import logging
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import ChatRequest, ChatResponse
from app.services.chat_assistant import generate_chat_response

logger = logging.getLogger("varsha_setu.chat")

router = APIRouter(tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest) -> ChatResponse:
    """
    Multilingual Context-Grounded AI Agronomic Assistant.
    Interprets telemetry, forecast probabilities, and soil moisture buffer for farmers in Karnataka.
    Responds in English ('en'), Kannada ('kn'), or Hindi ('hi') with interactive follow-up options.
    """
    try:
        response = await generate_chat_response(request)
        return response
    except Exception as e:
        logger.error("Chat generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"AI assistant failed to generate advice: {str(e)}"
        )
