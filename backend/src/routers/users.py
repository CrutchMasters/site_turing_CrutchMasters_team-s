"""Реєстрація, логін, ролі, налаштування сповіщень, профіль і пошук користувачів."""

import json

from fastapi import APIRouter, HTTPException, Header

from src.config import ALLOWED_ROLES
from src.db import fetch_one, supabase, supabase_auth
from src.schemas import ChangeRole, UserLogin, UserRegister
from src.security import decode_jwt_payload, get_caller


router = APIRouter()


@router.get("/api/users/me/email-notifications-status")
async def get_email_notifications_status(authorization: str = Header(...)):
    """Повертає поточний стан email-сповіщень користувача."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    res = supabase.table("account").select("email_notifications").eq("id", caller["id"]).limit(1).execute()
    enabled = (res.data or [{}])[0].get("email_notifications", True)
    return {"email_notifications": enabled}


@router.patch("/api/users/me/email-notifications")
async def set_email_notifications(body: dict, authorization: str = Header(...)):
    """Вмикає або вимикає email-розсилку для поточного користувача."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    enabled = body.get("enabled")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="'enabled' must be a boolean")

    supabase.table("account")         .update({"email_notifications": enabled})         .eq("id", caller["id"])         .execute()

    print(f"[SETTINGS] {caller['username']} email_notifications={enabled}", flush=True)
    return {"success": True, "email_notifications": enabled}


@router.post("/api/register")
async def register_user(user: UserRegister, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    try:
        token = authorization.replace("Bearer ", "").strip()
        jwt_payload = decode_jwt_payload(token)
        auth_uuid = jwt_payload.get("sub")
        if not auth_uuid:
            raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

        existing_email = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

        existing_login = supabase.table("account").select("id").eq("login", user.login).execute()
        if existing_login.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

        result = supabase.table("account").insert({
            "id":       auth_uuid,
            "username": user.username,
            "login":    user.login,
            "email":    user.email,
            "status":   "active",
            "role":     "user",
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Не удалось создать пользователя")

        return {"success": True, "message": "Пользователь успешно зарегистрирован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/login")
async def login_user(user: UserLogin):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    try:
        identifier = user.login.strip()

        if "@" in identifier:
            result = supabase.table("account").select("*").eq("email", identifier).execute()
        else:
            result = supabase.table("account").select("*").eq("login", identifier).execute()

        if not result.data:
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")

        user_data = result.data[0]

        auth_response = supabase_auth.auth.sign_in_with_password({
            "email":    user_data["email"],
            "password": user.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")

        return {
            "success":      True,
            "access_token":  auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "user":          user_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/get-email")
async def get_email_by_login(login: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    try:
        result = supabase.table("account").select("email").eq("login", login).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"email": result.data[0]["email"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/change-role")
async def change_role(payload: ChangeRole, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    print("\n=== CHANGE ROLE REQUEST ===", flush=True)
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Токен не передан")

    if payload.new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Недопустимая роль. Доступные: {ALLOWED_ROLES}")

    try:
        jwt_payload  = decode_jwt_payload(token)
        caller_email = jwt_payload.get("email")
        if not caller_email:
            raise HTTPException(status_code=401, detail="Invalid token: no email claim")

        caller_info = fetch_one(
            supabase.table("account").select("id, role").eq("email", caller_email)
        )
        if not caller_info:
            raise HTTPException(status_code=403, detail="Аккаунт не найден")
        if caller_info["role"] != "superadmin":
            raise HTTPException(status_code=403, detail="Только суперадмин может менять роли")
        if caller_info["id"] == payload.target_user_id:
            raise HTTPException(status_code=400, detail="Нельзя изменить собственную роль")

        target = fetch_one(
            supabase.table("account").select("id, username, role").eq("id", payload.target_user_id)
        )
        if not target:
            raise HTTPException(status_code=404, detail="Целевой пользователь не найден")
        if target.get("role") == "superadmin":
            raise HTTPException(status_code=403, detail="Нельзя изменить роль другого суперадмина")

        supabase.table("account").update({"role": payload.new_role}).eq("id", payload.target_user_id).execute()

        print(f"SUCCESS: роль изменена на {payload.new_role}", flush=True)
        return {"success": True, "message": f"Роль изменена на {payload.new_role}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/users/me/tournaments")
async def get_my_tournaments(authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    user_id = caller["id"]

    captain_res = supabase.table("teams") \
        .select("id, tournament_id") \
        .eq("captain_id", user_id) \
        .execute()

    member_res = supabase.table("teams") \
        .select("id, tournament_id") \
        .contains("members_ids", json.dumps([user_id])) \
        .execute()

    all_teams = (captain_res.data or []) + (member_res.data or [])
    tournament_ids = list({
        t["tournament_id"]
        for t in all_teams
        if t.get("tournament_id")
    })

    if not tournament_ids:
        return {"tournaments": []}

    tour_res = supabase.table("tournaments") \
        .select("id, name, status, start_at, registration_from, registration_to") \
        .in_("id", tournament_ids) \
        .execute()

    return {"tournaments": tour_res.data or []}


@router.get("/api/users/search")
async def search_users(q: str, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    get_caller(token)

    if len(q.strip()) < 2:
        return {"users": []}

    data = supabase.table("account") \
        .select("id, username, login, email, role, avatar_url, status") \
        .or_(f"username.ilike.%{q}%,login.ilike.%{q}%,email.ilike.%{q}%") \
        .eq("status", "active") \
        .limit(10) \
        .execute()

    return {"users": data.data or []}
