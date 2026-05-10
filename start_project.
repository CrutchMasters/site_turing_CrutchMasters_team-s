#!/bin/bash

# Цвета для красоты в терминале
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}>>> Запуск проекта CrutchMasters...${NC}"

# 1. Запуск Бэкенда
echo -e "${GREEN}>>> Запускаю Бэкенд (FastAPI)...${NC}"
cd backend
# Проверяем, есть ли venv, если нет - создаем
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
# Запускаем uvicorn в фоновом режиме
uvicorn main:app --reload & 
BACKEND_PID=$!
cd ..

# 2. Запуск Фронтенда
echo -e "${GREEN}>>> Запускаю Фронтенд (Next.js)...${NC}"
cd frontend
# Проверяем node_modules
if [ ! -d "node_modules" ]; then
    npm install
fi
# Запускаем фронт
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${BLUE}>>> Оба сервера запущены!${NC}"
echo -e "${BLUE}>>> Бэкенд: http://127.0.0.1:8000${NC}"
echo -e "${BLUE}>>> Фронтенд: http://localhost:3000${NC}"
echo -e "Нажми CTRL+C, чтобы остановить оба сервера."

# Функция для корректного завершения обоих процессов
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT

# Ждем завершения процессов
wait

