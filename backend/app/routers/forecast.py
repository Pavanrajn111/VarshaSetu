import asyncio
import datetime
import logging
from fastapi import APIRouter, Request
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
@limiter.limit("20/minute")
async def compute_forecast(request: Request, req: ForecastRequest) -> ForecastResponse:
    """
    Computes full 13-target probabilistic monsoon outlook across 4 horizons
    (1–7, 8–14, 15–21, 22–30 days) and 14-day onset arrival probability.

    Incorporates real Open-Meteo precipitation, planetary teleconnections (ENSO/IOD/MJO),
    and generates soil-aware agronomic advisory text.
    Non-blocking async execution offloads heavy calculations and external requests.
    """
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

    # 1. Real Weather & Teleconnections (async non-blocking threads)
    weather_data = await asyncio.to_thread(fetch_recent_precipitation, req.lat, req.lon, taluk_name)
    tele_data = await asyncio.to_thread(get_teleconnections)

    # 2. Build 18-Feature Vector (with strict order assertion)
    f_vec = build_feature_vector(weather_data, tele_data)

    # 3. Dual-Model Inference across 13 targets (non-blocking thread)
    predictions, horizons, onset_outlook = await asyncio.to_thread(
        run_ensemble_inference, f_vec, district_name
    )

    # 4. Soil Profile & Advisory
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
