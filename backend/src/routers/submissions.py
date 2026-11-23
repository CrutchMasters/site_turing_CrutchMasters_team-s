"""Подача робіт командами та перегляд сабмітів."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, Header, UploadFile

from src.db import fetch_one, supabase
from src.security import get_caller
from src.services.assignment import auto_assign_submission
from src.utils import parse_dt


router = APIRouter()


@router.post("/api/rounds/{round_id}/submit")
async def submit_work(
    round_id:      str,
    authorization: str              = Header(...),
    payload:       str              = Form(...),
    files:         list[UploadFile] = File([]),
):
    """
    Здати або оновити роботу команди для раунду.
    При фінальній здачі (is_draft=False) автоматично розподіляє
    K журі з найменшим навантаженням через auto_assign_submission.
    """
    import json as _json, re as _re, time as _time

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    try:
        data = _json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Невалідний payload JSON")

    github_url  = data.get("github_url") or None
    youtube_url = data.get("youtube_url") or None
    live_url    = data.get("live_url") or None
    description = data.get("description") or None
    is_draft    = bool(data.get("is_draft", False))
    team_id_req = data.get("team_id", "").strip()

    round_ = fetch_one(
        supabase.table("rounds")
            .select("id, tournament_id, end_at, status")
            .eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    round_status = round_.get("status")
    if not is_draft and round_status != "active":
        raise HTTPException(
            status_code=422,
            detail=f"Здача недоступна: раунд має статус '{round_status}'. Здача дозволена лише для активних раундів."
        )

    end_at = parse_dt(round_.get("end_at"))
    if not is_draft and end_at and datetime.now(timezone.utc) > end_at:
        raise HTTPException(status_code=422, detail="Дедлайн раунду минув, здача не приймається")

    tournament_id = round_.get("tournament_id")

    team = None
    if team_id_req:
        team = fetch_one(
            supabase.table("teams")
                .select("id, name, captain_id, members_ids, tournament_id")
                .eq("id", team_id_req)
        )

    if not team:
        try:
            cap_res = supabase.table("teams") \
                .select("id, name, captain_id, members_ids, tournament_id") \
                .eq("captain_id", caller["id"]) \
                .eq("tournament_id", tournament_id) \
                .limit(1).execute()
            if cap_res.data:
                team = cap_res.data[0]
        except Exception as e:
            print(f"[SUBMIT] Помилка пошуку команди (captain): {e}", flush=True)

    if not team:
        try:
            mem_res = supabase.table("teams") \
                .select("id, name, captain_id, members_ids, tournament_id") \
                .contains("members_ids", [caller["id"]]) \
                .eq("tournament_id", tournament_id) \
                .limit(1).execute()
            if mem_res.data:
                team = mem_res.data[0]
        except Exception as e:
            print(f"[SUBMIT] Помилка пошуку команди (member): {e}", flush=True)

    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено або ви не зареєстровані в цьому турнірі")

    is_captain = team["captain_id"] == caller["id"]
    if not is_captain:
        raise HTTPException(status_code=403, detail="Тільки капітан команди може здавати роботу")

    if team.get("tournament_id") != tournament_id:
        raise HTTPException(status_code=403, detail="Ваша команда не зареєстрована в цьому турнірі")

    team_id = team["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    new_file_entries: list[dict] = []
    for f in files:
        if not f.filename:
            continue
        safe_name = _re.sub(r"[^\w.\-]", "_", f.filename)
        path = f"submissions/{round_id}/{team_id}/{int(_time.time() * 1000)}-{safe_name}"
        content = await f.read()
        try:
            supabase.storage.from_("submissions").upload(
                path=path,
                file=content,
                file_options={
                    "content-type": f.content_type or "application/octet-stream",
                    "upsert": "true",
                },
            )
            new_file_entries.append({"name": f.filename, "path": path})
            print(f"[SUBMIT] Завантажено файл {safe_name} → {path}", flush=True)
        except Exception as upload_err:
            err_str = str(upload_err)
            print(f"[SUBMIT] Помилка завантаження {safe_name}: {err_str}", flush=True)
            if "not found" in err_str.lower() or "does not exist" in err_str.lower() or "NoSuchBucket" in err_str:
                try:
                    supabase.storage.create_bucket(
                        "submissions",
                        options={"public": False, "file_size_limit": 104857600},
                    )
                    print("[SUBMIT] Bucket 'submissions' створено автоматично, повторна спроба...", flush=True)
                    supabase.storage.from_("submissions").upload(
                        path=path,
                        file=content,
                        file_options={"content-type": f.content_type or "application/octet-stream", "upsert": "true"},
                    )
                    new_file_entries.append({"name": f.filename, "path": path})
                    print(f"[SUBMIT] Файл {safe_name} завантажено після створення bucket", flush=True)
                    continue
                except Exception as retry_err:
                    raise HTTPException(status_code=500, detail=f"Bucket 'submissions' не існує і не вдалося створити: {retry_err}")
            raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу '{f.filename}': {err_str}")

    existing = fetch_one(
        supabase.table("submissions")
            .select("id, file_paths, is_draft, status")
            .eq("round_id", round_id)
            .eq("team_id", team_id)
    )

    if existing and not existing.get("is_draft", True):
        locked_statuses = {"closed", "reviewed"}
        if existing.get("status") in locked_statuses or is_draft:
            raise HTTPException(
                status_code=409,
                detail="Роботу вже здано фінально. Зміни неможливі." if not is_draft
                       else "Неможливо зберегти чернетку: роботу вже здано фінально."
            )

    existing_files: list[dict] = []
    if existing:
        raw = existing.get("file_paths") or []
        if isinstance(raw, list):
            existing_files = raw

    merged_files = existing_files + new_file_entries

    record = {
        "round_id":      round_id,
        "team_id":       team_id,
        "submitted_by":  caller["id"],
        "github_url":    github_url,
        "youtube_url":   youtube_url,
        "live_url":      live_url,
        "description":   description,
        "file_paths":    merged_files,
        "is_draft":      is_draft,
        "updated_at":    now_iso,
    }

    if not is_draft:
        record["status"]       = "submitted"
        record["submitted_at"] = now_iso
    else:
        record["status"] = "draft"

    try:
        if existing:
            result = supabase.table("submissions").update(record).eq("id", existing["id"]).execute()
        else:
            result = supabase.table("submissions").insert(record).execute()
    except Exception as db_err:
        raise HTTPException(status_code=500, detail=f"Помилка збереження в БД: {db_err}")

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зберегти роботу")

    saved_sub = result.data[0]

    # ── Авто-розподіл при фінальній здачі ────────────────────────────────────
    # Призначаємо K журі одразу після submit (не чернетки).
    # Умова: перехід з чернетки → фінал, або нова фінальна здача (без попередньої).
    was_draft_before = existing.get("is_draft", True) if existing else True
    became_final = not is_draft and was_draft_before

    if became_final:
        try:
            assigned = auto_assign_submission(
                submission_id=saved_sub["id"],
                round_id=round_id,
                tournament_id=tournament_id,
            )
            saved_sub["_jury_assigned"] = assigned
        except Exception as ae:
            # Не зупиняємо відповідь — авто-розподіл є best-effort
            print(f"[SUBMIT] Авто-розподіл не вдався: {ae}", flush=True)

    action = "зберіг чернетку" if is_draft else "здав роботу"
    print(f"[SUBMIT] Команда {team['name']} {action} на раунд {round_id}", flush=True)
    return {"success": True, "submission": saved_sub}


@router.get("/api/rounds/{round_id}/submission")
async def get_submission(round_id: str, authorization: str = Header(...), team_id: str | None = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    is_privileged = caller.get("role") in ("admin", "superadmin", "jury")

    if not team_id:
        round_ = fetch_one(
            supabase.table("rounds").select("tournament_id").eq("id", round_id)
        )
        if not round_:
            raise HTTPException(status_code=404, detail="Раунд не знайдено")
        tournament_id = round_["tournament_id"]

        cap_res = supabase.table("teams") \
            .select("id") \
            .eq("captain_id", caller["id"]) \
            .eq("tournament_id", tournament_id) \
            .limit(1).execute()
        if cap_res.data:
            team_id = cap_res.data[0]["id"]
        else:
            mem_res = supabase.table("teams") \
                .select("id") \
                .contains("members_ids", json.dumps([caller["id"]])) \
                .eq("tournament_id", tournament_id) \
                .limit(1).execute()
            if mem_res.data:
                team_id = mem_res.data[0]["id"]

        if not team_id:
            return {"submission": None}

    if not is_privileged:
        team = fetch_one(
            supabase.table("teams")
                .select("captain_id, members_ids")
                .eq("id", team_id)
        )
        if not team:
            raise HTTPException(status_code=404, detail="Команду не знайдено")
        members = team.get("members_ids") or []
        if caller["id"] != team["captain_id"] and caller["id"] not in members:
            raise HTTPException(status_code=403, detail="Немає доступу до цієї роботи")

    sub = fetch_one(
        supabase.table("submissions")
            .select("*")
            .eq("round_id", round_id)
            .eq("team_id", team_id)
    )

    if sub:
        raw_files = sub.get("file_paths") or []
        enriched = []
        for f in raw_files:
            if isinstance(f, dict) and f.get("path"):
                try:
                    signed = supabase.storage.from_("submissions").create_signed_url(f["path"], 3600)
                    url = signed.get("signedURL") or signed.get("signedUrl")
                except Exception:
                    url = None
                enriched.append({"name": f.get("name", ""), "path": f["path"], "url": url})
        sub["files"] = enriched

    return {"submission": sub}


@router.get("/api/rounds/{round_id}/submissions")
async def get_round_submissions(round_id: str, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("jury", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Доступ тільки для журі та адміністраторів")

    round_ = fetch_one(
        supabase.table("rounds").select("id, tournament_id, status").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    if caller.get("role") == "jury":
        invited = fetch_one(
            supabase.table("jury_tournament_invitations")
                .select("id")
                .eq("tournament_id", round_["tournament_id"])
                .eq("jury_id", caller["id"])
                .eq("status", "accepted")
        )
        if not invited:
            raise HTTPException(status_code=403, detail="Ви не є журі цього турніру")

        # Журі може переглядати роботи тільки після завершення раунду;
        # суперадмін може переглядати завжди
        if caller.get("role") == "jury":
            round_status = round_.get("status")
            if round_status not in ("judging", "judged", "finished", "closed", "reviewed"):
                raise HTTPException(
                    status_code=403,
                    detail=f"Оцінювання недоступне: раунд ще не завершено (статус: '{round_status}')."
                )

        assignment = fetch_one(
            supabase.table("jury_assignments")
                .select("id")
                .eq("jury_id", caller["id"])
                .eq("round_id", round_id)
        )
        if not assignment:
            try:
                supabase.table("jury_assignments").insert({
                    "jury_id":       caller["id"],
                    "round_id":      round_id,
                    "tournament_id": round_["tournament_id"],
                }).execute()
                print(f"[SUBMISSIONS] Автоматично створено jury_assignment для {caller['username']}", flush=True)
            except Exception as ja_err:
                print(f"[SUBMISSIONS] Не вдалося створити jury_assignment: {ja_err}", flush=True)

    if caller.get("role") == "jury":
        assigned_res = supabase.table("jury_submission_assignments") \
            .select("submission_id") \
            .eq("round_id", round_id) \
            .eq("jury_id", caller["id"]) \
            .execute()
        assigned_sub_ids = [r["submission_id"] for r in (assigned_res.data or [])]

        if not assigned_sub_ids:
            subs_res = supabase.table("submissions") \
                .select("*") \
                .eq("round_id", round_id) \
                .eq("is_draft", False) \
                .execute()
        else:
            subs_res = supabase.table("submissions") \
                .select("*") \
                .in_("id", assigned_sub_ids) \
                .execute()
    else:
        subs_res = supabase.table("submissions") \
            .select("*") \
            .eq("round_id", round_id) \
            .eq("is_draft", False) \
            .execute()

    submissions = subs_res.data or []

    team_ids = list({s["team_id"] for s in submissions if s.get("team_id")})
    teams_map = {}
    if team_ids:
        teams_res = supabase.table("teams").select("id, name, city_school_org").in_("id", team_ids).execute()
        teams_map = {t["id"]: t for t in (teams_res.data or [])}

    for sub in submissions:
        team_info = teams_map.get(sub.get("team_id"), {})
        sub["team_name"] = team_info.get("name", "—")
        sub["team_org"]  = team_info.get("city_school_org")

        raw_files = sub.get("file_paths") or []
        enriched_files = []
        for f in raw_files:
            if isinstance(f, dict) and f.get("path"):
                try:
                    signed = supabase.storage.from_("submissions").create_signed_url(f["path"], 3600)
                    url = signed.get("signedURL") or signed.get("signedUrl")
                except Exception:
                    url = None
                enriched_files.append({"name": f.get("name", ""), "path": f["path"], "url": url})
        sub["files"] = enriched_files

        if caller.get("role") in ("jury", "superadmin"):
            eval_res = fetch_one(
                supabase.table("jury_evaluations")
                    .select("id, total_score, criteria_scores, general_comment, updated_at")
                    .eq("submission_id", sub["id"])
                    .eq("jury_id", caller["id"])
            )
            sub["my_evaluation"] = eval_res

    return {"submissions": submissions}
