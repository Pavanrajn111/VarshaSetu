import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Tuple
import joblib
import pandas as pd
from app.config import ARTIFACTS_DIR

logger = logging.getLogger("varsha_setu.artifact_loader")

class ArtifactBundle:
    """
    Singleton container holding all pre-trained models, calibrated thresholds,
    feature column definitions, administrative boundaries, and offline village datasets.
    """
    def __init__(
        self,
        models: Dict[str, Any],
        feature_columns: List[str],
        optimal_thresholds: Dict[str, float],
        taluks_df: pd.DataFrame,
        villages_df: pd.DataFrame,
        risk_map_html: str,
        artifacts_path: Path,
        threshold_format_detected: str = "flat_float",
        climatology_map: Dict[Tuple[str, int], float] = None
    ):
        self.models = models
        self.feature_columns = feature_columns
        self.optimal_thresholds = optimal_thresholds
        self.taluks_df = taluks_df
        self.villages_df = villages_df
        self.risk_map_html = risk_map_html
        self.artifacts_path = artifacts_path
        self.threshold_format_detected = threshold_format_detected
        self.climatology_map = climatology_map or {}
        self.feature_columns_count = len(feature_columns)
        self.model_targets_count = len(models)
        self.verified_taluks_count = len(taluks_df)
        self.offline_villages_count = len(villages_df)
        self.model_targets = list(models.keys())

    def get_climatology(self, taluk_name: str, day_of_year: int) -> float:
        """Returns baseline climatological precipitation (mm) for taluk on specific DOY."""
        key = (taluk_name.strip().lower(), int(day_of_year))
        if key in self.climatology_map:
            return self.climatology_map[key]
        return 5.0 if 150 <= day_of_year <= 260 else 1.0

HEAVY_TARGETS = {
    "target_heavy_w1",
    "target_heavy_w2",
    "target_heavy_w3",
    "target_heavy_w4"
}

def parse_threshold(target_name: str, raw_value: Any) -> float:
    """
    Target-aware threshold parser.
    For heavy-rain targets (target_heavy_w1..w4), prioritizes 'balanced' threshold
    to avoid excessive false alarms on extreme precipitation (>64.5mm).
    For onset and break-spell targets, prioritizes 'recall_first' to maximize hazard detection.
    Falls back gracefully with explicit warnings if preferred keys are absent.
    """
    if isinstance(raw_value, dict):
        if target_name in HEAVY_TARGETS and "balanced" in raw_value:
            return float(raw_value["balanced"])
        if "recall_first" in raw_value:
            return float(raw_value["recall_first"])
        if "cutoff" in raw_value:
            return float(raw_value["cutoff"])
        if "threshold" in raw_value:
            return float(raw_value["threshold"])
        
        # Last-resort fallback for dict, log a clear warning naming target and keys present
        keys = list(raw_value.keys())
        logger.warning(
            "Threshold dict for target '%s' missing preferred keys ('balanced' for heavy, 'recall_first' for others). "
            "Present keys: %s. Falling back to first valid key or 0.5 default.",
            target_name, keys
        )
        for k in keys:
            try:
                return float(raw_value[k])
            except (ValueError, TypeError):
                continue
        return 0.5
    elif isinstance(raw_value, (int, float)):
        return float(raw_value)

    logger.warning(
        "Unrecognized threshold format for target '%s': %s (%s). Defaulting to 0.5.",
        target_name, raw_value, type(raw_value)
    )
    return 0.5

_bundle: ArtifactBundle | None = None

def load_artifacts_once(artifacts_dir: Path | None = None) -> ArtifactBundle:
    """
    Loads all artifacts once at application startup.
    Fails fast with explicit RuntimeError if any artifact file is missing.
    """
    global _bundle
    if _bundle is not None:
        return _bundle

    target_dir = artifacts_dir or ARTIFACTS_DIR
    target_path = Path(target_dir).resolve()

    logger.info("Initializing Varsha Setu ML artifacts from: %s", target_path)

    # 1. Verification of Required Files (Fail-Fast)
    required_files = [
        "karnataka_multitarget_models.pkl",
        "feature_columns.pkl",
        "optimal_thresholds.pkl",
        "karnataka_taluks_verified.csv",
        "karnataka_offline_villages_master.csv",
        "karnataka_final_risk_map.html"
    ]

    missing = [f for f in required_files if not (target_path / f).exists()]
    if missing:
        err_msg = (
            f"CRITICAL: Missing required artifact file(s) in {target_path}: {missing}. "
            f"Please ensure all model pickles, CSVs, and HTML map are copied to {target_path}."
        )
        logger.error(err_msg)
        raise RuntimeError(err_msg)

    # 2. Load Models Bundle & Assert Estimator Contract
    models_path = target_path / "karnataka_multitarget_models.pkl"
    logger.info("Loading multi-target dual-model bundle from %s...", models_path.name)
    models = joblib.load(str(models_path))

    EXPECTED_TARGETS = [
        'target_onset_next14d',
        'target_break_w1', 'target_active_w1', 'target_heavy_w1',
        'target_break_w2', 'target_active_w2', 'target_heavy_w2',
        'target_break_w3', 'target_active_w3', 'target_heavy_w3',
        'target_break_w4', 'target_active_w4', 'target_heavy_w4'
    ]
    missing_targets = set(EXPECTED_TARGETS) - set(models.keys())
    if missing_targets:
        raise RuntimeError(f"Model targets contract violation! Missing targets: {missing_targets}")

    for tgt in EXPECTED_TARGETS:
        est_dict = models[tgt]
        if not isinstance(est_dict, dict) or "xgb" not in est_dict or "rf" not in est_dict:
            raise RuntimeError(
                f"Estimator contract violation for target '{tgt}': both 'xgb' and 'rf' submodels are strictly required."
            )

    # 3. Load Feature Columns & Assert 18-Feature Vector Contract
    features_path = target_path / "feature_columns.pkl"
    feature_cols = joblib.load(str(features_path))
    EXPECTED_FEATURES = [
        'precip', 'precip_3d_sum', 'precip_7d_sum', 'precip_14d_sum', 'precip_21d_sum',
        'precip_lag1', 'precip_lag2', 'precip_lag3', 'precip_7d_anomaly',
        'sin_doy', 'cos_doy', 'oni', 'dmi', 'mjo_amplitude',
        'sin_mjo_phase', 'cos_mjo_phase', 'is_el_nino', 'is_positive_iod'
    ]
    if feature_cols != EXPECTED_FEATURES:
        raise RuntimeError(
            f"Feature column contract violation! Expected exact 18 features: {EXPECTED_FEATURES}, got: {feature_cols}"
        )

    # 4. Load Optimal Thresholds with Defensive Parsing & Contract Validation
    thresholds_path = target_path / "optimal_thresholds.pkl"
    raw_thresholds = joblib.load(str(thresholds_path))
    clean_thresholds: Dict[str, float] = {}
    formats_detected = set()

    for tgt, val in raw_thresholds.items():
        if isinstance(val, dict):
            formats_detected.add("dict")
        elif isinstance(val, (int, float)):
            formats_detected.add("flat_float")
        else:
            formats_detected.add("unknown")
        clean_thresholds[tgt] = parse_threshold(tgt, val)

    missing_thresh = set(EXPECTED_TARGETS) - set(clean_thresholds.keys())
    if missing_thresh:
        raise RuntimeError(f"Thresholds contract violation! Missing thresholds for: {missing_thresh}")
    for tgt, tval in clean_thresholds.items():
        if not (0.0 <= tval <= 1.0):
            raise RuntimeError(f"Threshold contract violation for '{tgt}': value {tval} is outside [0.0, 1.0].")

    threshold_format_str = ", ".join(sorted(formats_detected)) or "flat_float"

    # 5. Load Administrative Taluks
    taluks_path = target_path / "karnataka_taluks_verified.csv"
    taluks_df = pd.read_csv(str(taluks_path))
    # Ensure standard schema
    required_taluk_cols = {"district", "taluk_name", "lat", "lon"}
    if not required_taluk_cols.issubset(taluks_df.columns):
        raise ValueError(f"Taluks CSV missing expected columns: {required_taluk_cols - set(taluks_df.columns)}")

    # 6. Load Offline Villages Master
    villages_path = target_path / "karnataka_offline_villages_master.csv"
    villages_df = pd.read_csv(str(villages_path))
    village_cols = ['name', 'label', 'taluk', 'district', 'lat', 'lon']
    for c in village_cols:
        if c not in villages_df.columns:
            villages_df[c] = ""

    # 7. Load Risk Map HTML
    risk_map_path = target_path / "karnataka_final_risk_map.html"
    with open(str(risk_map_path), "r", encoding="utf-8") as f_map:
        risk_map_html = f_map.read()

    # 8. Load Climatology Parquet Artifact
    climatology_map: Dict[Tuple[str, int], float] = {}
    climatology_path = target_path / "climatology_by_taluk_doy.parquet"
    if climatology_path.exists():
        try:
            clim_df = pd.read_parquet(str(climatology_path))
            for _, row in clim_df.iterrows():
                t_k = (str(row["taluk_name"]).strip().lower(), int(row["day_of_year"]))
                climatology_map[t_k] = float(row["precip_normal_doy"])
            logger.info("Loaded climatology baseline artifact: %d taluk-DOY records", len(climatology_map))
        except Exception as e:
            logger.warning("Could not read climatology_by_taluk_doy.parquet: %s", e)

    # 9. Known Limitations & Coverage Documentation
    # Model was trained on real daily CHIRPS rainfall observations (2015-2024) across Karnataka.
    # The heavy-rain target threshold reflects an intentional precision/recall calibration to alert
    # on severe events (>64.5 mm) while avoiding excessive false alarms.
    verified_taluk_count = len(taluks_df)
    offline_village_count = len(villages_df)
    model_targets_count = len(models)

    logger.info(
        "Successfully loaded all Varsha Setu artifacts: %d verified taluks, %d offline villages, %d targets.",
        verified_taluk_count,
        offline_village_count,
        model_targets_count
    )
    logger.info(
        "Coverage Audit Note: Serving models trained on 10-year CHIRPS raster across %d Karnataka taluks.",
        verified_taluk_count
    )

    _bundle = ArtifactBundle(
        models=models,
        feature_columns=feature_cols,
        optimal_thresholds=clean_thresholds,
        taluks_df=taluks_df,
        villages_df=villages_df,
        risk_map_html=risk_map_html,
        artifacts_path=target_path,
        threshold_format_detected=threshold_format_str,
        climatology_map=climatology_map
    )
    return _bundle

def get_bundle() -> ArtifactBundle:
    """Returns the loaded singleton ArtifactBundle. Raises error if not initialized."""
    if _bundle is None:
        raise RuntimeError("Artifact bundle not initialized. Ensure load_artifacts_once() ran during startup.")
    return _bundle
