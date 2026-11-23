"""Команди: створення, перегляд, редагування, видалення, виключення учасників."""

import json

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.schemas import CreateTeam, UpdateTeam
from src.security import get_caller
from src.services.emails import get_user_email, send_notification_email


router = APIRouter()


@router.post("/api/teams")
async def create_team(payload: CreateTeam, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") == "jury":
        raise HTTPException(status_code=403, detail="Журі не може створювати команди")

    result = supabase.table("teams").insert({
        "name":             payload.name,
        "captain_id":       caller["id"],
        "members_ids":      [],
        "city_school_org":  payload.city_school_org,
        "description":      payload.description,
        "telegram_url":     payload.telegram_url,
        "discord_url":      payload.discord_url,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не удалось создать команду")

    print(f"[TEAM] {caller['username']} создав команду {payload.name}", flush=True)
    return {"success": True, "team": result.data[0]}


@router.get("/api/teams")
async def get_teams(authorization: str | None = Header(None), limit: int = 50, offset: int = 0):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    # Public endpoint — guests can browse teams
    limit = min(limit, 200)

    result = supabase.table("teams").select("*").order("name").range(offset, offset + limit - 1).execute()
    return {"teams": result.data or [], "limit": limit, "offset": offset}


@router.get("/api/teams/my")
async def get_my_team(authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    captain_res = supabase.table("teams").select("*").eq("captain_id", caller["id"]).execute()
    member_res  = supabase.table("teams").select("*").contains("members_ids", json.dumps([caller["id"]])).execute()

    seen_ids = set()
    teams = []
    for t in (captain_res.data or []) + (member_res.data or []):
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
            teams.append(t)

    return {"teams": teams}


@router.get("/api/teams/{team_id}")
async def get_team(team_id: str, authorization: str | None = Header(None)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    # Public endpoint — guests can view team details

    team = fetch_one(supabase.table("teams").select("*").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    return {"team": team}


@router.patch("/api/teams/{team_id}")
async def update_team(team_id: str, payload: UpdateTeam, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(supabase.table("teams").select("id, captain_id").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан может редактировать команду")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None and v != ""}
    if not updates:
        raise HTTPException(status_code=400, detail="Нечего обновлять")

    result = supabase.table("teams").update(updates).eq("id", team_id).execute()
    return {"success": True, "team": result.data[0] if result.data else None}


@router.post("/api/teams/{team_id}/kick")
async def kick_member(team_id: str, body: dict, authorization: str = Header(...)):
    """Капітан кікає учасника з команди. body: {"user_id": "..."}"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(
        supabase.table("teams").select("id, name, captain_id, members_ids").eq("id", team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Тільки капітан може виключати учасників")

    target_id = body.get("target_id") or body.get("user_id")
    if not target_id:
        raise HTTPException(status_code=400, detail="target_id обов'язковий")
    if target_id == caller["id"]:
        raise HTTPException(status_code=400, detail="Капітан не може кікнути сам себе")

    members = team.get("members_ids") or []
    if target_id not in members:
        raise HTTPException(status_code=400, detail="Цей користувач не є членом команди")

    members.remove(target_id)
    supabase.table("teams").update({"members_ids": members}).eq("id", team_id).execute()

    # Сповіщення викинутому учаснику
    _notif_title   = f"Вас виключили з команди «{team['name']}»"
    _notif_message = f"Капітан команди «{team['name']}» виключив вас зі складу."
    try:
        supabase.table("notifications").insert({
            "user_id": target_id,
            "type":    "kicked_from_team",
            "title":   _notif_title,
            "message": _notif_message,
            "meta":    {"team_id": team_id, "team_name": team["name"]},
            "read":    False,
        }).execute()
        _email = get_user_email(target_id)
        if _email:
            send_notification_email(_email, _notif_title, _notif_message, "kicked_from_team")
    except Exception as _e:
        print(f"[NOTIFY] kick_member для {target_id}: {_e}", flush=True)

    print(f"[TEAM] {caller['username']} кікнув {target_id} з команди {team_id}", flush=True)
    return {"success": True, "members_ids": members}


@router.delete("/api/teams/{team_id}")
async def delete_team(team_id: str, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(supabase.table("teams").select("id, captain_id, tournament_id").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан может удалить команду")

    supabase.table("team_invitations") \
        .update({"status": "declined"}) \
        .eq("team_id", team_id) \
        .eq("status", "pending") \
        .execute()

    supabase.table("teams").delete().eq("id", team_id).execute()
    return {"success": True}
