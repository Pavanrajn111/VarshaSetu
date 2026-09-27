from typing import Optional
from fastapi import Header, HTTPException, status
from app.config import ADVISORY_AUDIO_API_KEY, APP_ENV

def verify_audio_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> Optional[str]:
    """
    Validates X-API-Key header against ADVISORY_AUDIO_API_KEY environment variable.
    If ADVISORY_AUDIO_API_KEY is set, enforces matching key on all callers.
    If unconfigured in development/test, permits access for local convenience.
    If unconfigured in production mode (APP_ENV=production), rejects with 500 configuration error.
    """
    if ADVISORY_AUDIO_API_KEY:
        if not x_api_key or x_api_key != ADVISORY_AUDIO_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-API-Key header for advisory audio synthesis."
            )
    else:
        if APP_ENV == "production":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: ADVISORY_AUDIO_API_KEY is not configured in production."
            )
    return x_api_key
