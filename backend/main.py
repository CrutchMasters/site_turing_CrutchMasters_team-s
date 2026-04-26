import os
import base64
import json
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr


from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler

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

# ─────────────────────────────────────────────────────────────────────────────
# AUTO STATUS UPDATER: оновлює статус турнірів кожну хвилину
# Логіка переходів:
#   upcoming   → registration  коли now >= registration_from
#   registration → upcoming    коли now < registration_from  (скасування)
#   registration → active      коли now >= start_at (і registration_to минув або немає)
#   active     → finished      коли всі раунди finished або start_at+тривалість минув
# ─────────────────────────────────────────────────────────────────────────────

def update_tournament_statuses():
    if not supabase:
        return
    try:
        now = datetime.now(timezone.utc)

        res = supabase.table("tournaments").select(
            "id, status, registration_from, registration_to, start_at"
        ).execute()
        tournaments = res.data or []

        for t in tournaments:
            current = t["status"]
            # Пропускаємо фінальні статуси
            if current in ("finished", "cancelled"):
                continue

            reg_from  = datetime.fromisoformat(t["registration_from"]) if t.get("registration_from") else None
            reg_to    = datetime.fromisoformat(t["registration_to"])   if t.get("registration_to")   else None
            start_at  = datetime.fromisoformat(t["start_at"])          if t.get("start_at")          else None

            new_status = current

            if start_at and now >= start_at:
                # Турнір почався → active
                new_status = "active"
            elif reg_from and now >= reg_from and (not reg_to or now < reg_to):
                # Реєстрація відкрита
                new_status = "registration"
            elif reg_to and now >= reg_to and (not start_at or now < start_at):
                # Реєстрація закрита, старт ще попереду → upcoming (очікування)
                new_status = "upcoming"
            else:
                # До початку реєстрації
                new_status = "upcoming"

            if new_status != current:
                supabase.table("tournaments").update({"status": new_status}).eq("id", t["id"]).execute()
                print(f"[SCHEDULER] Турнір {t['id']}: {current} → {new_status}", flush=True)

    except Exception as e:
        print(f"[SCHEDULER] Помилка оновлення статусів: {e}", flush=True)


_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(update_tournament_statuses, "interval", seconds=60, id="tournament_status_updater")

@app.on_event("startup")
def start_scheduler():
    _scheduler.start()
    update_tournament_statuses()  # Одразу при старті
    print("[SCHEDULER] Запущено оновлення статусів турнірів (кожні 60 сек)", flush=True)

@app.on_event("shutdown")
def stop_scheduler():
    _scheduler.shutdown(wait=False)

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
    Ищем по id (sub из JWT) — колонка id в таблице account совпадает с Supabase Auth UUID.
    Fallback по email для надёжности.
    """
    jwt_payload  = decode_jwt_payload(token)
    user_id      = jwt_payload.get("sub")
    caller_email = jwt_payload.get("email")

    print(f"[get_caller] id(sub)={user_id!r} email={caller_email!r}", flush=True)

    if not user_id and not caller_email:
        raise HTTPException(status_code=401, detail="Invalid token: no sub or email claim")

    account = None

    # Ищем по id (sub из JWT = Supabase Auth UUID = колонка id в account)
    if user_id:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("id", user_id)
            )
        except Exception as e:
            print(f"[get_caller] DB error (id lookup): {e}", flush=True)

    # Fallback — ищем по email
    if not account and caller_email:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("email", caller_email)
            )
        except Exception as e:
            print(f"[get_caller] DB error (email lookup): {e}", flush=True)

    print(f"[get_caller] account found: {account}", flush=True)
    if not account:
        raise HTTPException(
            status_code=403,
            detail=f"Аккаунт не найден. email={caller_email!r} id={user_id!r}"
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

        # Создаём пользователя в Supabase Auth (получаем UUID)
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
            auth_uuid = auth_response.user.id if auth_response.user else None
        except Exception as auth_err:
            print(f"[REGISTER] Auth error: {auth_err}", flush=True)
            raise HTTPException(status_code=400, detail=f"Ошибка создания Auth пользователя: {auth_err}")

        # Создаём запись в таблице account, используя Supabase Auth UUID как id
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
    telegram_url: str | None = None
    discord_url: str | None = None

class UpdateTeam(BaseModel):
    name: str | None = None
    city_school_org: str | None = None
    description: str | None = None
    telegram_url: str | None = None
    discord_url: str | None = None

class RegisterTeamForTournament(BaseModel):
    team_id: str
    tournament_id: str

class SubmitWork(BaseModel):
    team_id: str
    github_url: str | None = None
    video_url:  str | None = None
    demo_url:   str | None = None
    description: str | None = None
    files: list[dict] = []  # [{"name": "file.zip", "path": "submissions/round/team/file.zip"}]


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
        "telegram_url":     payload.telegram_url,
        "discord_url":      payload.discord_url,
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


@app.post("/api/tournaments/register")
async def register_team_for_tournament(payload: RegisterTeamForTournament, authorization: str = Header(...)):
    """
    Зареєструвати команду на турнір.
    Тільки капітан команди може реєструвати її.
    Використовує service_role ключ — обходить RLS.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Перевіряємо що турнір існує і реєстрація відкрита
    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, status, max_teams")
            .eq("id", payload.tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if tournament["status"] != "registration":
        raise HTTPException(status_code=400, detail=f"Реєстрація на турнір закрита (статус: {tournament['status']})")

    # Перевіряємо що команда існує і caller є капітаном
    team = fetch_one(
        supabase.table("teams")
            .select("id, name, captain_id, tournament_id")
            .eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Тільки капітан команди може реєструвати її на турнір")
    if team["tournament_id"]:
        raise HTTPException(status_code=400, detail="Команда вже зареєстрована в іншому турнірі")

    # Перевіряємо ліміт команд
    if tournament["max_teams"]:
        count_res = supabase.table("teams") \
            .select("id", count="exact") \
            .eq("tournament_id", payload.tournament_id) \
            .execute()
        current_count = count_res.count or 0
        if current_count >= tournament["max_teams"]:
            raise HTTPException(status_code=400, detail="Турнір заповнений")

    # Записуємо tournament_id в команду (service_role обходить RLS)
    result = supabase.table("teams") \
        .update({"tournament_id": payload.tournament_id}) \
        .eq("id", payload.team_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зареєструвати команду")

    print(f"[TOURNAMENT] Команда {team['name']} зареєстрована на турнір {tournament['name']}", flush=True)
    return {"success": True, "team": result.data[0]}


@app.delete("/api/tournaments/unregister")
async def unregister_team_from_tournament(payload: RegisterTeamForTournament, authorization: str = Header(...)):
    """
    Зняти команду з турніру.
    Тільки капітан і тільки поки статус турніру — registration.
    """
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
            .select("id, name, captain_id, tournament_id")
            .eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Тільки капітан може знімати команду з турніру")
    if team["tournament_id"] != payload.tournament_id:
        raise HTTPException(status_code=400, detail="Команда не зареєстрована в цьому турнірі")

    supabase.table("teams").update({"tournament_id": None}).eq("id", payload.team_id).execute()

    print(f"[TOURNAMENT] Команда {team['name']} знята з турніру {tournament['name']}", flush=True)
    return {"success": True}



# ─────────────────────────────────────────────────────────────────────────────
# ROUNDS: вставка раундів через service_role (RLS блокує anon key)
# ─────────────────────────────────────────────────────────────────────────────
# PATCH /api/tournaments/{id} — оновлення турніру через service_role (обходить RLS)
# ─────────────────────────────────────────────────────────────────────────────

@app.patch("/api/tournaments/{tournament_id}")
async def update_tournament(
    tournament_id: str,
    body: dict,
    authorization: str = Header(...),
):
    """
    Оновлює поля турніру через service_role — обходить RLS (anon key отримує порожній результат).
    Тільки admin/superadmin.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може редагувати турнір")

    # Перевіряємо що турнір існує
    tournament = fetch_one(
        supabase.table("tournaments").select("id, status").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    # Дозволені поля для оновлення (whitelist)
    allowed_fields = {
        "name", "rules", "start_at", "registration_from",
        "registration_to", "max_teams", "rounds", "status",
    }
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="Немає полів для оновлення")

    result = (
        supabase.table("tournaments")
        .update(update_data)
        .eq("id", tournament_id)
        .execute()
    )

    print(f"[TOURNAMENT] {caller['username']} оновив турнір {tournament_id}: {list(update_data.keys())}", flush=True)
    return {"success": True, "tournament": result.data[0] if result.data else None}


# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/tournaments/{tournament_id}/rounds")
async def create_tournament_rounds(
    tournament_id: str,
    body: dict,
    authorization: str = Header(...),
):
    """
    Вставляє раунди для турніру через service_role — обходить RLS (anon key отримує 401).
    Тільки admin/superadmin.
    Body: {"rounds": [{number, name, description, ...}, ...]}
    """
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

    # Перевіряємо що турнір існує і належить поточному адміну
    tournament = fetch_one(
        supabase.table("tournaments").select("id, name").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")

    # create_tournament вже створила порожні рядки раундів (number=1..N) —
    # тому INSERT дасть duplicate key. Робимо UPDATE по (tournament_id, number).
    updated = []
    for r in rounds:
        num = r.get("number")
        if not num:
            continue
        update_data = {
            "name":          r.get("name"),
            "description":   r.get("description"),
            "criteria":      r.get("criteria"),
            "technologies":  r.get("technologies"),
            "start_at":      r.get("start_at"),
            "end_at":        r.get("end_at"),
            "links":         r.get("links"),
            "attachments":   r.get("attachments"),
            "status":        r.get("status", "pending"),
            "template_path": r.get("template_path"),
        }
        res = (
            supabase.table("rounds")
                .update(update_data)
                .eq("tournament_id", tournament_id)
                .eq("number", num)
                .execute()
        )
        if res.data:
            updated.extend(res.data)

    print(f"[ROUNDS] {len(updated)} раундів оновлено для турніру {tournament['name']}", flush=True)
    return {"success": True, "rounds": updated}


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


# ─────────────────────────────────────────────────────────────────────────────
# 7. ТУРНИРЫ ПОЛЬЗОВАТЕЛЯ
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# 8. ЗДАЧА РОБОТИ (SUBMISSIONS)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/rounds/{round_id}/submit")
async def submit_work(round_id: str, payload: SubmitWork, authorization: str = Header(...)):
    """
    Здати або оновити роботу команди для раунду.
    Використовує service_role — обходить RLS.
    Доступно: капітан АБО учасник команди.
    Поле files містить список {"name": str, "path": str} — шляхи в bucket.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Перевіряємо що раунд існує
    round_ = fetch_one(
        supabase.table("rounds")
            .select("id, tournament_id, end_at, status")
            .eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    # Перевіряємо що команда існує і caller є капітаном або учасником
    team = fetch_one(
        supabase.table("teams")
            .select("id, name, captain_id, members_ids, tournament_id")
            .eq("id", payload.team_id)
    )
    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено")

    members = team.get("members_ids") or []
    is_captain = team["captain_id"] == caller["id"]
    is_member  = caller["id"] in members
    if not is_captain and not is_member:
        raise HTTPException(status_code=403, detail="Ви не є членом цієї команди")

    # Перевіряємо що команда зареєстрована в турнірі цього раунду
    if team.get("tournament_id") != round_.get("tournament_id"):
        raise HTTPException(status_code=403, detail="Ваша команда не зареєстрована в цьому турнірі")

    now_iso = __import__("datetime").datetime.utcnow().isoformat()

    # Шукаємо існуючий сабміт
    existing = fetch_one(
        supabase.table("submissions")
            .select("id")
            .eq("round_id", round_id)
            .eq("team_id", payload.team_id)
    )

    record = {
        "round_id":      round_id,
        "team_id":       payload.team_id,
        "submitted_by":  caller["id"],          # Bug 5: заповнюємо submitted_by
        "github_url":    payload.github_url,
        "video_url":     payload.video_url,
        "live_demo_url": payload.demo_url,      # Bug 3: правильна назва колонки
        "description":   payload.description,
        "file_path":     payload.files if payload.files else None,  # Bug 4: jsonb колонка file_path
        "status":        "submitted",
        "submitted_at":  now_iso,
    }

    if existing:
        result = supabase.table("submissions").update(record).eq("id", existing["id"]).execute()
    else:
        result = supabase.table("submissions").insert(record).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зберегти роботу")

    print(f"[SUBMIT] Команда {team['name']} здала роботу на раунд {round_id}", flush=True)
    return {"success": True, "submission": result.data[0]}


@app.get("/api/rounds/{round_id}/submission")
async def get_submission(round_id: str, team_id: str, authorization: str = Header(...)):
    """Отримати здану роботу команди для раунду."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    get_caller(token)

    sub = fetch_one(
        supabase.table("submissions")
            .select("*")
            .eq("round_id", round_id)
            .eq("team_id", team_id)
    )
    return {"submission": sub}


@app.post("/api/upload/submission-file")
async def upload_submission_file(
    round_id:  str        = Form(...),
    team_id:   str        = Form(...),
    file:      UploadFile = File(...),
    authorization: str    = Header(...),
):
    """
    Завантажити файл до bucket 'submissions'.
    Використовує service_role — обходить RLS bucket policies.
    Повертає path в bucket (зберігай його, а не signed URL).
    Structure: submissions/{round_id}/{team_id}/{timestamp}-{filename}
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Перевіряємо що caller належить до команди
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

    # Безпечне ім'я файлу
    import re, time
    safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "file")
    path = f"submissions/{round_id}/{team_id}/{int(time.time() * 1000)}-{safe_name}"

    content = await file.read()

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


@app.post("/api/upload/round-file")
async def upload_round_file(
    round_number: int       = Form(...),
    file:         UploadFile = File(...),
    authorization: str      = Header(...),
):
    """
    БАГ 6 fix: завантажити файл шаблону раунду в bucket 'round-files'
    через service_role (обходить RLS приватного bucket).
    Тільки admin/superadmin.
    Повертає: {"signed_url": "https://..."} — підписаний URL на 10 років.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може завантажувати файли раундів")

    import re, time as _time
    safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "file")
    path = f"rounds/round-{round_number}/{int(_time.time() * 1000)}-{safe_name}"

    content = await file.read()

    try:
        supabase.storage.from_("round-files").upload(
            path=path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу: {e}")

    # Генеруємо довготривалий signed URL (10 років) через service_role
    try:
        signed = supabase.storage.from_("round-files").create_signed_url(path, 315360000)
        signed_url = signed.get("signedURL") or signed.get("signedUrl")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не вдалося отримати URL: {e}")

    print(f"[ROUND-UPLOAD] {caller['username']} завантажив {safe_name} → {path}", flush=True)
    return {"success": True, "signed_url": signed_url, "path": path, "name": file.filename}


@app.post("/api/upload/signed-urls")
async def get_signed_urls(body: dict, authorization: str = Header(...)):
    """
    Отримати тимчасові signed URL для списку шляхів з bucket 'submissions'.
    Body: {"paths": ["submissions/round_id/team_id/file.zip", ...]}
    Повертає: {"urls": {"path": "https://..."}}
    Термін дії: 1 година (достатньо для перегляду/завантаження).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    get_caller(token)

    paths = body.get("paths", [])
    if not paths or not isinstance(paths, list):
        raise HTTPException(status_code=400, detail="Потрібен список paths")
    if len(paths) > 50:
        raise HTTPException(status_code=400, detail="Максимум 50 файлів за раз")

    result = {}
    for path in paths:
        try:
            signed = supabase.storage.from_("submissions").create_signed_url(path, 3600)
            result[path] = signed.get("signedURL") or signed.get("signedUrl")
        except Exception as e:
            print(f"[SIGNED_URL] Не вдалося для {path}: {e}", flush=True)
            result[path] = None

    return {"urls": result}


# ─────────────────────────────────────────────────────────────────────────────
# 9. ТУРНИРЫ ПОЛЬЗОВАТЕЛЯ
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/users/me/tournaments")
async def get_my_tournaments(authorization: str = Header(...)):
    """
    Возвращает турниры, в которых участвует текущий пользователь.
    Логика: найти команды где user = captain_id ИЛИ user в members_ids,
    затем вернуть турниры по tournament_id этих команд.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    user_id = caller["id"]

    # 1. Команды где пользователь — капитан
    captain_res = supabase.table("teams") \
        .select("id, tournament_id") \
        .eq("captain_id", user_id) \
        .execute()

    # 2. Команды где пользователь — участник (members_ids contains user_id)
    member_res = supabase.table("teams") \
        .select("id, tournament_id") \
        .contains("members_ids", json.dumps([user_id])) \
        .execute()

    # Собираем уникальные tournament_id (пропускаем None)
    all_teams = (captain_res.data or []) + (member_res.data or [])
    tournament_ids = list({
        t["tournament_id"]
        for t in all_teams
        if t.get("tournament_id")
    })

    if not tournament_ids:
        return {"tournaments": []}

    # 3. Получаем данные турниров
    tour_res = supabase.table("tournaments") \
        .select("id, name, status, start_at, registration_from, registration_to") \
        .in_("id", tournament_ids) \
        .execute()

    return {"tournaments": tour_res.data or []}
