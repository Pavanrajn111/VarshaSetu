import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel, Field

from app.limiter import limiter
from app.services.user_store import (
    create_user,
    get_user_by_phone,
    update_user_profile,
    validate_indian_phone,
    verify_password,
    normalize_phone_number,
)
from app.services.auth_token import create_access_token, get_current_user

logger = logging.getLogger("varsha_setu.auth_router")

router = APIRouter(prefix="/auth", tags=["User Authentication"])

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")
    phone_number: str = Field(..., description="10-digit Indian mobile number")
    password: str = Field(..., min_length=6, max_length=128, description="Password (min 6 characters)")
    preferred_language: str = Field("en", description="Language code: en, kn, or hi")
    role: Optional[str] = Field("farmer", description="'farmer' or 'officer'")
    default_taluk: Optional[str] = None
    default_district: Optional[str] = None

class LoginRequest(BaseModel):
    phone_number: str = Field(..., description="Registered mobile number")
    password: str = Field(..., description="Account password")

class ProfileUpdateRequest(BaseModel):
    preferred_language: Optional[str] = None
    default_taluk: Optional[str] = None
    default_district: Optional[str] = None
    notification_prefs: Optional[Dict[str, Any]] = None

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(req: RegisterRequest) -> Dict[str, Any]:
    """
    Registers a new user account with phone validation, uniqueness check,
    and bcrypt password hashing. Returns a signed JWT token and user profile.
    """
    clean_phone = normalize_phone_number(req.phone_number)
    if not validate_indian_phone(clean_phone):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid phone number. Must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9."
        )

    # Check for existing account
    existing = get_user_by_phone(clean_phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number is already registered. Please log in."
        )

    try:
        user = create_user(
            full_name=req.full_name,
            phone_number=clean_phone,
            password_plain=req.password,
            preferred_language=req.preferred_language,
            role=req.role or "farmer",
            default_taluk=req.default_taluk,
            default_district=req.default_district,
        )
    except Exception as e:
        logger.error("Failed to create user: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account."
        )

    token = create_access_token(user["id"], user["phone_number"], user["role"])
    logger.info("Successfully registered user ID %d (%s)", user["id"], user["role"])

    return {
        "status": "success",
        "message": "User registered successfully.",
        "token": token,
        "user": user
    }

@router.post("/login")
@limiter.limit("5/minute")
def login_user(request: Request, req: LoginRequest) -> Dict[str, Any]:
    """
    Authenticates user with phone number and password.
    Enforces a strict rate limit of 5 attempts/minute per IP.
    Returns generic 401 error message on failure to prevent enumeration attacks.
    """
    clean_phone = normalize_phone_number(req.phone_number)
    user_record = get_user_by_phone(clean_phone)

    # Generic failure condition: user not found OR password mismatch
    if not user_record or not verify_password(req.password, user_record["password_hash"]):
        logger.warning("Failed login attempt for phone %s", clean_phone[:4] + "******" if len(clean_phone) >= 4 else "unknown")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_record["id"], user_record["phone_number"], user_record["role"])
    user_safe = {
        "id": user_record["id"],
        "full_name": user_record["full_name"],
        "phone_number": user_record["phone_number"],
        "role": user_record["role"],
        "preferred_language": user_record["preferred_language"],
        "default_taluk": user_record["default_taluk"],
        "default_district": user_record["default_district"],
        "created_at": user_record["created_at"],
    }
    logger.info("Successful login for user ID %d (%s)", user_safe["id"], user_safe["phone_number"])

    return {
        "status": "success",
        "message": "Login successful.",
        "token": token,
        "user": user_safe
    }

@router.get("/me")
def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns the authenticated user's profile.
    Requires Authorization: Bearer <token>.
    """
    return {
        "status": "success",
        "user": current_user
    }

@router.patch("/me")
def update_profile(
    req: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates the authenticated user's preferences (language, default location, notification settings).
    Requires Authorization: Bearer <token>.
    """
    updates = req.model_dump(exclude_unset=True)
    updated_user = update_user_profile(current_user["id"], updates)

    return {
        "status": "success",
        "message": "Preferences updated successfully.",
        "user": updated_user
    }
