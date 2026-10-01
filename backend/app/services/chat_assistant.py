import json
import logging
import re
from typing import List, Tuple, Dict, Any, Optional
import httpx

from app.config import GEMINI_API_KEY
from app.models.schemas import ChatRequest, ChatResponse
from app.services.soil_advisory import normalize_language_code

logger = logging.getLogger("varsha_setu.chat_assistant")

GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
PRIMARY_MODEL = "gemini-flash-lite-latest"
FALLBACK_MODEL = "gemini-flash-latest"

LANGUAGE_LABELS = {
    "en": "English",
    "kn": "ಕನ್ನಡ (Kannada)",
    "hi": "हिन्दी (Hindi)",
}

DEFAULT_SUGGESTIONS = {
    "kn": [
        "ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಮಳೆಯಾಗುವುದೇ?",
        "ಇಂದು ಗೊಬ್ಬರ ಅಥವಾ ಕೀಟನಾಶಕ ಸಿಂಪಡಿಸಬಹುದೇ?",
        "ಮಣ್ಣಿನ ತೇವಾಂಶವು ನೀರಾವರಿಗೆ ಹೇಗೆ ಸಹಕಾರಿ?",
    ],
    "hi": [
        "क्या अगले 7 दिनों में बारिश होगी?",
        "क्या आज खाद या कीटनाशक डालना सुरक्षित है?",
        "मिट्टी की नमी सिंचाई को कैसे प्रभावित करती है?",
    ],
    "en": [
        "Will it rain in the next 7 days?",
        "Is it safe to apply fertilizer or pesticide today?",
        "How do soil buffer days affect irrigation?",
    ],
}


def _extract_options_from_text(text: str, lang: str) -> Tuple[str, List[str]]:
    """
    Parses optional SUGGESTED_OPTIONS: [...] line from LLM response.
    Returns cleaned response text and list of suggestions.
    """
    options = []
    pattern = r"SUGGESTED_OPTIONS:\s*(\[.*?\])"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        raw_json = match.group(1).strip()
        try:
            parsed = json.loads(raw_json)
            if isinstance(parsed, list):
                options = [str(item).strip() for item in parsed if item and len(str(item).strip()) > 3]
        except Exception:
            pass
        # Clean text
        text = re.sub(pattern, "", text, flags=re.DOTALL).strip()

    if not options or len(options) < 2:
        options = DEFAULT_SUGGESTIONS.get(lang, DEFAULT_SUGGESTIONS["en"])

    return text.strip(), options[:4]


def _build_context_summary(req: ChatRequest) -> str:
    """Builds structured agronomic context string for prompt injection."""
    loc = req.location or {}
    taluk = loc.get("taluk") or loc.get("title") or "Selected Taluk"
    district = loc.get("district") or "Karnataka"
    crop = req.crop_type or "General Agriculture"
    stage = req.crop_stage or "Active Growth"

    fc = req.forecast or {}
    horizons = fc.get("horizons") or {}
    w1 = horizons.get("w1") or {}
    w2 = horizons.get("w2") or {}
    soil = fc.get("soil") or {}
    onset = fc.get("onset") or {}

    w1_active_prob = w1.get("active_monsoon", {}).get("probability")
    w1_heavy_prob = w1.get("heavy_rain", {}).get("probability")
    w1_break_prob = w1.get("break_spell", {}).get("probability")

    w1_active_str = f"{w1_active_prob * 100:.1f}%" if w1_active_prob is not None else "N/A"
    w1_heavy_str = f"{w1_heavy_prob * 100:.1f}%" if w1_heavy_prob is not None else "N/A"
    w1_break_str = f"{w1_break_prob * 100:.1f}%" if w1_break_prob is not None else "N/A"

    soil_type = soil.get("type", "Medium Red Loam")
    awc = soil.get("awc", 100)
    buffer_days = soil.get("buffer_days", 5)
    drainage = soil.get("drainage", "Moderate")

    onset_tag = onset.get("status_tag", "Monitoring")
    onset_prob = onset.get("probability")
    onset_prob_str = f"{onset_prob * 100:.1f}%" if onset_prob is not None else "N/A"

    summary = (
        f"- Target Location: {taluk} Taluk, {district} District, Karnataka\n"
        f"- Target Crop & Stage: {crop} ({stage})\n"
        f"- Week 1 Forecast: Active Monsoon (>=30mm): {w1_active_str}, Heavy Downpour (>=64.5mm): {w1_heavy_str}, Dry Break Spell (<5mm): {w1_break_str}\n"
        f"- Soil Profile: {soil_type}, AWC: {awc} mm/m, Moisture Retention Buffer: {buffer_days} days, Drainage: {drainage}\n"
        f"- Onset Outlook: {onset_tag} (14-Day Arrival Probability: {onset_prob_str})\n"
        f"- Baseline Advisory: {fc.get('advisory_text', 'Proceed with standard weather-adaptive agronomic practices.')}"
    )
    return summary


def _build_system_prompt(lang: str, context_summary: str) -> str:
    lang_name = LANGUAGE_LABELS.get(lang, "English")

    instructions = {
        "kn": (
            "You MUST respond ONLY in natural, fluent, grammatically correct Kannada (ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಬರೆಯಿರಿ). "
            "Use respectful, farmer-friendly terms (ನಮಸ್ಕಾರ, ರೈತ ಮಿತ್ರರೇ). Use authentic Kannada agricultural terminology "
            "(e.g., ಬಿತ್ತನೆ, ಮಣ್ಣಿನ ತೇವಾಂಶ, ಮಲ್ಚಿಂಗ್, ರಾಗಿ, ಮುಸುಕಿನ ಜೋಳ, ನೀರಾವರಿ, ಕೀಟನಾಶಕ ಸಿಂಪರಣೆ, ಬೆಳೆ ಸಂರಕ್ಷಣೆ). "
            "Do NOT write in English or Hindi."
        ),
        "hi": (
            "You MUST respond ONLY in clear, respectful, practical Hindi (हिन्दी लिपि में लिखें). "
            "Use farmer-friendly language (किसान भाइयों, बुवाई, नमी, सिंचाई, खाद, कीटनाशक छिड़काव). "
            "Do NOT write in English or Kannada."
        ),
        "en": (
            "Respond in clear, professional, concise English. Format with clean bullet points and bold highlights."
        ),
    }

    selected_instr = instructions.get(lang, instructions["en"])

    prompt = (
        f"You are the Varsha Setu AI Agronomic Advisor (ವರ್ಷ ಸೇತು ಕೃಷಿ AI ಸಹಾಯಕ), developed for Karnataka farmers, "
        f"panchayats, and agricultural extension officers under Smart India Hackathon.\n\n"
        f"CURRENT LOCAL TALUK TELEMETRY & ML MODEL PREDICTIONS:\n"
        f"{context_summary}\n\n"
        f"LANGUAGE DIRECTIVE: The user's preferred language is {lang_name} (code: '{lang}').\n"
        f"{selected_instr}\n\n"
        f"STRICT RULES:\n"
        f"1. Base your answer strictly on the telemetry and forecast numbers provided above. Never hallucinate conflicting weather.\n"
        f"2. Keep answers concise, actionable, and encouraging for a farmer in the field.\n"
        f"3. Provide practical guidance for sowing, fertilizer, irrigation, or protection based on the crop and soil moisture buffer.\n"
        f"4. AT THE VERY END OF YOUR RESPONSE, output exactly one line containing a JSON list of 3 short, relevant follow-up questions "
        f"that the farmer might want to ask next, WRITTEN IN {lang_name}:\n"
        f"SUGGESTED_OPTIONS: [\"question 1 in {lang}\", \"question 2 in {lang}\", \"question 3 in {lang}\"]"
    )
    return prompt


def _deterministic_fallback(req: ChatRequest, lang: str) -> Tuple[str, List[str]]:
    """Grounded multilingual fallback when LLM API is unavailable or unconfigured."""
    loc = req.location or {}
    taluk = loc.get("taluk") or "ನಿಮ್ಮ ತಾಲೂಕು" if lang == "kn" else ("आपके तालुके" if lang == "hi" else "your taluk")
    district = loc.get("district") or "ಕರ್ನಾಟಕ" if lang == "kn" else ("कर्नाटक" if lang == "hi" else "Karnataka")
    crop = req.crop_type or "ಬೆಳೆ" if lang == "kn" else ("फसल" if lang == "hi" else "crop")
    stage = req.crop_stage or "ಪ್ರಸ್ತುತ ಹಂತ" if lang == "kn" else ("वर्तमान चरण" if lang == "hi" else "growth stage")

    fc = req.forecast or {}
    horizons = fc.get("horizons") or {}
    w1 = horizons.get("w1") or {}
    soil = fc.get("soil") or {}

    w1_active = w1.get("active_monsoon", {}).get("probability", 0.5)
    w1_heavy = w1.get("heavy_rain", {}).get("probability", 0.1)
    w1_break = w1.get("break_spell", {}).get("probability", 0.2)
    buffer_days = soil.get("buffer_days", 5)
    soil_type = soil.get("type", "Medium Red Loam")

    if lang == "kn":
        response = (
            f"**ವರ್ಷ ಸೇತು ಕೃಷಿ ಸಲಹೆ ({taluk}, {district}):**\n\n"
            f"• **ಆಯ್ಕೆ ಮಾಡಿದ ಬೆಳೆ:** {crop} ({stage})\n"
            f"• **ಮಳೆ ಮುನ್ಸೂಚನೆ (ವಾರ 1):** ಸಕ್ರಿಯ ಮಳೆ ಸಂಭವನೀಯತೆ {w1_active * 100:.1f}%, ಭಾರಿ ಮಳೆ {w1_heavy * 100:.1f}%, ಒಣ ಹವೆಯ ಕೊರತೆ (Break Spell) {w1_break * 100:.1f}%\n"
            f"• **ಮಣ್ಣಿನ ತೇವಾಂಶ ಧಾರಣ:** {soil_type} - ಸುಮಾರು {buffer_days} ದಿನಗಳ ತೇವಾಂಶ ಬಫರ್ ಲಭ್ಯವಿದೆ.\n\n"
            f"**ಕೃಷಿ ಶಿಫಾರಸು:** "
            + (
                "ಮಳೆ ಕೊರತೆ ಇರುವುದರಿಂದ ಬಿತ್ತನೆ ಮುನ್ನ ಹೊದಿಕೆ (ಮಲ್ಚಿಂಗ್) ಬಳಸಿ ತೇವಾಂಶ ಉಳಿಸಿಕೊಳ್ಳಿ."
                if w1_break > 0.4
                else "ಹವಾಮಾನವು ಕೃಷಿ ಚಟುವಟಿಕೆಗಳಿಗೆ ಅನುಕೂಲಕರವಾಗಿದೆ. ಬೆಳಗಿನ ವೇಳೆಯಲ್ಲಿ ಗೊಬ್ಬರ ಅಥವಾ ಪೋಷಕಾಂಶಗಳನ್ನು ನೀಡಬಹುದು."
            )
        )
    elif lang == "hi":
        response = (
            f"**वर्षा सेतु कृषि परामर्श ({taluk}, {district}):**\n\n"
            f"• **चयनित फसल:** {crop} ({stage})\n"
            f"• **सप्ताह 1 वर्षा पूर्वानुमान:** सक्रिय वर्षा संभावना {w1_active * 100:.1f}%, भारी वर्षा {w1_heavy * 100:.1f}%, शुष्क दौर (Break Spell) {w1_break * 100:.1f}%\n"
            f"• **मिट्टी की नमी:** {soil_type} - लगभग {buffer_days} दिनों का नमी बफर उपलब्ध है।\n\n"
            f"**कृषि सिफारिश:** "
            + (
                "शुष्क दौर की संभावना को देखते हुए बुवाई में सावधानी बरतें और नमी संरक्षण के लिए मल्चिंग करें।"
                if w1_break > 0.4
                else "मौसम कृषि कार्यों के लिए उपयुक्त है। निर्धारित मात्रा में खाद का प्रयोग सुबह के समय करें।"
            )
        )
    else:
        response = (
            f"**Varsha Setu Agronomic Intelligence ({taluk}, {district}):**\n\n"
            f"• **Selected Crop:** {crop} ({stage})\n"
            f"• **Week 1 Rainfall Probability:** Active Rain: {w1_active * 100:.1f}%, Heavy Downpour: {w1_heavy * 100:.1f}%, Break Spell: {w1_break * 100:.1f}%\n"
            f"• **Soil Hydrology Profile:** {soil_type} with a {buffer_days}-day moisture retention buffer.\n\n"
            f"**Recommendation:** "
            + (
                "Elevated break spell detected. Prepare conservation furrowing or protective mulch to preserve moisture."
                if w1_break > 0.4
                else "Normal monsoon conditions expected across Week 1. Standard agronomic operations and fertilizer application may proceed."
            )
        )

    options = DEFAULT_SUGGESTIONS.get(lang, DEFAULT_SUGGESTIONS["en"])
    return response, options


async def generate_chat_response(req: ChatRequest) -> ChatResponse:
    """
    Generates context-grounded agronomic assistant response in the user's selected language
    using Google Gemini API, with deterministic fallback.
    """
    lang = normalize_language_code(req.language)
    context_summary = _build_context_summary(req)

    # If GEMINI_API_KEY is not configured, use deterministic multilingual fallback
    if not GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not configured. Using deterministic multilingual fallback.")
        resp_text, options = _deterministic_fallback(req, lang)
        return ChatResponse(
            response=resp_text,
            suggested_options=options,
            language=lang,
            model_used="varsha-setu-grounded-deterministic",
            grounded=True,
        )

    system_prompt = _build_system_prompt(lang, context_summary)

    # Format user message & history for Gemini
    contents = []
    contents.append({"role": "user", "parts": [{"text": system_prompt}]})
    contents.append({"role": "model", "parts": [{"text": f"Understood. I will act strictly as Varsha Setu AI Agronomic Advisor, strictly grounded in this telemetry, and respond in {LANGUAGE_LABELS.get(lang, 'English')}."}]})

    if req.history:
        for turn in req.history[-6:]:
            role = "user" if turn.sender == "user" else "model"
            contents.append({"role": role, "parts": [{"text": turn.text}]})

    contents.append({"role": "user", "parts": [{"text": req.message}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800,
        },
    }

    # Attempt primary model first, fallback model on failure
    for model_name in [PRIMARY_MODEL, FALLBACK_MODEL]:
        url = GEMINI_API_ENDPOINT.format(model=model_name)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{url}?key={GEMINI_API_KEY}", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        clean_text, options = _extract_options_from_text(raw_text, lang)
                        return ChatResponse(
                            response=clean_text,
                            suggested_options=options,
                            language=lang,
                            model_used=model_name,
                            grounded=True,
                        )
                else:
                    logger.warning(
                        "Gemini model %s returned status %d: %s",
                        model_name,
                        res.status_code,
                        res.text[:200],
                    )
        except Exception as e:
            logger.warning("Error querying Gemini model %s: %s", model_name, e)

    # Fallback to deterministic engine if all external calls fail
    logger.info("Falling back to grounded deterministic engine due to Gemini API failure.")
    resp_text, options = _deterministic_fallback(req, lang)
    return ChatResponse(
        response=resp_text,
        suggested_options=options,
        language=lang,
        model_used="varsha-setu-grounded-deterministic",
        grounded=True,
    )
