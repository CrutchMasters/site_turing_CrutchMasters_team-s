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
    print(f"\n👤 Попытка регистрации: {user.username} ({user.login})")
    
    try:
        # Этап 1: Создание аккаунта в системе Auth
        # Если здесь ошибка "Database error saving new user" — чисти триггеры в SQL Editor (Шаг 1 выше)
        auth_res = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })
        print("✅ Auth этап пройден")

        # Этап 2: Запись в твою таблицу
        db_res = supabase.table("account").insert({
            "username": user.username,
            "login": user.login,
            "email": user.email,
            "password": user.password,
            "status": "user"
        }).execute()
        
        print(f"✅ Данные сохранены в таблицу account")
        return {"status": "success", "message": "User registered successfully"}

    except Exception as e:
        msg = str(e)
        print("\n--- КРИТИЧЕСКАЯ ОШИБКА БАЗЫ ---")
        print(f"Сообщение: {msg}")
        print("-------------------------------\n")
        
        raise HTTPException(
            status_code=400,
            detail=f"Ошибка: {msg}"
        )
