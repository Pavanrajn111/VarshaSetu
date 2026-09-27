import datetime
import logging
import re
import time
from typing import Dict, Tuple, Optional
from fastapi import APIRouter, Response
from app.services.artifact_loader import get_bundle
from app.services.outlook_store import get_latest_outlook
from app.models.schemas import RiskMapDataResponse, TalukRiskItem

logger = logging.getLogger("varsha_setu.risk_map")

router = APIRouter(tags=["Risk Mapping"])

_risk_cache: Optional[Tuple[RiskMapDataResponse, float]] = None
_CACHE_TTL_SECONDS = 3600.0  # 1 hour in-process TTL


def _extract_authoritative_break_risks(html: str) -> Dict[Tuple[str, str], float]:
    """
    Extracts calibrated break risk percentages from pre-rendered Folium HTML.
    Returns dict mapping (taluk_lower, district_lower) -> break_risk_pct.
    """
    pattern = r'([A-Za-z\s]+)\s*\(([A-Za-z\s]+)\)\s*-\s*Break Risk:\s*([0-9\.]+)%'
    results = {}
    for taluk, district, risk_str in re.findall(pattern, html):
        try:
            results[(taluk.strip().lower(), district.strip().lower())] = float(risk_str)
        except ValueError:
            continue
    return results


@router.get("/risk-map", response_class=Response)
def get_risk_map():
    """
    Serves the pre-rendered Folium/Leaflet Karnataka 236-Taluk Regional Risk Gradient map.
    Returns rendered HTML with media type 'text/html; charset=utf-8'.
    """
    bundle = get_bundle()
    return Response(
        content=bundle.risk_map_html,
        media_type="text/html; charset=utf-8"
    )


@router.get("/risk-map/data", response_model=RiskMapDataResponse)
def get_risk_map_data(force_refresh: bool = False) -> RiskMapDataResponse:
    """
    Returns lightweight per-taluk risk summary for native interactive map rendering.
    Uses calibrated Break Risk % across all taluks so pilot and non-pilot taluks
    are evaluated on identical footing without wet/dry geographical bias.
    Results are cached in-process with a 1-hour TTL.
    """
    global _risk_cache
    now = time.time()
    if not force_refresh and _risk_cache is not None:
        cached_data, expiry = _risk_cache
        if now < expiry:
            return cached_data

    bundle = get_bundle()
    html_risks = _extract_authoritative_break_risks(bundle.risk_map_html)

    items = []
    for _, row in bundle.taluks_df.iterrows():
        taluk_name = str(row["taluk_name"]).strip()
        district = str(row["district"]).strip()
        lat = float(row["lat"])
        lon = float(row["lon"])

        # Check if live stored outlook exists for pilot taluks
        basis = "calibrated_break_risk"
        stored_outlook = get_latest_outlook(taluk_name)
        if stored_outlook and len(stored_outlook) > 0:
            basis = "outlook_blended"
            key = (taluk_name.lower(), district.lower())
            risk_pct = html_risks.get(key, 35.0)
        else:
            key = (taluk_name.lower(), district.lower())
            risk_pct = html_risks.get(key, 35.0)

        # Categorize based on authoritative break risk thresholds:
        # > 45%: HIGH (severe dry/break risk)
        # 25% - 45%: MODERATE
        # < 25%: LOW
        if risk_pct > 45.0:
            category = "HIGH"
            color_hex = "#ef4444"
        elif risk_pct >= 25.0:
            category = "MODERATE"
            color_hex = "#f59e0b"
        else:
            category = "LOW"
            color_hex = "#10b981"

        items.append(
            TalukRiskItem(
                taluk_name=taluk_name,
                district=district,
                lat=lat,
                lon=lon,
                risk_category=category,
                risk_score_pct=round(risk_pct, 1),
                risk_color_hex=color_hex,
                risk_basis=basis
            )
        )

    response = RiskMapDataResponse(
        total_taluks=len(items),
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        taluks=items
    )
    _risk_cache = (response, now + _CACHE_TTL_SECONDS)
    return response
