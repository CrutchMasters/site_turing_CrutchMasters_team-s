"""Автоматичний розподіл робіт між журі раунду."""

import random

from src.db import supabase


def pick_least_loaded(candidates, load: dict, count: int, rng=random) -> list:
    """Обирає `count` кандидатів з найменшим навантаженням.

    Кандидати перемішуються при КОЖНОМУ виклику, потім працює стабільне сортування за
    навантаженням: нічиї розв'язуються випадково для кожної роботи окремо. Якщо
    перемішати суддів один раз на весь раунд, при кількості суддів, кратній K, вони
    діляться на незмінні панелі, що ніколи не оцінюють спільних робіт, і оцінки різних
    панелей неможливо порівняти (див. research/README.md).
    """
    pool = list(candidates)
    rng.shuffle(pool)
    pool.sort(key=lambda jid: load[jid])
    return pool[:count]


def auto_assign_submission(submission_id: str, round_id: str, tournament_id: str) -> int:
    """
    Призначає submission K журі, що мають найменше навантаження в цьому раунді.
    K береться з tournaments.jury_per_submission (default 1).
    Повертає кількість створених записів.

    Алгоритм:
    1. Отримуємо всіх прийнятих журі турніру.
    2. Рахуємо скільки робіт вже призначено кожному в цьому раунді.
    3. Вибираємо K журі з мінімальним навантаженням (з рандомним tie-breaking).
    4. Записуємо в jury_submission_assignments — пропускаємо дублікати.
    """
    if not supabase:
        return 0

    try:
        # Налаштування K
        tour_res = supabase.table("tournaments") \
            .select("jury_per_submission") \
            .eq("id", tournament_id) \
            .execute()
        k = (((tour_res.data or [{}])[0]).get("jury_per_submission") or 1)

        # Прийняті журі турніру
        jury_res = supabase.table("jury_tournament_invitations") \
            .select("jury_id") \
            .eq("tournament_id", tournament_id) \
            .eq("status", "accepted") \
            .execute()
        jury_ids = [r["jury_id"] for r in (jury_res.data or [])]

        if not jury_ids:
            return 0

        k = min(k, len(jury_ids))

        # Поточне навантаження кожного журі в раунді
        load_res = supabase.table("jury_submission_assignments") \
            .select("jury_id") \
            .eq("round_id", round_id) \
            .execute()
        load: dict[str, int] = {jid: 0 for jid in jury_ids}
        for row in (load_res.data or []):
            jid = row["jury_id"]
            if jid in load:
                load[jid] = load[jid] + 1

        # Вже призначені для цього submission
        existing_res = supabase.table("jury_submission_assignments") \
            .select("jury_id") \
            .eq("submission_id", submission_id) \
            .execute()
        already = {r["jury_id"] for r in (existing_res.data or [])}

        # Відбираємо кандидатів (не призначених до цього submission)
        candidates = [jid for jid in jury_ids if jid not in already]
        if not candidates:
            return 0

        # Найменш завантажені журі; нічиї розв'язуються випадково
        chosen = pick_least_loaded(candidates, load, k)

        # Вставляємо
        rows = [
            {
                "jury_id":       jid,
                "submission_id": submission_id,
                "round_id":      round_id,
                "tournament_id": tournament_id,
            }
            for jid in chosen
        ]
        if rows:
            supabase.table("jury_submission_assignments").insert(rows).execute()

        print(
            f"[AUTO-ASSIGN] submission={submission_id} → {len(rows)} журі призначено "
            f"(K={k}, round={round_id})",
            flush=True,
        )
        return len(rows)

    except Exception as e:
        print(f"[AUTO-ASSIGN] Помилка: {e}", flush=True)
        return 0
