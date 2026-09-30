import logging
from typing import Dict, Optional, Any, List
import datetime
import requests

logger = logging.getLogger("varsha_setu.outlook_fetcher")

MODEL_SOURCES = [
    ("gfs_seamless", "gfs_mm", "NOAA GFS (USA)"),
    ("icon_seamless", "icon_mm", "DWD ICON (Germany)"),
    ("ecmwf_ifs04", "ecmwf_mm", "ECMWF IFS (Europe)"),
]

def fetch_single_model(
    lat: float,
    lon: float,
    model_name: str,
    timeout_sec: float = 8.0
) -> Dict[str, Optional[float]]:
    """
    Queries Open-Meteo for a specific meteorological agency model for the next 16 days.
    Returns { "YYYY-MM-DD": precipitation_sum_mm }.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&daily=precipitation_sum&forecast_days=16&models={model_name}&timezone=Asia%2FKolkata"
    )

    try:
        resp = requests.get(url, timeout=timeout_sec)
        if resp.status_code == 200:
            data = resp.json()
            times = data.get("daily", {}).get("time", [])
            precips = data.get("daily", {}).get("precipitation_sum", [])
            
            # If ecmwf_ifs04 returned all None, attempt fallback to ecmwf_ifs025 / ecmwf_ifs
            if model_name == "ecmwf_ifs04" and (not precips or all(p is None for p in precips)):
                logger.info("Open-Meteo returned None for ecmwf_ifs04; trying fallback to ecmwf_ifs025...")
                fallback_url = (
                    f"https://api.open-meteo.com/v1/forecast?"
                    f"latitude={lat}&longitude={lon}&daily=precipitation_sum&forecast_days=16&models=ecmwf_ifs025&timezone=Asia%2FKolkata"
                )
                fb_resp = requests.get(fallback_url, timeout=timeout_sec)
                if fb_resp.status_code == 200:
                    fb_data = fb_resp.json()
                    times = fb_data.get("daily", {}).get("time", [])
                    precips = fb_data.get("daily", {}).get("precipitation_sum", [])

            result: Dict[str, Optional[float]] = {}
            for t_str, p_val in zip(times, precips):
                result[t_str] = float(p_val) if p_val is not None else None
            return result
        else:
            logger.warning("Open-Meteo model '%s' failed with status %d: %s", model_name, resp.status_code, resp.text[:120])
            return {}
    except Exception as e:
        logger.warning("Error fetching model '%s' for coords (%.3f, %.3f): %s", model_name, lat, lon, e)
        return {}

import concurrent.futures

def fetch_multi_source_forecast(
    lat: float,
    lon: float,
    timeout_sec: float = 3.5
) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Fetches 16-day daily forecasts concurrently from 3 independent agencies:
      1. NOAA GFS (gfs_seamless)
      2. DWD ICON (icon_seamless)
      3. ECMWF IFS (ecmwf_ifs04 / ifs025)

    Fetches all 3 models in parallel for sub-2s latency.
    Continues if any source fails and logs the failure gracefully.
    Returns: { "YYYY-MM-DD": { "gfs_mm": val, "icon_mm": val, "ecmwf_mm": val } }
    """
    daily_results: Dict[str, Dict[str, Optional[float]]] = {}

    def _fetch_task(item):
        m_param, f_key, a_name = item
        data = fetch_single_model(lat, lon, m_param, timeout_sec=timeout_sec)
        return f_key, a_name, data

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(_fetch_task, item) for item in MODEL_SOURCES]
        for future in concurrent.futures.as_completed(futures):
            try:
                field_key, agency_name, model_data = future.result()
                if not model_data:
                    logger.warning("Source [%s - %s] returned no data for (%.3f, %.3f). Continuing.", field_key, agency_name, lat, lon)
                for date_str, precip in model_data.items():
                    if date_str not in daily_results:
                        daily_results[date_str] = {"gfs_mm": None, "icon_mm": None, "ecmwf_mm": None}
                    daily_results[date_str][field_key] = precip
            except Exception as e:
                logger.warning("Parallel model fetch error: %s", e)

    logger.info(
        "Parallel multi-source fetch completed for (%.3f, %.3f): %d forecast days compiled across available sources.",
        lat, lon, len(daily_results)
    )
    return daily_results

def fetch_observed_rainfall(
    lat: float,
    lon: float,
    date_str: str,
    timeout_sec: float = 8.0
) -> Optional[float]:
    """
    Fetches real observed precipitation for a past date from Open-Meteo's historical/archive endpoint.
    Used by the daily 01:00 AM backfill worker to verify predicted precipitation against ground truth.
    Falls back to past_days on the operational endpoint if archive has a 1-2 day latency window.
    """
    # 1. Primary: archive-api.open-meteo.com/v1/archive
    archive_url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}&start_date={date_str}&end_date={date_str}&daily=precipitation_sum&timezone=auto"
    )
    try:
        resp = requests.get(archive_url, timeout=timeout_sec)
        if resp.status_code == 200:
            data = resp.json()
            precips = data.get("daily", {}).get("precipitation_sum", [])
            if precips and precips[0] is not None:
                return round(float(precips[0]), 2)
    except Exception as e:
        logger.debug("Archive endpoint attempt for (%s, %s) date %s failed: %s", lat, lon, date_str, e)

    # 2. Fallback: api.open-meteo.com/v1/forecast with past_days=7 for recent dates
    fallback_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&past_days=7&forecast_days=1&daily=precipitation_sum&timezone=Asia%2FKolkata"
    )
    try:
        resp = requests.get(fallback_url, timeout=timeout_sec)
        if resp.status_code == 200:
            data = resp.json()
            times = data.get("daily", {}).get("time", [])
            precips = data.get("daily", {}).get("precipitation_sum", [])
            for t, p in zip(times, precips):
                if t == date_str and p is not None:
                    return round(float(p), 2)
    except Exception as e:
        logger.warning("Fallback observed fetch for (%s, %s) date %s failed: %s", lat, lon, date_str, e)

    return None

