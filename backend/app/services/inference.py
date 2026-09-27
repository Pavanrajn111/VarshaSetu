import logging
from typing import Dict, Any, Tuple
import pandas as pd
from app.models.schemas import TargetPrediction, HorizonForecast, OnsetOutlook
from app.services.artifact_loader import get_bundle

logger = logging.getLogger("varsha_setu.inference")

TARGET_KEYS = [
    "target_onset_next14d",
    "target_break_w1", "target_active_w1", "target_heavy_w1",
    "target_break_w2", "target_active_w2", "target_heavy_w2",
    "target_break_w3", "target_active_w3", "target_heavy_w3",
    "target_break_w4", "target_active_w4", "target_heavy_w4"
]

HORIZON_LABELS = {
    1: "Week 1 (1–7 Days)",
    2: "Week 2 (8–14 Days)",
    3: "Week 3 (15–21 Days)",
    4: "Week 4 (22–30 Days)"
}

def run_ensemble_inference(f_vec: pd.DataFrame, district: str = "") -> Tuple[Dict[str, TargetPrediction], Dict[str, HorizonForecast], OnsetOutlook]:
    """
    Executes the dual-model ensemble (0.60 * Calibrated XGBoost + 0.40 * Random Forest)
    across all 13 targets, applying the calibrated threshold from optimal_thresholds.pkl.
    """
    bundle = get_bundle()
    models = bundle.models
    thresholds = bundle.optimal_thresholds

    predictions: Dict[str, TargetPrediction] = {}

    for tgt in TARGET_KEYS:
        try:
            if tgt not in models:
                raise KeyError(f"Target '{tgt}' missing from loaded model bundle.")

            m = models[tgt]
            xgb_model = m["xgb"]
            rf_model = m["rf"]

            # Dual-model probability prediction
            prob_xgb = float(xgb_model.predict_proba(f_vec)[0][1])
            prob_rf = float(rf_model.predict_proba(f_vec)[0][1])
            prob = float(0.60 * prob_xgb + 0.40 * prob_rf)

            # Calibrated threshold cutoff
            cutoff = float(thresholds.get(tgt, 0.45))
            triggered = bool(prob >= cutoff)
            badge = "⚠️ ALERT" if triggered else "✔️ Normal"

            predictions[tgt] = TargetPrediction(
                target=tgt,
                probability=round(prob, 4),
                cutoff=round(cutoff, 4),
                threshold=round(cutoff, 4),
                triggered=triggered,
                badge=badge,
                error=None
            )
        except Exception as e:
            logger.error("Target inference failed for '%s': %s", tgt, e, exc_info=True)
            predictions[tgt] = TargetPrediction(
                target=tgt,
                probability=None,
                cutoff=None,
                threshold=None,
                triggered=None,
                badge=None,
                error="model_unavailable"
            )

    # Build 4 Weekly Horizons
    horizons: Dict[str, HorizonForecast] = {}
    for w in range(1, 5):
        w_key = f"w{w}"
        horizons[w_key] = HorizonForecast(
            week=w,
            horizon_label=HORIZON_LABELS[w],
            break_spell=predictions[f"target_break_{w_key}"],
            active_monsoon=predictions[f"target_active_{w_key}"],
            heavy_rain=predictions[f"target_heavy_{w_key}"]
        )

    # Build Onset Outlook
    normal_date = (
        "June 05 - June 09"
        if ("Dakshina" in district or "Udupi" in district)
        else "June 08 - June 14"
    )
    onset_pred = predictions["target_onset_next14d"]
    if onset_pred.error or onset_pred.probability is None:
        onset_outlook = OnsetOutlook(
            probability=None,
            cutoff=None,
            triggered=None,
            status_tag="⚠️ MODEL UNAVAILABLE",
            normal_date_window=normal_date,
            driver_outlook="Onset model temporarily unavailable",
            error=onset_pred.error or "model_unavailable"
        )
    else:
        status_tag = "🔴 ONSET ACTIVE" if onset_pred.triggered else "🟢 PRE-MONSOON PHASE"
        driver_txt = (
            "Onset spell favored by planetary indices"
            if onset_pred.triggered
            else "Standard pre-monsoon progression"
        )
        onset_outlook = OnsetOutlook(
            probability=onset_pred.probability,
            cutoff=onset_pred.cutoff,
            triggered=onset_pred.triggered,
            status_tag=status_tag,
            normal_date_window=normal_date,
            driver_outlook=driver_txt,
            error=None
        )

    return predictions, horizons, onset_outlook
