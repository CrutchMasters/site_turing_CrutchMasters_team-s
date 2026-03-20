import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGISTER ---
class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr
    password: str

@app.post("/api/register")
async def register_user(user: UserRegister):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        existing = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        result = supabase.table("account").insert({
            "username": user.username,
            "login": user.login,
            "email": user.email,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to insert user data")

        return {"success": True, "message": "User registered successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- LOGIN ---
class UserLogin(BaseModel):
    login: str
    password: str

@app.post("/api/login")
async def login_user(user: UserLogin):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        # Визначаємо чи введено email або login
        identifier = user.login.strip()

        if "@" in identifier:
            # Введено email — шукаємо напряму
            result = supabase.table("account").select("email").eq("email", identifier).execute()
        else:
            # Введено login — знаходимо відповідний email
            result = supabase.table("account").select("email").eq("login", identifier).execute()

        if not result.data:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        email = result.data[0]["email"]

        # Перевіряємо пароль через Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": user.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        # Повертаємо токен і дані юзера
        user_data = supabase.table("account").select("*").eq("email", email).execute()

        return {
            "success": True,
            "access_token": auth_response.session.access_token,
            "user": user_data.data[0] if user_data.data else {},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
