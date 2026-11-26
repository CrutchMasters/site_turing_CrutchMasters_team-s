"""Турніри: реєстрація команд, редагування, банер, видалення, створення раундів."""

from fastapi import APIRouter, File, HTTPException, Header, UploadFile

from src.db import fetch_one, supabase
from src.schemas import RegisterTeamForTournament, TournamentUpdate
from src.security import get_caller
from src.services.emails import get_user_email, send_notification_email
from src.services.scoring import ScoringError, validate_round_criteria
from src.services.statuses import recalc_round_status, recalc_tournament_status, validate_tournament_timeline


router = APIRouter()


@router.post("/api/tournaments/register")
async def register_team_for_tournament(payload: RegisterTeamForTournament, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, status, max_teams")
            .eq("id", payload.tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if tournament["status"] != "registration":
        raise HTTPException(status_code=400, detail=f"Реєстрація на турнір закрита (статус: {tournament['status']})")

    if caller.get("role") == "jury":
        raise HTTPException(status_code=403, detail="Журі не може реєструвати команди на турнір")

    team = fetch_one(
        supabase.table("teams")
            .select("id, name, captain_id, tournament_id, members_ids")
            .eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Тільки капітан команди може реєструвати її на турнір")
    if team["tournament_id"]:
        raise HTTPException(status_code=400, detail="Команда вже зареєстрована в іншому турнірі")

    if tournament["max_teams"]:
        try:
            rpc_res = supabase.rpc(
                "register_team_atomic",
                {
                    "p_team_id":       payload.team_id,
                    "p_tournament_id": payload.tournament_id,
                    "p_max_teams":     tournament["max_teams"],
                },
            ).execute()
            if rpc_res.data is False:
                raise HTTPException(status_code=400, detail="Турнір заповнений")
        except HTTPException:
            raise
        except Exception as e:
            print(f"[WARN] register_team_atomic RPC недоступна, fallback: {e}", flush=True)
            count_res = supabase.table("teams") \
                .select("id", count="exact") \
                .eq("tournament_id", payload.tournament_id) \
                .execute()
            if (count_res.count or 0) >= tournament["max_teams"]:
                raise HTTPException(status_code=400, detail="Турнір заповнений")

    result = supabase.table("teams") \
        .update({"tournament_id": payload.tournament_id}) \
        .eq("id", payload.team_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зареєструвати команду")

    print(f"[TOURNAMENT] Команда {team['name']} зареєстрована на турнір {tournament['name']}", flush=True)

    # Сповіщення всіх членів команди про реєстрацію
    _notif_title   = f"Команда «{team['name']}» зареєстрована на турнір"
    _notif_message = (
        f"Капітан команди «{team['name']}» зареєстрував вас на турнір «{tournament['name']}». "
        f"Слідкуйте за оголошеннями та будьте готові!"
    )
    # Надсилаємо лише учасникам (не капітану — він сам реєстрував)
    _all_members = list(set(team.get("members_ids") or []))
    for _uid in _all_members:
        try:
            supabase.table("notifications").insert({
                "user_id": _uid,
                "type":    "tournament_registered",
                "title":   _notif_title,
                "message": _notif_message,
                "meta":    {"tournament_id": payload.tournament_id, "team_id": payload.team_id},
                "read":    False,
            }).execute()
            _email = get_user_email(_uid)
            if _email:
                send_notification_email(_email, _notif_title, _notif_message, "tournament_registered")
        except Exception as _e:
            print(f"[NOTIFY] register_tournament для {_uid}: {_e}", flush=True)

    return {"success": True, "team": result.data[0]}


@router.delete("/api/tournaments/unregister")
async def unregister_team_from_tournament(payload: RegisterTeamForTournament, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, status")
            .eq("id", payload.tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if tournament["status"] != "registration":
        raise HTTPException(status_code=400, detail="Скасувати реєстрацію можна лише поки відкрита реєстрація")

    team = fetch_one(
        supabase.table("teams")
            .select("id, name, captain_id, tournament_id, members_ids")
            .eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Тільки капітан може знімати команду з турніру")
    if team["tournament_id"] != payload.tournament_id:
        raise HTTPException(status_code=400, detail="Команда не зареєстрована в цьому турнірі")

    supabase.table("teams").update({"tournament_id": None}).eq("id", payload.team_id).execute()

    # Сповіщення всіх членів команди про знаття з турніру
    _notif_title   = f"Команда «{team['name']}» знята з турніру"
    _notif_message = (
        f"Капітан команди «{team['name']}» скасував реєстрацію на турнір «{tournament['name']}»."
    )
    # Надсилаємо лише учасникам (не капітану — він сам знімав)
    _all_members = list(set(team.get("members_ids") or []))
    for _uid in _all_members:
        try:
            supabase.table("notifications").insert({
                "user_id": _uid,
                "type":    "tournament_unregistered",
                "title":   _notif_title,
                "message": _notif_message,
                "meta":    {"tournament_id": payload.tournament_id, "team_id": payload.team_id},
                "read":    False,
            }).execute()
            _email = get_user_email(_uid)
            if _email:
                send_notification_email(_email, _notif_title, _notif_message, "tournament_unregistered")
        except Exception as _e:
            print(f"[NOTIFY] unregister_tournament для {_uid}: {_e}", flush=True)

    print(f"[TOURNAMENT] Команда {team['name']} знята з турніру {tournament['name']}", flush=True)
    return {"success": True}


@router.patch("/api/tournaments/{tournament_id}")
async def update_tournament(
    tournament_id: str,
    body: TournamentUpdate,
    authorization: str = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може редагувати турнір")

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, status, created_by, start_at, end_at, registration_from, registration_to")
            .eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if caller.get("role") not in ("admin", "superadmin") and tournament.get("created_by") != caller["id"]:
        raise HTTPException(status_code=403, detail="Ви не є власником цього турніру")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None and v != ""}
    if not update_data:
        raise HTTPException(status_code=400, detail="Немає полів для оновлення")

    # Валідація часової послідовності — мерджимо нові дати з поточними
    date_fields = {"start_at", "end_at", "registration_from", "registration_to"}
    if date_fields & set(update_data.keys()):
        timeline_err = validate_tournament_timeline(
            reg_from   = update_data.get("registration_from") or tournament.get("registration_from"),
            reg_to     = update_data.get("registration_to")   or tournament.get("registration_to"),
            tour_start = update_data.get("start_at")          or tournament.get("start_at"),
            tour_end   = update_data.get("end_at")            or tournament.get("end_at"),
        )
        if timeline_err:
            raise HTTPException(status_code=400, detail=timeline_err)

    result = (
        supabase.table("tournaments")
        .update(update_data)
        .eq("id", tournament_id)
        .execute()
    )

    # Якщо змінились дати — негайно перераховуємо статус турніру і всіх його раундів
    date_fields = {"start_at", "end_at", "registration_from", "registration_to"}
    if date_fields & set(update_data.keys()):
        recalc_tournament_status(tournament_id)
        rounds_res = supabase.table("rounds").select("id").eq("tournament_id", tournament_id).execute()
        for rr in (rounds_res.data or []):
            recalc_round_status(rr["id"])

    print(f"[TOURNAMENT] {caller['username']} оновив турнір {tournament_id}: {list(update_data.keys())}", flush=True)
    return {"success": True, "tournament": result.data[0] if result.data else None}


@router.post("/api/tournaments/{tournament_id}/banner")
async def upload_tournament_banner(
    tournament_id: str,
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може змінювати банер")

    tournament = fetch_one(
        supabase.table("tournaments").select("id").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    content_type  = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Непідтримуваний тип файлу: {content_type}. Дозволені: JPEG, PNG, WEBP, GIF",
        )

    ext_map = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
    ext  = ext_map.get(content_type, "jpg")
    path = f"{tournament_id}/banner.{ext}"

    try:
        file_bytes = await file.read()
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Файл занадто великий. Максимум 10 MB")

        supabase.storage.from_("tournament-banners").upload(
            path, file_bytes, {"content-type": content_type, "upsert": "true"},
        )

        url_data   = supabase.storage.from_("tournament-banners").get_public_url(path)
        public_url = url_data if isinstance(url_data, str) else url_data.get("publicUrl", "")

        import time as _time
        public_url_cache = f"{public_url}?t={int(_time.time())}"

        supabase.table("tournaments").update({"banner_url": public_url_cache}).eq("id", tournament_id).execute()

        print(f"[BANNER] Турнір {tournament_id}: банер завантажено → {public_url_cache}", flush=True)
        return {"banner_url": public_url_cache, "path": path}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[BANNER] Помилка завантаження банера для {tournament_id}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Помилка завантаження банера: {str(e)}")


@router.delete("/api/tournaments/{tournament_id}/banner")
async def delete_tournament_banner(
    tournament_id: str,
    authorization: str = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може видаляти банер")

    tournament = fetch_one(
        supabase.table("tournaments").select("id, banner_url").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    errors = []
    for ext in ("jpg", "png", "webp", "gif"):
        try:
            supabase.storage.from_("tournament-banners").remove([f"{tournament_id}/banner.{ext}"])
        except Exception as e:
            errors.append(str(e))

    try:
        supabase.table("tournaments").update({"banner_url": None}).eq("id", tournament_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка оновлення БД: {str(e)}")

    print(f"[BANNER] Турнір {tournament_id}: банер видалено", flush=True)
    return {"ok": True, "storage_errors": errors}


@router.delete("/api/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може видаляти турніри")

    tournament = fetch_one(
        supabase.table("tournaments").select("id, name, created_by").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    try:
        supabase.table("jury_tournament_invitations").delete().eq("tournament_id", tournament_id).execute()

        rounds = supabase.table("rounds").select("id").eq("tournament_id", tournament_id).execute()
        round_ids = [r["id"] for r in (rounds.data or [])]
        if round_ids:
            supabase.table("jury_assignments").delete().in_("round_id", round_ids).execute()
            supabase.table("jury_evaluations").delete().in_("round_id", round_ids).execute()
            supabase.table("submissions").delete().in_("round_id", round_ids).execute()
            supabase.table("rounds").delete().in_("id", round_ids).execute()

        supabase.table("teams").update({"tournament_id": None}).eq("tournament_id", tournament_id).execute()
        supabase.table("tournaments").delete().eq("id", tournament_id).execute()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка при видаленні турніру: {str(e)}")

    print(f"[TOURNAMENT] Турнір '{tournament['name']}' видалено адміном {caller.get('id')}", flush=True)
    return {"success": True}


@router.post("/api/tournaments/{tournament_id}/rounds")
async def create_tournament_rounds(
    tournament_id: str,
    body: dict,
    authorization: str = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може додавати раунди")

    rounds = body.get("rounds")
    if not rounds or not isinstance(rounds, list):
        raise HTTPException(status_code=400, detail="Потрібен список rounds")
    if len(rounds) > 8:
        raise HTTPException(status_code=400, detail="Максимальна кількість раундів — 8 (rounds_number_check)")

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, created_by, start_at, end_at, registration_from, registration_to")
            .eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if caller.get("role") not in ("admin", "superadmin") and tournament.get("created_by") != caller["id"]:
        raise HTTPException(status_code=403, detail="Ви не є власником цього турніру")

    # Критерії мають бути списком {key, label, weight} із сумою ваг 100
    for r in rounds:
        try:
            validate_round_criteria(r.get("criteria"))
        except ScoringError as e:
            raise HTTPException(status_code=400, detail=f"Раунд {r.get('number')}: {e}")

    # Валідація часової послідовності раундів
    rounds_with_dates = [r for r in rounds if r.get("start_at") or r.get("end_at")]
    if rounds_with_dates:
        timeline_err = validate_tournament_timeline(
            reg_from   = tournament.get("registration_from"),
            reg_to     = tournament.get("registration_to"),
            tour_start = tournament.get("start_at"),
            tour_end   = tournament.get("end_at"),
            rounds     = rounds,
        )
        if timeline_err:
            raise HTTPException(status_code=400, detail=timeline_err)

    updated = []
    failed_numbers = []
    for r in rounds:
        num = r.get("number")
        if not num:
            continue
        update_data = {
            "name":              r.get("name"),
            "description":       r.get("description"),
            "criteria":          r.get("criteria"),
            "technologies":      r.get("technologies"),
            "start_at":          r.get("start_at"),
            "end_at":            r.get("end_at"),
            "judging_deadline":  r.get("judging_deadline"),
            "links":             r.get("links"),
            "attachments":       r.get("attachments"),
            "template_path":     r.get("template_path"),
        }
        incoming_status = r.get("status", "pending")
        if incoming_status and incoming_status != "pending":
            update_data["status"] = incoming_status
        try:
            res = (
                supabase.table("rounds")
                    .update(update_data)
                    .eq("tournament_id", tournament_id)
                    .eq("number", num)
                    .execute()
            )
            if res.data:
                updated.extend(res.data)
            else:
                # Раунд з таким number не існує — створюємо
                insert_data = {**update_data, "tournament_id": tournament_id, "number": num}
                if "status" not in insert_data:
                    insert_data["status"] = "pending"
                ins_res = supabase.table("rounds").insert(insert_data).execute()
                if ins_res.data:
                    updated.extend(ins_res.data)
                    print(f"[ROUNDS] Створено новий раунд #{num} для турніру {tournament['name']}", flush=True)
                else:
                    failed_numbers.append(num)
        except Exception as round_err:
            print(f"[ROUNDS] Помилка оновлення/створення раунду #{num}: {round_err}", flush=True)
            failed_numbers.append(num)

    if failed_numbers:
        print(f"[ROUNDS] УВАГА: не вдалося оновити раунди #{failed_numbers} для турніру {tournament['name']}", flush=True)
        raise HTTPException(
            status_code=500,
            detail=f"Не вдалося зберегти раунди №{failed_numbers}. Турнір створено, але деякі раунди неповні. Спробуйте відредагувати турнір."
        )

    if updated:
        try:
            accepted_jury = supabase.table("jury_tournament_invitations") \
                .select("jury_id") \
                .eq("tournament_id", tournament_id) \
                .eq("status", "accepted") \
                .eq("scope", "tournament") \
                .execute()

            for jury_row in (accepted_jury.data or []):
                for round_row in updated:
                    exists = supabase.table("jury_assignments") \
                        .select("id") \
                        .eq("jury_id", jury_row["jury_id"]) \
                        .eq("round_id", round_row["id"]) \
                        .execute()
                    if not exists.data:
                        supabase.table("jury_assignments").insert({
                            "jury_id":       jury_row["jury_id"],
                            "round_id":      round_row["id"],
                            "tournament_id": tournament_id,
                        }).execute()
                        print(
                            f"[ROUNDS] jury_assignment створено: jury={jury_row['jury_id']} "
                            f"round={round_row['id']}",
                            flush=True
                        )
        except Exception as ja_err:
            print(f"[ROUNDS] Помилка створення jury_assignments: {ja_err}", flush=True)

    print(f"[ROUNDS] {len(updated)} раундів оновлено для турніру {tournament['name']}", flush=True)

    # Негайно перераховуємо статус кожного оновленого раунду
    for rr in updated:
        recalc_round_status(rr["id"])
    # І статус самого турніру
    recalc_tournament_status(tournament_id)

    return {"success": True, "rounds": updated}
