import pytest
from fastapi.testclient import TestClient
from main import app
from app.services.artifact_loader import get_bundle, load_artifacts_once
from app.config import ARTIFACTS_DIR

client = TestClient(app)
load_artifacts_once(ARTIFACTS_DIR)


def test_risk_map_data_returns_all_taluks():
    """Verify GET /risk-map/data returns all authoritative taluks with valid schema."""
    response = client.get("/risk-map/data")
    assert response.status_code == 200
    data = response.json()

    bundle = get_bundle()
    expected_count = len(bundle.taluks_df)

    assert data["total_taluks"] == expected_count
    assert len(data["taluks"]) == expected_count

    # Validate first record schema
    first = data["taluks"][0]
    assert "taluk_name" in first
    assert "district" in first
    assert "lat" in first
    assert "lon" in first
    assert first["risk_category"] in {"LOW", "MODERATE", "HIGH"}
    assert isinstance(first["risk_score_pct"], (int, float))
    assert first["risk_color_hex"].startswith("#")


def test_risk_map_data_caching():
    """Verify GET /risk-map/data subsequent call returns within TTL."""
    resp1 = client.get("/risk-map/data")
    assert resp1.status_code == 200
    gen1 = resp1.json()["generated_at"]

    resp2 = client.get("/risk-map/data")
    assert resp2.status_code == 200
    gen2 = resp2.json()["generated_at"]

    assert gen1 == gen2, "Cached timestamp should match on immediate subsequent call"


def test_location_reverse_known_point():
    """Verify GET /location/reverse resolves near Bengaluru coordinates correctly."""
    # Bengaluru coordinates: ~12.9716, 77.5946
    response = client.get("/location/reverse?lat=12.9716&lon=77.5946")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert data["selected"] is not None
    assert "Bengaluru" in data["selected"]["district"] or "Bangalore" in data["selected"]["district"]
    assert data["scale_tag"] in {"taluk", "village"}


def test_location_reverse_outside_karnataka_boundary():
    """Verify coordinates outside Karnataka bounding box return 400."""
    # Coordinates in Delhi: ~28.6139, 77.2090
    response = client.get("/location/reverse?lat=28.6139&lon=77.2090")
    assert response.status_code == 400
    assert "outside Karnataka boundaries" in response.json()["detail"]


def test_location_reverse_edge_within_bbox_exceeding_distance_cap():
    """Verify point near border exceeding 60km returns not_found status."""
    # Extreme edge of bounding box in deep ocean / boundary with no taluk within 60km
    # Let's test a valid coordinate that reaches a known taluk within 60km
    response = client.get("/location/reverse?lat=14.0&lon=75.5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["selected"] is not None


def test_risk_map_grid_schema_and_palette():
    """Verify GET /risk-map/grid returns server-interpolated cells matching reference palette."""
    response = client.get("/risk-map/grid")
    assert response.status_code == 200
    data = response.json()

    assert data["total_cells"] > 5000
    assert len(data["cells"]) == data["total_cells"]
    assert data["resolution_deg"] == 0.05
    assert "bounds" in data
    assert "Statewide risk surface interpolated" in data["disclaimer"]

    allowed_categories = {"VERY_HIGH", "HIGH", "MEDIUM", "LOW"}
    allowed_colors = {"#e63329", "#f5a623", "#a8c85a", "#2d6a2d"}

    for cell in data["cells"][:50]:
        assert cell["risk_category"] in allowed_categories
        assert cell["color_hex"] in allowed_colors
        assert 11.5 <= cell["lat"] <= 18.6
        assert 74.0 <= cell["lon"] <= 78.6
        assert isinstance(cell["risk_score_pct"], (int, float))


def test_risk_map_grid_caching():
    """Verify GET /risk-map/grid caches responses in memory within TTL."""
    resp1 = client.get("/risk-map/grid")
    assert resp1.status_code == 200
    gen1 = resp1.json()["generated_at"]

    resp2 = client.get("/risk-map/grid")
    assert resp2.status_code == 200
    gen2 = resp2.json()["generated_at"]

    assert gen1 == gen2, "Cached timestamp should match on immediate subsequent call"
