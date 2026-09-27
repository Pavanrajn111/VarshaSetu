import asyncio
from fastapi import APIRouter, Query, Request
from app.limiter import limiter
from app.models.schemas import DistrictHierarchyResponse, LocationResolveResponse
from app.services.location_resolver import get_admin_hierarchy, resolve_location_query

router = APIRouter(prefix="/location", tags=["Location Resolution"])

@router.get("/taluks", response_model=DistrictHierarchyResponse)
def get_taluk_hierarchy() -> DistrictHierarchyResponse:
    """
    Returns administrative hierarchy dropdown data (all 31 districts and their verified taluks)
    sourced from karnataka_taluks_verified.csv.
    """
    data = get_admin_hierarchy()
    return DistrictHierarchyResponse(**data)

@router.get("/resolve", response_model=LocationResolveResponse)
@limiter.limit("30/minute")
async def resolve_location(
    request: Request,
    query: str = Query(..., min_length=2, description="Village, Gram Panchayat, Hobli, or Taluk name in Karnataka")
) -> LocationResolveResponse:
    """
    Three-tier location resolution:
    1. Offline village master exact match (returns all candidates if multiple entries exist).
    2. Verified administrative taluks table match.
    3. Live OSM Nominatim fallback with strict Karnataka bounding-box validation.
    Protected by rate limiting (30/min) and executes asynchronously in worker threadpool.
    """
    return await asyncio.to_thread(resolve_location_query, query)
