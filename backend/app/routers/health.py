import datetime
from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.services.artifact_loader import get_bundle

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """
    Health check endpoint verifying application status and detailed artifact metadata.
    Reports taluk coverage count, feature column schema, threshold storage format,
    and verified CHIRPS spatial baseline.
    """
    bundle = get_bundle()
    taluks_count = bundle.verified_taluks_count
    villages_count = bundle.offline_villages_count
    targets_count = bundle.model_targets_count
    feature_cols = bundle.feature_columns
    thresholds_format = getattr(bundle, "threshold_format_detected", "flat_float")
    model_targets = getattr(bundle, "model_targets", list(bundle.models.keys()))

    coverage_desc = (
        f"Calibrated on real daily CHIRPS rainfall (2015-2024) across all {taluks_count} official Karnataka taluks. "
        f"Dual-model ensemble (0.60 XGB + 0.40 RF) across {targets_count} forward targets with {thresholds_format} cutoffs."
    )

    return HealthResponse(
        status="ok",
        artifacts_loaded=True,
        verified_taluks_count=taluks_count,
        offline_villages_count=villages_count,
        model_targets_count=targets_count,
        feature_columns_count=len(feature_cols),
        feature_columns=feature_cols,
        thresholds_format=thresholds_format,
        model_targets=model_targets,
        dataset_coverage=coverage_desc,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
