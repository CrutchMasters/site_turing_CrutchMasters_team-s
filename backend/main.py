import os
import json
import jwt as pyjwt
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler

# ─────────────────────────────────────────────────────────────────────────────
# JWT VERIFICATION
# Supabase использует HS256 с JWT_SECRET из Settings → API → JWT Secret.
# Добавь SUPABASE_JWT_SECRET в .env.
# ─────────────────────────────────────────────────────────────────────────────

def decode_jwt_payload(token: str) -> dict:
    """
    Верифікуємо JWT від Supabase.

    Supabase з 2024 року підписує токени ES256 (асиметричний) замість HS256.
    Алгоритм визначаємо з заголовку токена:
      - ES256 → верифікуємо через JWKS (публічний ключ з Supabase)
      - HS256 → верифікуємо через SUPABASE_JWT_SECRET (старий формат)
    Якщо жоден секрет/ключ не задано → fallback без верифікації (небезпечно).
    """
    import base64 as _base64

    # Читаємо alg з заголовку без повної верифікації
    try:
        header_part = token.split(".")[0]
        padded = header_part + "=" * (-len(header_part) % 4)
        header = json.loads(_base64.urlsafe_b64decode(padded))
        alg = header.get("alg", "HS256")
        kid = header.get("kid")
    except Exception:
        alg = "HS256"
        kid = None

    supabase_url = os.getenv("SUPABASE_URL", "")
    jwt_secret   = os.getenv("SUPABASE_JWT_SECRET")

    # ── ES256: верифікація через JWKS (з кешем на 1 годину) ─────────────────
    if alg == "ES256":
        try:
            from jwt.algorithms import ECAlgorithm
            import urllib.request
            import time as _time

            # Кеш публічних ключів: { kid -> ECPublicKey }, оновлюється раз на годину
            cache     = decode_jwt_payload.__dict__.setdefault("_jwks_cache", {})
            cache_ts  = decode_jwt_payload.__dict__.setdefault("_jwks_ts", 0)
            cache_ttl = 3600  # секунди

            public_key = cache.get(kid) if kid else (list(cache.values())[0] if cache else None)

            if public_key is None or (_time.time() - cache_ts > cache_ttl):
                # Кеш відсутній або застарів — оновлюємо
                jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
                print(f"[JWT] Fetching JWKS from {jwks_url}", flush=True)
                with urllib.request.urlopen(jwks_url, timeout=5) as resp:
                    jwks = json.loads(resp.read())

                keys = jwks.get("keys", [])
                if not keys:
                    raise HTTPException(status_code=401, detail="JWKS: no keys returned")

                # Заповнюємо кеш
                cache.clear()
                for k in keys:
                    k_kid = k.get("kid", "__default__")
                    cache[k_kid] = ECAlgorithm.from_jwk(json.dumps(k))
                decode_jwt_payload.__dict__["_jwks_ts"] = _time.time()

                public_key = cache.get(kid) if kid else list(cache.values())[0]

            if public_key is None:
                raise HTTPException(status_code=401, detail="JWKS: matching public key not found")

            payload = pyjwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_exp": True, "verify_aud": False},
            )
            return payload
        except HTTPException:
            raise
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except pyjwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
        except Exception as e:
            print(f"[JWT] JWKS fetch failed: {e}", flush=True)
            # Fallback: якщо кеш є — використовуємо його навіть якщо TTL минув
            stale_key = list(decode_jwt_payload.__dict__.get("_jwks_cache", {}).values())
            if stale_key:
                print("[JWT] Using stale cached JWKS key", flush=True)
                try:
                    return pyjwt.decode(token, stale_key[0], algorithms=["ES256"], options={"verify_exp": True, "verify_aud": False})
                except pyjwt.ExpiredSignatureError:
                    raise HTTPException(status_code=401, detail="Token expired")
                except Exception as e2:
                    raise HTTPException(status_code=401, detail=f"Invalid token: {e2}")
            raise HTTPException(status_code=401, detail=f"Cannot verify token: JWKS unavailable ({e})")

    # ── HS256: верифікація через JWT_SECRET ──────────────────────────────────
    if not jwt_secret:
        print("[JWT] УВАГА: SUPABASE_JWT_SECRET не задано — підпис не перевіряється!", flush=True)
        try:
            return pyjwt.decode(token, options={"verify_signature": False})
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid token format: {e}")
    try:
        payload = pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": True, "verify_aud": False},
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


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

def _parse_dt(value: str | None) -> datetime | None:
    """
    Парсит ISO-строку из БД в timezone-aware datetime (UTC).
    Обрабатывает как '+00:00'-суффикс, так и naive-строки без timezone.
    """
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def update_tournament_statuses():
    if not supabase:
        return
    try:
        now = datetime.now(timezone.utc)

        res = supabase.table("tournaments").select(
            "id, status, registration_from, registration_to, start_at, end_at"
        ).execute()
        tournaments = res.data or []

        for t in tournaments:
            current = t["status"]
            # Пропускаємо фінальні та незворотні статуси
            if current in ("finished", "ongoing"):
                continue

            reg_from  = _parse_dt(t.get("registration_from"))
            reg_to    = _parse_dt(t.get("registration_to"))
            start_at  = _parse_dt(t.get("start_at"))
            end_at    = _parse_dt(t.get("end_at"))

            new_status = current

            # 1. Турнір завершився (є end_at і він минув)
            if end_at and now >= end_at:
                new_status = "finished"
            # 2. Якщо немає end_at — перевіряємо чи всі раунди завершені
            elif current == "ongoing" and not end_at:
                try:
                    rounds_res = supabase.table("rounds").select("status").eq("tournament_id", t["id"]).execute()
                    rounds = rounds_res.data or []
                    if rounds and all(r.get("status") == "finished" for r in rounds):
                        new_status = "finished"
                except Exception:
                    pass  # Якщо не вдалось — залишаємо поточний статус
            # 3. Турнір почався → ongoing
            elif start_at and now >= start_at:
                new_status = "ongoing"
            # 4. Реєстрація відкрита
            elif reg_from and now >= reg_from and (not reg_to or now < reg_to):
                new_status = "registration"
            # 5. Реєстрація закрита, старт ще попереду
            elif reg_to and now >= reg_to and (not start_at or now < start_at):
                new_status = "upcoming"
            else:
                new_status = "upcoming"

            if new_status != current:
                try:
                    supabase.table("tournaments").update({"status": new_status}).eq("id", t["id"]).execute()
                    print(f"[SCHEDULER] Турнір {t['id']}: {current} → {new_status}", flush=True)
                except Exception as upd_err:
                    print(f"[SCHEDULER] Не вдалося оновити {t['id']} ({current} → {new_status}): {upd_err}", flush=True)

    except Exception as e:
        print(f"[SCHEDULER] Помилка оновлення статусів: {e}", flush=True)


def update_round_statuses():
    if not supabase:
        return
    try:
        now = datetime.now(timezone.utc)

        res = supabase.table("rounds").select(
            "id, status, start_at, end_at"
        ).execute()
        rounds = res.data or []

        for r in rounds:
            current  = r.get("status") or "pending"
            start_at = _parse_dt(r.get("start_at"))
            end_at   = _parse_dt(r.get("end_at"))

            # FIX (критичний): пропускаємо finished раунди — вони не повинні реактивуватися
            if current == "finished":
                continue

            if end_at and now >= end_at:
                new_status = "finished"
            elif start_at and now >= start_at:
                # FIX (критичний): active лише якщо start_at минув (прибрано мертву гілку
                # `elif end_at and (not start_at or now >= start_at)` що активувала раунди
                # без start_at одразу після створення)
                new_status = "active"
            else:
                new_status = "pending"

            if new_status != current:
                try:
                    supabase.table("rounds").update({"status": new_status}).eq("id", r["id"]).execute()
                    print(f"[SCHEDULER] Раунд {r['id']}: {current} → {new_status}", flush=True)
                except Exception as upd_err:
                    print(f"[SCHEDULER] Не вдалося оновити раунд {r['id']}: {upd_err}", flush=True)

    except Exception as e:
        print(f"[SCHEDULER] Помилка оновлення статусів раундів: {e}", flush=True)


_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler.add_job(update_tournament_statuses, "interval", seconds=15, id="tournament_status_updater")
_scheduler.add_job(update_round_statuses,      "interval", seconds=15, id="round_status_updater")

@app.on_event("startup")
def start_scheduler():
    _scheduler.start()
    update_tournament_statuses()  # Одразу при старті
    update_round_statuses()       # Одразу при старті
    print("[SCHEDULER] Запущено оновлення статусів турнірів та раундів (кожні 15 сек)", flush=True)

@app.on_event("shutdown")
def stop_scheduler():
    _scheduler.shutdown(wait=False)

# --- CORS ---
# Явный список origins — без "*", иначе браузер запрещает credentials + wildcard.
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://site-turing-crutchmasters-team-s.pages.dev",
]
# Дополнительные origins из .env (через запятую), например для staging-окружений
_extra = os.getenv("CORS_EXTRA_ORIGINS", "")
if _extra:
    _ALLOWED_ORIGINS.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- МОДЕЛИ ДАННЫХ ---
class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr
    # password намеренно убран: пользователь уже верифицирован через OTP,
    # Auth-запись создана Supabase — бэкенду пароль не нужен и не безопасен.

class UserLogin(BaseModel):
    login: str
    password: str

class TournamentUpdate(BaseModel):
    """FIX (критичний): Pydantic-модель замість dict — лише дозволені поля."""
    name:              str | None = None
    rules:             str | None = None
    start_at:          str | None = None
    end_at:            str | None = None   # FIX: було відсутнє — кінець турніру не зберігався
    registration_from: str | None = None
    registration_to:   str | None = None
    max_teams:         int | None = None
    rounds:            int | None = None
    status:            str | None = None

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
    print(f"[get_caller] token prefix={token[:40]!r}", flush=True)
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
    """Відправка email (best-effort — не ломає запит при помилці).
    FIX (середній): використовуємо стандартний SMTP/email замість send_email_otp,
    щоб отримувач отримав кастомний лист з деталями запрошення (не OTP-код).
    """
    try:
        site_url   = os.getenv("SITE_URL", "http://localhost:3000")
        accept_url = f"{site_url}/notifications"
        # Надсилаємо через Supabase admin.send_email якщо доступно,
        # або логуємо що потрібно налаштувати SMTP шаблон для запрошень.
        # send_email_otp генерує OTP-лист — не підходить для кастомного invite.
        # Рекомендація: налаштувати кастомний email template в Supabase або
        # використати сторонній SMTP (SendGrid, Resend тощо).
        print(
            f"[EMAIL] Invitation email to {to_email}: team='{team_name}', "
            f"captain='{captain_username}', accept_url={accept_url}",
            flush=True
        )
        # TODO: замінити на реальний SMTP-виклик (SendGrid / Resend / SMTP)
        # Приклад: resend.emails.send(to=to_email, subject=..., html=...)
    except Exception as e:
        print(f"[EMAIL] Не удалося відправити листа на {to_email}: {e}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/test")
def connection_test():
    return {"status": "ok", "message": "Backend status active"}


# 1. РЕГИСТРАЦИЯ
@app.post("/api/register")
async def register_user(user: UserRegister, authorization: str = Header(...)):
    """
    Создаёт запись в таблице account после верификации OTP на фронтенде.
    Supabase Auth-запись уже существует — UUID берём из JWT токена.
    Пароль не принимается и не нужен.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")
    try:
        # Получаем UUID из верифицированного JWT (токен выдан после verifyOtp)
        token = authorization.replace("Bearer ", "").strip()
        jwt_payload = decode_jwt_payload(token)
        auth_uuid = jwt_payload.get("sub")
        if not auth_uuid:
            raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

        # FIX (критичний): перевіряємо дублікат і по email, і по login
        existing_email = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

        existing_login = supabase.table("account").select("id").eq("login", user.login).execute()
        if existing_login.data:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

        # Создаём запись в account, используя UUID из Auth (не создаём нового Auth-пользователя)
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
    team_id:     str
    github_url:  str | None = None
    youtube_url: str | None = None   # FIX: було video_url — не співпадало з фронтендом
    live_url:    str | None = None   # FIX: було demo_url — не співпадало з фронтендом
    description: str | None = None
    is_draft:    bool = False        # FIX: додано — зберігається в submissions.is_draft
    files: list[dict] = []  # [{"name": "file.zip", "path": "submissions/round/team/file.zip"}]


@app.post("/api/teams")
async def create_team(payload: CreateTeam, authorization: str = Header(...)):
    """Создать команду. Текущий пользователь становится капитаном."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Журі не може створювати команди
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


@app.get("/api/teams")
async def get_teams(authorization: str = Header(...), limit: int = 50, offset: int = 0):
    """Отримати список команд з пагінацією (limit/offset).
    FIX (низький): без пагінації відповідь може бути дуже великою.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    get_caller(token)  # просто проверяем авторизацию

    # Обмежуємо limit щоб не повертати > 200 записів за раз
    limit = min(limit, 200)

    result = supabase.table("teams").select("*").order("name").range(offset, offset + limit - 1).execute()
    return {"teams": result.data or [], "limit": limit, "offset": offset}


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
    member_res = supabase.table("teams")         .select("*")         .contains("members_ids", json.dumps([caller["id"]]))         .execute()

    # FIX (низький): дедуплікація через set — O(n) замість O(n²)
    seen_ids = set()
    teams = []
    for t in (captain_res.data or []) + (member_res.data or []):
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
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

    updates = {k: v for k, v in payload.model_dump().items() if v is not None and v != ""}
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

    team = fetch_one(supabase.table("teams").select("id, captain_id, tournament_id").eq("id", team_id))
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")
    if team["captain_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Только капитан может удалить команду")

    # FIX (середній): відхиляємо всі pending запрошення до команди перед видаленням
    supabase.table("team_invitations") \
        .update({"status": "declined"}) \
        .eq("team_id", team_id) \
        .eq("status", "pending") \
        .execute()

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

    # Журі не може реєструвати команди
    if caller.get("role") == "jury":
        raise HTTPException(status_code=403, detail="Журі не може реєструвати команди на турнір")

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

    # FIX (критичний): атомарна перевірка ліміту + реєстрація через RPC,
    # щоб уникнути race condition коли дві паралельні реєстрації одночасно
    # проходять перевірку і обидві записуються, перевищуючи max_teams.
    if tournament["max_teams"]:
        try:
            rpc_res = supabase.rpc(
                "register_team_atomic",
                {
                    "p_team_id":       payload.team_id,
                    "p_tournament_id": payload.tournament_id,
                    "p_max_teams":     tournament["max_teams"],
                },
            ).execute()
            if rpc_res.data is False:
                raise HTTPException(status_code=400, detail="Турнір заповнений")
        except HTTPException:
            raise
        except Exception as e:
            # Fallback: якщо RPC ще не задеплоєна — виконуємо звичайну перевірку
            # (видалити після деплою міграції register_team_atomic)
            print(f"[WARN] register_team_atomic RPC недоступна, fallback: {e}", flush=True)
            count_res = supabase.table("teams") \
                .select("id", count="exact") \
                .eq("tournament_id", payload.tournament_id) \
                .execute()
            if (count_res.count or 0) >= tournament["max_teams"]:
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
    body: TournamentUpdate,  # FIX (критичний): Pydantic замість dict — довільні поля заблоковані
    authorization: str = Header(...),
):
    """
    Оновлює поля турніру через service_role — обходить RLS (anon key отримує порожній результат).
    Тільки admin/superadmin і лише власник турніру.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може редагувати турнір")

    # Перевіряємо що турнір існує і належить поточному адміну
    # FIX (критичний): перевірка owner_id запобігає редагуванню чужих турнірів
    tournament = fetch_one(
        supabase.table("tournaments").select("id, status, created_by").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if caller.get("role") != "superadmin" and tournament.get("created_by") != caller["id"]:
        raise HTTPException(status_code=403, detail="Ви не є власником цього турніру")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
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
    # FIX (високий): без цієї перевірки будь-який адмін міг редагувати чужі турніри
    tournament = fetch_one(
        supabase.table("tournaments").select("id, name, created_by").eq("id", tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if caller.get("role") != "superadmin" and tournament.get("created_by") != caller["id"]:
        raise HTTPException(status_code=403, detail="Ви не є власником цього турніру")

    # create_tournament вже створила порожні рядки раундів (number=1..N) —
    # тому INSERT дасть duplicate key. Робимо UPDATE по (tournament_id, number).
    # FIX (середній): якщо частина раундів не збережеться — повідомляємо про це
    # замість мовчазного ігнорування (повний rollback потребує RPC з транзакцією).
    updated = []
    failed_numbers = []
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
        try:
            res = (
                supabase.table("rounds")
                    .update(update_data)
                    .eq("tournament_id", tournament_id)
                    .eq("number", num)
                    .execute()
            )
            if res.data:
                updated.extend(res.data)
            else:
                failed_numbers.append(num)
        except Exception as round_err:
            print(f"[ROUNDS] Помилка оновлення раунду #{num}: {round_err}", flush=True)
            failed_numbers.append(num)

    if failed_numbers:
        print(f"[ROUNDS] УВАГА: не вдалося оновити раунди #{failed_numbers} для турніру {tournament['name']}", flush=True)
        raise HTTPException(
            status_code=500,
            detail=f"Не вдалося зберегти раунди №{failed_numbers}. Турнір створено, але деякі раунди неповні. Спробуйте відредагувати турнір."
        )

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

# ─────────────────────────────────────────────────────────────────────────────
# JURY INVITATIONS — адмін запрошує журі до оцінювання турніру
# ─────────────────────────────────────────────────────────────────────────────

class SendJuryInvitation(BaseModel):
    jury_id:       str   # ID користувача з роллю jury
    tournament_id: str

class RespondJuryInvitation(BaseModel):
    invitation_id: str
    accept: bool


@app.post("/api/jury-invitations/send")
async def send_jury_invitation(payload: SendJuryInvitation, authorization: str = Header(...)):
    """
    Адмін запрошує журі взяти участь в оцінюванні конкретного турніру.
    Створює запис в jury_tournament_invitations + сповіщення для журі.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може запрошувати журі")

    # Перевіряємо що турнір існує і належить адміну
    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name, created_by")
            .eq("id", payload.tournament_id)
    )
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнір не знайдено")
    if caller.get("role") != "superadmin" and tournament.get("created_by") != caller["id"]:
        raise HTTPException(status_code=403, detail="Ви не є власником цього турніру")

    # Перевіряємо що invitee існує і має роль jury
    jury_user = fetch_one(
        supabase.table("account")
            .select("id, username, email, role")
            .eq("id", payload.jury_id)
    )
    if not jury_user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    if jury_user.get("role") != "jury":
        raise HTTPException(status_code=400, detail="Користувач не має ролі журі")

    # Перевіряємо дублікат
    existing = supabase.table("jury_tournament_invitations")         .select("id")         .eq("tournament_id", payload.tournament_id)         .eq("jury_id", payload.jury_id)         .eq("status", "pending")         .execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Запрошення вже відправлено і очікує відповіді")

    # Перевіряємо чи журі вже не в цьому турнірі
    already = supabase.table("jury_tournament_invitations")         .select("id")         .eq("tournament_id", payload.tournament_id)         .eq("jury_id", payload.jury_id)         .eq("status", "accepted")         .execute()
    if already.data:
        raise HTTPException(status_code=400, detail="Це журі вже є учасником оцінювання даного турніру")

    # Створюємо запис
    inv_res = supabase.table("jury_tournament_invitations").insert({
        "tournament_id": payload.tournament_id,
        "jury_id":       payload.jury_id,
        "inviter_id":    caller["id"],
        "status":        "pending",
    }).execute()

    if not inv_res.data:
        raise HTTPException(status_code=500, detail="Не вдалося створити запрошення")

    invitation_id = inv_res.data[0]["id"]

    # Сповіщення для журі
    supabase.table("notifications").insert({
        "user_id": payload.jury_id,
        "type":    "jury_invitation",
        "title":   f"Запрошення до журі турніру «{tournament['name']}»",
        "message": (
            f"Адміністратор {caller['username']} запрошує вас взяти участь "
            f"в оцінюванні робіт турніру «{tournament['name']}»."
        ),
        "meta": json.dumps({
            "invitation_id":  invitation_id,
            "tournament_id":  payload.tournament_id,
            "tournament_name": tournament["name"],
            "inviter_id":     caller["id"],
            "inviter_name":   caller["username"],
        }),
        "read": False,
    }).execute()

    print(f"[JURY-INVITE] {caller['username']} → {jury_user['username']} для турніру {tournament['name']}", flush=True)
    return {"success": True, "invitation_id": invitation_id}


@app.post("/api/jury-invitations/respond")
async def respond_jury_invitation(payload: RespondJuryInvitation, authorization: str = Header(...)):
    """Журі приймає або відхиляє запрошення адміна."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") != "jury":
        raise HTTPException(status_code=403, detail="Тільки журі може відповідати на запрошення журі")

    inv = fetch_one(
        supabase.table("jury_tournament_invitations")
            .select("id, tournament_id, jury_id, inviter_id, status")
            .eq("id", payload.invitation_id)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Запрошення не знайдено")
    if inv["jury_id"] != caller["id"]:
        raise HTTPException(status_code=403, detail="Це запрошення не для вас")
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Запрошення вже {inv['status']}")

    new_status = "accepted" if payload.accept else "declined"

    supabase.table("jury_tournament_invitations")         .update({"status": new_status})         .eq("id", payload.invitation_id)         .execute()

    # Позначаємо сповіщення як прочитане
    supabase.table("notifications")         .update({"read": True})         .eq("type", "jury_invitation")         .eq("user_id", caller["id"])         .eq("read", False)         .execute()

    # Отримуємо інфо про турнір
    tournament = fetch_one(
        supabase.table("tournaments")
            .select("id, name")
            .eq("id", inv["tournament_id"])
    )

    if payload.accept:
        # Якщо прийняв — додаємо в таблицю jury_assignments для всіх раундів турніру
        rounds_res = supabase.table("rounds")             .select("id")             .eq("tournament_id", inv["tournament_id"])             .execute()

        for r in (rounds_res.data or []):
            # Перевіряємо чи вже є assignment
            exists = supabase.table("jury_assignments")                 .select("id")                 .eq("jury_id", caller["id"])                 .eq("round_id", r["id"])                 .execute()
            if not exists.data:
                supabase.table("jury_assignments").insert({
                    "jury_id":  caller["id"],
                    "round_id": r["id"],
                    "tournament_id": inv["tournament_id"],
                }).execute()

        # Сповіщення адміну
        if tournament:
            supabase.table("notifications").insert({
                "user_id": inv["inviter_id"],
                "type":    "jury_invitation_accepted",
                "title":   f"{caller['username']} прийняв запрошення журі",
                "message": (
                    f"Журі {caller['username']} прийняв запрошення до оцінювання "
                    f"турніру «{tournament['name']}»."
                ),
                "meta": json.dumps({
                    "tournament_id":   inv["tournament_id"],
                    "tournament_name": tournament["name"] if tournament else "",
                    "jury_id":         caller["id"],
                    "jury_name":       caller["username"],
                }),
                "read": False,
            }).execute()

        print(f"[JURY-INVITE] {caller['username']} ПРИЙНЯВ журі для {inv['tournament_id']}", flush=True)
        return {"success": True, "status": "accepted"}

    else:
        if tournament:
            supabase.table("notifications").insert({
                "user_id": inv["inviter_id"],
                "type":    "jury_invitation_declined",
                "title":   f"{caller['username']} відхилив запрошення журі",
                "message": (
                    f"Журі {caller['username']} відхилив запрошення до оцінювання "
                    f"турніру «{tournament['name']}»."
                ),
                "meta": json.dumps({
                    "tournament_id":   inv["tournament_id"],
                    "tournament_name": tournament["name"] if tournament else "",
                    "jury_id":         caller["id"],
                    "jury_name":       caller["username"],
                }),
                "read": False,
            }).execute()

        print(f"[JURY-INVITE] {caller['username']} ВІДХИЛИВ журі для {inv['tournament_id']}", flush=True)
        return {"success": True, "status": "declined"}


@app.get("/api/jury-invitations/my")
async def get_my_jury_invitations(authorization: str = Header(...)):
    """Отримати всі pending запрошення для поточного журі."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") != "jury":
        raise HTTPException(status_code=403, detail="Тільки журі може переглядати свої запрошення")

    inv_res = supabase.table("jury_tournament_invitations")         .select("id, tournament_id, inviter_id, status, created_at")         .eq("jury_id", caller["id"])         .order("created_at", desc=True)         .execute()

    invitations = inv_res.data or []
    if not invitations:
        return {"invitations": []}

    # Збагачуємо даними турніру та запрошувача
    tour_ids    = list({i["tournament_id"] for i in invitations})
    inviter_ids = list({i["inviter_id"]    for i in invitations})

    tours_res = supabase.table("tournaments")         .select("id, name, status")         .in_("id", tour_ids)         .execute()
    tours_map = {t["id"]: t for t in (tours_res.data or [])}

    inviters_res = supabase.table("account")         .select("id, username, login")         .in_("id", inviter_ids)         .execute()
    inviters_map = {a["id"]: a for a in (inviters_res.data or [])}

    enriched = [{
        **inv,
        "tournament_name":   tours_map.get(inv["tournament_id"], {}).get("name", "—"),
        "tournament_status": tours_map.get(inv["tournament_id"], {}).get("status", "—"),
        "inviter_username":  inviters_map.get(inv["inviter_id"], {}).get("username", "—"),
        "inviter_login":     inviters_map.get(inv["inviter_id"], {}).get("login", "—"),
    } for inv in invitations]

    return {"invitations": enriched}


@app.get("/api/tournaments/{tournament_id}/jury")
async def get_tournament_jury(tournament_id: str, authorization: str = Header(...)):
    """
    Список журі що прийняли запрошення для цього турніру.
    Доступно адміну/superadmin.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може переглядати журі турніру")

    accepted = supabase.table("jury_tournament_invitations")         .select("jury_id, created_at")         .eq("tournament_id", tournament_id)         .eq("status", "accepted")         .execute()

    jury_ids = [r["jury_id"] for r in (accepted.data or [])]
    if not jury_ids:
        return {"jury": []}

    jury_res = supabase.table("account")         .select("id, username, login, email, avatar_url")         .in_("id", jury_ids)         .execute()

    return {"jury": jury_res.data or []}


@app.get("/api/tournaments/{tournament_id}/jury-candidates")
async def get_jury_candidates(tournament_id: str, authorization: str = Header(...)):
    """
    Список усіх користувачів з роллю jury що ще НЕ запрошені / НЕ прийняли для цього турніру.
    Для форми відправки запрошень адміном.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки адміністратор може переглядати кандидатів")

    # Всі jury-користувачі
    all_jury = supabase.table("account")         .select("id, username, login, email, avatar_url")         .eq("role", "jury")         .execute()

    # Вже запрошені (pending або accepted) для цього турніру
    already = supabase.table("jury_tournament_invitations")         .select("jury_id, status")         .eq("tournament_id", tournament_id)         .in_("status", ["pending", "accepted"])         .execute()

    already_ids = {r["jury_id"] for r in (already.data or [])}

    candidates = [u for u in (all_jury.data or []) if u["id"] not in already_ids]

    return {"candidates": candidates}


@app.post("/api/invitations/respond")
async def respond_invitation(payload: RespondInvitation, authorization: str = Header(...)):
    """Приглашённый принимает или отклоняет приглашение."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # Журі не може вступати до команд
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
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Приглашение уже {inv['status']}")

    new_status = "accepted" if payload.accept else "declined"

    supabase.table("team_invitations") \
        .update({"status": new_status}) \
        .eq("id", payload.invitation_id) \
        .execute()

    # FIX (середній): позначаємо прочитаним лише сповіщення пов'язане з цим конкретним
    # запрошенням (по invitation_id в meta), а не всі team_invitation сповіщення юзера.
    # Інакше при наявності запрошень від кількох команд — всі відмічались прочитаними.
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

    if not invitations:
        return {"invitations": []}

    # Батч-запросы вместо N+1
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
async def submit_work(
    round_id:      str,
    authorization: str                   = Header(...),
    payload:       str                   = Form(...),   # FIX: multipart — фронтенд шле FormData
    files:         list[UploadFile]      = File([]),    # FIX: нові файли від фронтенду
):
    """
    Здати або оновити роботу команди для раунду.
    Приймає multipart/form-data:
      - payload: JSON-рядок з полями {team_id, round_id, github_url, youtube_url,
                                      live_url, description, is_draft}
      - files:   нові бінарні файли (0 або більше)
    Автоматично визначає команду юзера якщо team_id порожній.
    Завантажує нові файли в bucket 'submissions' і додає до file_paths.
    """
    import json as _json, re as _re, time as _time

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    # ── Парсимо payload з JSON-рядка ────────────────────────────────────────
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

    # ── Перевіряємо раунд ────────────────────────────────────────────────────
    round_ = fetch_one(
        supabase.table("rounds")
            .select("id, tournament_id, end_at, status")
            .eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")

    round_status = round_.get("status")
    # Для чернетки дозволяємо pending/active; фінальна здача — тільки active
    if not is_draft and round_status != "active":
        raise HTTPException(
            status_code=422,
            detail=f"Здача недоступна: раунд має статус '{round_status}'. Здача дозволена лише для активних раундів."
        )

    end_at = _parse_dt(round_.get("end_at"))
    if not is_draft and end_at and datetime.now(timezone.utc) > end_at:
        raise HTTPException(status_code=422, detail="Дедлайн раунду минув, здача не приймається")

    tournament_id = round_.get("tournament_id")

    # ── Визначаємо команду ───────────────────────────────────────────────────
    # Якщо team_id не передано або порожній — знаходимо команду юзера
    # в турнірі цього раунду автоматично.
    team = None
    if team_id_req:
        team = fetch_one(
            supabase.table("teams")
                .select("id, name, captain_id, members_ids, tournament_id")
                .eq("id", team_id_req)
        )

    if not team:
        # Шукаємо серед команд де юзер капітан або учасник і команда в цьому турнірі
        cap_res = supabase.table("teams") \
            .select("id, name, captain_id, members_ids, tournament_id") \
            .eq("captain_id", caller["id"]) \
            .eq("tournament_id", tournament_id) \
            .limit(1).execute()
        if cap_res.data:
            team = cap_res.data[0]
        else:
            mem_res = supabase.table("teams") \
                .select("id, name, captain_id, members_ids, tournament_id") \
                .contains("members_ids", json.dumps([caller["id"]])) \
                .eq("tournament_id", tournament_id) \
                .limit(1).execute()
            if mem_res.data:
                team = mem_res.data[0]

    if not team:
        raise HTTPException(status_code=404, detail="Команду не знайдено або ви не зареєстровані в цьому турнірі")

    members    = team.get("members_ids") or []
    is_captain = team["captain_id"] == caller["id"]
    is_member  = caller["id"] in members
    if not is_captain and not is_member:
        raise HTTPException(status_code=403, detail="Ви не є членом цієї команди")

    if team.get("tournament_id") != tournament_id:
        raise HTTPException(status_code=403, detail="Ваша команда не зареєстрована в цьому турнірі")

    team_id = team["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── Завантажуємо нові файли в bucket ────────────────────────────────────
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
            print(f"[SUBMIT] Помилка завантаження {safe_name}: {upload_err}", flush=True)
            raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу {f.filename}: {upload_err}")

    # ── Шукаємо існуючий сабміт і об'єднуємо file_paths ────────────────────
    existing = fetch_one(
        supabase.table("submissions")
            .select("id, file_paths")
            .eq("round_id", round_id)
            .eq("team_id", team_id)
    )

    # Зберігаємо попередні файли + додаємо нові
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
        "video_url":     youtube_url,      # FIX: колонка в БД називається video_url
        "live_demo_url": live_url,         # FIX: колонка в БД називається live_demo_url
        "description":   description,
        "file_paths":    merged_files,     # FIX: правильна jsonb-колонка (було file_path)
        "is_draft":      is_draft,         # FIX: додано збереження чернетки
        "updated_at":    now_iso,
    }

    if not is_draft:
        record["status"]       = "submitted"
        record["submitted_at"] = now_iso
    else:
        record["status"] = "draft"

    if existing:
        result = supabase.table("submissions").update(record).eq("id", existing["id"]).execute()
    else:
        result = supabase.table("submissions").insert(record).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зберегти роботу")

    action = "зберіг чернетку" if is_draft else "здав роботу"
    print(f"[SUBMIT] Команда {team['name']} {action} на раунд {round_id}", flush=True)
    return {"success": True, "submission": result.data[0]}


# ─────────────────────────────────────────────────────────────────────────────
# FIX (середній): новий ендпоінт для збереження оцінок журі через бекенд.
# Замінює пряме звернення з фронтенду до supabase.from("jury_evaluations").
# Перевіряє що caller є членом журі цього раунду перед записом.
# ─────────────────────────────────────────────────────────────────────────────

class JuryEvaluationPayload(BaseModel):
    submission_id:   str
    criteria_scores: dict
    general_comment: str | None = None
    total_score:     float | None = None

@app.post("/api/rounds/{round_id}/evaluate")
async def save_jury_evaluation(
    round_id: str,
    payload: JuryEvaluationPayload,
    authorization: str = Header(...),
):
    """Зберегти або оновити оцінку журі для submission. Лише для запрошених журі."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    if caller.get("role") not in ("jury", "admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Тільки журі може виставляти оцінки")

    # Для журі — перевіряємо що він запрошений саме до цього турніру
    if caller.get("role") in ("jury", "admin", "superadmin"):
        round_ = fetch_one(
            supabase.table("rounds").select("tournament_id").eq("id", round_id)
        )
        if not round_:
            raise HTTPException(status_code=404, detail="Раунд не знайдено")

        invited = supabase.table("jury_tournament_invitations") \
            .select("id") \
            .eq("tournament_id", round_["tournament_id"]) \
            .eq("jury_id", caller["id"]) \
            .eq("status", "accepted") \
            .execute()

        if not invited.data:
            raise HTTPException(status_code=403, detail="Ви не запрошені до журі цього турніру")

    # FIX (критичний): перевіряємо що раунд існує і має статус active або finished
    round_ = fetch_one(
        supabase.table("rounds")
            .select("id, status, tournament_id")
            .eq("id", round_id)
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Раунд не знайдено")
    if round_.get("status") not in ("active", "finished"):
        raise HTTPException(
            status_code=400,
            detail=f"Оцінювання недоступне: раунд має статус '{round_.get('status')}'. "
                   "Оцінювання дозволено лише для активних або завершених раундів."
        )

    # FIX (критичний): перевіряємо що журі призначено до цього раунду через jury_assignments
    if caller.get("role") == "jury":
        assignment = fetch_one(
            supabase.table("jury_assignments")
                .select("id")
                .eq("jury_id", caller["id"])
                .eq("round_id", round_id)
        )
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="Ви не призначені журі для цього раунду"
            )

    record = {
        "jury_id":        caller["id"],
        "submission_id":  payload.submission_id,
        "round_id":       round_id,
        "criteria_scores": payload.criteria_scores,
        "general_comment": payload.general_comment,
        "total_score":    payload.total_score,
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    }

    result = supabase.table("jury_evaluations").upsert(
        record, on_conflict="jury_id,submission_id"
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Не вдалося зберегти оцінку")

    print(f"[EVAL] {caller['username']} зберіг оцінку для submission {payload.submission_id}", flush=True)
    return {"success": True, "evaluation": result.data[0]}


@app.get("/api/rounds/{round_id}/submission")
async def get_submission(round_id: str, authorization: str = Header(...), team_id: str | None = None):
    """
    Отримати здану роботу команди для раунду.
    FIX: team_id тепер необов'язковий — якщо не переданий, визначається автоматично
    по токену (команда юзера в турнірі цього раунду).
    Збагачує file_paths підписаними URL для скачування (1 год).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)
    is_privileged = caller.get("role") in ("admin", "superadmin", "jury")

    # ── Визначаємо team_id ───────────────────────────────────────────────────
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

    # ── Перевіряємо доступ ───────────────────────────────────────────────────
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

    # ── Збагачуємо file_paths підписаними URL ────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# FIX: НОВИЙ ендпоінт — видалення файлу з чернетки submission.
# Фронтенд викликає DELETE /api/rounds/{round_id}/submission/file
# з body: {"file_path": "submissions/round_id/team_id/filename"}
# ─────────────────────────────────────────────────────────────────────────────

@app.delete("/api/rounds/{round_id}/submission/file")
async def delete_submission_file(round_id: str, body: dict, authorization: str = Header(...)):
    """
    Видалити окремий файл з чернетки здачі.
    Видаляє файл з bucket 'submissions' і прибирає його з file_paths у БД.
    Тільки власний учасник/капітан команди або адмін.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token  = authorization.replace("Bearer ", "").strip()
    caller = get_caller(token)

    file_path = (body.get("file_path") or "").strip()
    if not file_path:
        raise HTTPException(status_code=400, detail="Потрібен file_path")

    # Знаходимо submission цього раунду де є цей файл
    # Спочатку визначаємо team_id юзера в турнірі раунду
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

    # Знаходимо submission
    query = supabase.table("submissions") \
        .select("id, file_paths, status, is_draft, team_id") \
        .eq("round_id", round_id)
    if team_id:
        query = query.eq("team_id", team_id)

    sub = fetch_one(query)
    if not sub:
        raise HTTPException(status_code=404, detail="Здачу не знайдено")

    # Перевіряємо що submissions не закрита
    if sub.get("status") in ("closed", "reviewed"):
        raise HTTPException(status_code=403, detail="Здача закрита або перевірена, видалення файлів неможливе")

    # Перевіряємо що адмін не чіпає чужі файли без причини (або is_privileged — ок)
    if not is_privileged and sub["team_id"] != team_id:
        raise HTTPException(status_code=403, detail="Немає доступу до цієї здачі")

    # Видаляємо файл з bucket
    try:
        supabase.storage.from_("submissions").remove([file_path])
        print(f"[DELETE-FILE] Видалено з bucket: {file_path}", flush=True)
    except Exception as e:
        print(f"[DELETE-FILE] Помилка видалення з bucket {file_path}: {e}", flush=True)
        # Не зупиняємося — прибираємо з БД навіть якщо файл вже не існує

    # Прибираємо файл з file_paths у БД
    current_files: list[dict] = sub.get("file_paths") or []
    updated_files = [f for f in current_files if f.get("path") != file_path]

    supabase.table("submissions") \
        .update({"file_paths": updated_files, "updated_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", sub["id"]).execute()

    print(f"[DELETE-FILE] {caller['username']} видалив файл {file_path} з submission {sub['id']}", flush=True)
    return {"success": True}


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

    # FIX (середній): обмеження розміру файлу — 50 MB
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимальний розмір — 50 MB")

    # FIX (низький): валідація типу файлу — забороняємо виконувані файли
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

    # FIX (середній): обмеження розміру файлу — 100 MB для адмін-шаблонів
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл занадто великий. Максимальний розмір — 100 MB")

    # FIX (низький): валідація типу файлу — забороняємо виконувані файли
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
    caller = get_caller(token)

    paths = body.get("paths", [])
    if not paths or not isinstance(paths, list):
        raise HTTPException(status_code=400, detail="Потрібен список paths")
    if len(paths) > 50:
        raise HTTPException(status_code=400, detail="Максимум 50 файлів за раз")

    # FIX (високий): перевіряємо що всі paths належать команді поточного користувача.
    # Очікуваний формат: submissions/{round_id}/{team_id}/...
    # Знаходимо команди користувача і перевіряємо team_id в шляху.
    captain_res = supabase.table("teams").select("id").eq("captain_id", caller["id"]).execute()
    member_res  = supabase.table("teams").select("id").contains("members_ids", json.dumps([caller["id"]])).execute()
    is_admin    = caller.get("role") in ("admin", "superadmin", "jury")
    if not is_admin:
        user_team_ids = {t["id"] for t in (captain_res.data or []) + (member_res.data or [])}
        for path in paths:
            parts = path.split("/")
            # submissions/{round_id}/{team_id}/filename
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
    # FIX (критичний): використовуємо [user_id] (список), а не json.dumps([user_id]) (рядок)
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

@app.get("/api/users/search")
async def search_users(q: str, authorization: str = Header(...)):
    """Пошук користувачів по username/login/email. Використовує service_role — обходить RLS."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    token = authorization.replace("Bearer ", "").strip()
    get_caller(token)  # просто перевіряємо що юзер авторизований

    if len(q.strip()) < 2:
        return {"users": []}

    data = supabase.table("account") \
        .select("id, username, login, email, role, avatar_url, status") \
        .or_(f"username.ilike.%{q}%,login.ilike.%{q}%,email.ilike.%{q}%") \
        .eq("status", "active") \
        .limit(10) \
        .execute()

    return {"users": data.data or []}
