"""Клієнти Supabase, ініціалізація storage-бакетів і допоміжні запити."""

from supabase import Client, create_client

from src.config import SUPABASE_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ОШИБКА: Ключи Supabase не найдены! Проверь SUPABASE_URL и SUPABASE_SERVICE_KEY в .env", flush=True)
    supabase = None
    supabase_auth = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else supabase
    print("Бэкенд подключен к Supabase (service role)", flush=True)

REQUIRED_BUCKETS = [
    {"id": "submissions",        "name": "submissions",        "public": False},
    {"id": "round-files",        "name": "round-files",        "public": False},
    {"id": "tournament-banners", "name": "tournament-banners", "public": True},
]
BUCKET_FILE_SIZE_LIMIT = 104857600  # 100 MB


def ensure_buckets():
    """Створює відсутні storage-бакети. Викликається при старті застосунку."""
    if not supabase:
        return
    try:
        existing = {b.id for b in supabase.storage.list_buckets()}
    except Exception as e:
        print(f"[BUCKET] Не вдалося отримати список buckets: {e}", flush=True)
        return

    for b in REQUIRED_BUCKETS:
        if b["id"] not in existing:
            try:
                supabase.storage.create_bucket(
                    b["id"],
                    options={"public": b["public"], "file_size_limit": BUCKET_FILE_SIZE_LIMIT},
                )
                print(f"[BUCKET] Створено bucket '{b['id']}'", flush=True)
            except Exception as e:
                print(f"[BUCKET] Не вдалося створити bucket '{b['id']}': {e}", flush=True)
        else:
            print(f"[BUCKET] Bucket '{b['id']}' вже існує", flush=True)


def fetch_one(query) -> dict | None:
    """Виконує запит з limit(1) і повертає перший рядок або None (помилки логуються)."""
    try:
        result = query.limit(1).execute()
        if result and result.data:
            return result.data[0]
        return None
    except Exception as _fe:
        print(f"[fetch_one] ERROR: {_fe}", flush=True)
        return None
