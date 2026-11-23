"""Фонові задачі: автооновлення статусів та нагадування про дедлайни."""

from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from src.db import fetch_one, supabase
from src.services.emails import get_user_email, send_notification_email
from src.utils import parse_dt


def update_tournament_statuses():
    if not supabase:
        return
    try:
        now = datetime.now(timezone.utc)

        res = supabase.table("tournaments").select(
            "id, status, registration_from, registration_to, start_at, end_at"
        ).execute()
        tournaments = res.data or []

        for t in tournaments:
            current = t["status"]
            # НЕ пропускаємо finished/ongoing — адмін міг змінити дати,
            # тому статус повинен перераховуватися завжди.
            # Єдиний виняток — статус "cancelled" (ручне скасування).
            if current == "cancelled":
                continue

            reg_from  = parse_dt(t.get("registration_from"))
            reg_to    = parse_dt(t.get("registration_to"))
            start_at  = parse_dt(t.get("start_at"))
            end_at    = parse_dt(t.get("end_at"))

            new_status = current

            if end_at and now >= end_at:
                new_status = "finished"
            elif current == "ongoing" and not end_at:
                try:
                    rounds_res = supabase.table("rounds").select("status").eq("tournament_id", t["id"]).execute()
                    rounds = rounds_res.data or []
                    if rounds and all(r.get("status") == "judged" for r in rounds):
                        new_status = "finished"
                except Exception:
                    pass
            elif start_at and now >= start_at:
                new_status = "ongoing"
            elif reg_from and now >= reg_from and (not reg_to or now < reg_to):
                new_status = "registration"
            elif reg_to and now >= reg_to and (not start_at or now < start_at):
                new_status = "upcoming"
            else:
                new_status = "upcoming"

            if new_status != current:
                try:
                    supabase.table("tournaments").update({"status": new_status}).eq("id", t["id"]).execute()
                    print(f"[SCHEDULER] Турнір {t['id']}: {current} → {new_status}", flush=True)

                    # Сповіщення про старт турніру (upcoming/registration → ongoing)
                    if new_status == "ongoing":
                        _notify_tournament_start(t["id"], t.get("name", "Турнір"))

                except Exception as upd_err:
                    print(f"[SCHEDULER] Не вдалося оновити {t['id']} ({current} → {new_status}): {upd_err}", flush=True)

    except Exception as e:
        print(f"[SCHEDULER] Помилка оновлення статусів: {e}", flush=True)


def _notify_tournament_start(tournament_id: str, tournament_name: str):
    """Надсилає email усім учасникам команд турніру про його старт."""
    if not supabase:
        return
    try:
        teams_res = supabase.table("teams") \
            .select("id, name, captain_id, members_ids") \
            .eq("tournament_id", tournament_id) \
            .execute()
        teams = teams_res.data or []

        notified = set()
        title   = f"Турнір «{tournament_name}» розпочався!"
        message = f"Турнір «{tournament_name}» офіційно стартував. Бажаємо вашій команді успіху!"

        for team in teams:
            all_members = list({team["captain_id"]} | set(team.get("members_ids") or []))
            for uid in all_members:
                if uid in notified:
                    continue
                notified.add(uid)
                try:
                    supabase.table("notifications").insert({
                        "user_id": uid,
                        "type":    "tournament_start",
                        "title":   title,
                        "message": message,
                        "meta":    {"tournament_id": tournament_id, "tournament_name": tournament_name},
                        "read":    False,
                    }).execute()
                    email = get_user_email(uid)
                    if email:
                        send_notification_email(email, title, message, "tournament_start")
                except Exception as e:
                    print(f"[NOTIFY] Помилка старт-сповіщення для {uid}: {e}", flush=True)

        print(f"[NOTIFY] Старт турніру {tournament_id}: сповіщено {len(notified)} учасників", flush=True)
    except Exception as e:
        print(f"[NOTIFY] _notify_tournament_start помилка: {e}", flush=True)


def _notify_deadline_24h():
    """Надсилає email учасникам команд, у яких через < 24 год дедлайн здачі раунду.
    Відправляє лише одного разу (перевіряє notifications з type='deadline_24h')."""
    if not supabase:
        return
    try:
        now    = datetime.now(timezone.utc)
        in_24h = datetime.fromtimestamp(now.timestamp() + 86400, tz=timezone.utc)

        rounds_res = supabase.table("rounds") \
            .select("id, name, number, end_at, tournament_id") \
            .eq("status", "active") \
            .execute()
        rounds = rounds_res.data or []

        for r in rounds:
            end_at = parse_dt(r.get("end_at"))
            if not end_at:
                continue
            if not (now < end_at <= in_24h):
                continue

            # Отримуємо назву турніру
            tour = fetch_one(supabase.table("tournaments").select("name").eq("id", r["tournament_id"]))
            tour_name = tour["name"] if tour else "Турнір"
            round_label = f"Раунд {r.get('number', r.get('name', ''))}"

            teams_res = supabase.table("teams") \
                .select("id, name, captain_id, members_ids") \
                .eq("tournament_id", r["tournament_id"]) \
                .execute()
            teams = teams_res.data or []

            title   = f"До дедлайну {round_label} залишилось менше 24 годин"
            message = (
                f"Нагадуємо: дедлайн здачі роботи в «{tour_name}» — {round_label} "
                f"настане {end_at.strftime('%d.%m.%Y о %H:%M')} UTC. "
                f"Не забудьте завантажити роботу вчасно!"
            )

            for team in teams:
                all_members = list({team["captain_id"]} | set(team.get("members_ids") or []))
                for uid in all_members:
                    # Перевіряємо чи вже надсилали для цього раунду
                    try:
                        already = supabase.table("notifications") \
                            .select("id") \
                            .eq("user_id", uid) \
                            .eq("type", "deadline_24h") \
                            .execute()
                        meta_check = [
                            n for n in (already.data or [])
                            if (n.get("meta") or {}).get("round_id") == r["id"]
                        ]
                        if meta_check:
                            continue

                        supabase.table("notifications").insert({
                            "user_id": uid,
                            "type":    "deadline_24h",
                            "title":   title,
                            "message": message,
                            "meta":    {
                                "tournament_id":   r["tournament_id"],
                                "tournament_name": tour_name,
                                "round_id":        r["id"],
                            },
                            "read": False,
                        }).execute()

                        email = get_user_email(uid)
                        if email:
                            send_notification_email(email, title, message, "deadline_24h")
                    except Exception as e:
                        print(f"[NOTIFY] Помилка deadline_24h для {uid}: {e}", flush=True)

        print(f"[NOTIFY] deadline_24h перевірку завершено", flush=True)
    except Exception as e:
        print(f"[NOTIFY] _notify_deadline_24h помилка: {e}", flush=True)


def update_round_statuses():
    if not supabase:
        return
    try:
        now = datetime.now(timezone.utc)

        res = supabase.table("rounds").select(
            "id, status, start_at, end_at, judging_deadline"
        ).execute()
        rounds = res.data or []

        for r in rounds:
            current  = r.get("status") or "pending"
            start_at = parse_dt(r.get("start_at"))
            end_at   = parse_dt(r.get("end_at"))
            judging_deadline = parse_dt(r.get("judging_deadline"))

            # judged — фінальний стан, не чіпаємо
            if current == "judged":
                continue

            # Автозакриття оцінювання: judging → judged якщо judging_deadline минув
            if current == "judging" and judging_deadline and now >= judging_deadline:
                try:
                    supabase.table("rounds").update({"status": "judged"}).eq("id", r["id"]).execute()
                    print(f"[SCHEDULER] Раунд {r['id']}: judging → judged (judging_deadline минув)", flush=True)
                except Exception as upd_err:
                    print(f"[SCHEDULER] Не вдалося закрити оцінювання раунду {r['id']}: {upd_err}", flush=True)
                continue

            # judging — ручний статус, не перезаписуємо (якщо deadline ще не минув)
            if current == "judging":
                continue

            if start_at and now >= start_at and (not end_at or now < end_at):
                new_status = "active"
            elif end_at and now >= end_at:
                new_status = "judging"
            else:
                new_status = "pending"

            if new_status != current:
                try:
                    supabase.table("rounds").update({"status": new_status}).eq("id", r["id"]).execute()
                    print(f"[SCHEDULER] Раунд {r['id']}: {current} → {new_status}", flush=True)
                except Exception as upd_err:
                    print(f"[SCHEDULER] Не вдалося оновити раунд {r['id']}: {upd_err}", flush=True)

    except Exception as e:
        print(f"[SCHEDULER] Помилка оновлення статусів раундів: {e}", flush=True)


scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_job(update_tournament_statuses, "interval", seconds=15, id="tournament_status_updater")
scheduler.add_job(update_round_statuses,      "interval", seconds=15, id="round_status_updater")
scheduler.add_job(_notify_deadline_24h,       "interval", minutes=30, id="deadline_24h_notifier")


def start_scheduler():
    scheduler.start()
    update_tournament_statuses()
    update_round_statuses()
    print("[SCHEDULER] Запущено оновлення статусів турнірів та раундів (кожні 15 сек)", flush=True)


def stop_scheduler():
    scheduler.shutdown(wait=False)
