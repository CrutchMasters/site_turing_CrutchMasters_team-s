from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Створюємо екземпляр додатка
app = FastAPI(
    title="Tournament Platform API",
    description="Це 'мозок' нашої системи для проведення турнірів",
    version="0.1.0"

)
origins = [
    "http://localhost:3000",
    "https://your-frontend-vercel-link.vercel.app", # Сюди потім додасте посилання Богдана
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Дозволяє всі методи (GET, POST і т.д.)
    allow_headers=["*"], # Дозволяє всі заголовки
)

# 1. Главная страница
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Привіт, Капітане! Бекенд турнірної платформи запущено.",
        "team": ["Антон (Backend)", "Учень Богдан (Frontend)", "Діма (Data)"]
    }

# 2. Тестовий маршрут для перевірки логіки
@app.get("/healthcheck")
def check_system():
    return {
        "service": "tournament-core",
        "database_connected": False,  # Поки що False, поки Діма не підключив Supabase
        "uptime": "just started"
    }
# 3. Маршрут связи с фронтом
@app.get("/api/test")
def connection_test():
    return {
        "status": "ok",
        "message": "Бекенд Антона працює! Привіт, Богдане!"
    }
