from fastapi import APIRouter
from app.models.schemas import AdvisoryRequest, AdvisoryResponse
from app.services.soil_advisory import get_soil_info, generate_advisory_text

router = APIRouter(prefix="/advisory", tags=["Soil & Crop Advisory"])

@router.post("", response_model=AdvisoryResponse)
def compute_advisory(req: AdvisoryRequest) -> AdvisoryResponse:
    """
    Computes standalone crop- and soil-aware agronomic advisory text (in English, Kannada, or Hindi)
    based on Week 1 break or heavy-rain hazard triggers.
    """
    soil_info = get_soil_info(req.district)

    advisory_text = generate_advisory_text(
        district=req.district,
        crop_type=req.crop_type.value,
        crop_stage=req.crop_stage.value,
        language=req.language.value,
        t1_break_triggered=req.t1_break_triggered,
        w1_break_prob=req.t1_break_prob,
        t1_heavy_triggered=req.t1_heavy_triggered,
        w1_heavy_prob=req.t1_heavy_prob,
        w1_active_prob=req.t1_active_prob
    )

    return AdvisoryResponse(
        crop_type=req.crop_type.value,
        crop_stage=req.crop_stage.value,
        district=req.district,
        soil_type=str(soil_info["type"]),
        language=req.language.value,
        advisory_text=advisory_text
    )
