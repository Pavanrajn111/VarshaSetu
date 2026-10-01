import datetime
import logging
import re
import time
from typing import Dict, Tuple, Optional
from fastapi import APIRouter, Response
import numpy as np
from scipy.spatial import cKDTree

from app.config import (
    KARNATAKA_LAT_MIN,
    KARNATAKA_LAT_MAX,
    KARNATAKA_LON_MIN,
    KARNATAKA_LON_MAX,
)
from app.services.artifact_loader import get_bundle
from app.services.outlook_store import get_latest_outlook
from app.models.schemas import (
    RiskMapDataResponse,
    TalukRiskItem,
    RiskGridCell,
    RiskGridBounds,
    RiskMapGridResponse,
)

logger = logging.getLogger("varsha_setu.risk_map")

router = APIRouter(tags=["Risk Mapping"])

_risk_cache: Optional[Tuple[RiskMapDataResponse, float]] = None
_CACHE_TTL_SECONDS = 3600.0  # 1 hour in-process TTL

_grid_cache: Optional[Tuple[RiskMapGridResponse, float]] = None
_GRID_CACHE_TTL_SECONDS = 3600.0  # 1 hour in-process TTL
GRID_STEP_DEG = 0.05
MAX_NEAREST_TALUK_DIST_DEG = 0.38  # ~42 km mask to retain Karnataka geographic outline


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

    # Quick single-query batch lookup of taluks having stored outlooks
    try:
        from app.services.outlook_store import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT LOWER(taluk_name) FROM outlook_predictions")
            active_outlooks = {r[0] for r in cur.fetchall()}
    except Exception:
        active_outlooks = set()

    items = []
    for _, row in bundle.taluks_df.iterrows():
        taluk_name = str(row["taluk_name"]).strip()
        district = str(row["district"]).strip()
        lat = float(row["lat"])
        lon = float(row["lon"])

        basis = "outlook_blended" if taluk_name.lower() in active_outlooks else "calibrated_break_risk"
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


def generate_interpolated_grid(force_refresh: bool = False) -> RiskMapGridResponse:
    """
    Generates a regular lat/lon grid over Karnataka interpolated via Inverse Distance Weighting (IDW).
    Spatially estimated from authoritative taluk predictions.
    Prunes points farther than MAX_NEAREST_TALUK_DIST_DEG from any taluk to hug Karnataka's state boundary.
    """
    taluk_data = get_risk_map_data(force_refresh=force_refresh)
    taluks = taluk_data.taluks

    if not taluks:
        return RiskMapGridResponse(
            total_cells=0,
            resolution_deg=GRID_STEP_DEG,
            bounds=RiskGridBounds(
                lat_min=float(KARNATAKA_LAT_MIN),
                lat_max=float(KARNATAKA_LAT_MAX),
                lon_min=float(KARNATAKA_LON_MIN),
                lon_max=float(KARNATAKA_LON_MAX),
                step=GRID_STEP_DEG,
            ),
            generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            disclaimer="Statewide risk surface interpolated from model predictions at 236 taluk centers; areas between points are estimated, not independently modeled.",
            cells=[],
        )

    taluk_lats = np.array([t.lat for t in taluks], dtype=np.float64)
    taluk_lons = np.array([t.lon for t in taluks], dtype=np.float64)
    taluk_risks = np.array([t.risk_score_pct for t in taluks], dtype=np.float64)

    taluk_coords = np.column_stack([taluk_lats, taluk_lons])
    tree = cKDTree(taluk_coords)

    lats = np.arange(KARNATAKA_LAT_MIN, KARNATAKA_LAT_MAX + GRID_STEP_DEG / 2, GRID_STEP_DEG)
    lons = np.arange(KARNATAKA_LON_MIN, KARNATAKA_LON_MAX + GRID_STEP_DEG / 2, GRID_STEP_DEG)
    grid_lat, grid_lon = np.meshgrid(lats, lons, indexing="ij")

    flat_lats = grid_lat.ravel()
    flat_lons = grid_lon.ravel()
    coords_grid = np.column_stack([flat_lats, flat_lons])

    # Query 8 nearest neighbors
    dists, idxs = tree.query(coords_grid, k=min(8, len(taluks)))

    # Boundary mask: only include points within MAX_NEAREST_TALUK_DIST_DEG of verified taluk centers
    mask = dists[:, 0] <= MAX_NEAREST_TALUK_DIST_DEG
    sub_lats = flat_lats[mask]
    sub_lons = flat_lons[mask]
    sub_dists = dists[mask]
    sub_idxs = idxs[mask]

    # Inverse Distance Weighting: w = 1 / (d^2)
    weights = 1.0 / np.maximum(sub_dists, 1e-4) ** 2
    norm_weights = weights / weights.sum(axis=1, keepdims=True)
    interp_risks = np.sum(norm_weights * taluk_risks[sub_idxs], axis=1)

    cells = []
    for lat, lon, risk in zip(sub_lats, sub_lons, interp_risks):
        risk_val = float(round(risk, 1))
        # Discrete color bands matching reference flood-hazard map:
        # Very High: #e63329 (red, >= 48%)
        # High:      #f5a623 (orange, 35% - 47.9%)
        # Medium:    #a8c85a (light green, 20% - 34.9%)
        # Low:       #2d6a2d (dark green, < 20%)
        if risk_val >= 48.0:
            category = "VERY_HIGH"
            color_hex = "#e63329"
        elif risk_val >= 35.0:
            category = "HIGH"
            color_hex = "#f5a623"
        elif risk_val >= 20.0:
            category = "MEDIUM"
            color_hex = "#a8c85a"
        else:
            category = "LOW"
            color_hex = "#2d6a2d"

        cells.append(
            RiskGridCell(
                lat=float(round(lat, 4)),
                lon=float(round(lon, 4)),
                risk_category=category,
                risk_score_pct=risk_val,
                color_hex=color_hex,
            )
        )

    return RiskMapGridResponse(
        total_cells=len(cells),
        resolution_deg=GRID_STEP_DEG,
        bounds=RiskGridBounds(
            lat_min=float(KARNATAKA_LAT_MIN),
            lat_max=float(KARNATAKA_LAT_MAX),
            lon_min=float(KARNATAKA_LON_MIN),
            lon_max=float(KARNATAKA_LON_MAX),
            step=GRID_STEP_DEG,
        ),
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        disclaimer="Statewide risk surface interpolated from model predictions at 236 taluk centers; areas between points are estimated, not independently modeled.",
        cells=cells,
    )


@router.get("/risk-map/grid", response_model=RiskMapGridResponse)
def get_risk_map_grid(force_refresh: bool = False) -> RiskMapGridResponse:
    """
    Returns server-interpolated regular lat/lon risk grid (0.05° resolution)
    covering Karnataka using Inverse Distance Weighting (IDW) from authoritative taluk model outputs.
    Results are cached in-memory with a 1-hour TTL.
    """
    global _grid_cache
    now = time.time()
    if not force_refresh and _grid_cache is not None:
        cached_grid, expiry = _grid_cache
        if now < expiry:
            return cached_grid

    grid_response = generate_interpolated_grid(force_refresh=force_refresh)
    _grid_cache = (grid_response, now + _GRID_CACHE_TTL_SECONDS)
    return grid_response
