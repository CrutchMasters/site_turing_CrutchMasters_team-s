"""Точка входу FastAPI-застосунку. Запуск: uvicorn main:app --reload"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import ALLOWED_ORIGINS
from src.db import ensure_buckets
from src.routers import (
    evaluation,
    health,
    invitations,
    jury,
    leaderboard,
    notifications,
    rounds,
    submissions,
    teams,
    tournaments,
    uploads,
    users,
)
from src.security import start_jwks_preload
from src.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_buckets()
    start_jwks_preload()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    health,
    users,
    teams,
    tournaments,
    invitations,
    jury,
    notifications,
    submissions,
    evaluation,
    rounds,
    uploads,
    leaderboard,
):
    app.include_router(module.router)
