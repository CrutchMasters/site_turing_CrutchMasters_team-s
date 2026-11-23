"""Керування раундами: статус, перерозподіл робіт, матриця розподілу, ручне призначення."""

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.schemas import ManualAssignPayload, PartialRedistributePayload, RoundStatusUpdate
from src.security import get_caller


router = APIRouter()


@router.patch("/api/rounds/{round_id}/status")
async def set_round_status(round_id: str, body: RoundStatusUpdate, authorization: str = Header(...)):
    """
    Ручна зміна статусу раунду адміністратором.
    Дозволені переходи:
      judging → judged   (закрити оцінювання)
      judged  → judging  (відкрити оцінювання знову)
    Перехід active/pending контролюється планувальником автоматично.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    if not caller or caller.get("role") not in ("superadmin", "admin"):
        raise HTTPException(status_code=403, detail="Доступ заборонено: тільки адміністратори")

    allowed_statuses = ("judging", "judged", "active", "pending")
    new_status = body.status
    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Недозволений статус '{new_status}'. Дозволені: {', '.join(allowed_statuses)}"
        )

    round_ = fetch_one(
        supabase.table("rounds").select("id, status, tournament_id").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    old_status = round_.get("status")
    supabase.table("rounds").update({"status": new_status}).eq("id", round_id).execute()
    print(f"[ADMIN] Раунд {round_id}: {old_status} → {new_status} (адмін {caller.get('id')})", flush=True)
    return {"round_id": round_id, "old_status": old_status, "status": new_status}


@router.post("/api/rounds/{round_id}/redistribute")
async def redistribute_submissions(round_id: str, authorization: str = Header(...)):
    """
    Рівномірно перерозподілити submissions між журі цього раунду.
    Тільки admin або superadmin.
    Використовує load-balanced алгоритм — кожна робота призначається K журі
    з найменшим поточним навантаженням (замість простого round-robin).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може перерозподіляти роботи")

    # 1. Отримуємо раунд
    round_ = fetch_one(
        supabase.table("rounds").select("id, tournament_id, status").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    tournament_id = round_["tournament_id"]

    # 2. Налаштування K
    tour_res = supabase.table("tournaments") \
        .select("jury_per_submission") \
        .eq("id", tournament_id) \
        .execute()
    tour_data = (tour_res.data or [{}])[0]
    k_setting = tour_data.get("jury_per_submission") or 1

    # 3. Прийняті журі турніру
    jury_res = supabase.table("jury_tournament_invitations") \
        .select("jury_id") \
        .eq("tournament_id", tournament_id) \
        .eq("status", "accepted") \
        .execute()
    jury_ids = [r["jury_id"] for r in (jury_res.data or [])]

    if not jury_ids:
        raise HTTPException(status_code=400, detail="Немає запрошених журі для цього турніру")

    k = min(k_setting, len(jury_ids))

    # 4. Фінальні submissions раунду
    import random
    subs_res = supabase.table("submissions") \
        .select("id") \
        .eq("round_id", round_id) \
        .eq("is_draft", False) \
        .execute()
    sub_ids = [s["id"] for s in (subs_res.data or [])]
    random.shuffle(sub_ids)

    if not sub_ids:
        raise HTTPException(status_code=400, detail="Немає поданих робіт для розподілу")

    # 5. Очищуємо старі призначення для цього раунду
    try:
        supabase.table("jury_submission_assignments") \
            .delete() \
            .eq("round_id", round_id) \
            .execute()
    except Exception as e:
        print(f"[REDISTRIBUTE] Не вдалося очистити jury_submission_assignments: {e}", flush=True)

    # 6. Load-balanced розподіл — кожна робота отримує K журі
    #    з найменшим поточним навантаженням.
    random.shuffle(jury_ids)  # tie-breaking
    load: dict[str, int] = {jid: 0 for jid in jury_ids}

    unique_assignments: list[dict] = []
    seen: set[tuple] = set()

    for sub_id in sub_ids:
        # Для кожної роботи вибираємо K журі з найменшим навантаженням
        sorted_jury = sorted(jury_ids, key=lambda jid: load[jid])
        chosen = sorted_jury[:k]
        for jid in chosen:
            pair = (jid, sub_id)
            if pair not in seen:
                seen.add(pair)
                unique_assignments.append({
                    "jury_id":       jid,
                    "submission_id": sub_id,
                    "round_id":      round_id,
                    "tournament_id": tournament_id,
                })
                load[jid] = load[jid] + 1

    try:
        batch_size = 100
        for i in range(0, len(unique_assignments), batch_size):
            supabase.table("jury_submission_assignments").insert(unique_assignments[i:i+batch_size]).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка при збереженні розподілу: {e}")

    print(
        f"[REDISTRIBUTE] {caller['username']} перерозподілив {len(sub_ids)} робіт між "
        f"{len(jury_ids)} журі (K={k}) для раунду {round_id}",
        flush=True
    )
    return {
        "success":             True,
        "submissions":         len(sub_ids),
        "jury_count":          len(jury_ids),
        "assignments":         len(unique_assignments),
        "jury_per_submission": k,
    }


@router.post("/api/rounds/{round_id}/partial_redistribute")
async def partial_redistribute_submissions(
    round_id: str,
    payload: PartialRedistributePayload,
    authorization: str = Header(...),
):
    """
    Дорозподілити тільки "недоукомплектовані" роботи раунду.

    Алгоритм:
    1. Приймаємо locked_assignments — призначення, які адмін залишив вручну.
    2. Очищаємо всі поточні призначення раунду в БД.
    3. Записуємо locked_assignments назад.
    4. Для кожної роботи, у якої locked < K, добираємо ще (K - locked) журі
       з найменшим поточним навантаженням (load-balanced), не дублюючи вже обраних.
    5. Повертаємо статистику.
    """
    import random

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може перерозподіляти роботи")

    # 1. Отримуємо раунд
    round_ = fetch_one(
        supabase.table("rounds").select("id, tournament_id, status").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    tournament_id = round_["tournament_id"]

    # 2. Налаштування K
    tour_res = supabase.table("tournaments") \
        .select("jury_per_submission") \
        .eq("id", tournament_id) \
        .execute()
    tour_data = (tour_res.data or [{}])[0]
    k_setting = tour_data.get("jury_per_submission") or 1

    # 3. Прийняті журі турніру
    jury_res = supabase.table("jury_tournament_invitations") \
        .select("jury_id") \
        .eq("tournament_id", tournament_id) \
        .eq("status", "accepted") \
        .execute()
    jury_ids = [r["jury_id"] for r in (jury_res.data or [])]

    if not jury_ids:
        raise HTTPException(status_code=400, detail="Немає прийнятих журі для цього турніру")

    k = min(k_setting, len(jury_ids))

    # 4. Всі фінальні submissions раунду
    subs_res = supabase.table("submissions") \
        .select("id") \
        .eq("round_id", round_id) \
        .eq("is_draft", False) \
        .execute()
    all_sub_ids = [s["id"] for s in (subs_res.data or [])]

    if not all_sub_ids:
        raise HTTPException(status_code=400, detail="Немає поданих робіт для розподілу")

    # 5. Валідуємо locked_assignments — залишаємо тільки ті, що стосуються цього раунду
    valid_jury_set = set(jury_ids)
    valid_sub_set  = set(all_sub_ids)

    locked: list[dict] = []
    seen_locked: set[tuple] = set()
    for a in payload.locked_assignments:
        jid = a.get("jury_id", "")
        sid = a.get("submission_id", "")
        if jid in valid_jury_set and sid in valid_sub_set:
            pair = (jid, sid)
            if pair not in seen_locked:
                seen_locked.add(pair)
                locked.append({
                    "jury_id":       jid,
                    "submission_id": sid,
                    "round_id":      round_id,
                    "tournament_id": tournament_id,
                })

    # locked_per_sub: скільки журі вже зафіксовано для кожної роботи
    locked_per_sub: dict[str, set] = {sid: set() for sid in all_sub_ids}
    for a in locked:
        locked_per_sub[a["submission_id"]].add(a["jury_id"])

    # 6. Очищаємо всі старі призначення раунду
    try:
        supabase.table("jury_submission_assignments") \
            .delete() \
            .eq("round_id", round_id) \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка очищення призначень: {e}")

    # 7. Записуємо locked назад
    if locked:
        try:
            batch_size = 100
            for i in range(0, len(locked), batch_size):
                supabase.table("jury_submission_assignments").insert(locked[i:i+batch_size]).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Помилка збереження зафіксованих призначень: {e}")

    # 8. Load-balanced дорозподіл для "недоукомплектованих" робіт
    #    Починаємо з навантаження = кількість locked призначень кожного журі
    random.shuffle(jury_ids)  # tie-breaking
    load: dict[str, int] = {jid: 0 for jid in jury_ids}
    for a in locked:
        jid = a["jury_id"]
        if jid in load:
            load[jid] += 1

    new_assignments: list[dict] = []
    sub_ids_to_fill = [sid for sid in all_sub_ids if len(locked_per_sub[sid]) < k]
    random.shuffle(sub_ids_to_fill)

    for sub_id in sub_ids_to_fill:
        already_assigned = locked_per_sub[sub_id]
        need = k - len(already_assigned)
        if need <= 0:
            continue

        # Кандидати — журі, що ще не призначені до цієї роботи
        candidates = [jid for jid in jury_ids if jid not in already_assigned]
        if not candidates:
            continue

        # Сортуємо за навантаженням (менше — краще), tie-breaking вже є через shuffle вище
        candidates.sort(key=lambda jid: load[jid])
        chosen = candidates[:need]

        for jid in chosen:
            new_assignments.append({
                "jury_id":       jid,
                "submission_id": sub_id,
                "round_id":      round_id,
                "tournament_id": tournament_id,
            })
            load[jid] += 1
            locked_per_sub[sub_id].add(jid)

    if new_assignments:
        try:
            batch_size = 100
            for i in range(0, len(new_assignments), batch_size):
                supabase.table("jury_submission_assignments").insert(new_assignments[i:i+batch_size]).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Помилка збереження нових призначень: {e}")

    still_under = sum(
        1 for sid in all_sub_ids if len(locked_per_sub[sid]) < k
    )

    print(
        f"[PARTIAL_REDISTRIBUTE] {caller['username']} дорозподілив {len(sub_ids_to_fill)} робіт "
        f"(зафіксовано: {len(locked)}, нових: {len(new_assignments)}, K={k}) "
        f"для раунду {round_id}",
        flush=True,
    )

    return {
        "success":              True,
        "submissions_total":    len(all_sub_ids),
        "submissions_filled":   len(sub_ids_to_fill),
        "locked_assignments":   len(locked),
        "new_assignments":      len(new_assignments),
        "jury_per_submission":  k,
        "still_under_k":        still_under,
    }


@router.get("/api/rounds/{round_id}/distribution")
async def get_distribution(round_id: str, authorization: str | None = Header(None)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    token  = authorization.replace("Bearer ", "").strip()
    try:
        caller = get_caller(token)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[distribution] auth error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може переглядати розподіл")

    try:
        round_ = fetch_one(
            supabase.table("rounds").select("id, tournament_id").eq("id", round_id)
        )
    except Exception as e:
        print(f"[distribution] rounds query error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"DB error (rounds): {str(e)}")
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    tournament_id = round_["tournament_id"]

    tour_res = supabase.table("tournaments") \
        .select("jury_per_submission") \
        .eq("id", tournament_id) \
        .execute()
    jury_per_submission = ((tour_res.data or [{}])[0].get("jury_per_submission") or 1)

    jury_inv = supabase.table("jury_tournament_invitations") \
        .select("jury_id") \
        .eq("tournament_id", tournament_id) \
        .eq("status", "accepted") \
        .execute()
    jury_ids = [r["jury_id"] for r in (jury_inv.data or [])]

    jury_list = []
    if jury_ids:
        jury_res = supabase.table("account") \
            .select("id, username, login, avatar_url") \
            .in_("id", jury_ids) \
            .execute()
        jury_list = jury_res.data or []

    subs_res = supabase.table("submissions") \
        .select("id, team_id, submitted_at") \
        .eq("round_id", round_id) \
        .eq("is_draft", False) \
        .execute()
    sub_rows = subs_res.data or []

    team_ids = list({s["team_id"] for s in sub_rows if s.get("team_id")})
    teams_map: dict = {}
    if team_ids:
        teams_res = supabase.table("teams") \
            .select("id, name") \
            .in_("id", team_ids) \
            .execute()
        teams_map = {t["id"]: t for t in (teams_res.data or [])}

    submissions = [
        {
            "id":           s["id"],
            "team_name":    teams_map.get(s["team_id"], {}).get("name", "—"),
            "submitted_at": s.get("submitted_at"),
        }
        for s in sub_rows
    ]

    assign_res = supabase.table("jury_submission_assignments") \
        .select("jury_id, submission_id") \
        .eq("round_id", round_id) \
        .execute()
    assignments = [
        {"jury_id": a["jury_id"], "submission_id": a["submission_id"]}
        for a in (assign_res.data or [])
    ]

    return {
        "jury":                jury_list,
        "submissions":         submissions,
        "assignments":         assignments,
        "jury_per_submission": jury_per_submission,
    }


@router.post("/api/rounds/{round_id}/assign")
async def manual_assign(round_id: str, payload: ManualAssignPayload, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може змінювати розподіл")

    if payload.action not in ("add", "remove"):
        raise HTTPException(status_code=400, detail="action має бути 'add' або 'remove'")

    round_ = fetch_one(
        supabase.table("rounds").select("id, tournament_id").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    tournament_id = round_["tournament_id"]

    if payload.action == "add":
        existing = supabase.table("jury_submission_assignments") \
            .select("id") \
            .eq("jury_id",       payload.jury_id) \
            .eq("submission_id", payload.submission_id) \
            .eq("round_id",      round_id) \
            .execute()
        if not (existing.data or []):
            supabase.table("jury_submission_assignments").insert({
                "jury_id":       payload.jury_id,
                "submission_id": payload.submission_id,
                "round_id":      round_id,
                "tournament_id": tournament_id,
            }).execute()
        return {"success": True, "action": "added"}

    else:
        supabase.table("jury_submission_assignments") \
            .delete() \
            .eq("jury_id",       payload.jury_id) \
            .eq("submission_id", payload.submission_id) \
            .eq("round_id",      round_id) \
            .execute()
        return {"success": True, "action": "removed"}
