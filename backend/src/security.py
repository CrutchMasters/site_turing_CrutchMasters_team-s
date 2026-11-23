"""Перевірка JWT та визначення поточного користувача (caller)."""

import json
import os
import threading

import jwt as pyjwt
from fastapi import HTTPException

from src.db import fetch_one, supabase


def decode_jwt_payload(token: str) -> dict:
    import base64 as _base64

    try:
        header_part = token.split(".")[0]
        padded = header_part + "=" * (-len(header_part) % 4)
        header = json.loads(_base64.urlsafe_b64decode(padded))
        alg = header.get("alg", "HS256")
        kid = header.get("kid")
    except Exception:
        alg = "HS256"
        kid = None

    supabase_url = os.getenv("SUPABASE_URL", "")
    jwt_secret   = os.getenv("SUPABASE_JWT_SECRET")

    if alg == "ES256":
        try:
            from jwt.algorithms import ECAlgorithm
            import urllib.request
            import time as _time

            cache     = decode_jwt_payload.__dict__.setdefault("_jwks_cache", {})
            cache_ts  = decode_jwt_payload.__dict__.setdefault("_jwks_ts", 0)
            cache_ttl = 3600

            public_key = cache.get(kid) if kid else (list(cache.values())[0] if cache else None)

            if public_key is None or (_time.time() - cache_ts > cache_ttl):
                jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
                print(f"[JWT] Fetching JWKS from {jwks_url}", flush=True)
                with urllib.request.urlopen(jwks_url, timeout=5) as resp:
                    jwks = json.loads(resp.read())

                keys = jwks.get("keys", [])
                if not keys:
                    raise HTTPException(status_code=401, detail="JWKS: no keys returned")

                cache.clear()
                for k in keys:
                    k_kid = k.get("kid", "__default__")
                    cache[k_kid] = ECAlgorithm.from_jwk(json.dumps(k))
                decode_jwt_payload.__dict__["_jwks_ts"] = _time.time()

                public_key = cache.get(kid) if kid else list(cache.values())[0]

            if public_key is None:
                raise HTTPException(status_code=401, detail="JWKS: matching public key not found")

            payload = pyjwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_exp": True, "verify_aud": False},
            )
            return payload
        except HTTPException:
            raise
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except pyjwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
        except Exception as e:
            print(f"[JWT] JWKS fetch failed: {e}", flush=True)
            stale_key = list(decode_jwt_payload.__dict__.get("_jwks_cache", {}).values())
            if stale_key:
                print("[JWT] Using stale cached JWKS key", flush=True)
                try:
                    return pyjwt.decode(token, stale_key[0], algorithms=["ES256"], options={"verify_exp": True, "verify_aud": False})
                except pyjwt.ExpiredSignatureError:
                    raise HTTPException(status_code=401, detail="Token expired")
                except Exception as e2:
                    raise HTTPException(status_code=401, detail=f"Invalid token: {e2}")
            print(f"[JWT] JWKS unavailable and no cache — falling back to unverified decode", flush=True)
            try:
                return pyjwt.decode(token, options={"verify_signature": False})
            except Exception as e3:
                raise HTTPException(status_code=401, detail=f"Cannot verify token: JWKS unavailable and fallback failed ({e3})")

    if not jwt_secret:
        print("[JWT] УВАГА: SUPABASE_JWT_SECRET не задано — підпис не перевіряється!", flush=True)
        try:
            return pyjwt.decode(token, options={"verify_signature": False})
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid token format: {e}")
    try:
        payload = pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": True, "verify_aud": False},
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def preload_jwks():
    try:
        decode_jwt_payload("dummy.dummy.dummy")
    except Exception:
        pass


def get_caller(token: str) -> dict:
    print(f"[get_caller] token prefix={token[:40]!r}", flush=True)
    jwt_payload  = decode_jwt_payload(token)
    user_id      = jwt_payload.get("sub")
    caller_email = jwt_payload.get("email")

    print(f"[get_caller] id(sub)={user_id!r} email={caller_email!r}", flush=True)

    if not user_id and not caller_email:
        raise HTTPException(status_code=401, detail="Invalid token: no sub or email claim")

    account = None

    if user_id:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("id", user_id)
            )
        except Exception as e:
            print(f"[get_caller] DB error (id lookup): {e}", flush=True)

    if not account and caller_email:
        try:
            account = fetch_one(
                supabase.table("account")
                    .select("id, username, email, role")
                    .eq("email", caller_email)
            )
        except Exception as e:
            print(f"[get_caller] DB error (email lookup): {e}", flush=True)

    print(f"[get_caller] account found: {account}", flush=True)
    if not account:
        raise HTTPException(
            status_code=403,
            detail=f"Аккаунт не найден. email={caller_email!r} id={user_id!r}"
        )
    return account


def start_jwks_preload():
    """Прогріває кеш JWKS у фоні, щоб перший запит із токеном не чекав мережі."""
    threading.Thread(target=preload_jwks, daemon=True).start()
