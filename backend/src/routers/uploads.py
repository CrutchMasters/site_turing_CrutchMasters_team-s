"""Завантаження та видалення файлів (сабміти, банери, аватари), підписані URL."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, Header, UploadFile

from src.db import fetch_one, supabase
from src.security import get_caller


router = APIRouter()


@router.delete("/api/rounds/{round_id}/submission/file")
async def delete_submission_file(round_id: str, body: dict, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    file_path = (body.get("file_path") or "").strip()
    if not file_path:
        raise HTTPException(status_code=400, detail="Потрібен file_path")

    round_ = fetch_one(
        supabase.table("rounds").select("tournament_id").eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")
    tournament_id = round_["tournament_id"]

    is_privileged = caller.get("role") in ("admin", "superadmin")

    team_id = None
    if not is_privileged:
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
            raise HTTPException(status_code=403, detail="Ви не є учасником цього турніру")

    query = supabase.table("submissions") \
        .select("id, file_paths, status, is_draft, team_id") \
        .eq("round_id", round_id)
    if team_id:
        query = query.eq("team_id", team_id)

    sub = fetch_one(query)
    if not sub:
        raise HTTPException(status_code=404, detail="Здачу не знайдено")

    if sub.get("status") in ("closed", "reviewed"):
        raise HTTPException(status_code=403, detail="Здача закрита або перевірена, видалення файлів неможливе")

    if not is_privileged and sub["team_id"] != team_id:
        raise HTTPException(status_code=403, detail="Немає доступу до цієї здачі")

    try:
        supabase.storage.from_("submissions").remove([file_path])
        print(f"[DELETE-FILE] Видалено з bucket: {file_path}", flush=True)
    except Exception as e:
        print(f"[DELETE-FILE] Помилка видалення з bucket {file_path}: {e}", flush=True)

    current_files: list[dict] = sub.get("file_paths") or []
    updated_files = [f for f in current_files if f.get("path") != file_path]

    supabase.table("submissions") \
        .update({"file_paths": updated_files, "updated_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", sub["id"]).execute()

    print(f"[DELETE-FILE] {caller['username']} видалив файл {file_path} з submission {sub['id']}", flush=True)
    return {"success": True}


@router.post("/api/upload/submission-file")
async def upload_submission_file(
    round_id:  str        = Form(...),
    team_id:   str        = Form(...),
    file:      UploadFile = File(...),
    authorization: str    = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(
        supabase.table("teams")
            .select("id, captain_id, members_ids")
            .eq("id", team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")

    members    = team.get("members_ids") or []
    is_captain = team["captain_id"] == caller["id"]
    is_member  = caller["id"] in members
    if not is_captain and not is_member:
        raise HTTPException(status_code=403, detail="Ви не є членом цієї команди")

    MAX_FILE_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимальний розмір — 50 MB")

    BLOCKED_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".ps1", ".msi", ".com", ".vbs", ".jar"}
    import re, time
    safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "file")
    ext = ("." + safe_name.rsplit(".", 1)[-1]).lower() if "." in safe_name else ""
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Файли типу '{ext}' заборонені до завантаження")

    path = f"submissions/{round_id}/{team_id}/{int(time.time() * 1000)}-{safe_name}"

    try:
        supabase.storage.from_("submissions").upload(
            path=path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу: {e}")

    print(f"[UPLOAD] {caller['username']} завантажив {safe_name} → {path}", flush=True)
    return {"success": True, "path": path, "name": file.filename}


@router.post("/api/upload/round-file")
async def upload_round_file(
    round_number: int        = Form(...),
    file:         UploadFile = File(...),
    authorization: str       = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може завантажувати файли раундів")

    import re, time as _time
    safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "file")

    MAX_FILE_SIZE = 100 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимальний розмір — 100 MB")

    BLOCKED_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".ps1", ".msi", ".com", ".vbs", ".jar"}
    ext = ("." + safe_name.rsplit(".", 1)[-1]).lower() if "." in safe_name else ""
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Файли типу '{ext}' заборонені до завантаження")

    path = f"rounds/round-{round_number}/{int(_time.time() * 1000)}-{safe_name}"

    try:
        supabase.storage.from_("round-files").upload(
            path=path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу: {e}")

    try:
        signed = supabase.storage.from_("round-files").create_signed_url(path, 315360000)
        signed_url = signed.get("signedURL") or signed.get("signedUrl")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не вдалося отримати URL: {e}")

    print(f"[ROUND-UPLOAD] {caller['username']} завантажив {safe_name} → {path}", flush=True)
    return {"success": True, "signed_url": signed_url, "path": path, "name": file.filename}


@router.post("/api/upload/tournament-banner-temp")
async def upload_tournament_banner_temp(
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    """
    Тимчасове завантаження банера турніру ДО створення турніру.
    Файл зберігається у bucket 'tournament-banners' за шляхом temp/<user_id>/<timestamp>/banner.<ext>.
    Повертає public_url, який потім передається при POST /api/tournaments як поле banner_url.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може завантажувати банер")

    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    content_type  = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Непідтримуваний тип файлу: {content_type}. Дозволені: JPEG, PNG, WEBP, GIF",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл занадто великий. Максимум 10 MB")

    import time as _time
    ext_map = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
    ext  = ext_map.get(content_type, "webp")
    path = f"temp/{caller['id']}/{int(_time.time() * 1000)}/banner.{ext}"

    try:
        supabase.storage.from_("tournament-banners").upload(
            path, file_bytes, {"content-type": content_type, "upsert": "true"},
        )

        url_data   = supabase.storage.from_("tournament-banners").get_public_url(path)
        public_url = url_data if isinstance(url_data, str) else url_data.get("publicUrl", "")
        public_url_cache = f"{public_url}?t={int(_time.time())}"

        print(f"[BANNER-TEMP] {caller['username']} завантажив тимчасовий банер → {path}", flush=True)
        return {"public_url": public_url_cache, "path": path}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[BANNER-TEMP] Помилка завантаження: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Помилка завантаження банера: {str(e)}")


@router.post("/api/upload/avatar-preview")
async def upload_avatar_preview(
    preview_id:    str        = Form(...),
    file:          UploadFile = File(...),
    authorization: str        = Header(...),
):
    """Upload avatar to storage only (no DB update). Used for team avatar before team is created."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    MAX_SIZE = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимум 5 MB")

    import time as _time
    timestamp = int(_time.time() * 1000)
    path = f"team_preview_{caller['id']}/{preview_id}/avatar_{timestamp}.webp"

    try:
        supabase.storage.from_("avatars").upload(
            path=path,
            file=content,
            file_options={"content-type": "image/webp", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження: {e}")

    url_data = supabase.storage.from_("avatars").get_public_url(path)
    public_url = f"{url_data}?v={timestamp}"

    print(f"[AVATAR PREVIEW] {caller['username']} завантажив preview → {path}", flush=True)
    return {"success": True, "url": public_url}


@router.post("/api/upload/user-avatar")
async def upload_user_avatar(
    file:          UploadFile = File(...),
    authorization: str        = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    user_id = caller["id"]

    MAX_SIZE = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимум 5 MB")

    import time as _time
    timestamp = int(_time.time() * 1000)
    path = f"{user_id}/avatar_{timestamp}.webp"

    # Отримуємо старий avatar_url
    old_avatar = None
    try:
        old_data = fetch_one(supabase.table("account").select("avatar_url").eq("id", user_id))
        old_avatar = (old_data or {}).get("avatar_url")
    except Exception:
        pass

    # Upload через service role
    try:
        supabase.storage.from_("avatars").upload(
            path=path,
            file=content,
            file_options={"content-type": "image/webp", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження: {e}")

    url_data = supabase.storage.from_("avatars").get_public_url(path)
    public_url = f"{url_data}?v={timestamp}"

    supabase.table("account").update({"avatar_url": public_url}).eq("id", user_id).execute()

    # Видаляємо старий файл
    if old_avatar:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(old_avatar)
            parts = parsed.path.split("/object/public/avatars/")
            if len(parts) > 1:
                old_path = parts[1].split("?")[0]
                supabase.storage.from_("avatars").remove([old_path])
        except Exception:
            pass

    print(f"[AVATAR] {caller['username']} оновив особистий аватар → {path}", flush=True)
    return {"success": True, "url": public_url}


@router.post("/api/upload/team-avatar")
async def upload_team_avatar(
    team_id:       str        = Form(...),
    file:          UploadFile = File(...),
    authorization: str        = Header(...),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Перевіряємо що юзер є капітаном або учасником команди
    team = fetch_one(
        supabase.table("teams")
            .select("id, captain_id, members_ids")
            .eq("id", team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")

    members    = team.get("members_ids") or []
    is_captain = team["captain_id"] == caller["id"]
    is_member  = caller["id"] in members
    if not is_captain and not is_member:
        raise HTTPException(status_code=403, detail="Ви не є членом цієї команди")

    MAX_SIZE = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимум 5 MB")

    import time as _time
    timestamp = int(_time.time() * 1000)
    path = f"teams/{team_id}/avatar_{timestamp}.webp"

    # Отримуємо старий avatar_url щоб потім видалити
    old_avatar = None
    try:
        old_data = fetch_one(supabase.table("teams").select("avatar_url").eq("id", team_id))
        old_avatar = (old_data or {}).get("avatar_url")
    except Exception:
        pass

    # Upload через service role — обходить RLS
    try:
        supabase.storage.from_("avatars").upload(
            path=path,
            file=content,
            file_options={"content-type": "image/webp", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження: {e}")

    # Отримуємо публічний URL
    url_data = supabase.storage.from_("avatars").get_public_url(path)
    public_url = f"{url_data}?v={timestamp}"

    # Оновлюємо avatar_url в таблиці teams
    supabase.table("teams").update({"avatar_url": public_url}).eq("id", team_id).execute()

    # Видаляємо старий файл
    if old_avatar:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(old_avatar)
            parts = parsed.path.split("/object/public/avatars/")
            if len(parts) > 1:
                old_path = parts[1].split("?")[0]
                supabase.storage.from_("avatars").remove([old_path])
        except Exception:
            pass

    print(f"[AVATAR] {caller['username']} оновив аватар команди {team_id} → {path}", flush=True)
    return {"success": True, "url": public_url}


@router.post("/api/upload/signed-urls")
async def get_signed_urls(body: dict, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    paths = body.get("paths", [])
    if not paths or not isinstance(paths, list):
        raise HTTPException(status_code=400, detail="Потрібен список paths")
    if len(paths) > 50:
        raise HTTPException(status_code=400, detail="Максимум 50 файлів за раз")

    captain_res = supabase.table("teams").select("id").eq("captain_id", caller["id"]).execute()
    member_res  = supabase.table("teams").select("id").contains("members_ids", json.dumps([caller["id"]])).execute()
    is_admin    = caller.get("role") in ("admin", "superadmin", "jury")
    if not is_admin:
        user_team_ids = {t["id"] for t in (captain_res.data or []) + (member_res.data or [])}
        for path in paths:
            parts = path.split("/")
            if len(parts) < 3 or parts[2] not in user_team_ids:
                raise HTTPException(
                    status_code=403,
                    detail=f"Шлях '{path}' не належить вашій команді",
                )

    result = {}
    for path in paths:
        try:
            signed = supabase.storage.from_("submissions").create_signed_url(path, 3600)
            result[path] = signed.get("signedURL") or signed.get("signedUrl")
        except Exception as e:
            print(f"[SIGNED_URL] Не вдалося для {path}: {e}", flush=True)
            result[path] = None

    return {"urls": result}
