import datetime
import logging
from typing import Dict, Any, List, Optional
import numpy as np
from app.services.artifact_loader import get_bundle

logger = logging.getLogger("varsha_setu.outlook_blender")

def compute_source_agreement(valid_values: List[float]) -> str:
    """
    Computes multi-agency forecast agreement based on standard deviation across available sources:
      - HIGH: std dev < 2.0 mm (strong consensus)
      - MODERATE: 2.0 mm <= std dev < 6.0 mm (moderate dispersion)
      - LOW: std dev >= 6.0 mm or fewer than 2 sources available (high uncertainty)
    """
    if len(valid_values) < 2:
        return "LOW"

    spread = float(np.std(valid_values))
    if spread < 2.0:
        return "HIGH"
    elif spread < 6.0:
        return "MODERATE"
    else:
        return "LOW"

def blend_outlook_for_taluk(
    taluk_name: str,
    district: str,
    multi_source_daily: Dict[str, Dict[str, Optional[float]]],
    start_date: Optional[datetime.date] = None,
    total_days: int = 30
) -> List[Dict[str, Any]]:
    """
    Blends multi-agency live forecasts with 10-year historical climatology.

    Weeks 1-2 (Days 1-16 / Available Horizon):
      external_forecast_mm = mean(successful agency forecasts for that day)
      climatology_mm = precip_normal_doy(taluk, doy)
      combined_mm = 0.70 * external_forecast_mm + 0.30 * climatology_mm
      forecast_basis = "blended"
      source_agreement = "HIGH" | "MODERATE" | "LOW"

    Weeks 3-4 (Days 17-30 / Beyond Live Horizon):
      combined_mm = climatology_mm (100% climatology, 0% external)
      forecast_basis = "climatology_only"
      source_agreement = "CLIMATOLOGY"
    """
    base_date = start_date or datetime.date.today()
    bundle = get_bundle()
    records: List[Dict[str, Any]] = []

    for d in range(total_days):
        forecast_dt = base_date + datetime.timedelta(days=d)
        date_str = forecast_dt.isoformat()
        doy = forecast_dt.timetuple().tm_yday

        climatology_val = bundle.get_climatology(taluk_name, doy)

        # Check if date is within live multi-source forecast window
        if date_str in multi_source_daily:
            day_sources = multi_source_daily[date_str]
            gfs = day_sources.get("gfs_mm")
            icon = day_sources.get("icon_mm")
            ecmwf = day_sources.get("ecmwf_mm")

            valid_vals = [float(v) for v in (gfs, icon, ecmwf) if v is not None]

            if valid_vals:
                external_mean = float(np.mean(valid_vals))
                combined = round(0.70 * external_mean + 0.30 * climatology_val, 2)
                basis = "blended"
                agreement = compute_source_agreement(valid_vals)
            else:
                # All sources failed for this specific day
                combined = round(climatology_val, 2)
                basis = "climatology_only"
                agreement = "LOW"
        else:
            # Beyond Open-Meteo 16-day limit (Weeks 3-4) -> 100% Climatology
            gfs = None
            icon = None
            ecmwf = None
            combined = round(climatology_val, 2)
            basis = "climatology_only"
            agreement = "CLIMATOLOGY"

        records.append({
            "taluk_name": taluk_name,
            "district": district,
            "forecast_date": date_str,
            "day_index": d + 1,
            "gfs_mm": round(gfs, 2) if gfs is not None else None,
            "icon_mm": round(icon, 2) if icon is not None else None,
            "ecmwf_mm": round(ecmwf, 2) if ecmwf is not None else None,
            "climatology_mm": round(climatology_val, 2),
            "combined_mm": combined,
            "forecast_basis": basis,
            "source_agreement": agreement,
            "actual_precip_mm": None
        })

    logger.debug(
        "Blended %d-day outlook for %s: %d blended days, %d climatology-only days.",
        total_days, taluk_name,
        sum(1 for r in records if r["forecast_basis"] == "blended"),
        sum(1 for r in records if r["forecast_basis"] == "climatology_only")
    )
    return records
