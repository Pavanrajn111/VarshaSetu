import asyncio
from typing import Optional
from fastapi import APIRouter, Response, HTTPException, Request, Depends
from app.limiter import limiter
from app.models.schemas import VoiceRequest
from app.services.voice import generate_advisory_audio
from app.services.security import verify_audio_api_key

router = APIRouter(prefix="/advisory", tags=["Voice Synthesis"])

@router.post("/audio")
@limiter.limit("10/minute")
async def stream_advisory_audio(
    request: Request,
    req: VoiceRequest,
    _api_key: Optional[str] = Depends(verify_audio_api_key)
):
    """
    Synthesizes MP3 speech audio for the provided advisory text in English, Kannada, or Hindi using gTTS.
    Protected by rate limiting (10/min) and X-API-Key verification.
    Uses non-blocking async execution.
    Returns binary MP3 audio stream with Content-Type 'audio/mpeg'.
    """
    try:
        audio_stream = await asyncio.to_thread(generate_advisory_audio, req.text, req.language.value)
        return Response(
            content=audio_stream.getvalue(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=varsha_setu_advisory.mp3"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio synthesis failed: {str(e)}")
