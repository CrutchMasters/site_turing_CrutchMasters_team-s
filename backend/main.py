from fastapi import FastAPI

# Створюємо екземпляр додатка
app = FastAPI(
    title="Tournament Platform API",
    description="Це 'мозок' нашої системи для проведення турнірів",
    version="0.1.0"
)

# 1. Головна сторінка (вітання)
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Привіт, Капітане! Бекенд турнірної платформи запущено.",
        "team": ["Антон (Backend)", "Учень №1 (Frontend)", "Діма (Data)"]
    }

# 2. Тестовий маршрут для перевірки логіки
@app.get("/healthcheck")
def check_system():
    return {
        "service": "tournament-core",
        "database_connected": False,  # Поки що False, поки Діма не підключив Supabase
        "uptime": "just started"
    }