import os
import base64
import json
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr


def decode_jwt_payload(token: str) -> dict:
    """Декодируем JWT payload без проверки подписи."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT structure")
        payload_b64 = parts[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token format: {e}")


def fetch_one(query) -> dict | None:
    """
    Безопасная замена .single() / .maybe_single().
    Выполняет запрос и возвращает первую строку или None.
    Не падает с исключением если строк 0.
    """
    try:
        result = query.limit(1).execute()
        if result and result.data:
            return result.data[0]
        return None
    except Exception:
        return None


# --- ИНИЦИАЛИЗАЦИЯ ---
load_dotenv()

SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_KEY         = os.getenv("SUPABASE_KEY")          # anon key (для auth.sign_in)
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service_role key (обходит RLS)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ОШИБКА: Ключи Supabase не найдены! Проверь SUPABASE_URL и SUPABASE_SERVICE_KEY в .env", flush=True)
    supabase      = None
    supabase_auth = None
else:
    # supabase — клиент с service_role, полностью обходит RLS
    supabase: Client      = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    # supabase_auth — anon-клиент, только для sign_in_with_password
    supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else supabase
    print("Бэкенд подключен к Supabase (service role)", flush=True)

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "https://site-turing-crutchmasters-team-s.pages.dev",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- МОДЕЛИ ДАННЫХ ---
class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    login: str
    password: str

class ChangeRole(BaseModel):
    target_user_id: str
    new_role: str

class SendInvitation(BaseModel):
    team_id: str
    invitee_id: str

class RespondInvitation(BaseModel):
    invitation_id: str
    accept: bool

# --- КОНСТАНТЫ ---
ALLOWED_ROLES = {"user", "jury", "admin"}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def get_caller(token: str) -> dict:
    """
    Декодируем токен и возвращаем строку аккаунта из БД.
    Ищем сначала по auth_id (sub из JWT), затем fallback по email.
    """
    jwt_payload  = decode_jwt_payload(token)
    auth_id      = jwt_payload.get("sub")
    caller_email = jwt_payload.get("email")

    print(f"[get_caller] auth_id(sub)={auth_id!r} email={caller_email!r}", flush=True)

    if not caller_email and not auth_id:
        raise HTTPException(status_code=401, detail="Invalid token: no email or sub claim")

    account = None

    # Сначала ищем по auth_id (надёжнее)
    if auth_id:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("auth_id", auth_id)
            )
        except Exception as e:
            print(f"[get_caller] DB error (auth_id lookup): {e}", flush=True)

    # Fallback — ищем по email (для старых записей без auth_id)
    if not account and caller_email:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("email", caller_email)
            )
            # Если нашли по email — попутно заполняем auth_id чтобы в следующий раз было быстрее
            if account and auth_id and not account.get("auth_id"):
                try:
                    supabase.table("account")                         .update({"auth_id": auth_id})                         .eq("id", account["id"])                         .execute()
                    print(f"[get_caller] auto-filled auth_id for {caller_email}", flush=True)
                except Exception:
                    pass
        except Exception as e:
            print(f"[get_caller] DB error (email lookup): {e}", flush=True)

    print(f"[get_caller] account found: {account}", flush=True)
    if not account:
        raise HTTPException(
            status_code=403,
            detail=f"Аккаунт не найден. email={caller_email!r} auth_id={auth_id!r}"
        )
    return account


def send_invitation_email(to_email, to_username, team_name, captain_username, invitation_id):
    """Отправка email (best-effort — не ломает запрос при ошибке)."""
    try:
        site_url   = os.getenv("SITE_URL", "http://localhost:3000")
        accept_url = f"{site_url}/notifications"
        supabase_auth.auth.admin.send_email_otp(
            email=to_email,
            options={"data": {
                "invitation_id": invitation_id,
                "team_name":     team_name,
                "captain":       captain_username,
                "accept_url":    accept_url,
            }}
        )
    except Exception as e:
        print(f"[EMAIL] Не удалось отправить письмо на {to_email}: {e}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/test")
def connection_test():
    return {"status": "ok", "message": "Backend status active"}


# 1. РЕГИСТРАЦИЯ
@app.post("/api/register")
async def register_user(user: UserRegister):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    try:
        # Проверяем дубликат email в нашей таблице
        existing = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

        # Создаём пользователя в Supabase Auth (получаем auth_id)
        try:
            auth_response = supabase.auth.admin.create_user({
                "email":            user.email,
                "password":         user.password,
                "email_confirm":    True,
                "user_metadata": {
                    "username": user.username,
                    "login":    user.login,
                },
            })
            auth_id = auth_response.user.id if auth_response.user else None
        except Exception as auth_err:
            print(f"[REGISTER] Auth error: {auth_err}", flush=True)
            raise HTTPException(status_code=400, detail=f"Ошибка создания Auth пользователя: {auth_err}")

        # Создаём запись в таблице account с auth_id
        result = supabase.table("account").insert({
            "username": user.username,
            "login":    user.login,
            "email":    user.email,
            "status":   "active",
            "role":     "user",
            "auth_id":  auth_id,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Не удалось создать пользователя")

        return {"success": True, "message": "Пользователь успешно зарегистрирован"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 2. ЛОГИН
@app.post("/api/login")
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
            "access_token": auth_response.session.access_token,
            "user":         user_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 3. ПОЛУЧЕНИЕ EMAIL ПО ЛОГИНУ
@app.get("/api/get-email")
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


# 4. СМЕНА РОЛИ (только суперадмин)
@app.post("/api/change-role")
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


# ─────────────────────────────────────────────────────────────────────────────
# 5. КОМАНДЫ
# ─────────────────────────────────────────────────────────────────────────────

class CreateTeam(BaseModel):
    name: str
    city_school_org: str | None = None
    description: str | None = None

class UpdateTeam(BaseModel):
    name: str | None = None
    city_school_org: str | None = None
    description: str | None = None


@app.post("/api/teams")
async def create_team(payload: CreateTeam, authorization: str = Header(...)):
    """Создать команду. Текущий пользователь становится капитаном."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    result = supabase.table("teams").insert({
        "name":             payload.name,
        "captain_id":       caller["id"],
        "members_ids":      [],
        "city_school_org":  payload.city_school_org,
        "description":      payload.description,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не удалось создать команду")

    print(f"[TEAM] {caller['username']} создал команду {payload.name}", flush=True)
    return {"success": True, "team": result.data[0]}


@app.get("/api/teams")
async def get_teams(authorization: str = Header(...)):
    """Получить список всех команд."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    get_caller(token)  # просто проверяем авторизацию

    result = supabase.table("teams").select("*").order("name").execute()
    return {"teams": result.data or []}


@app.get("/api/teams/my")
async def get_my_team(authorization: str = Header(...)):
    """Получить команду текущего пользователя (где он капитан или участник)."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Команды где капитан
    captain_res = supabase.table("teams")         .select("*")         .eq("captain_id", caller["id"])         .execute()

    # Команды где участник (members_ids содержит id)
    member_res = supabase.table("teams")         .select("*")         .contains("members_ids", [caller["id"]])         .execute()

    teams = captain_res.data or []
    for t in (member_res.data or []):
        if t["id"] not in [x["id"] for x in teams]:
            teams.append(t)

    return {"teams": teams}


@app.get("/api/teams/{team_id}")
async def get_team(team_id: str, authorization: str = Header(...)):
    """Получить команду по ID."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    get_caller(token)

    team = fetch_one(supabase.table("teams").select("*").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    return {"team": team}


@app.patch("/api/teams/{team_id}")
async def update_team(team_id: str, payload: UpdateTeam, authorization: str = Header(...)):
    """Обновить команду. Только капитан."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(supabase.table("teams").select("id, captain_id").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан может редактировать команду")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Нечего обновлять")

    result = supabase.table("teams").update(updates).eq("id", team_id).execute()
    return {"success": True, "team": result.data[0] if result.data else None}


@app.delete("/api/teams/{team_id}")
async def delete_team(team_id: str, authorization: str = Header(...)):
    """Удалить команду. Только капитан."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    team = fetch_one(supabase.table("teams").select("id, captain_id").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан может удалить команду")

    supabase.table("teams").delete().eq("id", team_id).execute()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# 6. СИСТЕМА ПРИГЛАШЕНИЙ
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/invitations/send")
async def send_invitation(payload: SendInvitation, authorization: str = Header(...)):
    """Капитан отправляет приглашение. Создаёт запись в team_invitations + уведомление."""
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

    supabase.table("notifications").insert({
        "user_id": payload.invitee_id,
        "type":    "team_invitation",
        "title":   f"Запрошення до команди «{team['name']}»",
        "message": (
            f"Капітан команди «{team['name']}» ({caller['username']}) "
            f"запрошує вас приєднатися до команди."
        ),
        "meta": json.dumps({
            "invitation_id": invitation_id,
            "team_id":       payload.team_id,
            "team_name":     team["name"],
            "inviter_id":    caller["id"],
            "inviter_name":  caller["username"],
        }),
        "read": False,
    }).execute()

    send_invitation_email(
        to_email=invitee["email"],
        to_username=invitee["username"],
        team_name=team["name"],
        captain_username=caller["username"],
        invitation_id=invitation_id,
    )

    print(f"[INVITE] {caller['username']} → {invitee['username']} для команды {team['name']}", flush=True)
    return {"success": True, "invitation_id": invitation_id}


@app.post("/api/invitations/respond")
async def respond_invitation(payload: RespondInvitation, authorization: str = Header(...)):
    """Приглашённый принимает или отклоняет приглашение."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    inv = fetch_one(
        supabase.table("team_invitations")
            .select("id, team_id, inviter_id, invitee_id, status")
            .eq("id", payload.invitation_id)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if inv["invitee_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Это приглашение не для вас")
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Приглашение уже {inv['status']}")

    new_status = "accepted" if payload.accept else "declined"

    supabase.table("team_invitations") \
        .update({"status": new_status}) \
        .eq("id", payload.invitation_id) \
        .execute()

    supabase.table("notifications") \
        .update({"read": True}) \
        .eq("type", "team_invitation") \
        .eq("user_id", caller["id"]) \
        .eq("read", False) \
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

        supabase.table("notifications").insert({
            "user_id": team["captain_id"],
            "type":    "invitation_accepted",
            "title":   f"{caller['username']} прийняв запрошення",
            "message": f"Користувач {caller['username']} прийняв ваше запрошення до команди «{team['name']}».",
            "meta":    json.dumps({
                "team_id":    inv["team_id"],
                "team_name":  team["name"],
                "new_member": caller["username"],
            }),
            "read": False,
        }).execute()

        print(f"[INVITE] {caller['username']} принял приглашение в команду {inv['team_id']}", flush=True)
        return {"success": True, "status": "accepted"}

    else:
        team = fetch_one(
            supabase.table("teams").select("name, captain_id").eq("id", inv["team_id"])
        )
        if team:
            supabase.table("notifications").insert({
                "user_id": team["captain_id"],
                "type":    "invitation_declined",
                "title":   f"{caller['username']} відхилив запрошення",
                "message": f"Користувач {caller['username']} відхилив ваше запрошення до команди «{team['name']}».",
                "meta":    json.dumps({
                    "team_id":   inv["team_id"],
                    "team_name": team["name"],
                }),
                "read": False,
            }).execute()

        print(f"[INVITE] {caller['username']} отклонил приглашение в команду {inv['team_id']}", flush=True)
        return {"success": True, "status": "declined"}


@app.get("/api/invitations/my")
async def get_my_invitations(authorization: str = Header(...)):
    """Получить все ожидающие приглашения текущего пользователя."""
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

    enriched = []
    for inv in invitations:
        team_r    = fetch_one(supabase.table("teams").select("name, city_school_org").eq("id", inv["team_id"]))
        inviter_r = fetch_one(supabase.table("account").select("username, login").eq("id", inv["inviter_id"]))
        enriched.append({
            **inv,
            "team_name":        team_r.get("name")            if team_r else "—",
            "team_org":         team_r.get("city_school_org") if team_r else None,
            "inviter_username": inviter_r.get("username")     if inviter_r else "—",
            "inviter_login":    inviter_r.get("login")        if inviter_r else "—",
        })

    return {"invitations": enriched}


# ─────────────────────────────────────────────────────────────────────────────
# 6. УВЕДОМЛЕНИЯ
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/notifications")
async def get_notifications(authorization: str = Header(...), limit: int = 20, offset: int = 0):
    """Получить уведомления текущего пользователя."""
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


@app.get("/api/notifications/unread-count")
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


@app.post("/api/notifications/mark-read")
async def mark_notification_read(body: dict, authorization: str = Header(...)):
    """Отметить одно или все уведомления как прочитанные. Body: {ids: [str]} или {all: true}"""
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
