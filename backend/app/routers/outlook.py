import datetime
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel
from app.services.outlook_store import get_latest_outlook, save_outlook_records, compute_outlook_accuracy
from app.services.outlook_fetcher import fetch_multi_source_forecast
from app.services.outlook_blender import blend_outlook_for_taluk
from app.services.scheduler import run_outlook_pipeline, run_rainfall_backfill_pipeline, DEFAULT_PILOT_TALUKS
from app.services.artifact_loader import get_bundle
from app.services.security import verify_audio_api_key

logger = logging.getLogger("varsha_setu.outlook_router")

router = APIRouter(prefix="/outlook", tags=["7-30 Day Precipitation Outlook"])

class RunNowRequest(BaseModel):
    taluks: Optional[List[str]] = None

@router.get("/{taluk_name}")
def get_taluk_outlook(taluk_name: str) -> Dict[str, Any]:
    """
    Returns the most recent stored 7-30 day precipitation outlook for a specific taluk.
    Includes day-by-day combined_mm, raw agency forecasts (GFS, ICON, ECMWF),
    forecast_basis ('blended' for Weeks 1-2 vs 'climatology_only' for Weeks 3-4),
    and source_agreement ('HIGH' | 'MODERATE' | 'LOW').

    If no run exists in the database, returns 404 for non-pilot taluks, or generates
    on-demand for pilot taluks.
    """
    bundle = get_bundle()
    clean_name = taluk_name.strip()

    # Verify taluk exists in verified dataset
    t_match = bundle.taluks_df[bundle.taluks_df["taluk_name"].str.strip().str.lower() == clean_name.lower()]
    if t_match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Taluk '{clean_name}' not found in verified 236 Karnataka administrative taluks."
        )

    matched_taluk = t_match.iloc[0]["taluk_name"]
    district = t_match.iloc[0]["district"]
    lat = float(t_match.iloc[0]["lat"])
    lon = float(t_match.iloc[0]["lon"])

    records = get_latest_outlook(matched_taluk)

    # On-demand initialization if database has not had a scheduled run yet
    if not records:
        pilot_names_lower = [t.lower() for t in DEFAULT_PILOT_TALUKS]
        if matched_taluk.lower() in pilot_names_lower:
            logger.info("No prior logged outlook for pilot taluk %s in DB. Computing on-demand...", matched_taluk)
            try:
                multi_source = fetch_multi_source_forecast(lat, lon)
                records = blend_outlook_for_taluk(matched_taluk, district, multi_source)
                save_outlook_records(records)
                records = get_latest_outlook(matched_taluk)
            except Exception as e:
                logger.error("On-demand outlook generation failed for %s: %s", matched_taluk, e)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate initial outlook for {matched_taluk}: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Extended outlook available for pilot taluks only (expanding soon). Currently active pilot taluks: {', '.join(DEFAULT_PILOT_TALUKS)}."
            )

    blended_count = sum(1 for r in records if r.get("forecast_basis") == "blended")
    climatology_count = sum(1 for r in records if r.get("forecast_basis") == "climatology_only")
    total_precip = round(sum(r.get("combined_mm", 0.0) for r in records), 2)

    return {
        "status": "success",
        "taluk_name": matched_taluk,
        "district": district,
        "coordinates": {"lat": lat, "lon": lon},
        "run_timestamp": records[0]["run_timestamp"] if records else None,
        "total_days": len(records),
        "summary": {
            "blended_days": blended_count,
            "climatology_days": climatology_count,
            "total_expected_precip_mm": total_precip,
            "mean_daily_precip_mm": round(total_precip / max(1, len(records)), 2)
        },
        "daily_outlook": records
    }

@router.post("/run-now")
def trigger_outlook_run_now(
    req: Optional[RunNowRequest] = Body(None),
    _api_key: Optional[str] = Depends(verify_audio_api_key)
) -> Dict[str, Any]:
    """
    Manually triggers the 7-30 day multi-source precipitation outlook pipeline.
    Protected by X-API-Key verification (same security pattern as /advisory/audio).
    Can target an explicit subset of taluks or defaults to the configured pilot set.
    """
    taluk_subset = req.taluks if req and req.taluks else None
    logger.info("Manual outlook run triggered via POST /outlook/run-now (subset=%s)", taluk_subset)

    result = run_outlook_pipeline(taluk_subset=taluk_subset)
    return {
        "status": "success",
        "message": "Multi-source 7-30 day precipitation outlook pipeline completed.",
        "execution_summary": result
    }

@router.get("/accuracy/{taluk_name}")
def get_outlook_accuracy_metrics(taluk_name: str) -> Dict[str, Any]:
    """
    Computes and returns accuracy metrics (MAE) for logged outlook predictions where
    actual observed rainfall has been backfilled from Open-Meteo's historical archive.

    Returns:
      - mae_combined_mm (70/30 multi-agency + climatology)
      - mae_climatology_mm (10-yr climatology baseline alone)
      - mae_external_mean_mm (raw multi-model forecast mean alone)
      - evaluated_days_count

    # ARCHITECTURAL POLICY: Do NOT auto-adjust 70/30 blending weights or trigger automated
    # retraining based on these metrics. Recalibrating weights requires multi-season offline
    # validation and human meteorological review, strictly preserving the project's
    # frozen ML artifact and no-auto-retrain policies.
    """
    bundle = get_bundle()
    clean_name = taluk_name.strip()

    t_match = bundle.taluks_df[bundle.taluks_df["taluk_name"].str.strip().str.lower() == clean_name.lower()]
    if t_match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Taluk '{clean_name}' not found in verified 236 Karnataka administrative taluks."
        )

    matched_taluk = t_match.iloc[0]["taluk_name"]
    return compute_outlook_accuracy(matched_taluk)

@router.post("/backfill-now")
def trigger_backfill_now(
    target_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD up to which to backfill observed rainfall"),
    _api_key: Optional[str] = Depends(verify_audio_api_key)
) -> Dict[str, Any]:
    """
    Manually triggers the historical rainfall backfill pipeline for past dates.
    Queries Open-Meteo archive / observed data and populates actual_precip_mm in SQLite.
    Protected by X-API-Key verification.
    """
    logger.info("Manual backfill triggered via POST /outlook/backfill-now (target_date=%s)", target_date)
    result = run_rainfall_backfill_pipeline(target_date=target_date)
    return {
        "status": "success",
        "message": "Rainfall backfill execution finished.",
        "execution_summary": result
    }

