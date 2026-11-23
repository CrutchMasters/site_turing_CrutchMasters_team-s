"""Одноразові токени для прийняття запрошень через email."""

from src.db import supabase


def create_invitation_token(invitation_id: str, inv_type: str) -> str:
    """Створює одноразовий токен для прийняття запрошення через email."""
    if not supabase:
        return ""
    try:
        res = supabase.table("invitation_tokens").insert({
            "type":          inv_type,
            "invitation_id": invitation_id,
        }).execute()
        return (res.data or [{}])[0].get("token", "")
    except Exception as e:
        print(f"[TOKEN] Помилка створення токена: {e}", flush=True)
        return ""
