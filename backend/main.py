import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

# --- ИНИЦИАЛИЗАЦИЯ ---
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ КРИТИЧЕСКАЯ ОШИБКА: Ключи Supabase не найдены!", flush=True)
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Бэкенд успешно подключен к Supabase", flush=True)

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
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

# --- ЭНДПОИНТЫ ---

@app.get("/api/test")
def connection_test():
    return {
        "status": "ok",
        "message": "Backend status active"
    }

# 1. РЕГИСТРАЦИЯ
@app.post("/api/register")
async def register_user(user: UserRegister):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        # Проверка, существует ли пользователь
        existing = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        # Вставка данных в таблицу account
        result = supabase.table("account").insert({
    "username": user.username,
    "login": user.login,
    "email": user.email,
    "status": "active",
    "role": "user",  # ← додай це
    }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to insert user data")

        return {"success": True, "message": "User registered successfully"}

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

        # Определяем, вошел ли пользователь через email или логин
        if "@" in identifier:
            result = supabase.table("account").select("email").eq("email", identifier).execute()
        else:
            result = supabase.table("account").select("email").eq("login", identifier).execute()

        if not result.data:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        email = result.data[0]["email"]

        # Аутентификация через Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": user.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        # Получаем полные данные пользователя из таблицы account
        user_info = supabase.table("account").select("*").eq("email", email).execute()

        return {
            "success": True,
            "access_token": auth_response.session.access_token,
            "user": user_info.data[0] if user_info.data else {},
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
        # Изменил "profiles" на "account", чтобы соответствовать остальной логике
        result = supabase.table("account").select("email").eq("login", login).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        return {"email": result.data[0]["email"]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
