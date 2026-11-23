"""Запрошення в команди та прийняття запрошень за email-посиланням."""

import json
import os

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.schemas import RespondInvitation, SendInvitation
from src.security import get_caller
from src.services.emails import get_user_email, send_notification_email
from src.services.invitation_tokens import create_invitation_token


router = APIRouter()


@router.get("/api/invitations/accept-by-token")
async def accept_invitation_by_token(token: str):
    """
    Приймає запрошення за одноразовим токеном з email-листа.
    Після прийняття робить редирект на сторінку команди.
    """
    from fastapi.responses import RedirectResponse

    site_url = os.getenv("SITE_URL", "http://localhost:3000")

    if not supabase:
        return RedirectResponse(url=f"{site_url}/notifications?error=server")

    # Знаходимо токен
    tok_res = supabase.table("invitation_tokens")         .select("*")         .eq("token", token)         .limit(1)         .execute()

    if not tok_res.data:
        return RedirectResponse(url=f"{site_url}/notifications?error=invalid_token")

    tok = tok_res.data[0]

    if tok["used"]:
        return RedirectResponse(url=f"{site_url}/notifications?error=already_used")

    from datetime import datetime, timezone
    expires_at = datetime.fromisoformat(tok["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        return RedirectResponse(url=f"{site_url}/notifications?error=expired")

    inv_type      = tok["type"]
    invitation_id = tok["invitation_id"]

    # Визначаємо таблицю залежно від типу
    if inv_type == "team_invitation":
        table = "team_invitations"
    elif inv_type == "jury_invitation":
        table = "jury_tournament_invitations"
    else:
        return RedirectResponse(url=f"{site_url}/notifications?error=unknown_type")

    inv_res = supabase.table(table)         .select("*")         .eq("id", invitation_id)         .limit(1)         .execute()

    if not inv_res.data:
        return RedirectResponse(url=f"{site_url}/notifications?error=invitation_not_found")

    inv = inv_res.data[0]

    if inv["status"] != "pending":
        # Вже оброблено — просто редіректимо
        if inv_type == "team_invitation":
            return RedirectResponse(url=f"{site_url}/teams/{inv['team_id']}")
        return RedirectResponse(url=f"{site_url}/notifications")

    # Приймаємо запрошення
    supabase.table(table)         .update({"status": "accepted"})         .eq("id", invitation_id)         .execute()

    # Позначаємо токен використаним
    supabase.table("invitation_tokens")         .update({"used": True})         .eq("id", tok["id"])         .execute()

    if inv_type == "team_invitation":
        # Додаємо користувача до команди
        team_res = supabase.table("teams")             .select("members_ids, captain_id, name")             .eq("id", inv["team_id"])             .limit(1)             .execute()

        if team_res.data:
            team = team_res.data[0]
            members = team.get("members_ids") or []
            if inv["invitee_id"] not in members:
                members.append(inv["invitee_id"])
                supabase.table("teams")                     .update({"members_ids": members})                     .eq("id", inv["team_id"])                     .execute()

            # Сповіщаємо капітана
            invitee_res = supabase.table("account")                 .select("username")                 .eq("id", inv["invitee_id"])                 .limit(1)                 .execute()
            invitee_name = (invitee_res.data or [{}])[0].get("username", "Користувач")

            supabase.table("notifications").insert({
                "user_id": team["captain_id"],
                "type":    "invitation_accepted",
                "title":   f"{invitee_name} прийняв запрошення",
                "message": f"Користувач {invitee_name} прийняв ваше запрошення до команди «{team['name']}».",
                "meta":    {"team_id": inv["team_id"], "team_name": team["name"], "new_member": invitee_name},
                "read":    False,
            }).execute()

        print(f"[TOKEN-ACCEPT] team_invitation {invitation_id} прийнято через email-посилання", flush=True)
        return RedirectResponse(url=f"{site_url}/teams/{inv['team_id']}")

    elif inv_type == "jury_invitation":
        # Додаємо jury_assignments для всіх раундів турніру
        rounds_res = supabase.table("rounds")             .select("id")             .eq("tournament_id", inv["tournament_id"])             .execute()
        for r in (rounds_res.data or []):
            exists = supabase.table("jury_assignments")                 .select("id")                 .eq("jury_id", inv["jury_id"])                 .eq("round_id", r["id"])                 .execute()
            if not exists.data:
                supabase.table("jury_assignments").insert({
                    "jury_id":       inv["jury_id"],
                    "round_id":      r["id"],
                    "tournament_id": inv["tournament_id"],
                }).execute()

        print(f"[TOKEN-ACCEPT] jury_invitation {invitation_id} прийнято через email-посилання", flush=True)
        return RedirectResponse(url=f"{site_url}/tournaments/{inv['tournament_id']}")

    return RedirectResponse(url=f"{site_url}/notifications")


@router.post("/api/invitations/send")
async def send_invitation(payload: SendInvitation, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(
        supabase.table("teams").select("id, name, captain_id, members_ids").eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан команды может отправлять приглашения")

    invitee = fetch_one(
        supabase.table("account").select("id, username, email").eq("id", payload.invitee_id)
    )
    if not invitee:
        raise HTTPException(status_code=404, detail="Приглашаемый пользователь не найден")

    members_ids = team.get("members_ids") or []
    if payload.invitee_id in members_ids or payload.invitee_id == team["captain_id"]:
        raise HTTPException(status_code=400, detail="Пользователь уже является участником команды")

    existing_inv = supabase.table("team_invitations") \
        .select("id") \
        .eq("team_id", payload.team_id) \
        .eq("invitee_id", payload.invitee_id) \
        .eq("status", "pending") \
        .execute()
    if existing_inv.data:
        raise HTTPException(status_code=400, detail="Приглашение уже отправлено и ожидает ответа")

    inv_res = supabase.table("team_invitations").insert({
        "team_id":    payload.team_id,
        "inviter_id": caller["id"],
        "invitee_id": payload.invitee_id,
        "status":     "pending",
    }).execute()

    if not inv_res.data:
        raise HTTPException(status_code=500, detail="Не удалось создать приглашение")

    invitation_id = inv_res.data[0]["id"]

    _notif_title   = f"Запрошення до команди «{team['name']}»"
    _notif_message = (
        f"Капітан команди «{team['name']}» ({caller['username']}) "
        f"запрошує вас приєднатися до команди."
    )
    supabase.table("notifications").insert({
        "user_id": payload.invitee_id,
        "type":    "team_invitation",
        "title":   _notif_title,
        "message": _notif_message,
        "meta": {
            "invitation_id": invitation_id,
            "team_id":       payload.team_id,
            "team_name":     team["name"],
            "inviter_id":    caller["id"],
            "inviter_name":  caller["username"],
        },
        "read": False,
    }).execute()
    _token = create_invitation_token(invitation_id, "team_invitation")
    _api_url = os.getenv("API_URL", "http://localhost:8000")
    _accept_url = f"{_api_url}/api/invitations/accept-by-token?token={_token}" if _token else ""
    _invitee_email = get_user_email(payload.invitee_id)  # перевіряє email_notifications
    if _invitee_email:
        send_notification_email(_invitee_email, _notif_title, _notif_message, "team_invitation", _accept_url)

    print(f"[INVITE] {caller['username']} → {invitee['username']} для команды {team['name']}", flush=True)
    return {"success": True, "invitation_id": invitation_id}


@router.post("/api/invitations/respond")
async def respond_invitation(payload: RespondInvitation, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") == "jury":
        raise HTTPException(status_code=403, detail="Журі не може вступати до команд")

    inv = fetch_one(
        supabase.table("team_invitations")
            .select("id, team_id, inviter_id, invitee_id, status")
            .eq("id", payload.invitation_id)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if inv["invitee_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Это приглашение не для вас")

    def get_user_current_team(user_id: str, exclude_team_id: str) -> str | None:
        member_res  = supabase.table("teams").select("id, name").contains("members_ids", json.dumps([user_id])).execute()
        captain_res = supabase.table("teams").select("id, name").eq("captain_id", user_id).execute()
        all_teams = (member_res.data or []) + (captain_res.data or [])
        seen = set()
        for t in all_teams:
            if t["id"] != exclude_team_id and t["id"] not in seen:
                seen.add(t["id"])
                return t.get("name", "іншу команду")
        return None

    if inv["status"] != "pending":
        if payload.accept:
            existing_team_name = get_user_current_team(caller["id"], inv["team_id"])
            if existing_team_name:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ви вже є членом команди \u00ab{existing_team_name}\u00bb. Спочатку покиньте поточну команду, щоб приєднатися до іншої."
                )
        raise HTTPException(status_code=400, detail="Це запрошення вже було оброблено раніше.")

    if payload.accept:
        existing_team_name = get_user_current_team(caller["id"], inv["team_id"])
        if existing_team_name:
            raise HTTPException(
                status_code=400,
                detail=f"Ви вже є членом команди \u00ab{existing_team_name}\u00bb. Спочатку покиньте поточну команду, щоб приєднатися до іншої."
            )

    new_status = "accepted" if payload.accept else "declined"

    supabase.table("team_invitations") \
        .update({"status": new_status}) \
        .eq("id", payload.invitation_id) \
        .execute()

    notifs_res = supabase.table("notifications") \
        .select("id, meta") \
        .eq("type", "team_invitation") \
        .eq("user_id", caller["id"]) \
        .eq("read", False) \
        .execute()

    notif_ids_to_mark = []
    for notif in (notifs_res.data or []):
        try:
            meta = json.loads(notif.get("meta") or "{}")
            if meta.get("invitation_id") == payload.invitation_id:
                notif_ids_to_mark.append(notif["id"])
        except Exception:
            pass

    if notif_ids_to_mark:
        supabase.table("notifications") \
            .update({"read": True}) \
            .in_("id", notif_ids_to_mark) \
            .execute()

    if payload.accept:
        team = fetch_one(
            supabase.table("teams").select("name, captain_id, members_ids").eq("id", inv["team_id"])
        )
        if not team:
            raise HTTPException(status_code=404, detail="Команда не найдена")

        current_members = team.get("members_ids") or []
        if caller["id"] not in current_members:
            current_members.append(caller["id"])
            supabase.table("teams") \
                .update({"members_ids": current_members}) \
                .eq("id", inv["team_id"]) \
                .execute()

        _notif_title   = f"{caller['username']} прийняв запрошення"
        _notif_message = f"Користувач {caller['username']} прийняв ваше запрошення до команди «{team['name']}»."
        supabase.table("notifications").insert({
            "user_id": team["captain_id"],
            "type":    "invitation_accepted",
            "title":   _notif_title,
            "message": _notif_message,
            "meta":    {
                "team_id":    inv["team_id"],
                "team_name":  team["name"],
                "new_member": caller["username"],
            },
            "read": False,
        }).execute()
        _captain_email = get_user_email(team["captain_id"])
        if _captain_email:
            send_notification_email(_captain_email, _notif_title, _notif_message, "invitation_accepted")

        print(f"[INVITE] {caller['username']} принял приглашение в команду {inv['team_id']}", flush=True)
        return {"success": True, "status": "accepted"}

    else:
        team = fetch_one(
            supabase.table("teams").select("name, captain_id").eq("id", inv["team_id"])
        )
        if team:
            _notif_title   = f"{caller['username']} відхилив запрошення"
            _notif_message = f"Користувач {caller['username']} відхилив ваше запрошення до команди «{team['name']}»."
            supabase.table("notifications").insert({
                "user_id": team["captain_id"],
                "type":    "invitation_declined",
                "title":   _notif_title,
                "message": _notif_message,
                "meta":    {
                    "team_id":   inv["team_id"],
                    "team_name": team["name"],
                },
                "read": False,
            }).execute()
            _captain_email = get_user_email(team["captain_id"])
            if _captain_email:
                send_notification_email(_captain_email, _notif_title, _notif_message, "invitation_declined")

        print(f"[INVITE] {caller['username']} отклонил приглашение в команду {inv['team_id']}", flush=True)
        return {"success": True, "status": "declined"}


@router.get("/api/invitations/my")
async def get_my_invitations(authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    inv_res = supabase.table("team_invitations") \
        .select("id, team_id, inviter_id, status, created_at") \
        .eq("invitee_id", caller["id"]) \
        .eq("status", "pending") \
        .order("created_at", desc=True) \
        .execute()

    invitations = inv_res.data or []

    if not invitations:
        return {"invitations": []}

    team_ids    = list({inv["team_id"]    for inv in invitations})
    inviter_ids = list({inv["inviter_id"] for inv in invitations})

    teams_res = supabase.table("teams") \
        .select("id, name, city_school_org") \
        .in_("id", team_ids) \
        .execute()
    teams_map = {t["id"]: t for t in (teams_res.data or [])}

    inviters_res = supabase.table("account") \
        .select("id, username, login") \
        .in_("id", inviter_ids) \
        .execute()
    inviters_map = {a["id"]: a for a in (inviters_res.data or [])}

    enriched = []
    for inv in invitations:
        team_r    = teams_map.get(inv["team_id"])
        inviter_r = inviters_map.get(inv["inviter_id"])
        enriched.append({
            **inv,
            "team_name":        team_r.get("name")            if team_r else "—",
            "team_org":         team_r.get("city_school_org") if team_r else None,
            "inviter_username": inviter_r.get("username")     if inviter_r else "—",
            "inviter_login":    inviter_r.get("login")        if inviter_r else "—",
        })

    return {"invitations": enriched}
