from typing import Dict, Any
from app.config import DISTRICT_SOIL_MAP, DEFAULT_SOIL_PROFILE
from app.models.schemas import SoilProfile

def get_soil_info(district: str) -> Dict[str, Any]:
    """Retrieves regional soil texture, AWC (mm/m), buffer days, and drainage properties."""
    for k, v in DISTRICT_SOIL_MAP.items():
        if k.lower() in district.lower() or district.lower() in k.lower():
            return v
    return DEFAULT_SOIL_PROFILE

def get_soil_profile(district: str) -> SoilProfile:
    """Returns typed SoilProfile model for given district."""
    s = get_soil_info(district)
    return SoilProfile(
        type=str(s["type"]),
        awc=int(s["awc"]),
        buffer_days=int(s["buffer_days"]),
        drainage=str(s["drainage"])
    )

def normalize_language_code(language: str) -> str:
    """
    Normalizes any input language representation (code or native label)
    into standard ISO 639-1 code ('en', 'kn', or 'hi').
    """
    if not language:
        return "en"
    l_str = str(language).strip().lower()
    if "hi" in l_str or "hindi" in l_str or "हिन्दी" in l_str:
        return "hi"
    if "kn" in l_str or "kannada" in l_str or "ಕನ್ನಡ" in l_str:
        return "kn"
    return "en"

# ---------------------------------------------------------------------------
# ADVISORY TEMPLATES DICTIONARY
# Structured as {advisory_type: {"en": ..., "kn": ..., "hi": ...}}
# Adding a 4th language later requires only adding its code to each template dict.
# ---------------------------------------------------------------------------
ADVISORY_TEMPLATES: Dict[str, Dict[str, str]] = {
    "break_low_retention": {
        "en": (
            "CRITICAL MOISTURE STRESS: Break spell alert ({break_pct}%) on {soil_type} "
            "(only {buffer_days} days buffer). Suspend sowing of {crop_type} and apply biomass mulching "
            "immediately to prevent root scorch during {crop_stage}."
        ),
        "kn": (
            "ತೀವ್ರ ತೇವಾಂಶ ಕೊರತೆ ಎಚ್ಚರಿಕೆ: {soil_type} ಮಣ್ಣಿನಲ್ಲಿ ಮಳೆ ಕೊರತೆ ({break_pct}%) ಉಂಟಾಗಲಿದೆ "
            "(ತೇವಾಂಶ ಧಾರಣ ಸಾಮರ್ಥ್ಯ ಕೇವಲ {buffer_days} ದಿನಗಳು). {crop_stage} ಹಂತದಲ್ಲಿ {crop_type} "
            "ಬಿತ್ತನೆಯನ್ನು ತಕ್ಷಣ ಮುಂದೂಡಿ ಮತ್ತು ಹೊದಿಕೆ (ಮಲ್ಚಿಂಗ್) ಮಾಡಿ."
        ),
        "hi": (
            "गंभीर नमी तनाव चेतावनी: {soil_type} मिट्टी में ब्रेक स्पेल (सूखे) का अलर्ट ({break_pct}%) है "
            "(नमी धारण क्षमता केवल {buffer_days} दिन)। {crop_stage} के दौरान {crop_type} की बुवाई तुरंत "
            "स्थगित करें और जड़ों को झुलसने से बचाने के लिए मल्चिंग (पुआल/घास की परत) करें।"
        )
    },
    "break_moderate_retention": {
        "en": (
            "MODERATE DRY SPELL WATCH: Break spell forecast ({break_pct}%), but {soil_type} "
            "retains moisture for ~{buffer_days} days. Standing {crop_type} at {crop_stage} can sustain "
            "without emergency irrigation; delay nitrogen top-dressing until showers resume."
        ),
        "kn": (
            "ಮಧ್ಯಮ ಮಳೆ ಕೊರತೆ: {soil_type} ಮಣ್ಣು ಸುಮಾರು {buffer_days} ದಿನಗಳ ಕಾಲ ತೇವಾಂಶವನ್ನು ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ. "
            "{crop_stage} ಹಂತದಲ್ಲಿರುವ {crop_type} ಬೆಳೆಗೆ ತಕ್ಷಣದ ನೀರಿನ ಕೊರತೆ ಇರುವುದಿಲ್ಲ; ರಾಸಾಯನಿಕ ಗೊಬ್ಬರ ಸಿಂಪರಣೆಯನ್ನು ಮುಂದೂಡಿ."
        ),
        "hi": (
            "मध्यम शुष्क मौसम निगरानी: ब्रेक स्पेल का पूर्वानुमान ({break_pct}%), लेकिन {soil_type} "
            "मिट्टी लगभग {buffer_days} दिनों तक नमी बनाए रखती है। {crop_stage} में खड़ी {crop_type} "
            "की फसल बिना आपातकालीन सिंचाई के संभल सकती है; बारिश दोबारा शुरू होने तक नाइट्रोजन/यूरिया का छिड़काव टालें।"
        )
    },
    "heavy_swelling_soil": {
        "en": (
            "WATERLOGGING HAZARD: Heavy downpour alert ({heavy_pct}%) on swelling {soil_type}. "
            "High risk of soil aeration deficit and root rot in {crop_type} ({crop_stage}). "
            "Open deep perimeter drainage trenches immediately."
        ),
        "kn": (
            "ಜಮೀನಿನಲ್ಲಿ ನೀರು ನಿಲ್ಲುವ ಅಪಾಯ: {soil_type} ಮಣ್ಣಿನಲ್ಲಿ ಭಾರೀ ಮಳೆ ({heavy_pct}%) ಮುನ್ಸೂಚನೆ. "
            "{crop_stage} ಹಂತದ {crop_type} ಬೆಳೆಯ ಬೇರು ಕೊಳೆಯದಂತೆ ತಕ್ಷಣ ಆಳವಾದ ಬಸಿಗಾಲುವೆಗಳನ್ನು ತೆರೆಯಿರಿ."
        ),
        "hi": (
            "जलभराव का गंभीर जोखिम: फूलने वाली {soil_type} मिट्टी में भारी बारिश का अलर्ट ({heavy_pct}%)। "
            "{crop_stage} में {crop_type} की फसल में हवा की कमी और जड़ सड़न का भारी खतरा है। "
            "तुरंत खेत के चारों ओर गहरी जल निकासी नालियां खोलें।"
        )
    },
    "heavy_standard_soil": {
        "en": (
            "Heavy rain alert ({heavy_pct}%) on {soil_type}. Clean field drainage furrows for {crop_type} ({crop_stage})."
        ),
        "kn": (
            "ಭಾರೀ ಮಳೆಯಾಗುವ ಮುನ್ಸೂಚನೆ ({heavy_pct}%). {crop_stage} ಹಂತದ {crop_type} ಜಮೀನಿನ ಹೊರಭಾಗದಲ್ಲಿ "
            "ಹೆಚ್ಚುವರಿ ನೀರು ಹರಿದುಹೋಗಲು ಕಾಲುವೆ ಸರಿಪಡಿಸಿ."
        ),
        "hi": (
            "भारी बारिश की चेतावनी: {soil_type} मिट्टी पर भारी बारिश का अलर्ट ({heavy_pct}%)। "
            "{crop_stage} में {crop_type} फसल के लिए खेत की जल निकासी नालियों को साफ करें।"
        )
    },
    "favorable_active": {
        "en": (
            "Favorable active monsoon conditions ({active_pct}%). "
            "Soil moisture balance in {soil_type} optimal for standard intercultural operations in {crop_type} ({crop_stage})."
        ),
        "kn": (
            "ಉತ್ತಮ ಮುಂಗಾರು ಮಳೆ ಮುಂದುವರಿಯಲಿದೆ ({active_pct}%). "
            "{soil_type} ಮಣ್ಣಿನಲ್ಲಿ ತೇವಾಂಶ ಸೂಕ್ತವಾಗಿದ್ದು, {crop_stage} ಹಂತದ {crop_type} ಬೆಳೆಯ ಕೃಷಿ ಚಟುವಟಿಕೆಗಳನ್ನು ಮುಂದುವರಿಸಿ."
        ),
        "hi": (
            "अनुकूल सक्रिय मानसून परिस्थितियां ({active_pct}%): {soil_type} मिट्टी में नमी का संतुलन "
            "{crop_stage} पर {crop_type} की सामान्य कृषि गतिविधियों और निराई-गुड़ाई के लिए सर्वोत्तम है।"
        )
    }
}

def generate_advisory_text(
    district: str,
    crop_type: str,
    crop_stage: str,
    language: str,
    t1_break_triggered: bool,
    w1_break_prob: float,
    t1_heavy_triggered: bool,
    w1_heavy_prob: float,
    w1_active_prob: float
) -> str:
    """
    Generates rule-based agronomic advisory text combining regional soil water retention,
    crop growth stage, and Week 1 meteorological hazard triggers in English, Kannada, or Hindi.
    """
    soil_data = get_soil_info(district)
    is_low_retention = soil_data['awc'] <= 90
    lang_code = normalize_language_code(language)

    # Determine hazard advisory type
    if t1_break_triggered:
        advisory_type = "break_low_retention" if is_low_retention else "break_moderate_retention"
    elif t1_heavy_triggered:
        advisory_type = "heavy_swelling_soil" if "Black" in soil_data["type"] else "heavy_standard_soil"
    else:
        advisory_type = "favorable_active"

    # Select language template (defaulting to English if missing)
    type_templates = ADVISORY_TEMPLATES[advisory_type]
    template = type_templates.get(lang_code, type_templates["en"])

    # Interpolate variables
    return template.format(
        soil_type=soil_data["type"],
        buffer_days=soil_data["buffer_days"],
        crop_type=crop_type,
        crop_stage=crop_stage,
        break_pct=f"{w1_break_prob * 100:.1f}",
        heavy_pct=f"{w1_heavy_prob * 100:.1f}",
        active_pct=f"{w1_active_prob * 100:.1f}"
    )
