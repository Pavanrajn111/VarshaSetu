import datetime
import logging
import os
from typing import Dict, Any, List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.artifact_loader import get_bundle
from app.services.outlook_fetcher import fetch_multi_source_forecast, fetch_observed_rainfall
from app.services.outlook_blender import blend_outlook_for_taluk
from app.services.outlook_store import save_outlook_records, get_unbackfilled_records, update_actual_precip

logger = logging.getLogger("varsha_setu.scheduler")

# Default pilot set representing diverse agro-climatic zones across Karnataka
# (Coastal, Malnad, North Dry, Central/South Dry, High Rainfall)
DEFAULT_PILOT_TALUKS = [
    "Sirsi",            # Malnad / Western Ghats (Uttara Kannada)
    "Belagavi",         # Northern Transition Zone
    "Ballari",          # North-Eastern Dry Zone
    "Mysuru",           # Southern Dry Zone
    "Kalaburagi",       # North-Eastern Transition Zone
    "Shivamogga",       # Central Wet / Malnad
    "Mangaluru",        # Coastal Zone (Dakshina Kannada)
    "Bengaluru South"   # Eastern Dry / Urban fringe
]

_scheduler: Optional[BackgroundScheduler] = None

def get_target_taluks(taluk_subset: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Resolves the list of taluks to process based on configuration or explicit subset.
    Defaulting to the 8-taluk pilot avoids excessive rate-limit pressure on Open-Meteo.
    """
    bundle = get_bundle()
    df = bundle.taluks_df

    if taluk_subset:
        subset_lower = [t.strip().lower() for t in taluk_subset]
        matched = df[df["taluk_name"].str.strip().str.lower().isin(subset_lower)]
        return matched.to_dict(orient="records")

    config_mode = os.getenv("OUTLOOK_TALUKS", "pilot").strip().lower()
    if config_mode == "all":
        logger.info("OUTLOOK_TALUKS='all': Targeting all %d official Karnataka taluks.", len(df))
        return df.to_dict(orient="records")

    # Otherwise pilot list
    pilot_lower = [t.lower() for t in DEFAULT_PILOT_TALUKS]
    matched = df[df["taluk_name"].str.strip().str.lower().isin(pilot_lower)]
    if len(matched) == 0:
        # Fallback to first 8 taluks if names differ slightly
        matched = df.head(8)
    logger.info("Targeting pilot subset of %d taluks (OUTLOOK_TALUKS='%s').", len(matched), config_mode)
    return matched.to_dict(orient="records")

def run_outlook_pipeline(taluk_subset: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Executes the full 7-30 day multi-source precipitation outlook pipeline:
      1. Fetches GFS, ICON, and ECMWF 16-day forecasts from Open-Meteo.
      2. Blends 70% external mean with 30% historical DOY climatology for Weeks 1-2.
      3. Uses 100% climatology for Weeks 3-4 (Open-Meteo 16-day limit fallback).
      4. Computes multi-agency source agreement (HIGH / MODERATE / LOW).
      5. Persists time-stamped prediction rows into SQLite outlook_log.db.

    Robust: Individual taluk failures are logged and do not abort the remaining batch.
    """
    start_time = datetime.datetime.now(datetime.timezone.utc)
    run_timestamp = start_time.isoformat()

    logger.info("=== Starting 7-30 Day Multi-Source Outlook Pipeline [Run: %s] ===", run_timestamp)

    target_taluks = get_target_taluks(taluk_subset)
    succeeded = 0
    failed = 0

    for item in target_taluks:
        taluk_name = item["taluk_name"]
        district = item["district"]
        lat = float(item["lat"])
        lon = float(item["lon"])

        try:
            logger.info("Processing outlook for %s (%s, %.3f, %.3f)...", taluk_name, district, lat, lon)
            # Step 1: Multi-source fetch
            multi_source_data = fetch_multi_source_forecast(lat, lon)

            # Step 2: Blending & Weeks 3-4 Climatology fallback
            records = blend_outlook_for_taluk(
                taluk_name=taluk_name,
                district=district,
                multi_source_daily=multi_source_data,
                start_date=datetime.date.today(),
                total_days=30
            )

            # Step 3: Persistent storage
            save_outlook_records(records, run_timestamp=run_timestamp)
            succeeded += 1
        except Exception as e:
            failed += 1
            logger.error("Failed outlook pipeline for %s: %s", taluk_name, e, exc_info=True)

    end_time = datetime.datetime.now(datetime.timezone.utc)
    duration_sec = round((end_time - start_time).total_seconds(), 2)

    logger.info(
        "=== Finished Outlook Pipeline: %d succeeded, %d failed in %.2fs ===",
        succeeded, failed, duration_sec
    )

    return {
        "run_timestamp": run_timestamp,
        "taluks_attempted": len(target_taluks),
        "succeeded": succeeded,
        "failed": failed,
        "duration_seconds": duration_sec
    }

def run_rainfall_backfill_pipeline(target_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Backfills real observed precipitation for past prediction dates using Open-Meteo historical/archive data.
    Scheduled daily at 01:00 AM (after previous day's rainfall observations are recorded).
    """
    bundle = get_bundle()
    df = bundle.taluks_df

    if not target_date:
        # Default to yesterday
        target_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    unbackfilled = get_unbackfilled_records(max_date=target_date)
    if not unbackfilled:
        logger.info("No unbackfilled outlook predictions found on or before %s", target_date)
        return {"status": "noop", "unbackfilled_count": 0, "target_date": target_date}

    logger.info("Starting historical rainfall backfill for %d records on or before %s", len(unbackfilled), target_date)

    updated_count = 0
    failed_count = 0

    for rec in unbackfilled:
        taluk_name = rec["taluk_name"]
        date_str = rec["forecast_date"]

        # Find coordinates
        t_row = df[df["taluk_name"].str.strip().str.lower() == taluk_name.strip().lower()]
        if t_row.empty:
            continue
        lat = float(t_row.iloc[0]["lat"])
        lon = float(t_row.iloc[0]["lon"])

        try:
            observed_mm = fetch_observed_rainfall(lat, lon, date_str)
            if observed_mm is not None:
                update_actual_precip(taluk_name, date_str, observed_mm)
                updated_count += 1
            else:
                failed_count += 1
        except Exception as e:
            logger.warning("Failed backfill for %s on %s: %s", taluk_name, date_str, e)
            failed_count += 1

    return {
        "status": "completed",
        "target_date": target_date,
        "total_attempted": len(unbackfilled),
        "updated": updated_count,
        "failed_or_pending": failed_count
    }

def get_scheduler() -> BackgroundScheduler:
    """Returns or creates the global BackgroundScheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
        # Cron trigger 1: 00:00 (Midnight daily)
        _scheduler.add_job(
            run_outlook_pipeline,
            trigger=CronTrigger(hour=0, minute=0, timezone="Asia/Kolkata"),
            id="outlook_midnight_run",
            replace_existing=True,
            name="Daily Midnight Multi-Source Outlook Pipeline"
        )
        # Cron trigger 2: 12:00 (Noon daily)
        _scheduler.add_job(
            run_outlook_pipeline,
            trigger=CronTrigger(hour=12, minute=0, timezone="Asia/Kolkata"),
            id="outlook_noon_run",
            replace_existing=True,
            name="Daily Noon Multi-Source Outlook Pipeline"
        )
        # Cron trigger 3: 01:00 AM (Daily historical rainfall backfill)
        _scheduler.add_job(
            run_rainfall_backfill_pipeline,
            trigger=CronTrigger(hour=1, minute=0, timezone="Asia/Kolkata"),
            id="rainfall_backfill_01am_run",
            replace_existing=True,
            name="Daily 01:00 AM Historical Rainfall Backfill"
        )
    return _scheduler

def start_scheduler():
    """Starts the APScheduler background daemon."""
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info(
            "APScheduler started with 3 daily cron triggers: 00:00, 01:00 (backfill) & 12:00 Asia/Kolkata."
        )

def shutdown_scheduler():
    """Gracefully shuts down the background scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler gracefully shut down.")
        _scheduler = None
