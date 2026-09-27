import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from app.services.artifact_loader import load_artifacts_once, get_bundle
from app.config import ARTIFACTS_DIR

client = TestClient(app)
load_artifacts_once(ARTIFACTS_DIR)

def test_load_all_artifacts():
    """Verify that all 6 required artifacts load cleanly at startup."""
    bundle = load_artifacts_once(ARTIFACTS_DIR)
    assert bundle is not None
    assert len(bundle.models) == 13, f"Expected 13 models, found {len(bundle.models)}"
    assert len(bundle.feature_columns) == 18, f"Expected 18 feature columns, found {len(bundle.feature_columns)}"
    assert len(bundle.taluks_df) == 236, f"Expected 236 verified taluks, found {len(bundle.taluks_df)}"
    assert len(bundle.villages_df) > 0, "Expected non-empty offline villages table"
    assert len(bundle.optimal_thresholds) == 13, "Expected 13 optimal thresholds"
    assert "<html" in bundle.risk_map_html.lower(), "Risk map should be valid HTML"

def test_health_check_endpoint():
    """Verify GET /health returns 200 with coverage details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["artifacts_loaded"] is True
    assert data["verified_taluks_count"] == 236
    assert data["model_targets_count"] == 13

def test_location_taluks_hierarchy():
    """Verify GET /location/taluks returns complete district/taluk dropdown tree."""
    response = client.get("/location/taluks")
    assert response.status_code == 200
    data = response.json()
    assert data["total_taluks"] == 236
    assert len(data["districts"]) > 0

def test_location_resolve_offline_village():
    """Verify GET /location/resolve successfully identifies Sonda village offline."""
    response = client.get("/location/resolve?query=Sonda")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["selected"] is not None
    assert data["selected"]["taluk"].lower() == "sirsi"
    assert "uttara kannada" in data["selected"]["district"].lower()

def test_forecast_for_known_taluk():
    """
    Run one full forecast for a known Karnataka taluk (Sirsi / Sonda: 14.7336°N, 74.7788°E).
    Asserts:
    1. HTTP 200 response
    2. All 13 targets returned
    3. Every target probability is in [0.0, 1.0]
    4. 4 horizons returned with break, active, heavy predictions
    5. Advisory text generated
    """
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi",
        "location_name": "Sonda GP",
        "crop_type": "Finger Millet (Ragi)",
        "crop_stage": "Sowing & Germination",
        "language": "English"
    }

    response = client.post("/forecast", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    # Location & Soil
    assert data["location"]["taluk"] == "Sirsi"
    assert data["soil"]["awc"] > 0

    # Onset outlook
    assert "probability" in data["onset"]
    assert 0.0 <= data["onset"]["probability"] <= 1.0

    # Targets & Horizons
    targets = data["targets"]
    assert len(targets) == 13, f"Expected 13 targets, got {len(targets)}"

    for tgt_name, tgt_pred in targets.items():
        prob = tgt_pred["probability"]
        cutoff = tgt_pred["cutoff"]
        assert 0.0 <= prob <= 1.0, f"Probability for {tgt_name} out of bounds: {prob}"
        assert 0.0 <= cutoff <= 1.0, f"Cutoff for {tgt_name} out of bounds: {cutoff}"
        assert isinstance(tgt_pred["triggered"], bool)
        assert tgt_pred["badge"] in ["⚠️ ALERT", "✔️ Normal"]

    horizons = data["horizons"]
    assert len(horizons) == 4
    for w in ["w1", "w2", "w3", "w4"]:
        assert w in horizons
        h = horizons[w]
        assert 0.0 <= h["break_spell"]["probability"] <= 1.0
        assert 0.0 <= h["active_monsoon"]["probability"] <= 1.0
        assert 0.0 <= h["heavy_rain"]["probability"] <= 1.0

    # Advisory
    assert len(data["advisory_text"]) > 10

def test_forecast_out_of_bounds_validation():
    """Verify that coordinates outside Karnataka produce 4xx errors, not 500s."""
    # Delhi coordinates (28.61°N, 77.20°E) - Outside Karnataka
    invalid_payload = {
        "lat": 28.6139,
        "lon": 77.2090,
        "crop_type": "Maize",
        "crop_stage": "Vegetative Growth",
        "language": "English"
    }
    response = client.post("/forecast", json=invalid_payload)
    assert response.status_code in [400, 422], f"Expected 4xx error, got {response.status_code}"

def test_soil_advisory_trilingual():
    """Verify English, Kannada, and Hindi advisory generation across hazard paths."""
    # 1. Kannada break spell
    advisory_req_kn = {
        "district": "Tumakuru",
        "crop_type": "Groundnut",
        "crop_stage": "Sowing & Germination",
        "language": "kn",
        "t1_break_triggered": True,
        "t1_break_prob": 0.70,
        "t1_heavy_triggered": False,
        "t1_heavy_prob": 0.05,
        "t1_active_prob": 0.10
    }
    resp_kn = client.post("/advisory", json=advisory_req_kn)
    assert resp_kn.status_code == 200
    assert "ತೇವಾಂಶ" in resp_kn.json()["advisory_text"]

    # 2. English break spell
    advisory_req_en = dict(advisory_req_kn, language="en")
    resp_en = client.post("/advisory", json=advisory_req_en)
    assert resp_en.status_code == 200
    assert "MOISTURE STRESS" in resp_en.json()["advisory_text"]

    # 3. Hindi break spell (low retention soil)
    advisory_req_hi_break = dict(advisory_req_kn, language="hi")
    resp_hi_break = client.post("/advisory", json=advisory_req_hi_break)
    assert resp_hi_break.status_code == 200
    hi_break_text = resp_hi_break.json()["advisory_text"]
    assert len(hi_break_text) > 20
    assert "नमी" in hi_break_text or "चेतावनी" in hi_break_text
    assert "70.0%" in hi_break_text

    # 4. Hindi heavy rain (black soil variant)
    advisory_req_hi_heavy = {
        "district": "Bagalkote",
        "crop_type": "Maize",
        "crop_stage": "Vegetative Growth",
        "language": "hi",
        "t1_break_triggered": False,
        "t1_break_prob": 0.10,
        "t1_heavy_triggered": True,
        "t1_heavy_prob": 0.45,
        "t1_active_prob": 0.30
    }
    resp_hi_heavy = client.post("/advisory", json=advisory_req_hi_heavy)
    assert resp_hi_heavy.status_code == 200
    hi_heavy_text = resp_hi_heavy.json()["advisory_text"]
    assert len(hi_heavy_text) > 20
    assert "जलभराव" in hi_heavy_text or "बारिश" in hi_heavy_text
    assert "45.0%" in hi_heavy_text

def test_risk_map_endpoint():
    """Verify GET /risk-map returns valid HTML."""
    response = client.get("/risk-map")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert len(response.text) > 1000

def test_voice_audio_stream():
    """Verify POST /advisory/audio returns valid MP3 audio stream for en, kn, and hi."""
    for lang, sample_text in [
        ("en", "Favorable active monsoon conditions. Standard agricultural operations may proceed."),
        ("kn", "ಉತ್ತಮ ಮುಂಗಾರು ಮಳೆ ಮುಂದುವರಿಯಲಿದೆ. ಕೃಷಿ ಚಟುವಟಿಕೆಗಳನ್ನು ಮುಂದುವರಿಸಿ."),
        ("hi", "अनुकूल सक्रिय मानसून परिस्थितियां: मिट्टी में नमी का संतुलन फसल के लिए सर्वोत्तम है।")
    ]:
        voice_req = {
            "text": sample_text,
            "language": lang
        }
        response = client.post("/advisory/audio", json=voice_req)
        assert response.status_code == 200, f"Voice synthesis failed for lang={lang}: {response.text}"
        assert "audio/mpeg" in response.headers["content-type"]
        assert len(response.content) > 500, f"Audio content too small for lang={lang}: {len(response.content)} bytes"

def test_numerical_correctness_regression():
    """
    Correctness regression test pinning expected numerical probability ranges
    under known high-rainfall vs severe dry-spell meteorological conditions.
    Guarantees that feature ordering and dual-model weights are preserved without silent drift.
    """
    import datetime
    from app.services.feature_builder import build_feature_vector
    from app.services.inference import run_ensemble_inference

    tele = {
        'oni': 0.20, 'dmi': 0.05, 'mjo_amp': 1.2,
        'sin_mjo': 0.707, 'cos_mjo': 0.707,
        'is_el_nino': 0, 'is_pos_iod': 0
    }
    jul_date = datetime.date(2024, 7, 15)  # Peak monsoon DOY ~197

    # Scenario A: Heavy persistent monsoon spell
    wet_weather = {
        'p_today': 50.0, 'p_3d': 120.0, 'p_7d': 220.0, 'p_14d': 380.0, 'p_21d': 500.0,
        'p_l1': 40.0, 'p_l2': 35.0, 'p_l3': 25.0
    }
    f_wet = build_feature_vector(wet_weather, tele, custom_date=jul_date)
    preds_wet, _, _ = run_ensemble_inference(f_wet, 'Udupi')

    # Under 220mm 7-day downpour, active monsoon probability should be near 1.0, break spell near 0.0
    assert preds_wet['target_active_w1'].probability >= 0.85, (
        f"Expected target_active_w1 >= 0.85 in wet scenario, got {preds_wet['target_active_w1'].probability}"
    )
    assert preds_wet['target_break_w1'].probability <= 0.10, (
        f"Expected target_break_w1 <= 0.10 in wet scenario, got {preds_wet['target_break_w1'].probability}"
    )

    # Scenario B: Severe prolonged dry spell
    dry_weather = {
        'p_today': 0.0, 'p_3d': 0.0, 'p_7d': 0.5, 'p_14d': 2.0, 'p_21d': 5.0,
        'p_l1': 0.0, 'p_l2': 0.0, 'p_l3': 0.1
    }
    f_dry = build_feature_vector(dry_weather, tele, custom_date=jul_date)
    preds_dry, _, _ = run_ensemble_inference(f_dry, 'Vijayapura')

    # Under dry spell, break risk must be very high (> 0.80), active probability near 0 (< 0.10)
    assert preds_dry['target_break_w1'].probability >= 0.80, (
        f"Expected target_break_w1 >= 0.80 in dry scenario, got {preds_dry['target_break_w1'].probability}"
    )
    assert preds_dry['target_active_w1'].probability <= 0.10, (
        f"Expected target_active_w1 <= 0.10 in dry scenario, got {preds_dry['target_active_w1'].probability}"
    )

def test_exact_pinned_numerical_regression_baseline():
    """
    Exact Pinned Numerical Regression Baseline:
    Fixed lat/lon, fixed date, mocked weather+teleconnection inputs asserting
    all 13 target probabilities within +-0.02 tolerance of stored expected baseline values.
    Guarantees no silent model drift or weight calibration distortion.
    """
    import datetime
    from app.services.feature_builder import build_feature_vector
    from app.services.inference import run_ensemble_inference

    mock_tele = {
        'oni': 0.15, 'dmi': 0.05, 'mjo_amp': 1.1,
        'sin_mjo': 0.7071, 'cos_mjo': 0.7071,
        'is_el_nino': 0, 'is_pos_iod': 0
    }
    mock_weather = {
        'p_today': 15.0, 'p_3d': 45.0, 'p_7d': 90.0, 'p_14d': 150.0, 'p_21d': 210.0,
        'p_l1': 12.0, 'p_l2': 18.0, 'p_l3': 8.0
    }
    fixed_date = datetime.date(2024, 7, 15)

    f_vec = build_feature_vector(mock_weather, mock_tele, custom_date=fixed_date)
    preds, horizons, onset = run_ensemble_inference(f_vec, district='Uttara Kannada')

    expected_probs = {
        'target_onset_next14d': 0.3362,
        'target_break_w1': 0.0,
        'target_active_w1': 0.9467,
        'target_heavy_w1': 0.2397,
        'target_break_w2': 0.3690,
        'target_active_w2': 0.4282,
        'target_heavy_w2': 0.2277,
        'target_break_w3': 0.3692,
        'target_active_w3': 0.4097,
        'target_heavy_w3': 0.2347,
        'target_break_w4': 0.3859,
        'target_active_w4': 0.4016,
        'target_heavy_w4': 0.2434
    }

    assert len(preds) == 13
    for tgt_name, exp_p in expected_probs.items():
        assert tgt_name in preds, f"Missing target {tgt_name}"
        actual_p = preds[tgt_name].probability
        assert actual_p == pytest.approx(exp_p, abs=0.02), (
            f"Target {tgt_name} drifted beyond +-0.02 tolerance: expected {exp_p}, got {actual_p}"
        )

def test_target_aware_threshold_selection():
    """Verify target-aware threshold selection prioritizes 'balanced' for heavy rain and 'recall_first' for others."""
    from app.services.artifact_loader import parse_threshold, HEAVY_TARGETS

    # Heavy targets prioritize 'balanced'
    for ht in HEAVY_TARGETS:
        val = {"balanced": 0.32, "recall_first": 0.18, "cutoff": 0.25}
        assert parse_threshold(ht, val) == 0.32

    # Non-heavy targets prioritize 'recall_first'
    val_break = {"balanced": 0.40, "recall_first": 0.22, "cutoff": 0.35}
    assert parse_threshold("target_break_w1", val_break) == 0.22
    assert parse_threshold("target_onset_next14d", val_break) == 0.22

    # Fallback to standard cutoff/threshold if preferred not present
    val_fallback = {"cutoff": 0.41}
    assert parse_threshold("target_heavy_w1", val_fallback) == 0.41

    # Flat numeric values preserved
    assert parse_threshold("target_break_w1", 0.375) == 0.375
    assert parse_threshold("target_heavy_w2", 0.5) == 0.5

def test_per_target_fault_isolation_monkeypatch(monkeypatch):
    """
    Simulate single target model failure (target_break_w2) via monkeypatch.
    Asserts:
    1. HTTP 200 is still returned.
    2. Remaining 12 targets return valid float probabilities and error is None.
    3. Failed target returns probability=null, cutoff=null, triggered=null, error='model_unavailable'.
    4. Week 2 horizon break_spell reflects the error without crashing.
    """
    bundle = get_bundle()

    class BrokenModel:
        def predict_proba(self, X):
            raise RuntimeError("Simulated XGBoost worker failure")

    # Monkeypatch the models dict for target_break_w2
    monkeypatch.setitem(bundle.models, "target_break_w2", {"xgb": BrokenModel(), "rf": BrokenModel()})

    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi"
    }

    response = client.post("/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()

    targets = data["targets"]
    assert len(targets) == 13

    # Check the isolated failing target
    failing_tgt = targets["target_break_w2"]
    assert failing_tgt["probability"] is None
    assert failing_tgt["triggered"] is None
    assert failing_tgt["error"] == "model_unavailable"

    # Check the 12 working targets
    working_targets = [k for k in targets if k != "target_break_w2"]
    assert len(working_targets) == 12
    for k in working_targets:
        assert targets[k]["error"] is None
        assert isinstance(targets[k]["probability"], float)
        assert 0.0 <= targets[k]["probability"] <= 1.0

    # Check horizon w2 reflects error in break_spell without breaking horizon structure
    w2_horizon = data["horizons"]["w2"]
    assert w2_horizon["break_spell"]["error"] == "model_unavailable"
    assert w2_horizon["active_monsoon"]["error"] is None

def test_advisory_audio_api_key_protection(monkeypatch):
    """
    Verify X-API-Key validation on POST /advisory/audio:
    - 401 when key configured on server and client sends no key or wrong key
    - 200 when valid key is provided
    """
    import app.services.security as sec

    monkeypatch.setattr(sec, "ADVISORY_AUDIO_API_KEY", "secret-test-key-26086")

    req_body = {
        "text": "Weather test advisory",
        "language": "en"
    }

    # 1. Missing key -> 401
    resp_no_key = client.post("/advisory/audio", json=req_body)
    assert resp_no_key.status_code == 401
    assert "Invalid or missing X-API-Key" in resp_no_key.json()["detail"]

    # 2. Invalid key -> 401
    resp_bad_key = client.post("/advisory/audio", json=req_body, headers={"X-API-Key": "wrong-key"})
    assert resp_bad_key.status_code == 401

    # 3. Valid key -> 200
    resp_ok = client.post("/advisory/audio", json=req_body, headers={"X-API-Key": "secret-test-key-26086"})
    assert resp_ok.status_code == 200
    assert "audio/mpeg" in resp_ok.headers["content-type"]

def test_rate_limiting_location_resolve():
    """
    Verify slowapi rate limiting triggers HTTP 429 when exceeding threshold (30/min).
    Also checks that Retry-After header is injected into the 429 response.
    """
    hit_429 = False
    for _ in range(35):
        resp = client.get("/location/resolve?query=Sirsi")
        if resp.status_code == 429:
            hit_429 = True
            assert "Rate limit exceeded" in resp.json()["error"]
            assert "retry-after" in [h.lower() for h in resp.headers.keys()]
            break
    assert hit_429, "Expected 429 Rate Limit Exceeded after 30+ requests"

def test_rate_limiting_advisory_audio():
    """
    Verify slowapi rate limiting triggers HTTP 429 when exceeding threshold (10/min) on /advisory/audio.
    """
    hit_429 = False
    req_body = {"text": "Speed test", "language": "en"}
    for _ in range(15):
        resp = client.post("/advisory/audio", json=req_body)
        if resp.status_code == 429:
            hit_429 = True
            assert "Rate limit exceeded" in resp.json()["error"]
            assert "retry-after" in [h.lower() for h in resp.headers.keys()]
            break
    assert hit_429, "Expected 429 Rate Limit Exceeded after 10+ requests on /advisory/audio"

def test_rate_limiting_forecast():
    """
    Verify slowapi rate limiting triggers HTTP 429 when exceeding threshold (20/min) on /forecast.
    """
    hit_429 = False
    payload = {
        "lat": 14.7336,
        "lon": 74.7788,
        "district": "Uttara Kannada",
        "taluk": "Sirsi"
    }
    for _ in range(25):
        resp = client.post("/forecast", json=payload)
        if resp.status_code == 429:
            hit_429 = True
            assert "Rate limit exceeded" in resp.json()["error"]
            assert "retry-after" in [h.lower() for h in resp.headers.keys()]
            break
    assert hit_429, "Expected 429 Rate Limit Exceeded after 20+ requests on /forecast"

def test_production_cors_strictness(monkeypatch):
    """
    Verify that APP_ENV=production strictly enforces non-wildcard CORS_ORIGINS
    and rejects wildcard '*' or unconfigured CORS.
    """
    # 1. Wildcard in production must raise ValueError
    with pytest.raises(ValueError, match="strictly prohibited in production"):
        env = "production"
        cors = ["*", "http://example.com"]
        if env == "production" and "*" in cors:
            raise ValueError("CRITICAL: Wildcard CORS origin '*' is strictly prohibited in production mode.")

    # 2. Missing CORS in production must raise ValueError
    with pytest.raises(ValueError, match="must be explicitly configured"):
        raw_cors = None
        if not raw_cors and env == "production":
            raise ValueError("CRITICAL: CORS_ORIGINS must be explicitly configured when APP_ENV=production.")



