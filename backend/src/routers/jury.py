"""Запрошення журі, реєстрація журі за токеном, список журі, видалення журі."""

import os

from fastapi import APIRouter, HTTPException, Header

from src.db import fetch_one, supabase
from src.schemas import RespondJuryInvitation, SendJuryInvitation, SendRoundJuryEmailInvitation, SendTournamentJuryEmailInvitation
from src.security import get_caller
from src.services.emails import get_user_email, send_notification_email
from src.services.invitation_tokens import create_invitation_token


router = APIRouter()


@router.post("/api/jury-invitations/send")
async def send_jury_invitation(payload: SendJuryInvitation, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може запрошувати журі")

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, created_by")
            .eq("id", payload.tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    jury_user = fetch_one(
        supabase.table("account")
            .select("id, username, email, role")
            .eq("id", payload.jury_id)
    )
    if not jury_user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    if jury_user.get("role") != "jury":
        raise HTTPException(status_code=400, detail="Користувач не має ролі журі")

    # Визначаємо scope: якщо round_id передано — запрошення на конкретний раунд
    scope    = "round" if payload.round_id else "tournament"
    round_id = payload.round_id

    round_info = None
    if scope == "round":
        print(f"[JURY-INVITE] Перевірка раунду: round_id={round_id!r} tournament_id={payload.tournament_id!r}", flush=True)
        round_info = fetch_one(
            supabase.table("rounds")
                .select("id, name, number")
                .eq("id", round_id)
                .eq("tournament_id", payload.tournament_id)
        )
        print(f"[JURY-INVITE] round_info={round_info!r}", flush=True)
        if not round_info:
            # Спробуємо знайти раунд без фільтра tournament_id щоб зрозуміти проблему
            round_exists = fetch_one(supabase.table("rounds").select("id, tournament_id").eq("id", round_id))
            print(f"[JURY-INVITE] round_exists (без tournament filter)={round_exists!r}", flush=True)
            raise HTTPException(status_code=404, detail="Раунд не знайдено або не належить цьому турніру")

    # Перевіряємо чи вже є запрошення з таким самим scope
    q = supabase.table("jury_tournament_invitations") \
        .select("id, status, scope") \
        .eq("tournament_id", payload.tournament_id) \
        .eq("jury_id", payload.jury_id) \
        .eq("scope", scope)
    if scope == "round":
        q = q.eq("round_id", round_id)
    else:
        q = q.eq("scope", "tournament")  # scope=tournament means round_id IS NULL
    existing = q.execute()

    if existing.data:
        rec = existing.data[0]
        if rec["status"] == "pending":
            raise HTTPException(status_code=400, detail="Запрошення вже відправлено і очікує відповіді")
        if rec["status"] == "accepted":
            raise HTTPException(status_code=400, detail="Це журі вже має доступ до цього " + ("раунду" if scope == "round" else "турніру"))
        inv_res = supabase.table("jury_tournament_invitations") \
            .update({"status": "pending", "inviter_id": caller["id"]}) \
            .eq("id", rec["id"]) \
            .execute()
        if not inv_res.data:
            raise HTTPException(status_code=500, detail="Не вдалося оновити запрошення")
        invitation_id = rec["id"]
    else:
        insert_data: dict = {
            "tournament_id": payload.tournament_id,
            "jury_id":       payload.jury_id,
            "inviter_id":    caller["id"],
            "status":        "pending",
            "scope":         scope,
        }
        if scope == "round":
            insert_data["round_id"] = round_id
        inv_res = supabase.table("jury_tournament_invitations").insert(insert_data).execute()
        if not inv_res.data:
            raise HTTPException(status_code=500, detail="Не вдалося створити запрошення")
        invitation_id = inv_res.data[0]["id"]

    if scope == "round" and round_info:
        round_label = round_info.get("name") or f"Раунд {round_info.get('number', '')}"
        _notif_title   = f"Запрошення журі до {round_label} турніру \u00ab{tournament['name']}\u00bb"
        _notif_message = (
            f"Адміністратор {caller['username']} запрошує вас оцінювати роботи "
            f"у {round_label} турніру \u00ab{tournament['name']}\u00bb."
        )
    else:
        _notif_title   = f"Запрошення до журі турніру \u00ab{tournament['name']}\u00bb"
        _notif_message = (
            f"Адміністратор {caller['username']} запрошує вас взяти участь "
            f"в оцінюванні робіт турніру \u00ab{tournament['name']}\u00bb."
        )

    meta: dict = {
        "invitation_id":   invitation_id,
        "tournament_id":   payload.tournament_id,
        "tournament_name": tournament["name"],
        "inviter_id":      caller["id"],
        "inviter_name":    caller["username"],
        "scope":           scope,
    }
    if scope == "round":
        meta["round_id"] = round_id

    supabase.table("notifications").insert({
        "user_id": payload.jury_id,
        "type":    "jury_invitation",
        "title":   _notif_title,
        "message": _notif_message,
        "meta":    meta,
        "read":    False,
    }).execute()

    _jury_email_checked = get_user_email(payload.jury_id)
    if _jury_email_checked:
        _token = create_invitation_token(invitation_id, "jury_invitation")
        _api_url = os.getenv("API_URL", "http://localhost:8000")
        _accept_url = f"{_api_url}/api/invitations/accept-by-token?token={_token}" if _token else ""
        send_notification_email(_jury_email_checked, _notif_title, _notif_message, "jury_invitation", _accept_url)

    print(f"[JURY-INVITE] {caller['username']} -> {jury_user['username']} scope={scope} tournament={tournament['name']}", flush=True)
    return {"success": True, "invitation_id": invitation_id, "scope": scope}


@router.post("/api/rounds/{round_id}/invite-by-email")
async def invite_jury_by_email(round_id: str, payload: SendRoundJuryEmailInvitation, authorization: str = Header(...)):
    """
    Адмін запрошує людину, якої ще немає на платформі, бути журі для конкретного раунду.
    Надсилає email з унікальним посиланням на спеціальну реєстраційну сторінку.
    Email в формі буде заблокований, роль 'jury' видається автоматично,
    а після реєстрації одразу додається jury_assignment для цього раунду.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може запрошувати журі")

    import re as _re
    email = payload.email.strip().lower()
    if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Невірний формат email")

    # Перевіряємо — чи вже зареєстровано цей email
    existing_account = fetch_one(
        supabase.table("account").select("id, role").eq("email", email)
    )
    if existing_account:
        raise HTTPException(
            status_code=400,
            detail="Користувач з таким email вже зареєстрований. Запросіть його через панель журі турніру."
        )

    # Отримуємо раунд + турнір
    rnd = fetch_one(
        supabase.table("rounds")
            .select("id, number, name, tournament_id")
            .eq("id", round_id)
    )
    if not rnd:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name")
            .eq("id", rnd["tournament_id"])
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    # Перевіряємо — чи вже є активне запрошення для цього email + раунду
    existing_inv = supabase.table("jury_round_email_invitations") \
        .select("id, status, expires_at") \
        .eq("round_id", round_id) \
        .eq("invited_email", email) \
        .eq("status", "pending") \
        .execute()

    if existing_inv.data:
        inv_rec = existing_inv.data[0]
        from datetime import datetime, timezone as _tz
        expires = datetime.fromisoformat(inv_rec["expires_at"].replace("Z", "+00:00"))
        if expires > datetime.now(_tz.utc):
            raise HTTPException(status_code=400, detail="Активне запрошення для цього email вже існує")

    # Створюємо запис запрошення (токен генерується в БД DEFAULT)
    inv_res = supabase.table("jury_round_email_invitations").insert({
        "round_id":      round_id,
        "tournament_id": rnd["tournament_id"],
        "invited_email": email,
        "inviter_id":    caller["id"],
    }).execute()

    if not inv_res.data:
        raise HTTPException(status_code=500, detail="Не вдалося створити запрошення")

    inv = inv_res.data[0]
    inv_token = inv["token"]

    # Формуємо посилання на спеціальну сторінку реєстрації
    _frontend_url = os.getenv("FRONTEND_URL", "https://site-turing-crutchmasters-team-s.vercel.app")
    register_url = f"{_frontend_url}/jury-register?token={inv_token}"

    round_label = rnd.get("name") or f"Раунд {rnd['number']}"
    notif_title   = f"Запрошення до журі: {tournament['name']}"
    notif_message = (
        f"Адміністратор {caller['username']} запрошує вас оцінювати роботи у раунді "
        f"«{round_label}» турніру «{tournament['name']}». "
        f"Перейдіть за посиланням, щоб зареєструватись та приєднатись."
    )

    send_notification_email(email, notif_title, notif_message, "jury_invitation", register_url)
    print(
        f"[ROUND-EMAIL-INVITE] {caller['username']} → {email} "
        f"для раунду {round_id} турніру {tournament['name']}",
        flush=True
    )
    return {"success": True, "invitation_id": inv["id"]}


@router.get("/api/jury-register/validate")
async def validate_jury_register_token(token: str):
    """
    Фронтенд викликає цей ендпоінт при завантаженні сторінки /jury-register?token=...
    Повертає email та інформацію про раунд/турнір, або помилку якщо токен невалідний/прострочений.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    inv = fetch_one(
        supabase.table("jury_round_email_invitations")
            .select("id, round_id, tournament_id, invited_email, status, expires_at")
            .eq("token", token)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено або посилання недійсне")

    from datetime import datetime, timezone as _tz
    expires = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
    if expires < datetime.now(_tz.utc):
        supabase.table("jury_round_email_invitations") \
            .update({"status": "expired"}) \
            .eq("id", inv["id"]) \
            .execute()
        raise HTTPException(status_code=410, detail="Посилання для реєстрації закінчило термін дії")

    if inv["status"] == "accepted":
        raise HTTPException(status_code=409, detail="Це запрошення вже було використано")

    if inv["status"] == "expired":
        raise HTTPException(status_code=410, detail="Посилання для реєстрації закінчило термін дії")

    rnd = fetch_one(
        supabase.table("rounds")
            .select("id, number, name, tournament_id")
            .eq("id", inv["round_id"])
    )
    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name")
            .eq("id", inv["tournament_id"])
    )

    return {
        "valid":          True,
        "invitation_id":  inv["id"],
        "email":          inv["invited_email"],
        "round_id":       inv["round_id"],
        "round_number":   rnd["number"] if rnd else None,
        "round_name":     rnd.get("name") if rnd else None,
        "tournament_id":  inv["tournament_id"],
        "tournament_name": tournament["name"] if tournament else None,
    }


@router.post("/api/jury-register/complete")
async def complete_jury_registration(token: str, authorization: str = Header(...)):
    """
    Викликається після успішної реєстрації через Supabase Auth.
    Встановлює роль 'jury', позначає запрошення як 'accepted',
    додає jury_assignment для раунду та jury_tournament_invitations.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    jwt_token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(jwt_token)
    caller_id = caller["id"]

    inv = fetch_one(
        supabase.table("jury_round_email_invitations")
            .select("id, round_id, tournament_id, invited_email, status, expires_at")
            .eq("token", token)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")

    from datetime import datetime, timezone as _tz
    expires = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
    if expires < datetime.now(_tz.utc):
        raise HTTPException(status_code=410, detail="Посилання закінчило термін дії")

    if inv["status"] == "accepted":
        # Вже прийнято — просто повертаємо success (ідемпотентно)
        return {"success": True, "already_accepted": True}

    # Перевіряємо що email акаунту збігається з запрошеним
    account = fetch_one(
        supabase.table("account").select("id, email, role").eq("id", caller_id)
    )
    if not account:
        raise HTTPException(status_code=404, detail="Акаунт не знайдено")

    if account["email"].lower() != inv["invited_email"].lower():
        raise HTTPException(
            status_code=403,
            detail="Email акаунту не збігається з запрошеним email"
        )

    # 1. Встановлюємо роль 'jury' якщо ще не встановлена
    if account.get("role") != "jury":
        supabase.table("account") \
            .update({"role": "jury"}) \
            .eq("id", caller_id) \
            .execute()

    # 2. jury_tournament_invitations — додаємо запис (прийнятий)
    existing_tourn_inv = supabase.table("jury_tournament_invitations") \
        .select("id, status") \
        .eq("tournament_id", inv["tournament_id"]) \
        .eq("jury_id", caller_id) \
        .execute()

    if existing_tourn_inv.data:
        if existing_tourn_inv.data[0]["status"] != "accepted":
            supabase.table("jury_tournament_invitations") \
                .update({"status": "accepted"}) \
                .eq("id", existing_tourn_inv.data[0]["id"]) \
                .execute()
    else:
        supabase.table("jury_tournament_invitations").insert({
            "tournament_id": inv["tournament_id"],
            "jury_id":       caller_id,
            "inviter_id":    inv["inviter_id"] if "inviter_id" in inv else caller_id,
            "status":        "accepted",
        }).execute()

    # 3. jury_assignments — тільки для конкретного раунду
    existing_assign = supabase.table("jury_assignments") \
        .select("id") \
        .eq("jury_id", caller_id) \
        .eq("round_id", inv["round_id"]) \
        .execute()

    if not existing_assign.data:
        supabase.table("jury_assignments").insert({
            "jury_id":       caller_id,
            "round_id":      inv["round_id"],
            "tournament_id": inv["tournament_id"],
        }).execute()

    # 4. Позначаємо запрошення як прийняте
    supabase.table("jury_round_email_invitations") \
        .update({
            "status":      "accepted",
            "accepted_at": datetime.now(_tz.utc).isoformat(),
            "accepted_by": caller_id,
        }) \
        .eq("id", inv["id"]) \
        .execute()

    print(
        f"[JURY-REG-COMPLETE] {caller_id} прийняв запрошення для раунду {inv['round_id']}",
        flush=True
    )
    return {"success": True, "round_id": inv["round_id"], "tournament_id": inv["tournament_id"]}


@router.get("/api/rounds/{round_id}/email-invitations")
async def get_round_email_invitations(round_id: str, authorization: str = Header(...)):
    """Список email-запрошень для раунду (тільки для адміна)."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    jwt_token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(jwt_token)
    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор")

    res = supabase.table("jury_round_email_invitations") \
        .select("id, invited_email, status, created_at, expires_at, accepted_at") \
        .eq("round_id", round_id) \
        .order("created_at", desc=True) \
        .execute()

    return {"invitations": res.data or []}


@router.post("/api/tournaments/{tournament_id}/invite-by-email")
async def invite_jury_by_email_tournament(
    tournament_id: str,
    payload: SendTournamentJuryEmailInvitation,
    authorization: str = Header(...),
):
    """
    Адмін запрошує незареєстровану людину бути журі для всього турніру.
    Після реєстрації вона отримає jury_assignments для всіх існуючих раундів.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може запрошувати журі")

    import re as _re
    email = payload.email.strip().lower()
    if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Невірний формат email")

    # Перевіряємо — чи вже зареєстровано цей email
    existing_account = fetch_one(
        supabase.table("account").select("id, role").eq("email", email)
    )
    if existing_account:
        raise HTTPException(
            status_code=400,
            detail="Користувач з таким email вже зареєстрований. Запросіть його через панель журі турніру."
        )

    tournament = fetch_one(
        supabase.table("tournaments").select("id, name").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    # Перевіряємо — чи вже є активне pending-запрошення для цього email + турніру
    existing_inv = supabase.table("jury_tournament_email_invitations") \
        .select("id, status, expires_at") \
        .eq("tournament_id", tournament_id) \
        .eq("invited_email", email) \
        .eq("status", "pending") \
        .execute()

    if existing_inv.data:
        from datetime import datetime, timezone as _tz
        expires = datetime.fromisoformat(existing_inv.data[0]["expires_at"].replace("Z", "+00:00"))
        if expires > datetime.now(_tz.utc):
            raise HTTPException(status_code=400, detail="Активне запрошення для цього email вже існує")

    inv_res = supabase.table("jury_tournament_email_invitations").insert({
        "tournament_id": tournament_id,
        "invited_email": email,
        "inviter_id":    caller["id"],
    }).execute()

    if not inv_res.data:
        raise HTTPException(status_code=500, detail="Не вдалося створити запрошення")

    inv = inv_res.data[0]
    inv_token = inv["token"]

    _frontend_url = os.getenv("FRONTEND_URL", "https://site-turing-crutchmasters-team-s.vercel.app")
    register_url = f"{_frontend_url}/jury-register?token={inv_token}"

    notif_title   = f"Запрошення до журі турніру: {tournament['name']}"
    notif_message = (
        f"Адміністратор {caller['username']} запрошує вас бути журі у турнірі "
        f"«{tournament['name']}». "
        f"Перейдіть за посиланням, щоб зареєструватись та приєднатись."
    )

    send_notification_email(email, notif_title, notif_message, "jury_invitation", register_url)
    print(
        f"[TOURNAMENT-EMAIL-INVITE] {caller['username']} → {email} "
        f"для турніру {tournament['name']}",
        flush=True
    )
    return {"success": True, "invitation_id": inv["id"]}


@router.get("/api/tournaments/{tournament_id}/email-invitations")
async def get_tournament_email_invitations(tournament_id: str, authorization: str = Header(...)):
    """Список email-запрошень на весь турнір (тільки для адміна)."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    jwt_token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(jwt_token)
    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор")

    res = supabase.table("jury_tournament_email_invitations") \
        .select("id, invited_email, status, created_at, expires_at, accepted_at") \
        .eq("tournament_id", tournament_id) \
        .order("created_at", desc=True) \
        .execute()

    return {"invitations": res.data or []}


@router.post("/api/jury-invitations/respond")
async def respond_jury_invitation(payload: RespondJuryInvitation, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") != "jury":
        raise HTTPException(status_code=403, detail="Тільки журі може відповідати на запрошення журі")

    inv = fetch_one(
        supabase.table("jury_tournament_invitations")
            .select("id, tournament_id, jury_id, inviter_id, status, scope, round_id")
            .eq("id", payload.invitation_id)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")
    if inv["jury_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Це запрошення не для вас")
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Запрошення вже {inv['status']}")

    inv_scope    = inv.get("scope", "tournament")
    inv_round_id = inv.get("round_id")

    new_status = "accepted" if payload.accept else "declined"

    supabase.table("jury_tournament_invitations") \
        .update({"status": new_status}) \
        .eq("id", payload.invitation_id) \
        .execute()

    supabase.table("notifications") \
        .update({"read": True}) \
        .eq("type", "jury_invitation") \
        .eq("user_id", caller["id"]) \
        .eq("read", False) \
        .execute()

    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name")
            .eq("id", inv["tournament_id"])
    )

    if payload.accept:
        if inv_scope == "round" and inv_round_id:
            # Доступ лише до конкретного раунду
            rounds_to_assign = [{"id": inv_round_id}]
        else:
            # Доступ до всіх існуючих раундів турніру
            rounds_res = supabase.table("rounds") \
                .select("id") \
                .eq("tournament_id", inv["tournament_id"]) \
                .execute()
            rounds_to_assign = rounds_res.data or []

        for r in rounds_to_assign:
            exists = supabase.table("jury_assignments") \
                .select("id") \
                .eq("jury_id", caller["id"]) \
                .eq("round_id", r["id"]) \
                .execute()
            if not exists.data:
                supabase.table("jury_assignments").insert({
                    "jury_id":       caller["id"],
                    "round_id":      r["id"],
                    "tournament_id": inv["tournament_id"],
                }).execute()

        if tournament:
            if inv_scope == "round" and inv_round_id:
                round_info = fetch_one(
                    supabase.table("rounds").select("name, number").eq("id", inv_round_id)
                )
                round_label = (round_info.get("name") or f"Раунд {round_info.get('number','')}") if round_info else "раунд"
                _notif_title   = f"{caller['username']} прийняв запрошення журі ({round_label})"
                _notif_message = (
                    f"Журі {caller['username']} прийняв запрошення до оцінювання "
                    f"{round_label} турніру «{tournament['name']}»."
                )
            else:
                _notif_title   = f"{caller['username']} прийняв запрошення журі"
                _notif_message = (
                    f"Журі {caller['username']} прийняв запрошення до оцінювання "
                    f"турніру «{tournament['name']}»."
                )
            supabase.table("notifications").insert({
                "user_id": inv["inviter_id"],
                "type":    "jury_invitation_accepted",
                "title":   _notif_title,
                "message": _notif_message,
                "meta": {
                    "tournament_id":   inv["tournament_id"],
                    "tournament_name": tournament["name"] if tournament else "",
                    "jury_id":         caller["id"],
                    "jury_name":       caller["username"],
                    "scope":           inv_scope,
                },
                "read": False,
            }).execute()
            _inviter_email = get_user_email(inv["inviter_id"])
            if _inviter_email:
                send_notification_email(_inviter_email, _notif_title, _notif_message, "jury_invitation_accepted")

        print(f"[JURY-INVITE] {caller['username']} ПРИЙНЯВ scope={inv_scope} для {inv['tournament_id']}", flush=True)
        return {"success": True, "status": "accepted", "scope": inv_scope}

    else:
        if tournament:
            _notif_title   = f"{caller['username']} відхилив запрошення журі"
            _notif_message = (
                f"Журі {caller['username']} відхилив запрошення до оцінювання "
                f"турніру «{tournament['name']}»."
            )
            supabase.table("notifications").insert({
                "user_id": inv["inviter_id"],
                "type":    "jury_invitation_declined",
                "title":   _notif_title,
                "message": _notif_message,
                "meta": {
                    "tournament_id":   inv["tournament_id"],
                    "tournament_name": tournament["name"] if tournament else "",
                    "jury_id":         caller["id"],
                    "jury_name":       caller["username"],
                },
                "read": False,
            }).execute()
            _inviter_email = get_user_email(inv["inviter_id"])
            if _inviter_email:
                send_notification_email(_inviter_email, _notif_title, _notif_message, "jury_invitation_declined")

        print(f"[JURY-INVITE] {caller['username']} ВІДХИЛИВ журі для {inv['tournament_id']}", flush=True)
        return {"success": True, "status": "declined"}


@router.get("/api/jury-invitations/my")
async def get_my_jury_invitations(authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") != "jury":
        raise HTTPException(status_code=403, detail="Тільки журі може переглядати свої запрошення")

    inv_res = supabase.table("jury_tournament_invitations") \
        .select("id, tournament_id, inviter_id, status, created_at") \
        .eq("jury_id", caller["id"]) \
        .order("created_at", desc=True) \
        .execute()

    invitations = inv_res.data or []
    if not invitations:
        return {"invitations": []}

    tour_ids    = list({i["tournament_id"] for i in invitations})
    inviter_ids = list({i["inviter_id"]    for i in invitations})

    tours_res = supabase.table("tournaments") \
        .select("id, name, status") \
        .in_("id", tour_ids) \
        .execute()
    tours_map = {t["id"]: t for t in (tours_res.data or [])}

    inviters_res = supabase.table("account") \
        .select("id, username, login") \
        .in_("id", inviter_ids) \
        .execute()
    inviters_map = {a["id"]: a for a in (inviters_res.data or [])}

    enriched = [{
        **inv,
        "tournament_name":   tours_map.get(inv["tournament_id"], {}).get("name", "—"),
        "tournament_status": tours_map.get(inv["tournament_id"], {}).get("status", "—"),
        "inviter_username":  inviters_map.get(inv["inviter_id"], {}).get("username", "—"),
        "inviter_login":     inviters_map.get(inv["inviter_id"], {}).get("login", "—"),
    } for inv in invitations]

    return {"invitations": enriched}


@router.get("/api/tournaments/{tournament_id}/jury")
async def get_tournament_jury(tournament_id: str, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може переглядати журі турніру")

    accepted = supabase.table("jury_tournament_invitations") \
        .select("jury_id, created_at") \
        .eq("tournament_id", tournament_id) \
        .eq("status", "accepted") \
        .execute()

    jury_ids = [r["jury_id"] for r in (accepted.data or [])]
    if not jury_ids:
        return {"jury": []}

    jury_res = supabase.table("account") \
        .select("id, username, login, email, avatar_url") \
        .in_("id", jury_ids) \
        .execute()

    return {"jury": jury_res.data or []}


@router.get("/api/tournaments/{tournament_id}/jury-candidates")
async def get_jury_candidates(
    tournament_id: str,
    authorization: str = Header(...),
    scope: str = "tournament",
    round_id: str | None = None,
):
    """
    Повертає список журі-кандидатів.
    scope=tournament: виключає тих, хто вже запрошений/прийнятий на весь турнір.
    scope=round&round_id=...: виключає тих, хто вже запрошений/прийнятий саме до цього раунду.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може переглядати кандидатів")

    all_jury = supabase.table("account") \
        .select("id, username, login, email, avatar_url") \
        .eq("role", "jury") \
        .execute()

    # Завжди виключаємо тих, хто запрошений на весь турнір (вони вже мають доступ до всіх раундів)
    already_tournament = supabase.table("jury_tournament_invitations") \
        .select("jury_id, status, scope") \
        .eq("tournament_id", tournament_id) \
        .eq("scope", "tournament") \
        .in_("status", ["pending", "accepted"]) \
        .execute()

    already_ids = {r["jury_id"] for r in (already_tournament.data or [])}

    # Якщо запит для конкретного раунду — також виключаємо тих, хто вже запрошений саме до цього раунду
    if scope == "round" and round_id:
        already_round = supabase.table("jury_tournament_invitations") \
            .select("jury_id, status") \
            .eq("tournament_id", tournament_id) \
            .eq("scope", "round") \
            .eq("round_id", round_id) \
            .in_("status", ["pending", "accepted"]) \
            .execute()
        for r in (already_round.data or []):
            already_ids.add(r["jury_id"])

    candidates = [u for u in (all_jury.data or []) if u["id"] not in already_ids]

    return {"candidates": candidates}


@router.delete("/api/tournaments/{tournament_id}/jury/{jury_id}")
async def remove_jury_from_tournament(
    tournament_id: str,
    jury_id: str,
    authorization: str = Header(...),
):
    """
    Видаляє журі з турніру (тільки admin / superadmin).

    Що відбувається:
    1. Запис у jury_tournament_invitations отримує status='removed',
       а також removed_at і removed_by — для аудиту.
    2. Всі непризначені submissions цього журі в цьому турнірі
       видаляються з jury_submission_assignments.
    3. Вже виставлені оцінки (jury_evaluations) НЕ чіпаються —
       вони залишаються в БД як є.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Тільки адміністратор може видаляти журі з турніру",
        )

    # 1. Перевіряємо що турнір існує
    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name")
            .eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    # 2. Знаходимо активний запис запрошення
    invitation = fetch_one(
        supabase.table("jury_tournament_invitations")
            .select("id, status")
            .eq("tournament_id", tournament_id)
            .eq("jury_id", jury_id)
            .eq("status", "accepted")
    )
    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Журі не є активним учасником цього турніру",
        )

    from datetime import datetime, timezone as _tz

    # 3. М'яке видалення — змінюємо статус на 'removed'
    supabase.table("jury_tournament_invitations") \
        .update({
            "status":     "removed",
            "removed_at": datetime.now(_tz.utc).isoformat(),
            "removed_by": caller["id"],
            "updated_at": datetime.now(_tz.utc).isoformat(),
        }) \
        .eq("id", invitation["id"]) \
        .execute()

    # 4. Прибираємо jury_submission_assignments цього журі в цьому турнірі
    #    (тільки ті, де вже НЕ виставлена оцінка)
    evaluated_subs_res = supabase.table("jury_evaluations") \
        .select("submission_id") \
        .eq("jury_id", jury_id) \
        .execute()
    evaluated_sub_ids = {r["submission_id"] for r in (evaluated_subs_res.data or [])}

    assignments_res = supabase.table("jury_submission_assignments") \
        .select("id, submission_id") \
        .eq("jury_id", jury_id) \
        .eq("tournament_id", tournament_id) \
        .execute()

    ids_to_delete = [
        r["id"]
        for r in (assignments_res.data or [])
        if r["submission_id"] not in evaluated_sub_ids
    ]

    if ids_to_delete:
        supabase.table("jury_submission_assignments") \
            .delete() \
            .in_("id", ids_to_delete) \
            .execute()

    print(
        f"[JURY-REMOVE] jury={jury_id} видалено з tournament={tournament_id} "
        f"адміном={caller['id']}. Прибрано {len(ids_to_delete)} assignments.",
        flush=True,
    )

    return {
        "ok": True,
        "removed_jury_id":        jury_id,
        "tournament_id":          tournament_id,
        "deleted_assignments":    len(ids_to_delete),
        "preserved_evaluations":  len(evaluated_sub_ids),
    }
