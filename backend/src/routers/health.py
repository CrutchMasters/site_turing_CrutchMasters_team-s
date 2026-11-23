"""Службові ендпоінти."""

from fastapi import APIRouter


router = APIRouter()


@router.get("/api/test")
def connection_test():
    return {"status": "ok", "message": "Backend status active"}
