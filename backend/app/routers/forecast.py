import asyncio
import datetime
import logging
import time
from fastapi import APIRouter, Request, Response
from app.limiter import limiter
from app.models.schemas import (
    ForecastRequest,
    ForecastResponse,
    LocationProfile,
    TeleconnectionProfile
)
from app.services.location_resolver import find_nearest_taluk, validate_coordinates
from app.services.weather_client import fetch_recent_precipitation
from app.services.teleconnections import get_teleconnections
from app.services.feature_builder import build_feature_vector
from app.services.inference import run_ensemble_inference
from app.services.soil_advisory import get_soil_profile, generate_advisory_text
from app.services.artifact_loader import get_bundle

logger = logging.getLogger("varsha_setu.forecast_router")

router = APIRouter(prefix="/forecast", tags=["Monsoon & Horizon Forecasting"])

@router.post("", response_model=ForecastResponse)
@limiter.limit("60/minute")
async def compute_forecast(request: Request, req: ForecastRequest, response: Response) -> ForecastResponse:
    """
    Computes full 13-target probabilistic monsoon outlook across 4 horizons
    (1–7, 8–14, 15–21, 22–30 days) and 14-day onset arrival probability.

    Ultra-fast execution: Serves planetary teleconnections and precipitation baselines
    from non-blocking cache, executing sub-50ms dual-model ensemble inference.
    """
    t_start = time.perf_counter()
    validate_coordinates(req.lat, req.lon)
    bundle = get_bundle()

    # Determine administrative context
    taluk_name = req.taluk
    district_name = req.district

    if not taluk_name or not district_name:
        nearest_taluk, nearest_dist, _ = await asyncio.to_thread(
            find_nearest_taluk, req.lat, req.lon, bundle.taluks_df
        )
        taluk_name = taluk_name or nearest_taluk
        district_name = district_name or nearest_dist

    loc_title = req.location_name or taluk_name

    # 1. Real Weather & Teleconnections (instant non-blocking cache lookups)
    t_cache_0 = time.perf_counter()
    weather_data = await asyncio.to_thread(fetch_recent_precipitation, req.lat, req.lon, taluk_name)
    tele_data = get_teleconnections()
    t_cache_dur = (time.perf_counter() - t_cache_0) * 1000.0

    # 2. Build 18-Feature Vector
    t_feat_0 = time.perf_counter()
    f_vec = build_feature_vector(weather_data, tele_data)
    t_feat_dur = (time.perf_counter() - t_feat_0) * 1000.0

    # 3. Dual-Model Inference across 13 targets (0.60 XGB + 0.40 RF)
    t_inf_0 = time.perf_counter()
    predictions, horizons, onset_outlook = await asyncio.to_thread(
        run_ensemble_inference, f_vec, district_name
    )
    t_inf_dur = (time.perf_counter() - t_inf_0) * 1000.0

    # 4. Soil Profile & Advisory
    t_adv_0 = time.perf_counter()
    soil_profile = get_soil_profile(district_name)

    w1_break = predictions["target_break_w1"]
    w1_heavy = predictions["target_heavy_w1"]
    w1_active = predictions["target_active_w1"]

    crop_val = req.crop_type.value if req.crop_type else "Finger Millet (Ragi)"
    stage_val = req.crop_stage.value if req.crop_stage else "Sowing & Germination"
    lang_val = req.language.value if req.language else "English"

    advisory_text = await asyncio.to_thread(
        generate_advisory_text,
        district=district_name,
        crop_type=crop_val,
        crop_stage=stage_val,
        language=lang_val,
        t1_break_triggered=bool(w1_break.triggered) if w1_break.triggered is not None else False,
        w1_break_prob=float(w1_break.probability) if w1_break.probability is not None else 0.0,
        t1_heavy_triggered=bool(w1_heavy.triggered) if w1_heavy.triggered is not None else False,
        w1_heavy_prob=float(w1_heavy.probability) if w1_heavy.probability is not None else 0.0,
        w1_active_prob=float(w1_active.probability) if w1_active.probability is not None else 0.0
    )
    t_adv_dur = (time.perf_counter() - t_adv_0) * 1000.0

    location_profile = LocationProfile(
        spatial_node=req.scale_tag or "Spatial Coordinate Node",
        title=loc_title,
        taluk=taluk_name,
        district=district_name,
        lat=req.lat,
        lon=req.lon
    )

    tele_profile = TeleconnectionProfile(
        oni=tele_data["oni"],
        dmi=tele_data["dmi"],
        mjo_amp=tele_data["mjo_amp"],
        mjo_phase=tele_data["mjo_phase"],
        is_el_nino=tele_data["is_el_nino"],
        is_pos_iod=tele_data["is_pos_iod"]
    )

    t_total_dur = (time.perf_counter() - t_start) * 1000.0

    logger.info(
        "[PERF] /forecast taluk='%s' forecast_total_ms=%.2f (cache_lookup_ms=%.2f, feature_generation_ms=%.2f, ml_inference_ms=%.2f, advisory_ms=%.2f)",
        taluk_name, t_total_dur, t_cache_dur, t_feat_dur, t_inf_dur, t_adv_dur
    )

    response.headers["Server-Timing"] = (
        f"cache;dur={t_cache_dur:.1f}, feat;dur={t_feat_dur:.1f}, ml;dur={t_inf_dur:.1f}, "
        f"adv;dur={t_adv_dur:.1f}, total;dur={t_total_dur:.1f}"
    )

    return ForecastResponse(
        location=location_profile,
        soil=soil_profile,
        teleconnections=tele_profile,
        onset=onset_outlook,
        horizons=horizons,
        targets=predictions,
        advisory_text=advisory_text,
        crop_type=crop_val,
        crop_stage=stage_val,
        language=lang_val,
        weather_data_source=weather_data.get("data_source", "open_meteo_live"),
        weather_fallback_warning=weather_data.get("fallback_warning"),
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )

