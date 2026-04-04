import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr

# --- ИНИЦИАЛИЗАЦИЯ ---
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ОШИБКА: Ключи Supabase не найдены!", flush=True)
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Бэкенд подключен к Supabase", flush=True)

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "https://site-turing-crutchmasters-team-s.pages.dev",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- МОДЕЛИ ДАННЫХ ---
class UserRegister(BaseModel):
    username: str
    login: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    login: str
    password: str

class ChangeRole(BaseModel):
    target_user_id: str
    new_role: str

# --- КОНСТАНТЫ ---
ALLOWED_ROLES = {"user", "jury", "admin"}

# --- ЭНДПОИНТЫ ---

@app.get("/api/test")
def connection_test():
    return {
        "status": "ok",
        "message": "Backend status active"
    }

# 1. РЕГИСТРАЦИЯ
@app.post("/api/register")
async def register_user(user: UserRegister):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        existing = supabase.table("account").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        result = supabase.table("account").insert({
            "username": user.username,
            "login": user.login,
            "email": user.email,
            "status": "active",
            "role": "user",
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to insert user data")

        return {"success": True, "message": "User registered successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. ЛОГИН
@app.post("/api/login")
async def login_user(user: UserLogin):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        identifier = user.login.strip()

        if "@" in identifier:
            result = supabase.table("account").select("*").eq("email", identifier).execute()
        else:
            result = supabase.table("account").select("*").eq("login", identifier).execute()

        if not result.data:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        user_data = result.data[0]
        email = user_data["email"]

        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": user.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid login or password")

        return {
            "success": True,
            "access_token": auth_response.session.access_token,
            "user": user_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. ПОЛУЧЕНИЕ EMAIL ПО ЛОГИНУ
@app.get("/api/get-email")
async def get_email_by_login(login: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    try:
        result = supabase.table("account").select("email").eq("login", login).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        return {"email": result.data[0]["email"]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. СМЕНА РОЛИ (только суперадмин)
@app.post("/api/change-role")
async def change_role(payload: ChangeRole, authorization: str = Header(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    print(f"\n=== CHANGE ROLE REQUEST ===", flush=True)
    print(f"Target user ID: {payload.target_user_id}", flush=True)
    print(f"New role: {payload.new_role}", flush=True)

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        print("ERROR: No token provided", flush=True)
        raise HTTPException(status_code=401, detail="No token provided")

    if payload.new_role not in ALLOWED_ROLES:
        print(f"ERROR: Invalid role {payload.new_role}. Allowed: {ALLOWED_ROLES}", flush=True)
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {ALLOWED_ROLES}")

    try:
        print("Step 1: Verifying token...", flush=True)
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            print("ERROR: Invalid token", flush=True)
            raise HTTPException(status_code=401, detail="Invalid token")

        caller_email = user_resp.user.email
        print(f"Step 1: Token verified for {caller_email}", flush=True)

        print("Step 2: Getting caller role...", flush=True)
        caller_info = supabase.table("account").select("id, role").eq("email", caller_email).single().execute()
        if not caller_info.data:
            print("ERROR: Caller account not found", flush=True)
            raise HTTPException(status_code=403, detail="Caller account not found")

        print(f"Step 2: Caller role is {caller_info.data['role']}", flush=True)

        if caller_info.data["role"] != "superadmin":
            print(f"ERROR: Caller is not superadmin", flush=True)
            raise HTTPException(status_code=403, detail="Only superadmin can change roles")

        caller_id = caller_info.data["id"]

        if caller_id == payload.target_user_id:
            print("ERROR: Cannot change own role", flush=True)
            raise HTTPException(status_code=400, detail="Cannot change your own role")

        print("Step 3: Checking if target user exists...", flush=True)
        target_check = supabase.table("account").select("id, username, role").eq("id", payload.target_user_id).single().execute()
        if not target_check.data:
            print(f"ERROR: Target user {payload.target_user_id} not found", flush=True)
            raise HTTPException(status_code=404, detail="Target user not found")

        target_username = target_check.data.get("username", "Unknown")
        old_role = target_check.data.get("role", "unknown")
        print(f"Step 3: Target user found - {target_username} (current role: {old_role})", flush=True)

        if old_role == "superadmin":
            print(f"ERROR: Cannot change role of another superadmin", flush=True)
            raise HTTPException(status_code=403, detail="Cannot change the role of another superadmin")

        print(f"Step 4: Updating role in database...", flush=True)
        print(f"Query: UPDATE account SET role='{payload.new_role}' WHERE id='{payload.target_user_id}'", flush=True)

        update_result = supabase.table("account").update({
            "role": payload.new_role
        }).eq("id", payload.target_user_id).execute()

        print(f"Step 4: Update result received", flush=True)
        print(f"Update result data: {update_result.data}", flush=True)
        print(f"Update result count: {len(update_result.data) if update_result.data else 0}", flush=True)

        print(f"SUCCESS: {caller_email} changed {target_username} role from {old_role} to {payload.new_role}", flush=True)
        print(f"=== END CHANGE ROLE ===\n", flush=True)

        return {"success": True, "message": f"Role changed to {payload.new_role}"}

    except HTTPException as he:
        print(f"HTTP ERROR: {he.status_code} - {he.detail}", flush=True)
        print(f"=== END CHANGE ROLE (ERROR) ===\n", flush=True)
        raise
    except Exception as e:
        print(f"EXCEPTION: {type(e).__name__}: {str(e)}", flush=True)
        import traceback
        print(traceback.format_exc(), flush=True)
        print(f"=== END CHANGE ROLE (EXCEPTION) ===\n", flush=True)
        raise HTTPException(status_code=500, detail=str(e))
