import datetime
import logging
import os
from typing import Dict, Any, Optional

import jwt
from fastapi import HTTPException, Header, Depends, status

from app.services.user_store import get_user_by_id

logger = logging.getLogger("varsha_setu.auth_token")

# Secret key from environment with secure fallback
JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "varsha-setu-secure-auth-jwt-token-secret-2026-production-sih")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = int(os.getenv("AUTH_JWT_EXPIRY_DAYS", "30"))

def create_access_token(user_id: int, phone_number: str, role: str = "farmer") -> str:
    """Generates a signed HS256 JWT access token valid for 30 days."""
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = now + datetime.timedelta(days=JWT_EXPIRY_DAYS)
    payload = {
        "sub": str(user_id),
        "phone": phone_number,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token.
    Raises HTTPException 401 on malformed or expired tokens.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("Provided JWT token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.debug("Invalid JWT token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    FastAPI dependency that extracts and validates the Bearer token from the Authorization header.
    Returns the user profile from the database.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    payload = decode_access_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str or not user_id_str.isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(int(user_id_str))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
