import datetime
import logging
import time
from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
import requests
from app.config import OPEN_METEO_TIMEOUT_SECONDS, WEATHER_CACHE_TTL

logger = logging.getLogger("varsha_setu.weather_client")

# In-memory TTL cache: key -> (data_dict, expiry_timestamp)
_weather_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}

def get_seasonal_harmonic_fallback(target_date: Optional[datetime.date] = None) -> Dict[str, Any]:
    """
    Tier 3 Fallback: Computes documented statewide seasonal harmonic precipitation baseline
    for Karnataka when both live Open-Meteo and taluk parquet artifacts are unavailable.
    """
    d = target_date or datetime.date.today()
    doy = d.timetuple().tm_yday

    if 150 <= doy <= 260:
        # Peak Southwest Monsoon (June - mid-September): ~6 - 15 mm/day
        norm_daily = 7.5 + 4.5 * float(np.sin(np.pi * (doy - 150) / 110.0))
    elif 120 <= doy < 150:
        # Pre-monsoon & Early Onset (May): ~2 - 6 mm/day
        norm_daily = 2.0 + 3.5 * float((doy - 120) / 30.0)
    elif 261 <= doy <= 310:
        # Post-monsoon / Northeast Monsoon (mid-Sept - early Nov): ~2 - 5 mm/day
        norm_daily = 4.0 * float(np.cos(np.pi * (doy - 261) / 100.0))
    else:
        # Dry winter / early pre-monsoon: ~0.5 mm/day
        norm_daily = 0.5

    norm_daily = max(norm_daily, 0.1)

    p_today = norm_daily
    p_3d = norm_daily * 3.0
    p_7d = norm_daily * 7.0
    p_14d = norm_daily * 14.0
    p_21d = norm_daily * 21.0
    p_l1 = norm_daily
    p_l2 = norm_daily
    p_l3 = norm_daily

    logger.info(
        "Applying statewide seasonal harmonic fallback for DOY %d: today=%.1fmm, 7d=%.1fmm",
        doy, p_today, p_7d
    )

    return {
        "p_today": p_today,
        "p_3d": p_3d,
        "p_7d": p_7d,
        "p_14d": p_14d,
        "p_21d": p_21d,
        "p_l1": p_l1,
        "p_l2": p_l2,
        "p_l3": p_l3,
        "data_source": "karnataka_seasonal_harmonic_fallback",
        "fallback_warning": (
            "Live Open-Meteo precipitation API was unreachable. "
            "Model inferred from statewide seasonal harmonic approximation."
        )
    }

def get_taluk_climatology_fallback(taluk_name: str, target_date: Optional[datetime.date] = None) -> Optional[Dict[str, Any]]:
    """
    Tier 2 Fallback: Queries verified taluk-level Day-of-Year climatological rainfall
    from the bundled 86,376-row climatology_by_taluk_doy.parquet artifact (10-year CHIRPS distribution).
    """
    try:
        from app.services.artifact_loader import get_bundle
        bundle = get_bundle()
    except Exception:
        return None

    if not bundle or not bundle.climatology_map:
        return None

    clean_name = taluk_name.strip().lower()
    d = target_date or datetime.date.today()
    doy = d.timetuple().tm_yday

    # Verify if taluk has entries in climatology map
    if (clean_name, doy) not in bundle.climatology_map:
        return None

    def _doy_for_offset(offset: int) -> int:
        offset_date = d - datetime.timedelta(days=offset)
        return offset_date.timetuple().tm_yday

    p_today = bundle.get_climatology(taluk_name, doy)
    p_3d = sum(bundle.get_climatology(taluk_name, _doy_for_offset(i)) for i in range(3))
    p_7d = sum(bundle.get_climatology(taluk_name, _doy_for_offset(i)) for i in range(7))
    p_14d = sum(bundle.get_climatology(taluk_name, _doy_for_offset(i)) for i in range(14))
    p_21d = sum(bundle.get_climatology(taluk_name, _doy_for_offset(i)) for i in range(21))
    p_l1 = bundle.get_climatology(taluk_name, _doy_for_offset(1))
    p_l2 = bundle.get_climatology(taluk_name, _doy_for_offset(2))
    p_l3 = bundle.get_climatology(taluk_name, _doy_for_offset(3))

    logger.info(
        "Applying verified taluk climatology parquet artifact for '%s' DOY %d: today=%.2fmm, 7d=%.2fmm",
        taluk_name, doy, p_today, p_7d
    )

    return {
        "p_today": float(p_today),
        "p_3d": float(p_3d),
        "p_7d": float(p_7d),
        "p_14d": float(p_14d),
        "p_21d": float(p_21d),
        "p_l1": float(p_l1),
        "p_l2": float(p_l2),
        "p_l3": float(p_l3),
        "data_source": "taluk_climatology_artifact_fallback",
        "fallback_warning": (
            f"Live Open-Meteo precipitation API was unreachable. "
            f"Model inferred from verified {taluk_name} DOY climatological baseline (10-year CHIRPS artifact)."
        )
    }

def get_climatological_normal_fallback(
    lat: float,
    lon: float,
    target_date: Optional[datetime.date] = None,
    taluk_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Coordinates fallback resolution between Tier 2 (Taluk Parquet Artifact)
    and Tier 3 (Statewide Seasonal Harmonic Model).
    """
    # 1. Try taluk name if directly available
    if taluk_name:
        taluk_result = get_taluk_climatology_fallback(taluk_name, target_date)
        if taluk_result:
            return taluk_result

    # 2. Try resolving nearest taluk from coordinates
    try:
        from app.services.artifact_loader import get_bundle
        from app.services.location_resolver import find_nearest_taluk
        bundle = get_bundle()
        nearest_taluk, _, _ = find_nearest_taluk(lat, lon, bundle.taluks_df)
        if nearest_taluk:
            taluk_result = get_taluk_climatology_fallback(nearest_taluk, target_date)
            if taluk_result:
                return taluk_result
    except Exception as e:
        logger.debug("Could not resolve nearest taluk for fallback: %s", e)

    # 3. Final resort: Seasonal Harmonic Fallback
    return get_seasonal_harmonic_fallback(target_date)

def fetch_recent_precipitation(
    lat: float,
    lon: float,
    taluk_name: Optional[str] = None,
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Fetches real-time rolling 21-day precipitation history with a 3-tier cascade:
      Tier 1: Live Open-Meteo daily aggregation API (cached with 1-hour TTL).
      Tier 2: Verified Taluk-level Parquet Climatology (86,376 rows, 10-year CHIRPS baseline, instant <1ms).
      Tier 3: Karnataka Statewide Seasonal Harmonic Model.
    Ensures user requests never freeze under remote API network latency.
    """
    now = time.time()
    today_str = datetime.date.today().isoformat()
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}_{today_str}"

    if not force_refresh and cache_key in _weather_cache:
        cached_data, expiry = _weather_cache[cache_key]
        if now < expiry:
            return cached_data

    # Attempt fast live fetch with a 1.5s cap to ensure ultra-low latency; fallback to parquet baseline
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&daily=precipitation_sum&past_days=21&forecast_days=1&timezone=Asia%2FKolkata"
    )

    is_fallback = False
    p_s = None
    try:
        resp = requests.get(url, timeout=1.2)
        if resp.status_code == 200:
            data = resp.json()
            p_vals = data.get("daily", {}).get("precipitation_sum", [])
            if len(p_vals) >= 21:
                p_s = pd.Series(p_vals, dtype=float).fillna(0.0).clip(lower=0.0)
            else:
                is_fallback = True
        else:
            logger.warning("Open-Meteo status %d. Activating climatological fallback.", resp.status_code)
            is_fallback = True
    except Exception as e:
        logger.info("Open-Meteo live query skipped/timed out (%s). Using verified taluk parquet baseline.", e)
        is_fallback = True

    if is_fallback or p_s is None:
        result = get_climatological_normal_fallback(lat, lon, taluk_name=taluk_name)
    else:
        p_today = float(p_s.iloc[-1])
        p_3d = float(p_s.tail(3).sum())
        p_7d = float(p_s.tail(7).sum())
        p_14d = float(p_s.tail(14).sum())
        p_21d = float(p_s.tail(21).sum())
        p_l1 = float(p_s.iloc[-2]) if len(p_s) >= 2 else p_today
        p_l2 = float(p_s.iloc[-3]) if len(p_s) >= 3 else p_today
        p_l3 = float(p_s.iloc[-4]) if len(p_s) >= 4 else p_today

        result = {
            "p_today": p_today,
            "p_3d": p_3d,
            "p_7d": p_7d,
            "p_14d": p_14d,
            "p_21d": p_21d,
            "p_l1": p_l1,
            "p_l2": p_l2,
            "p_l3": p_l3,
            "data_source": "open_meteo_live",
            "fallback_warning": None
        }

    _weather_cache[cache_key] = (result, now + WEATHER_CACHE_TTL)
    return result

