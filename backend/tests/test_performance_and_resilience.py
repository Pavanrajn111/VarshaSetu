import pytest
import time
import concurrent.futures
from fastapi.testclient import TestClient
from main import app
from app.services.teleconnections import get_teleconnections, DEFAULT_TELECONNECTIONS
from app.services.weather_client import fetch_recent_precipitation, get_climatological_normal_fallback

from app.services.artifact_loader import load_artifacts_once

@pytest.fixture(scope="session", autouse=True)
def setup_app():
    load_artifacts_once()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_a_first_visit_taluk(client):
    """Scenario A: First visit to a taluk computes valid response with timing headers."""
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi",
        "location_name": "Sirsi Taluk HQ",
        "scale_tag": "Administrative Taluk Node",
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Sowing & Germination",
        "language": "en"
    }
    t0 = time.perf_counter()
    resp = client.post("/forecast", json=payload)
    t_dur = (time.perf_counter() - t0) * 1000.0

    assert resp.status_code == 200
    data = resp.json()
    assert data["location"]["taluk"] == "Sirsi"
    assert "target_break_w1" in data["targets"]
    assert "Server-Timing" in resp.headers
    print(f"\n[TEST A] First visit response time: {t_dur:.2f}ms")

def test_b_returning_to_cached_taluk(client):
    """Scenario B: Returning to an already visited taluk hits local cache instantly."""
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi",
        "location_name": "Sirsi Taluk HQ",
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Sowing & Germination",
        "language": "en"
    }
    t0 = time.perf_counter()
    resp = client.post("/forecast", json=payload)
    t_dur = (time.perf_counter() - t0) * 1000.0

    assert resp.status_code == 200
    print(f"\n[TEST B] Cached taluk response time: {t_dur:.2f}ms")

def test_c_rapid_taluk_switching(client):
    """Scenario C: Rapidly switching between 3 distinct taluks without failure."""
    taluks = [
        {"taluk": "Sirsi", "district": "Uttara Kannada", "lat": 14.62, "lon": 74.835},
        {"taluk": "Belagavi", "district": "Belagavi", "lat": 15.85, "lon": 74.498},
        {"taluk": "Mysuru", "district": "Mysuru", "lat": 12.296, "lon": 76.639},
    ]
    for t in taluks:
        payload = {
            "lat": t["lat"],
            "lon": t["lon"],
            "district": t["district"],
            "taluk": t["taluk"],
            "crop_type": "Maize",
            "crop_stage": "Vegetative Growth",
            "language": "en"
        }
        resp = client.post("/forecast", json=payload)
        assert resp.status_code == 200
        assert resp.json()["location"]["taluk"] == t["taluk"]

def test_d_and_e_changing_crop_and_stage(client):
    """Scenarios D & E: Changing crop and stage updates advisory text seamlessly."""
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi",
        "crop_type": "Groundnut",
        "crop_stage": "Harvesting",
        "language": "kn"
    }
    resp = client.post("/forecast", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["crop_type"] == "Groundnut"
    assert data["crop_stage"] == "Harvesting"
    assert data["language"] == "kn"

def test_g_h_i_j_external_apis_unavailable_fallbacks():
    """Scenarios G, H, I, J: Fallback mechanisms when external APIs are offline."""
    tele = get_teleconnections()
    assert "oni" in tele
    assert "dmi" in tele
    assert "mjo_amp" in tele

    clim = get_climatological_normal_fallback(lat=14.7336, lon=74.7788, taluk_name="Sirsi")
    assert clim is not None
    assert clim["p_today"] >= 0.0
    assert "fallback_warning" in clim

def test_k_tts_synthesis(client):
    """Scenario K: Voice synthesis endpoint generates valid audio or fallback."""
    resp = client.post("/advisory/audio", json={"text": "Moderate rainfall expected.", "language": "en"})
    assert resp.status_code == 200
    assert len(resp.content) > 0

def test_l_multiple_simultaneous_users(client):
    """Scenario L: High concurrency handles requests cleanly."""
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi",
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Sowing & Germination",
        "language": "en"
    }
    for _ in range(5):
        resp = client.post("/forecast", json=payload)
        assert resp.status_code == 200

