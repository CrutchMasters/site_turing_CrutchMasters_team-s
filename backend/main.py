import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Создание экземпляра додатка
app = FastAPI(
    title="Tournament Platform API",
    description="Це 'мозок' нашої системи для проведення турнірів",
    version="0.1.0"

)
origins = [
    "http://localhost:3000",
    "https://your-frontend-vercel-link.vercel.app", # ссылка богдана
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешает все методы (GET, POST і т.д.)
    allow_headers=["*"], # Разрешает все заголовки
)

# 1. Главная страница
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Привіт, Капітане! Бекенд турнірної платформи запущено.",
        "team": ["Антон (Backend)", "Учень Богдан (Frontend)", "Діма (Data)"]
    }

# 2. Проверка логики текстовым путем
@app.get("/healthcheck")
def check_system():
    return {
        "service": "tournament-core",
        "database_connected": True,  
        "uptime": "just started"
    }
# 3. Маршрут связи с фронтом
@app.get("/api/test")
def connection_test():
    return {
        "status": "ok",
        "message": "Бекенд Антона працює! Привіт, Богдане!"
    }

load_dotenv()

app = FastAPI()

# подкачь ключа
DATABASE_URL = os.getenv("DATABASE_URL")

@app.get("/api/db-check")
def check_db():
    # Це просто перевірка, видит ли бэкенд клуч
    if DATABASE_URL:
        # показываем начало строки ради безопасности поняли да ?
        return {"status": "success", "db_info": f"{DATABASE_URL[:15]}..."}
    return {"status": "error", "message": "Ключ не знайдено в .env"}
