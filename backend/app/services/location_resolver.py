import logging
import time
import urllib.parse
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
import pandas as pd
import requests
from fastapi import HTTPException

from app.config import (
    KARNATAKA_LAT_MIN,
    KARNATAKA_LAT_MAX,
    KARNATAKA_LON_MIN,
    KARNATAKA_LON_MAX,
    NOMINATIM_TIMEOUT_SECONDS,
    NOMINATIM_MAX_DISTANCE_KM,
    LOCATION_CACHE_TTL,
    OSM_USER_AGENT
)
from app.models.schemas import CandidateLocation, LocationResolveResponse
from app.services.artifact_loader import get_bundle

logger = logging.getLogger("varsha_setu.location_resolver")

# In-memory TTL cache: query_lower -> (LocationResolveResponse, expiry_timestamp)
_location_cache: Dict[str, Tuple[LocationResolveResponse, float]] = {}

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two geographic coordinates in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)

    a = np.sin(delta_phi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return float(R * c)

def validate_coordinates(lat: float, lon: float) -> None:
    """Raises HTTPException 400 if coordinates fall outside the Karnataka bounding box."""
    if not (KARNATAKA_LAT_MIN <= lat <= KARNATAKA_LAT_MAX and KARNATAKA_LON_MIN <= lon <= KARNATAKA_LON_MAX):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Coordinates ({lat:.4f}°N, {lon:.4f}°E) fall outside Karnataka boundaries "
                f"({KARNATAKA_LAT_MIN}-{KARNATAKA_LAT_MAX}°N, {KARNATAKA_LON_MIN}-{KARNATAKA_LON_MAX}°E)."
            )
        )

def find_nearest_taluk(lat: float, lon: float, taluks_df: pd.DataFrame) -> Tuple[str, str, float]:
    """
    Finds the nearest verified taluk node to the given coordinates.
    Returns (taluk_name, district, distance_km).
    """
    taluk_lats = taluks_df['lat'].astype(float).values
    taluk_lons = taluks_df['lon'].astype(float).values

    # Vectorized haversine computation
    R = 6371.0
    p1 = np.radians(lat)
    p2 = np.radians(taluk_lats)
    dp = np.radians(taluk_lats - lat)
    dl = np.radians(taluk_lons - lon)

    a = np.sin(dp / 2.0)**2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    distances_km = R * c

    min_idx = int(np.argmin(distances_km))
    min_dist = float(distances_km[min_idx])
    row = taluks_df.iloc[min_idx]
    return str(row['taluk_name']), str(row['district']), min_dist

def get_admin_hierarchy() -> Dict[str, Any]:
    """Returns districts and their associated taluks from karnataka_taluks_verified.csv."""
    bundle = get_bundle()
    df = bundle.taluks_df
    
    districts_list = []
    for dist_name in sorted(df['district'].unique()):
        sub_df = df[df['district'] == dist_name].sort_values('taluk_name')
        taluks = [
            {
                "taluk_name": str(r['taluk_name']),
                "lat": float(r['lat']),
                "lon": float(r['lon'])
            }
            for _, r in sub_df.iterrows()
        ]
        districts_list.append({"district": str(dist_name), "taluks": taluks})

    return {
        "total_taluks": len(df),
        "districts": districts_list
    }

def resolve_location_query(query: str, force_refresh: bool = False) -> LocationResolveResponse:
    """
    Three-tier location resolution with in-memory TTL caching and distance cap:
    1. In-memory cache check (10 min TTL).
    2. Offline village master exact/token match (returning all matches if ambiguous).
    3. Verified taluk exact match.
    4. Live OSM Nominatim fallback with Karnataka bounding box validation AND
       sanity distance cap (< 60 km from nearest verified taluk).
    """
    clean_q = query.strip()
    if not clean_q:
        raise HTTPException(status_code=400, detail="Location query cannot be empty.")

    q_lower = clean_q.lower()
    now = time.time()

    # Cache check
    if not force_refresh and q_lower in _location_cache:
        cached_resp, expiry = _location_cache[q_lower]
        if now < expiry:
            logger.debug("Returning cached location resolution for query: %s", clean_q)
            return cached_resp

    bundle = get_bundle()
    taluks_df = bundle.taluks_df
    villages_df = bundle.villages_df

    # Tier 1: Check Offline Villages Master
    if len(villages_df) > 0 and 'name' in villages_df.columns:
        exact_matches = villages_df[villages_df['name'].astype(str).str.lower() == q_lower]
        if len(exact_matches) > 1:
            candidates = [
                CandidateLocation(
                    name=str(r['name']),
                    label=str(r['label']),
                    taluk=str(r['taluk']),
                    district=str(r['district']),
                    lat=float(r['lat']),
                    lon=float(r['lon'])
                )
                for _, r in exact_matches.iterrows()
            ]
            resp = LocationResolveResponse(
                status="disambiguation_required",
                query=clean_q,
                disambiguation_required=True,
                scale_tag="Village Cluster (Disambiguation Required)",
                candidates=candidates,
                message=f"Multiple ({len(candidates)}) village entries found for '{clean_q}'. Please choose one."
            )
            _location_cache[q_lower] = (resp, now + LOCATION_CACHE_TTL)
            return resp

        elif len(exact_matches) == 1:
            r = exact_matches.iloc[0]
            cand = CandidateLocation(
                name=str(r['name']),
                label=str(r['label']),
                taluk=str(r['taluk']),
                district=str(r['district']),
                lat=float(r['lat']),
                lon=float(r['lon'])
            )
            resp = LocationResolveResponse(
                status="success",
                query=clean_q,
                disambiguation_required=False,
                scale_tag="Village Cluster (Offline Verified)",
                selected=cand,
                candidates=[cand]
            )
            _location_cache[q_lower] = (resp, now + LOCATION_CACHE_TTL)
            return resp

    # Tier 2: Check Verified Taluks
    taluk_match = taluks_df[taluks_df['taluk_name'].astype(str).str.lower() == q_lower]
    if len(taluk_match) > 0:
        r = taluk_match.iloc[0]
        cand = CandidateLocation(
            name=str(r['taluk_name']),
            label=f"{r['taluk_name']} Taluk Headquarter",
            taluk=str(r['taluk_name']),
            district=str(r['district']),
            lat=float(r['lat']),
            lon=float(r['lon'])
        )
        resp = LocationResolveResponse(
            status="success",
            query=clean_q,
            disambiguation_required=False,
            scale_tag="Administrative Taluk Node",
            selected=cand,
            candidates=[cand]
        )
        _location_cache[q_lower] = (resp, now + LOCATION_CACHE_TTL)
        return resp

    # Tier 3: Live OSM Nominatim Fallback
    logger.info("Query '%s' not found offline. Attempting live OSM Nominatim geocoding...", clean_q)
    enc_query = urllib.parse.quote(f"{clean_q}, Karnataka, India")
    url = f"https://nominatim.openstreetmap.org/search?q={enc_query}&format=json&limit=3"
    headers = {"User-Agent": OSM_USER_AGENT}

    try:
        osm_resp = requests.get(url, headers=headers, timeout=NOMINATIM_TIMEOUT_SECONDS)
        if osm_resp.status_code == 200:
            results = osm_resp.json()
            valid_results = []
            for item in results:
                try:
                    c_lat = float(item["lat"])
                    c_lon = float(item["lon"])
                    if KARNATAKA_LAT_MIN <= c_lat <= KARNATAKA_LAT_MAX and KARNATAKA_LON_MIN <= c_lon <= KARNATAKA_LON_MAX:
                        p_taluk, p_dist, dist_km = find_nearest_taluk(c_lat, c_lon, taluks_df)
                        # Sanity distance cap: verify that the geocoded point is within 60km of a known taluk
                        if dist_km > NOMINATIM_MAX_DISTANCE_KM:
                            logger.warning(
                                "Nominatim result for '%s' at (%.3f, %.3f) is %.1f km from nearest taluk '%s' (exceeds %.0f km cap). Discarding.",
                                clean_q, c_lat, c_lon, dist_km, p_taluk, NOMINATIM_MAX_DISTANCE_KM
                            )
                            continue

                        display_name = item.get("display_name", clean_q)
                        valid_results.append(
                            CandidateLocation(
                                name=clean_q,
                                label=display_name.split(",")[0] or clean_q.title(),
                                taluk=p_taluk,
                                district=p_dist,
                                lat=c_lat,
                                lon=c_lon
                            )
                        )
                except (ValueError, KeyError):
                    continue

            if valid_results:
                if len(valid_results) == 1:
                    resp = LocationResolveResponse(
                        status="success",
                        query=clean_q,
                        disambiguation_required=False,
                        scale_tag="Hyperlocal Village (Live Geocoded OSM)",
                        selected=valid_results[0],
                        candidates=valid_results
                    )
                else:
                    resp = LocationResolveResponse(
                        status="disambiguation_required",
                        query=clean_q,
                        disambiguation_required=True,
                        scale_tag="Live Geocoded OSM (Multiple Candidates)",
                        selected=valid_results[0],
                        candidates=valid_results,
                        message=f"Found {len(valid_results)} candidates via OpenStreetMap."
                    )
                _location_cache[q_lower] = (resp, now + LOCATION_CACHE_TTL)
                return resp
            else:
                if results:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Location '{clean_q}' was located but could not be confidently verified within Karnataka's "
                            f"agricultural boundaries (either outside state bounding box or > {NOMINATIM_MAX_DISTANCE_KM:.0f} km from any official taluk)."
                        )
                    )
    except requests.RequestException as e:
        logger.warning("OSM Nominatim request failed: %s", e)

    raise HTTPException(
        status_code=404,
        detail=f"Location '{clean_q}' could not be resolved in Karnataka offline databases or live geocoding."
    )


def reverse_geocode_coordinates(lat: float, lon: float) -> LocationResolveResponse:
    """
    Finds the nearest known taluk or village to the given coordinates
    using vectorized Haversine distance across taluks_df and villages_df combined.
    Enforces NOMINATIM_MAX_DISTANCE_KM sanity cap (60 km).
    """
    validate_coordinates(lat, lon)

    bundle = get_bundle()
    taluks_df = bundle.taluks_df
    villages_df = bundle.villages_df

    # 1. Search nearest taluk
    taluk_name, taluk_dist_district, taluk_dist = find_nearest_taluk(lat, lon, taluks_df)

    nearest_is_village = False
    best_name = taluk_name
    best_district = taluk_dist_district
    best_taluk = taluk_name
    best_dist = taluk_dist
    best_lat = lat
    best_lon = lon

    # Look up authoritative taluk coordinates
    t_rows = taluks_df[taluks_df['taluk_name'].str.lower() == taluk_name.lower()]
    if not t_rows.empty:
        best_lat = float(t_rows.iloc[0]['lat'])
        best_lon = float(t_rows.iloc[0]['lon'])

    # 2. Search nearest village
    if villages_df is not None and not villages_df.empty and 'lat' in villages_df.columns and 'lon' in villages_df.columns:
        v_lats = villages_df['lat'].astype(float).values
        v_lons = villages_df['lon'].astype(float).values
        R = 6371.0
        p1 = np.radians(lat)
        p2 = np.radians(v_lats)
        dp = np.radians(v_lats - lat)
        dl = np.radians(v_lons - lon)
        a = np.sin(dp / 2.0)**2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2.0)**2
        c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
        v_distances = R * c
        v_min_idx = int(np.argmin(v_distances))
        v_min_dist = float(v_distances[v_min_idx])

        if v_min_dist < best_dist:
            v_row = villages_df.iloc[v_min_idx]
            best_name = str(v_row['name'])
            best_district = str(v_row['district'])
            best_taluk = str(v_row['taluk'])
            best_dist = v_min_dist
            best_lat = float(v_row['lat'])
            best_lon = float(v_row['lon'])
            nearest_is_village = True

    # 3. Check distance sanity cap (60km)
    if best_dist > NOMINATIM_MAX_DISTANCE_KM:
        return LocationResolveResponse(
            status="not_found",
            query=f"{lat:.4f},{lon:.4f}",
            disambiguation_required=False,
            scale_tag="out_of_bounds",
            selected=None,
            candidates=[],
            message=(
                f"Coordinates ({lat:.4f}°N, {lon:.4f}°E) are {best_dist:.1f} km from closest known node "
                f"({best_name}), exceeding the {NOMINATIM_MAX_DISTANCE_KM:.0f} km sanity distance cap."
            )
        )

    scale_tag = "village" if nearest_is_village else "taluk"
    label = (
        f"{best_name} ({best_taluk}, {best_district})"
        if nearest_is_village
        else f"{best_name} Taluk, {best_district}"
    )

    candidate = CandidateLocation(
        name=best_name,
        label=label,
        taluk=best_taluk,
        district=best_district,
        lat=round(best_lat, 4),
        lon=round(best_lon, 4)
    )

    return LocationResolveResponse(
        status="success",
        query=f"{lat:.4f},{lon:.4f}",
        disambiguation_required=False,
        scale_tag=scale_tag,
        selected=candidate,
        candidates=[candidate],
        message=f"Resolved to nearest {scale_tag}: {best_name} ({best_dist:.1f} km away)"
    )

