import pytest
from fastapi.testclient import TestClient
from main import app
from app.services.artifact_loader import load_artifacts_once
from app.config import ARTIFACTS_DIR

client = TestClient(app)
load_artifacts_once(ARTIFACTS_DIR)


def test_chat_english():
    """Verify POST /chat responds in English with suggested options."""
    payload = {
        "message": "Will it rain in the next 7 days in Mandya?",
        "language": "en",
        "location": {"taluk": "Mandya", "district": "Mandya"},
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Vegetative Growth",
        "forecast": {
            "horizons": {
                "w1": {
                    "active_monsoon": {"probability": 0.65},
                    "heavy_rain": {"probability": 0.15},
                    "break_spell": {"probability": 0.20},
                }
            },
            "soil": {"type": "Red Sandy Loam", "awc": 85, "buffer_days": 4},
        },
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert len(data["response"]) > 20
    assert data["language"] == "en"
    assert "suggested_options" in data
    assert len(data["suggested_options"]) >= 2


def test_chat_kannada():
    """Verify POST /chat responds in Kannada when language is 'kn'."""
    payload = {
        "message": "ಮಂಡ್ಯದಲ್ಲಿ ಈ ವಾರ ಮಳೆ ಬರುತ್ತದೆಯೇ?",
        "language": "kn",
        "location": {"taluk": "Mandya", "district": "Mandya"},
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Vegetative Growth",
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "kn"
    assert len(data["suggested_options"]) >= 2


def test_chat_hindi():
    """Verify POST /chat responds in Hindi when language is 'hi'."""
    payload = {
        "message": "क्या मंड्या में इस सप्ताह बारिश होगी?",
        "language": "hi",
        "location": {"taluk": "Mandya", "district": "Mandya"},
        "crop_type": "Finger Millet (Ragi)",
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "hi"
    assert len(data["suggested_options"]) >= 2
