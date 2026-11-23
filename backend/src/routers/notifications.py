"""Внутрішні сповіщення користувача."""

from fastapi import APIRouter, HTTPException, Header

from src.db import supabase
from src.security import get_caller


router = APIRouter()


@router.get("/api/notifications")
async def get_notifications(authorization: str = Header(...), limit: int = 20, offset: int = 0):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    res = supabase.table("notifications") \
        .select("id, type, title, message, meta, read, created_at") \
        .eq("user_id", caller["id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()

    return {"notifications": res.data or []}


@router.get("/api/notifications/unread-count")
async def get_unread_count(authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    res = supabase.table("notifications") \
        .select("id", count="exact") \
        .eq("user_id", caller["id"]) \
        .eq("read", False) \
        .execute()

    return {"count": res.count or 0}


@router.post("/api/notifications/mark-read")
async def mark_notification_read(body: dict, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if body.get("all"):
        supabase.table("notifications") \
            .update({"read": True}) \
            .eq("user_id", caller["id"]) \
            .execute()
    elif ids := body.get("ids"):
        supabase.table("notifications") \
            .update({"read": True}) \
            .eq("user_id", caller["id"]) \
            .in_("id", ids) \
            .execute()

    return {"success": True}
