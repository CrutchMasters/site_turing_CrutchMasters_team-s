import contextlib
import io
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# Тести працюють без справжніх ключів: Supabase підміняється in-memory базою.
for _key in ("SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_JWT_SECRET"):
    os.environ.pop(_key, None)

with contextlib.redirect_stdout(io.StringIO()):
    import src.routers.rounds  # noqa: F401  (db.py друкує попередження про відсутні ключі)
