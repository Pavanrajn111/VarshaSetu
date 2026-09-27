import hashlib
import io
import logging
import time
from typing import Dict, Tuple
from gtts import gTTS
from app.config import AUDIO_CACHE_TTL

logger = logging.getLogger("varsha_setu.voice")

# Unified mapping from language inputs/codes to standard gTTS language codes
LANGUAGE_TO_GTTS: Dict[str, str] = {
    "en": "en",
    "english": "en",
    "kn": "kn",
    "kannada": "kn",
    "ಕನ್ನಡ (kannada)": "kn",
    "ಕನ್ನಡ": "kn",
    "hi": "hi",
    "hindi": "hi",
    "हिन्दी (hindi)": "hi",
    "हिन्दी": "hi"
}

# In-memory audio cache: cache_key -> (raw_bytes, expiry_timestamp)
_audio_cache: Dict[str, Tuple[bytes, float]] = {}

def get_gtts_code(language: str) -> str:
    """Resolves language identifier to gTTS language code."""
    normalized = str(language).strip().lower()
    return LANGUAGE_TO_GTTS.get(normalized, "en")

def generate_advisory_audio(text: str, language: str) -> io.BytesIO:
    """
    Synthesizes speech for the provided agronomic advisory text using Google Text-to-Speech (gTTS).
    Supports English ('en'), Kannada ('kn'), and Hindi ('hi').
    Caches identical (text, language) requests in memory to eliminate duplicate calls to Google TTS.
    Includes non-empty byte validation and graceful fallback logging if regional voice fails.
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Audio synthesis text cannot be empty.")

    lang_code = get_gtts_code(language)
    now = time.time()

    # Cache lookup by text hash and language code
    cache_key = hashlib.sha256(f"{lang_code}:{clean_text}".encode("utf-8")).hexdigest()
    if cache_key in _audio_cache:
        cached_bytes, expiry = _audio_cache[cache_key]
        if now < expiry:
            logger.debug("Serving advisory audio from in-memory cache (lang=%s, hash=%s)", lang_code, cache_key[:8])
            return io.BytesIO(cached_bytes)

    logger.info("Generating advisory audio stream via gTTS (lang=%s, length=%d chars)...", lang_code, len(clean_text))

    try:
        audio_buf = io.BytesIO()
        tts = gTTS(text=clean_text, lang=lang_code, slow=False)
        tts.write_to_fp(audio_buf)
        audio_buf.seek(0)
        raw_bytes = audio_buf.getvalue()

        if len(raw_bytes) == 0:
            raise ValueError(f"gTTS returned an empty audio stream for language code '{lang_code}'.")

        # Store in cache
        _audio_cache[cache_key] = (raw_bytes, now + AUDIO_CACHE_TTL)
        return io.BytesIO(raw_bytes)

    except Exception as e:
        logger.warning(
            "Primary audio generation failed for language '%s': %s. "
            "Attempting fallback audio synthesis...",
            lang_code, e
        )
        if lang_code != "en":
            try:
                fallback_buf = io.BytesIO()
                fallback_tts = gTTS(text=clean_text, lang="en", slow=False)
                fallback_tts.write_to_fp(fallback_buf)
                fallback_buf.seek(0)
                fb_bytes = fallback_buf.getvalue()
                if len(fb_bytes) > 0:
                    logger.info("Fallback audio synthesis (lang=en) succeeded.")
                    _audio_cache[cache_key] = (fb_bytes, now + AUDIO_CACHE_TTL)
                    return io.BytesIO(fb_bytes)
            except Exception as fb_err:
                logger.error("Fallback audio generation also failed: %s", fb_err)

        raise RuntimeError(f"Voice synthesis failed for language '{lang_code}': {str(e)}")
