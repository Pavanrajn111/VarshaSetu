import datetime
import logging
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import ARTIFACTS_DIR

logger = logging.getLogger("varsha_setu.outlook_store")

DB_PATH = Path(ARTIFACTS_DIR) / "outlook_log.db"

def init_db(db_path: Path = DB_PATH):
    """Initializes the SQLite schema for logging outlook predictions over time."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS outlook_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                taluk_name TEXT NOT NULL,
                district TEXT NOT NULL,
                forecast_date TEXT NOT NULL,
                run_timestamp TEXT NOT NULL,
                gfs_mm REAL,
                icon_mm REAL,
                ecmwf_mm REAL,
                climatology_mm REAL,
                combined_mm REAL NOT NULL,
                forecast_basis TEXT NOT NULL,
                source_agreement TEXT,
                actual_precip_mm REAL,
                UNIQUE(taluk_name, forecast_date, run_timestamp)
            )
            """
        )
        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_taluk_date_run
            ON outlook_predictions (taluk_name, forecast_date, run_timestamp)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_taluk_run 
            ON outlook_predictions (taluk_name, run_timestamp)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_forecast_date
            ON outlook_predictions (forecast_date)
            """
        )
        conn.commit()
    logger.debug("Initialized outlook database at %s", db_path)

def save_outlook_records(
    records: List[Dict[str, Any]],
    run_timestamp: Optional[str] = None,
    db_path: Path = DB_PATH
) -> int:
    """
    Inserts newly computed outlook predictions for a scheduled run.
    Uses INSERT OR IGNORE to prevent duplicate inserts for identical (taluk, date, run).
    """
    if not records:
        return 0

    init_db(db_path)
    ts = run_timestamp or datetime.datetime.now(datetime.timezone.utc).isoformat()

    insert_rows = [
        (
            r["taluk_name"],
            r["district"],
            r["forecast_date"],
            ts,
            r.get("gfs_mm"),
            r.get("icon_mm"),
            r.get("ecmwf_mm"),
            r.get("climatology_mm"),
            r["combined_mm"],
            r["forecast_basis"],
            r.get("source_agreement"),
            r.get("actual_precip_mm")
        )
        for r in records
    ]

    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.executemany(
            """
            INSERT OR IGNORE INTO outlook_predictions (
                taluk_name, district, forecast_date, run_timestamp,
                gfs_mm, icon_mm, ecmwf_mm, climatology_mm, combined_mm,
                forecast_basis, source_agreement, actual_precip_mm
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            insert_rows
        )
        conn.commit()

    logger.info("Persisted %d outlook records to %s with run_timestamp=%s", len(insert_rows), db_path.name, ts)
    return len(insert_rows)

def get_latest_outlook(
    taluk_name: str,
    db_path: Path = DB_PATH
) -> List[Dict[str, Any]]:
    """
    Retrieves the most recent 30-day outlook prediction set for a given taluk.
    Returns list of daily prediction dicts ordered by forecast_date ascending.
    """
    if not db_path.exists():
        return []

    clean_name = taluk_name.strip()

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Find the latest run_timestamp for this taluk
        cursor.execute(
            """
            SELECT MAX(run_timestamp) as latest_ts
            FROM outlook_predictions
            WHERE lower(taluk_name) = lower(?)
            """,
            (clean_name,)
        )
        row = cursor.fetchone()
        if not row or not row["latest_ts"]:
            return []

        latest_ts = row["latest_ts"]

        # Fetch records for that latest run
        cursor.execute(
            """
            SELECT id, taluk_name, district, forecast_date, run_timestamp,
                   gfs_mm, icon_mm, ecmwf_mm, climatology_mm, combined_mm,
                   forecast_basis, source_agreement, actual_precip_mm
            FROM outlook_predictions
            WHERE lower(taluk_name) = lower(?) AND run_timestamp = ?
            ORDER BY forecast_date ASC
            """,
            (clean_name, latest_ts)
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def update_actual_precip(
    taluk_name: str,
    forecast_date: str,
    actual_mm: float,
    db_path: Path = DB_PATH
) -> int:
    """
    Updates actual observed rainfall for past dates once historical observations are available.
    """
    if not db_path.exists():
        return 0

    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE outlook_predictions
            SET actual_precip_mm = ?
            WHERE lower(taluk_name) = lower(?) AND forecast_date = ?
            """,
            (round(float(actual_mm), 2), taluk_name.strip(), forecast_date)
        )
        conn.commit()
        return cursor.rowcount

def get_unbackfilled_records(
    max_date: str,
    db_path: Path = DB_PATH
) -> List[Dict[str, Any]]:
    """
    Retrieves distinct taluks and dates on or before max_date where actual_precip_mm is not yet backfilled.
    """
    if not db_path.exists():
        return []

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT DISTINCT taluk_name, district, forecast_date
            FROM outlook_predictions
            WHERE forecast_date <= ? AND actual_precip_mm IS NULL
            ORDER BY forecast_date ASC
            """,
            (max_date,)
        )
        return [dict(r) for r in cursor.fetchall()]

def compute_outlook_accuracy(
    taluk_name: str,
    db_path: Path = DB_PATH
) -> Dict[str, Any]:
    """
    Computes accuracy metrics (MAE) for logged outlook predictions where actual observed rainfall
    has been backfilled.

    Evaluates:
      1. MAE of 70/30 combined_mm vs actual
      2. MAE of climatology_mm alone vs actual
      3. MAE of raw external model mean alone vs actual

    # ARCHITECTURAL POLICY: Do NOT auto-adjust 70/30 blending weights or trigger automated
    # retraining based on these metrics. Recalibrating weights requires multi-season offline
    # validation and human meteorological review, strictly preserving the project's
    # frozen ML artifact and no-auto-retrain policies.
    """
    if not db_path.exists():
        return {
            "status": "error",
            "message": "Outlook database does not exist yet.",
            "evaluated_days_count": 0
        }

    clean_name = taluk_name.strip()

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, taluk_name, district, forecast_date, run_timestamp,
                   gfs_mm, icon_mm, ecmwf_mm, climatology_mm, combined_mm,
                   forecast_basis, source_agreement, actual_precip_mm
            FROM outlook_predictions
            WHERE lower(taluk_name) = lower(?) AND actual_precip_mm IS NOT NULL
            ORDER BY forecast_date ASC
            """,
            (clean_name,)
        )
        rows = [dict(r) for r in cursor.fetchall()]

    if not rows:
        return {
            "status": "pending_data",
            "taluk_name": clean_name,
            "evaluated_days_count": 0,
            "message": (
                f"No observed actual rainfall records have been backfilled yet for {clean_name}. "
                "The automated 01:00 AM backfill worker populates actual observed rainfall from the "
                "Open-Meteo historical archive once past days conclude."
            ),
            "mae_combined_mm": None,
            "mae_climatology_mm": None,
            "mae_external_mean_mm": None,
            "policy_note": (
                "Weights are fixed at 70/30 per baseline calibration. Automatic weight adjustment "
                "or model retraining is strictly prohibited without offline meteorological review."
            )
        }

    errors_combined = []
    errors_climatology = []
    errors_external = []
    evaluated_records = []

    for r in rows:
        actual = float(r["actual_precip_mm"])
        comb = float(r["combined_mm"])
        clim = float(r["climatology_mm"]) if r["climatology_mm"] is not None else 0.0

        err_comb = abs(comb - actual)
        err_clim = abs(clim - actual)

        errors_combined.append(err_comb)
        errors_climatology.append(err_clim)

        # Raw external mean if available
        ext_sources = [float(v) for v in (r.get("gfs_mm"), r.get("icon_mm"), r.get("ecmwf_mm")) if v is not None]
        if ext_sources:
            ext_mean = sum(ext_sources) / len(ext_sources)
            err_ext = abs(ext_mean - actual)
            errors_external.append(err_ext)
        else:
            ext_mean = None
            err_ext = None

        evaluated_records.append({
            "forecast_date": r["forecast_date"],
            "actual_precip_mm": actual,
            "combined_mm": comb,
            "climatology_mm": clim,
            "external_mean_mm": round(ext_mean, 2) if ext_mean is not None else None,
            "err_combined": round(err_comb, 2),
            "err_climatology": round(err_clim, 2),
            "err_external": round(err_ext, 2) if err_ext is not None else None,
        })

    n = len(errors_combined)
    mae_comb = round(sum(errors_combined) / n, 2)
    mae_clim = round(sum(errors_climatology) / n, 2)
    mae_ext = round(sum(errors_external) / len(errors_external), 2) if errors_external else None

    # Calculate blend advantage percentages
    blend_beats_climatology = bool(mae_comb < mae_clim)
    blend_beats_external = bool(mae_ext is not None and mae_comb < mae_ext)

    adv_vs_clim = round(((mae_clim - mae_comb) / max(0.01, mae_clim)) * 100, 1)
    adv_vs_ext = round(((mae_ext - mae_comb) / max(0.01, mae_ext)) * 100, 1) if mae_ext is not None else None

    return {
        "status": "success",
        "taluk_name": clean_name,
        "district": rows[0]["district"],
        "evaluated_days_count": n,
        "mae_combined_mm": mae_comb,
        "mae_climatology_mm": mae_clim,
        "mae_external_mean_mm": mae_ext,
        "blend_beats_climatology": blend_beats_climatology,
        "blend_beats_external": blend_beats_external,
        "blend_advantage_vs_climatology_pct": adv_vs_clim,
        "blend_advantage_vs_external_pct": adv_vs_ext,
        "policy_note": (
            "Weights are fixed at 70/30 per baseline calibration. Automatic weight adjustment "
            "or model retraining is strictly prohibited without offline meteorological review."
        ),
        "evaluated_records": evaluated_records
    }
