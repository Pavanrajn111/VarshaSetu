import datetime
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from app.services.artifact_loader import get_bundle

logger = logging.getLogger("varsha_setu.feature_builder")

def build_feature_vector(
    weather_data: Dict[str, float],
    tele_data: Dict[str, Any],
    custom_date: Optional[datetime.date] = None
) -> pd.DataFrame:
    """
    Constructs the exact 18-feature vector required by the multi-target ensemble models.

    CRITICAL SAFETY REQUIREMENT:
    The columns and their ordering in the output DataFrame must match the loaded
    feature_columns.pkl EXACTLY. Mismatched ordering causes silent model degradation.
    Strict assertions enforce exact schema equality.
    """
    bundle = get_bundle()
    feature_cols: List[str] = bundle.feature_columns

    # 1. Hydrological & Lag Precipitation
    p_today = float(weather_data.get("p_today", 0.0))
    p_3d = float(weather_data.get("p_3d", 0.0))
    p_7d = float(weather_data.get("p_7d", 0.0))
    p_14d = float(weather_data.get("p_14d", 0.0))
    p_21d = float(weather_data.get("p_21d", 0.0))
    p_l1 = float(weather_data.get("p_l1", 0.0))
    p_l2 = float(weather_data.get("p_l2", 0.0))
    p_l3 = float(weather_data.get("p_l3", 0.0))

    # 2. Climatological Day-of-Year Harmonics & 7-Day Rainfall Anomaly
    target_date = custom_date or datetime.date.today()
    doy = target_date.timetuple().tm_yday
    sin_doy = float(np.sin(2 * np.pi * doy / 365.25))
    cos_doy = float(np.cos(2 * np.pi * doy / 365.25))
    anomaly_7d = float(p_7d - 25.0)

    # 3. Teleconnections (ENSO, IOD, MJO)
    oni = float(tele_data.get("oni", 0.20))
    dmi = float(tele_data.get("dmi", 0.05))
    mjo_amp = float(tele_data.get("mjo_amp", 1.2))
    sin_mjo = float(tele_data.get("sin_mjo", 0.707))
    cos_mjo = float(tele_data.get("cos_mjo", 0.707))
    is_el_nino = int(tele_data.get("is_el_nino", 0))
    is_pos_iod = int(tele_data.get("is_pos_iod", 0))

    # Comprehensive feature mapping dictionary supporting potential naming variants
    raw_feature_map: Dict[str, Any] = {
        "precip": p_today,
        "precip_3d_sum": p_3d,
        "precip_7d_sum": p_7d,
        "precip_14d_sum": p_14d,
        "precip_21d_sum": p_21d,
        "precip_lag1": p_l1,
        "precip_lag2": p_l2,
        "precip_lag3": p_l3,
        "precip_7d_anomaly": anomaly_7d,
        "sin_doy": sin_doy,
        "cos_doy": cos_doy,
        "oni": oni,
        "dmi": dmi,
        "mjo_amplitude": mjo_amp,
        "mjo_amp": mjo_amp,
        "sin_mjo_phase": sin_mjo,
        "sin_mjo": sin_mjo,
        "cos_mjo_phase": cos_mjo,
        "cos_mjo": cos_mjo,
        "is_el_nino": is_el_nino,
        "is_positive_iod": is_pos_iod,
        "is_pos_iod": is_pos_iod
    }

    # Assemble row following feature_cols order exactly
    vector_values = []
    for col in feature_cols:
        if col not in raw_feature_map:
            raise KeyError(
                f"Feature '{col}' defined in feature_columns.pkl was not computed in feature_builder."
            )
        vector_values.append(raw_feature_map[col])

    f_vec = pd.DataFrame([vector_values], columns=feature_cols)

    # 4. Critical Safety Assertions
    assert list(f_vec.columns) == list(feature_cols), (
        f"CRITICAL SAFETY VIOLATION: Built feature columns {list(f_vec.columns)} "
        f"do not match expected feature_columns.pkl order {list(feature_cols)}"
    )
    assert len(f_vec.columns) == 18, (
        f"CRITICAL SAFETY VIOLATION: Expected 18 features, but constructed {len(f_vec.columns)}"
    )

    logger.debug("Successfully built and validated 18-feature vector for doy=%d", doy)
    return f_vec
