"""Налаштування з оточення (.env локально, змінні середовища на Render)."""

import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

ALLOWED_ROLES = {"user", "jury", "admin"}

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://site-turing-crutchmasters-team-s.pages.dev",
    "https://siteturingcrutchmastersteam-s.crutch-mastersss.workers.dev",
]
_extra_origins = os.getenv("CORS_EXTRA_ORIGINS", "")
if _extra_origins:
    ALLOWED_ORIGINS.extend(o.strip() for o in _extra_origins.split(",") if o.strip())
