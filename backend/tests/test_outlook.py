import datetime
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.services.artifact_loader import load_artifacts_once
from app.services.outlook_blender import blend_outlook_for_taluk, compute_source_agreement
from app.services.outlook_store import init_db, save_outlook_records, get_latest_outlook
from app.services.scheduler import get_scheduler
from main import app

@pytest.fixture(scope="session", autouse=True)
def setup_artifacts():
    load_artifacts_once()

def test_source_agreement_metrics():
    # Close values: std < 2.0 -> HIGH
    assert compute_source_agreement([10.0, 11.0, 10.5]) == "HIGH"

    # Moderate spread: 2.0 <= std < 6.0 -> MODERATE
    assert compute_source_agreement([5.0, 10.0, 8.0]) == "MODERATE"

    # Wide spread: std >= 6.0 -> LOW
    assert compute_source_agreement([0.0, 25.0, 5.0]) == "LOW"

    # Single source or none -> LOW
    assert compute_source_agreement([10.0]) == "LOW"
    assert compute_source_agreement([]) == "LOW"

def test_blending_math_known_mock(monkeypatch):
    """
    Confirms exact 70/30 blending math:
    external_mean = (10.0 + 12.0 + 8.0) / 3 = 10.0 mm
    climatology = 6.0 mm
    combined = 0.70 * 10.0 + 0.30 * 6.0 = 7.0 + 1.8 = 8.8 mm
    """
    test_date = datetime.date(2026, 6, 15)
    date_str = test_date.isoformat()

    mock_sources = {
        date_str: {
            "gfs_mm": 10.0,
            "icon_mm": 12.0,
            "ecmwf_mm": 8.0
        }
    }

    # Mock get_climatology on bundle
    from app.services.artifact_loader import get_bundle
    bundle = get_bundle()
    monkeypatch.setattr(bundle, "get_climatology", lambda taluk, doy: 6.0)

    records = blend_outlook_for_taluk(
        taluk_name="Sirsi",
        district="Uttara Kannada",
        multi_source_daily=mock_sources,
        start_date=test_date,
        total_days=1
    )

    assert len(records) == 1
    r = records[0]
    assert r["forecast_date"] == date_str
    assert r["gfs_mm"] == 10.0
    assert r["icon_mm"] == 12.0
    assert r["ecmwf_mm"] == 8.0
    assert r["climatology_mm"] == 6.0
    assert r["combined_mm"] == 8.8
    assert r["forecast_basis"] == "blended"
    assert r["source_agreement"] == "HIGH"

def test_weeks_3_4_climatology_only_fallback(monkeypatch):
    """
    Confirms that for days beyond the live 16-day forecast horizon (Weeks 3-4),
    the system falls back to 100% climatology with forecast_basis='climatology_only'.
    """
    start_date = datetime.date(2026, 7, 1)

    # Provide only 14 days of external forecasts
    mock_sources = {}
    for d in range(14):
        dt_str = (start_date + datetime.timedelta(days=d)).isoformat()
        mock_sources[dt_str] = {"gfs_mm": 15.0, "icon_mm": 15.0, "ecmwf_mm": 15.0}

    from app.services.artifact_loader import get_bundle
    bundle = get_bundle()
    monkeypatch.setattr(bundle, "get_climatology", lambda taluk, doy: 7.2)

    records = blend_outlook_for_taluk(
        taluk_name="Sirsi",
        district="Uttara Kannada",
        multi_source_daily=mock_sources,
        start_date=start_date,
        total_days=30
    )

    assert len(records) == 30

    # Days 1-14: blended
    for r in records[:14]:
        assert r["forecast_basis"] == "blended"
        assert r["combined_mm"] == round(0.70 * 15.0 + 0.30 * 7.2, 2)

    # Days 15-30: climatology_only
    for r in records[14:]:
        assert r["forecast_basis"] == "climatology_only"
        assert r["combined_mm"] == 7.2
        assert r["gfs_mm"] is None
        assert r["icon_mm"] is None
        assert r["ecmwf_mm"] is None
        assert r["source_agreement"] == "CLIMATOLOGY"

def test_one_failed_source_graceful_continuation(monkeypatch):
    """
    Confirms that if one source fails (e.g. gfs=None), the mean of the remaining
    sources is used without aborting the taluk calculation.
    """
    test_date = datetime.date(2026, 8, 1)
    date_str = test_date.isoformat()

    mock_sources = {
        date_str: {
            "gfs_mm": None,   # failed source
            "icon_mm": 6.0,
            "ecmwf_mm": 10.0
        }
    }

    from app.services.artifact_loader import get_bundle
    bundle = get_bundle()
    monkeypatch.setattr(bundle, "get_climatology", lambda taluk, doy: 5.0)

    records = blend_outlook_for_taluk(
        taluk_name="Sirsi",
        district="Uttara Kannada",
        multi_source_daily=mock_sources,
        start_date=test_date,
        total_days=1
    )

    r = records[0]
    # mean of 6.0 and 10.0 is 8.0
    # combined = 0.70 * 8.0 + 0.30 * 5.0 = 5.6 + 1.5 = 7.1
    assert r["gfs_mm"] is None
    assert r["icon_mm"] == 6.0
    assert r["ecmwf_mm"] == 10.0
    assert r["climatology_mm"] == 5.0
    assert r["combined_mm"] == 7.1
    assert r["forecast_basis"] == "blended"

def test_sqlite_persistence(tmp_path):
    """
    Confirms persistent SQLite insertion and retrieval by taluk name.
    """
    test_db = tmp_path / "test_outlook.db"
    records = [
        {
            "taluk_name": "Sirsi",
            "district": "Uttara Kannada",
            "forecast_date": f"2026-07-{d:02d}",
            "day_index": d,
            "gfs_mm": 5.0,
            "icon_mm": 5.5,
            "ecmwf_mm": 4.5,
            "climatology_mm": 6.0,
            "combined_mm": 5.3,
            "forecast_basis": "blended",
            "source_agreement": "HIGH",
            "actual_precip_mm": None
        }
        for d in range(1, 31)
    ]

    count = save_outlook_records(records, run_timestamp="2026-07-01T00:00:00Z", db_path=test_db)
    assert count == 30

    retrieved = get_latest_outlook("Sirsi", db_path=test_db)
    assert len(retrieved) == 30
    assert retrieved[0]["taluk_name"] == "Sirsi"
    assert retrieved[0]["combined_mm"] == 5.3
    assert retrieved[0]["run_timestamp"] == "2026-07-01T00:00:00Z"

def test_scheduler_cron_registration():
    """
    Confirms the scheduler registers two cron triggers:
    1. 00:00 Asia/Kolkata
    2. 12:00 Asia/Kolkata
    Without waiting for them to fire.
    """
    sched = get_scheduler()
    jobs = sched.get_jobs()
    job_ids = [j.id for j in jobs]

    assert "outlook_midnight_run" in job_ids, "Midnight cron trigger must be registered"
    assert "outlook_noon_run" in job_ids, "Noon cron trigger must be registered"
    assert "rainfall_backfill_01am_run" in job_ids, "01:00 AM backfill trigger must be registered"

    midnight_job = sched.get_job("outlook_midnight_run")
    noon_job = sched.get_job("outlook_noon_run")
    backfill_job = sched.get_job("rainfall_backfill_01am_run")

    # Inspect CronTrigger fields
    assert str(midnight_job.trigger.fields[5]) == "0", "Midnight job must trigger at hour 0"
    assert str(midnight_job.trigger.fields[6]) == "0", "Midnight job must trigger at minute 0"

    assert str(noon_job.trigger.fields[5]) == "12", "Noon job must trigger at hour 12"
    assert str(noon_job.trigger.fields[6]) == "0", "Noon job must trigger at minute 0"

    assert str(backfill_job.trigger.fields[5]) == "1", "Backfill job must trigger at hour 1"
    assert str(backfill_job.trigger.fields[6]) == "0", "Backfill job must trigger at minute 0"

def test_backfill_and_accuracy_metrics(tmp_path):
    """
    Confirms backfill of actual_precip_mm and exact calculation of MAE across:
    1. 70/30 combined blend
    2. Climatology alone
    3. Raw external multi-model mean alone
    """
    from app.services.outlook_store import update_actual_precip, compute_outlook_accuracy

    test_db = tmp_path / "test_acc.db"
    init_db(test_db)

    # Insert 2 test rows:
    # Day 1: GFS=10, ICON=12, ECMWF=8 -> ext_mean=10.0, clim=6.0, combined=8.8
    # Day 2: GFS=4,  ICON=6,  ECMWF=5 -> ext_mean=5.0,  clim=3.0, combined=4.4
    records = [
        {
            "taluk_name": "Sirsi",
            "district": "Uttara Kannada",
            "forecast_date": "2026-06-15",
            "gfs_mm": 10.0,
            "icon_mm": 12.0,
            "ecmwf_mm": 8.0,
            "climatology_mm": 6.0,
            "combined_mm": 8.8,
            "forecast_basis": "blended",
            "source_agreement": "HIGH",
            "actual_precip_mm": None
        },
        {
            "taluk_name": "Sirsi",
            "district": "Uttara Kannada",
            "forecast_date": "2026-06-16",
            "gfs_mm": 4.0,
            "icon_mm": 6.0,
            "ecmwf_mm": 5.0,
            "climatology_mm": 3.0,
            "combined_mm": 4.4,
            "forecast_basis": "blended",
            "source_agreement": "HIGH",
            "actual_precip_mm": None
        }
    ]
    save_outlook_records(records, run_timestamp="2026-06-15T00:00:00Z", db_path=test_db)

    # Before backfill: pending_data
    acc_before = compute_outlook_accuracy("Sirsi", db_path=test_db)
    assert acc_before["status"] == "pending_data"
    assert acc_before["evaluated_days_count"] == 0

    # Backfill ground truth observations:
    # Day 1 actual = 8.0 mm
    #   err_combined = |8.8 - 8.0| = 0.8
    #   err_clim     = |6.0 - 8.0| = 2.0
    #   err_ext      = |10.0 - 8.0| = 2.0
    # Day 2 actual = 5.0 mm
    #   err_combined = |4.4 - 5.0| = 0.6
    #   err_clim     = |3.0 - 5.0| = 2.0
    #   err_ext      = |5.0 - 5.0| = 0.0
    # Expected MAE:
    #   combined = (0.8 + 0.6) / 2 = 0.70 mm
    #   clim     = (2.0 + 2.0) / 2 = 2.00 mm
    #   ext      = (2.0 + 0.0) / 2 = 1.00 mm
    update_actual_precip("Sirsi", "2026-06-15", 8.0, db_path=test_db)
    update_actual_precip("Sirsi", "2026-06-16", 5.0, db_path=test_db)

    acc = compute_outlook_accuracy("Sirsi", db_path=test_db)
    assert acc["status"] == "success"
    assert acc["evaluated_days_count"] == 2
    assert acc["mae_combined_mm"] == 0.7
    assert acc["mae_climatology_mm"] == 2.0
    assert acc["mae_external_mean_mm"] == 1.0
    assert acc["blend_beats_climatology"] is True
    assert acc["blend_beats_external"] is True
    assert "strictly prohibited" in acc["policy_note"]

def test_outlook_api_endpoint():
    """
    Tests GET /outlook/{taluk_name} and GET /outlook/accuracy/{taluk_name} with FastAPI TestClient.
    """
    client = TestClient(app)
    resp = client.get("/outlook/Sirsi")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["taluk_name"] == "Sirsi"
    assert data["district"] == "Uttara Kannada"
    assert "daily_outlook" in data
    assert len(data["daily_outlook"]) == 30

    # Accuracy endpoint
    acc_resp = client.get("/outlook/accuracy/Sirsi")
    assert acc_resp.status_code == 200
    acc_data = acc_resp.json()
    assert acc_data["taluk_name"] == "Sirsi"
    assert "policy_note" in acc_data

    # 404 for unknown taluk
    bad_resp = client.get("/outlook/UnknownFictionalTaluk123")
    assert bad_resp.status_code == 404

