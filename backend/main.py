import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

# 1. Загрузка окружения
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Инициализация клиента
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ КРИТИЧЕСКАЯ ОШИБКА: Ключи Supabase не найдены!", flush=True)
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Бэкенд успешно подключен к Supabase", flush=True)

app = FastAPI()

# 2. Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модель данных из фронтенда
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
        # Перевіряємо чи існує вже такий email
        existing = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        # Записуємо в таблицю account (без пароля — він зберігається в Supabase Auth)
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
