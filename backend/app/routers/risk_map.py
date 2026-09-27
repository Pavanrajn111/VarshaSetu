from fastapi import APIRouter, Response
from app.services.artifact_loader import get_bundle

router = APIRouter(tags=["Risk Mapping"])

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
