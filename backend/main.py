import os
import sys
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
    print("❌ КРИТИЧЕСКАЯ ОШИБКА: Ключи не найдены!", flush=True)
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Бэкенд успешно подключен к Supabase", flush=True)

app = FastAPI()

# 2. CORS (Без этого фронтенд не сможет слать POST запросы)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Маршрут связи с фронтом (то, что ищет Богдан)
@app.get("/api/test")
def connection_test():
    return {
        "status": "ok",
        "message": "Backend status active"
    }

# Схема данных
class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr
    password: str

@app.get("/")
def home():
    return {"message": "Server is running"}

# --- ЭНДПОИНТ РЕГИСТРАЦИИ ---
@app.post("/api/register")
async def register_user(user: UserRegister):
    # ПРИНУДИТЕЛЬНЫЙ ВЫВОД В КОНСОЛЬ
    print("\n" + "="*30, flush=True)
    print(f"🔥 ПОЛУЧЕН ЗАПРОС НА РЕГИСТРАЦИЮ!", flush=True)
    print(f"👤 Имя (username): {user.username}", flush=True)
    print(f"🔑 Логин (login):    {user.login}", flush=True)
    print(f"📧 Email:           {user.email}", flush=True)
    print(f"🛡️ Пароль:          {user.password}", flush=True)
    print("="*30 + "\n", flush=True)

    try:
        # 1. Создаем пользователя в Auth
        auth_res = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {"data": {"username": user.username}}
        })

        # 2. Сохраняем в таблицу accaunt
        db_res = supabase.table("accaunt").insert({
            "login": user.login,
            "name": user.username,
            "email": user.email,
            "pasword": user.password, # Убедись, что в БД это TEXT, а не BIGINT
            "status": "active"
        }).execute()

        print("✅ Данные успешно сохранены в таблицу 'accaunt'", flush=True)
        return {"status": "success", "user": user.login}

    except Exception as e:
        error_msg = str(e)
        print(f"❌ ОШИБКА: {error_msg}", flush=True)
        raise HTTPException(status_code=400, detail=error_msg)
