from typing import Optional
from fastapi import Header, HTTPException, status
from app.config import ADVISORY_AUDIO_API_KEY

def verify_audio_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> Optional[str]:
    """
    Validates X-API-Key header against ADVISORY_AUDIO_API_KEY environment variable.
    If ADVISORY_AUDIO_API_KEY is configured (e.g. for private deployments), callers must provide it.
    If unconfigured (standard mode for web application), public rate-limiting governs access
    so client-side bundles do not need to expose or leak API secrets.
    """
    if ADVISORY_AUDIO_API_KEY:
        if not x_api_key or x_api_key != ADVISORY_AUDIO_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-API-Key header for advisory audio synthesis."
            )
    return x_api_key
