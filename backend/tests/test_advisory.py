import sys
from pathlib import Path
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from app.services.soil_advisory import ADVISORY_TEMPLATES, normalize_language_code

client = TestClient(app)

def test_advisory_templates_structure():
    """Assert that every advisory type has parallel en, kn, and hi templates."""
    for adv_type, lang_dict in ADVISORY_TEMPLATES.items():
        assert "en" in lang_dict, f"Missing 'en' in {adv_type}"
        assert "kn" in lang_dict, f"Missing 'kn' in {adv_type}"
        assert "hi" in lang_dict, f"Missing 'hi' in {adv_type}"

def test_language_normalization():
    """Assert language code normalization handles all code and text variants."""
    assert normalize_language_code("hi") == "hi"
    assert normalize_language_code("Hindi") == "hi"
    assert normalize_language_code("हिन्दी (Hindi)") == "hi"
    assert normalize_language_code("kn") == "kn"
    assert normalize_language_code("Kannada") == "kn"
    assert normalize_language_code("ಕನ್ನಡ (Kannada)") == "kn"
    assert normalize_language_code("en") == "en"
    assert normalize_language_code("English") == "en"

def test_hindi_break_spell_advisory_paths():
    """Assert Hindi advisory text for both low-retention and higher-retention soils."""
    # Low retention soil (Tumakuru, Alfisol, AWC <= 90)
    req_low = {
        "district": "Tumakuru",
        "crop_type": "Groundnut",
        "crop_stage": "Sowing & Germination",
        "language": "hi",
        "t1_break_triggered": True,
        "t1_break_prob": 0.68,
        "t1_heavy_triggered": False,
        "t1_heavy_prob": 0.05,
        "t1_active_prob": 0.10
    }
    resp_low = client.post("/advisory", json=req_low)
    assert resp_low.status_code == 200
    txt_low = resp_low.json()["advisory_text"]
    assert "गंभीर नमी तनाव चेतावनी" in txt_low
    assert "मल्चिंग" in txt_low
    assert "68.0%" in txt_low

    # Higher retention soil (Bagalkote, Vertisol, AWC > 90)
    req_high = dict(req_low, district="Bagalkote")
    resp_high = client.post("/advisory", json=req_high)
    assert resp_high.status_code == 200
    txt_high = resp_high.json()["advisory_text"]
    assert "मध्यम शुष्क मौसम निगरानी" in txt_high
    assert "नाइट्रोजन/यूरिया" in txt_high

def test_hindi_heavy_rain_advisory_paths():
    """Assert Hindi advisory text for swelling black soils and other soils."""
    # Black soil (Vijayapura, Vertisol)
    req_black = {
        "district": "Vijayapura",
        "crop_type": "Paddy",
        "crop_stage": "Vegetative Growth",
        "language": "hi",
        "t1_break_triggered": False,
        "t1_break_prob": 0.05,
        "t1_heavy_triggered": True,
        "t1_heavy_prob": 0.55,
        "t1_active_prob": 0.20
    }
    resp_black = client.post("/advisory", json=req_black)
    assert resp_black.status_code == 200
    txt_black = resp_black.json()["advisory_text"]
    assert "जलभराव का गंभीर जोखिम" in txt_black
    assert "जड़ सड़न" in txt_black
    assert "55.0%" in txt_black

    # Non-black soil (Kolar, Red Sandy Loam)
    req_other = dict(req_black, district="Kolar")
    resp_other = client.post("/advisory", json=req_other)
    assert resp_other.status_code == 200
    txt_other = resp_other.json()["advisory_text"]
    assert "भारी बारिश की चेतावनी" in txt_other
    assert "जल निकासी नालियों" in txt_other

def test_hindi_favorable_active_path():
    """Assert Hindi advisory text for normal/favorable monsoon conditions."""
    req_fav = {
        "district": "Shivamogga",
        "crop_type": "Sugarcane",
        "crop_stage": "Vegetative Growth",
        "language": "hi",
        "t1_break_triggered": False,
        "t1_break_prob": 0.05,
        "t1_heavy_triggered": False,
        "t1_heavy_prob": 0.10,
        "t1_active_prob": 0.75
    }
    resp_fav = client.post("/advisory", json=req_fav)
    assert resp_fav.status_code == 200
    txt_fav = resp_fav.json()["advisory_text"]
    assert "अनुकूल सक्रिय मानसून परिस्थितियां" in txt_fav
    assert "75.0%" in txt_fav

def test_hindi_voice_synthesis_stream():
    """Assert POST /advisory/audio returns valid MP3 bytes for Hindi."""
    voice_req = {
        "text": "गंभीर नमी तनाव चेतावनी: मिट्टी में ब्रेक स्पेल का अलर्ट है। बुवाई स्थगित करें।",
        "language": "hi"
    }
    resp = client.post("/advisory/audio", json=voice_req)
    assert resp.status_code == 200
    assert "audio/mpeg" in resp.headers["content-type"]
    assert len(resp.content) > 1000
