import os
from typing import Any, Optional

import requests
from fastapi import Header, HTTPException


def _supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("SUPABASE_URL must be set")
    return url


def _anon_key() -> str:
    anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not anon:
        raise RuntimeError("SUPABASE_ANON_KEY must be set")
    return anon


def verify_bearer_jwt(authorization: str) -> dict[str, Any]:
    """
    Production-safe v1 auth for this project: Supabase introspection.
    Reason: the project's JWKS endpoint currently returns {"keys": []}, so offline RS256 verification cannot succeed.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Missing bearer token", "details": {}}})
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Missing bearer token", "details": {}}})

    try:
        supabase_url = _supabase_url()
        anon = _anon_key()
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "AUTH_CONFIG_MISSING",
                    "message": "Unable to verify authentication credentials (missing SUPABASE_URL or SUPABASE_ANON_KEY on the Data API).",
                    "details": {},
                }
            },
        )

    try:
        r = requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": anon,
                "accept": "application/json",
            },
            timeout=8,
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "AUTH_UNAVAILABLE",
                    "message": "Unable to verify authentication credentials (Supabase auth unreachable).",
                    "details": {"reason": e.__class__.__name__},
                }
            },
        )

    if r.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "JWT verification failed",
                    "details": {"status": r.status_code},
                }
            },
        )

    payload = r.json() if r.content else {}

    # Supabase may return either:
    # - {"user": {...}}
    # - {...} (user object at top level)
    user: dict[str, Any] = {}
    if isinstance(payload, dict):
        if isinstance(payload.get("user"), dict):
            user = payload["user"]  # type: ignore[assignment]
        else:
            user = payload  # type: ignore[assignment]

    user_id = user.get("id") or user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "Missing user id from introspection.",
                    "details": {"payload_keys": list(payload.keys()) if isinstance(payload, dict) else None},
                }
            },
        )

    claims = {"sub": user_id, "user": user}

    return claims


def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    authz = authorization or ""
    claims = verify_bearer_jwt(authz)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail={"error": {"code": "INVALID_TOKEN", "message": "Missing sub claim", "details": {}}})
    token = authz.split(" ", 1)[1].strip() if authz.lower().startswith("bearer ") else ""
    return {"user_id": user_id, "claims": claims, "token": token}


CurrentUser = dict[str, Any]


