"""Перерахунок статусів турнірів/раундів та валідація таймлайну турніру."""

from datetime import datetime, timezone

from src.db import fetch_one, supabase
from src.utils import parse_dt


def recalc_round_status(round_id: str) -> str | None:
    """
    Негайно перераховує та зберігає статус одного раунду на основі поточного часу.
    Повертає новий статус або None якщо помилка.
    """
    if not supabase:
        return None
    try:
        r = fetch_one(
            supabase.table("rounds")
                .select("id, status, start_at, end_at, judging_deadline")
                .eq("id", round_id)
        )
        if not r:
            return None
        current  = r.get("status") or "pending"
        now      = datetime.now(timezone.utc)
        start_at = parse_dt(r.get("start_at"))
        end_at   = parse_dt(r.get("end_at"))
        judging_deadline = parse_dt(r.get("judging_deadline"))

        if current == "judged":
            return current  # фінальний стан

        # Автозакриття оцінювання
        if current == "judging" and judging_deadline and now >= judging_deadline:
            supabase.table("rounds").update({"status": "judged"}).eq("id", round_id).execute()
            print(f"[RECALC] Раунд {round_id}: judging → judged (judging_deadline минув)", flush=True)
            return "judged"

        if current == "judging":
            return current  # ручний статус, не чіпаємо
        if start_at and now >= start_at and (not end_at or now < end_at):
            new_status = "active"
        elif end_at and now >= end_at:
            # Час вийшов — переходимо в judging (чекає ручного підтвердження адміном)
            new_status = "judging"
        else:
            new_status = "pending"
        if new_status != current:
            supabase.table("rounds").update({"status": new_status}).eq("id", round_id).execute()
            print(f"[RECALC] Раунд {round_id}: {current} → {new_status}", flush=True)
        return new_status
    except Exception as e:
        print(f"[RECALC] Помилка перерахунку раунду {round_id}: {e}", flush=True)
        return None


def recalc_tournament_status(tournament_id: str) -> str | None:
    """
    Негайно перераховує та зберігає статус турніру на основі поточного часу.
    Повертає новий статус або None якщо помилка.
    """
    if not supabase:
        return None
    try:
        t = fetch_one(
            supabase.table("tournaments")
                .select("id, status, registration_from, registration_to, start_at, end_at")
                .eq("id", tournament_id)
        )
        if not t:
            return None
        current = t["status"]
        if current == "cancelled":
            return current
        now      = datetime.now(timezone.utc)
        reg_from = parse_dt(t.get("registration_from"))
        reg_to   = parse_dt(t.get("registration_to"))
        start_at = parse_dt(t.get("start_at"))
        end_at   = parse_dt(t.get("end_at"))
        if end_at and now >= end_at:
            new_status = "finished"
        elif start_at and now >= start_at:
            new_status = "ongoing"
        elif reg_from and now >= reg_from and (not reg_to or now < reg_to):
            new_status = "registration"
        elif reg_to and now >= reg_to and (not start_at or now < start_at):
            new_status = "upcoming"
        else:
            new_status = "upcoming"
        if new_status != current:
            supabase.table("tournaments").update({"status": new_status}).eq("id", tournament_id).execute()
            print(f"[RECALC] Турнір {tournament_id}: {current} → {new_status}", flush=True)
        return new_status
    except Exception as e:
        print(f"[RECALC] Помилка перерахунку турніру {tournament_id}: {e}", flush=True)
        return None


def validate_tournament_timeline(
    reg_from:   str | None,
    reg_to:     str | None,
    tour_start: str | None,
    tour_end:   str | None,
    rounds:     list[dict] | None = None,
) -> str | None:
    """
    Перевіряє часову послідовність турніру.
    Повертає рядок з описом помилки або None якщо все ок.
    Правила:
      1. Реєстрація повністю до початку турніру (reg_to <= tour_start).
      2. Раунди не виходять за межі турніру.
      3. Раунди йдуть послідовно без перекриттів (кінець N <= початок N+1).
    """
    def p(s: str | None) -> datetime | None:
        if not s:
            return None
        try:
            return parse_dt(s)
        except Exception:
            return None

    rf  = p(reg_from)
    rt  = p(reg_to)
    ts  = p(tour_start)
    te  = p(tour_end)

    if rf and ts and rf >= ts:
        return "Реєстрація повинна починатися раніше за старт турніру."
    if rt and ts and rt > ts:
        return "Реєстрація повинна закінчуватися не пізніше старту турніру (вони не можуть перетинатися)."
    if rf and rt and rf >= rt:
        return "Початок реєстрації повинен бути раніше за кінець реєстрації."
    if ts and te and ts >= te:
        return "Початок турніру повинен бути раніше за кінець турніру."

    if rounds:
        try:
            sorted_rounds = sorted(
                [r for r in rounds if r.get("start_at") and r.get("end_at")],
                key=lambda r: r.get("number", 0)
            )
            for r in sorted_rounds:
                rs  = p(r.get("start_at"))
                re  = p(r.get("end_at"))
                n   = r.get("number", "?")
                if rs and re and rs >= re:
                    return f"Раунд {n}: початок повинен бути раніше за дедлайн здачі."
                if ts and rs and rs < ts:
                    return f"Раунд {n}: початок раунду не може бути раніше за старт турніру."
                if te and re and re > te:
                    return f"Раунд {n}: дедлайн здачі не може виходити за межі турніру."
            for r in sorted_rounds:
                rs  = p(r.get("start_at"))
                re  = p(r.get("end_at"))
                rjd = p(r.get("judging_deadline"))
                n   = r.get("number", "?")
                if rjd:
                    if re and rjd <= re:
                        return f"Раунд {n}: дедлайн оцінювання повинен бути пізніше за дедлайн здачі робіт."
                    if te and rjd > te:
                        return f"Раунд {n}: дедлайн оцінювання не може виходити за межі турніру."

            for i in range(len(sorted_rounds) - 1):
                cur       = sorted_rounds[i]
                nxt       = sorted_rounds[i + 1]
                cur_end   = p(cur.get("end_at"))
                cur_jd    = p(cur.get("judging_deadline"))
                nxt_start = p(nxt.get("start_at"))
                # Наступний раунд не може починатися раніше ніж закінчиться оцінювання поточного
                effective_cur_end = cur_jd if cur_jd else cur_end
                if effective_cur_end and nxt_start and effective_cur_end > nxt_start:
                    boundary = "дедлайн оцінювання" if cur_jd else "дедлайн здачі"
                    return (
                        f"Раунд {nxt.get('number','?')} починається до завершення "
                        f"раунду {cur.get('number','?')} ({boundary}). Раунди не можуть перекриватися."
                    )
        except Exception as e:
            print(f"[TIMELINE VALIDATION] Помилка: {e}", flush=True)

    return None
