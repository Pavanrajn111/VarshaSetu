from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from app.config import (
    KARNATAKA_LAT_MIN,
    KARNATAKA_LAT_MAX,
    KARNATAKA_LON_MIN,
    KARNATAKA_LON_MAX
)

class CropTypeEnum(str, Enum):
    FINGER_MILLET = "Finger Millet (Ragi)"
    MAIZE = "Maize"
    GROUNDNUT = "Groundnut"
    SUGARCANE = "Sugarcane"
    PADDY = "Paddy"
    COTTON = "Cotton"
    RED_GRAM = "Red Gram (Tur)"
    SOYBEAN = "Soybean"

class CropStageEnum(str, Enum):
    PRE_SOWING = "Pre-Sowing / Land Preparation"
    SOWING = "Sowing & Germination"
    VEGETATIVE = "Vegetative Growth"
    FLOWERING = "Flowering / Grain Formation"
    HARVESTING = "Harvesting"
    HARVESTING_POST = "Harvesting & Post-Harvest"

class LanguageEnum(str, Enum):
    EN = "en"
    KN = "kn"
    HINDI = "hi"
    ENGLISH = "English"
    KANNADA = "ಕನ್ನಡ (Kannada)"
    HINDI_LABEL = "हिन्दी (Hindi)"
    HINDI_TEXT = "Hindi"

# ---------------------------------------------------------------------------
# Location Resolution Models
# ---------------------------------------------------------------------------
class CandidateLocation(BaseModel):
    name: str
    label: str
    taluk: str
    district: str
    lat: float
    lon: float

class LocationResolveResponse(BaseModel):
    status: str
    query: str
    disambiguation_required: bool
    scale_tag: str
    selected: Optional[CandidateLocation] = None
    candidates: List[CandidateLocation] = []
    message: Optional[str] = None

class TalukItem(BaseModel):
    taluk_name: str
    lat: float
    lon: float

class DistrictTaluks(BaseModel):
    district: str
    taluks: List[TalukItem]

class DistrictHierarchyResponse(BaseModel):
    total_taluks: int
    districts: List[DistrictTaluks]

# ---------------------------------------------------------------------------
# Forecast Models
# ---------------------------------------------------------------------------
class ForecastRequest(BaseModel):
    lat: float = Field(..., description="Latitude within Karnataka (11.5 - 18.6)")
    lon: float = Field(..., description="Longitude within Karnataka (74.0 - 78.6)")
    district: Optional[str] = Field(None, description="Optional override/hint for district")
    taluk: Optional[str] = Field(None, description="Optional override/hint for taluk")
    location_name: Optional[str] = Field(None, description="Display name for the location")
    scale_tag: Optional[str] = Field("Spatial Coordinate Node", description="Provenance of location resolution")
    crop_type: Optional[CropTypeEnum] = Field(CropTypeEnum.FINGER_MILLET, description="Crop for agronomic advisory")
    crop_stage: Optional[CropStageEnum] = Field(CropStageEnum.SOWING, description="Growth stage")
    language: Optional[LanguageEnum] = Field(LanguageEnum.ENGLISH, description="Advisory language")

    @field_validator("lat")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (KARNATAKA_LAT_MIN <= v <= KARNATAKA_LAT_MAX):
            raise ValueError(
                f"Latitude {v} is outside Karnataka boundary ({KARNATAKA_LAT_MIN}°N to {KARNATAKA_LAT_MAX}°N)"
            )
        return v

    @field_validator("lon")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (KARNATAKA_LON_MIN <= v <= KARNATAKA_LON_MAX):
            raise ValueError(
                f"Longitude {v} is outside Karnataka boundary ({KARNATAKA_LON_MIN}°E to {KARNATAKA_LON_MAX}°E)"
            )
        return v

class TargetPrediction(BaseModel):
    target: str
    probability: Optional[float] = None
    cutoff: Optional[float] = None
    threshold: Optional[float] = None
    triggered: Optional[bool] = None
    badge: Optional[str] = None
    error: Optional[str] = None

class HorizonForecast(BaseModel):
    week: int
    horizon_label: str
    break_spell: TargetPrediction
    active_monsoon: TargetPrediction
    heavy_rain: TargetPrediction

class OnsetOutlook(BaseModel):
    probability: Optional[float] = None
    cutoff: Optional[float] = None
    triggered: Optional[bool] = None
    status_tag: str
    normal_date_window: str
    driver_outlook: str
    error: Optional[str] = None

class SoilProfile(BaseModel):
    type: str
    awc: int
    buffer_days: int
    drainage: str

class LocationProfile(BaseModel):
    spatial_node: str
    title: str
    taluk: str
    district: str
    lat: float
    lon: float

class TeleconnectionProfile(BaseModel):
    oni: float
    dmi: float
    mjo_amp: float
    mjo_phase: int
    is_el_nino: int
    is_pos_iod: int

class ForecastResponse(BaseModel):
    location: LocationProfile
    soil: SoilProfile
    teleconnections: TeleconnectionProfile
    onset: OnsetOutlook
    horizons: Dict[str, HorizonForecast]
    targets: Dict[str, TargetPrediction]
    advisory_text: Optional[str] = None
    crop_type: Optional[str] = None
    crop_stage: Optional[str] = None
    language: Optional[str] = None
    weather_data_source: str = Field("open_meteo_live", description="Source of precipitation features ('open_meteo_live' or 'climatological_normal_fallback')")
    weather_fallback_warning: Optional[str] = Field(None, description="Transparency notice if live weather API was unreachable")
    generated_at: str

# ---------------------------------------------------------------------------
# Advisory Models
# ---------------------------------------------------------------------------
class AdvisoryRequest(BaseModel):
    district: str
    taluk: Optional[str] = None
    crop_type: CropTypeEnum = CropTypeEnum.FINGER_MILLET
    crop_stage: CropStageEnum = CropStageEnum.SOWING
    language: LanguageEnum = LanguageEnum.ENGLISH
    t1_break_triggered: bool = False
    t1_break_prob: float = 0.0
    t1_heavy_triggered: bool = False
    t1_heavy_prob: float = 0.0
    t1_active_prob: float = 0.0

class AdvisoryResponse(BaseModel):
    crop_type: str
    crop_stage: str
    district: str
    soil_type: str
    language: str
    advisory_text: str

# ---------------------------------------------------------------------------
# Voice Models
# ---------------------------------------------------------------------------
class VoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    language: LanguageEnum = LanguageEnum.ENGLISH

# ---------------------------------------------------------------------------
# Health Response
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str
    artifacts_loaded: bool
    verified_taluks_count: int
    offline_villages_count: int
    model_targets_count: int
    feature_columns_count: int
    feature_columns: List[str]
    thresholds_format: str
    model_targets: List[str]
    dataset_coverage: str
    timestamp: str

# ---------------------------------------------------------------------------
# Statewide Risk Map Models
# ---------------------------------------------------------------------------
class TalukRiskItem(BaseModel):
    taluk_name: str
    district: str
    lat: float
    lon: float
    risk_category: str
    risk_score_pct: float
    risk_color_hex: str
    risk_basis: str

class RiskMapDataResponse(BaseModel):
    total_taluks: int
    generated_at: str
    taluks: List[TalukRiskItem]

class RiskGridCell(BaseModel):
    lat: float
    lon: float
    risk_category: str
    risk_score_pct: float
    color_hex: str

class RiskGridBounds(BaseModel):
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    step: float

class RiskMapGridResponse(BaseModel):
    total_cells: int
    resolution_deg: float
    bounds: RiskGridBounds
    generated_at: str
    disclaimer: str
    cells: List[RiskGridCell]

# ---------------------------------------------------------------------------
# Multilingual AI Assistant Models
# ---------------------------------------------------------------------------
class ChatMessageHistory(BaseModel):
    sender: str
    text: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    language: str = Field("en", description="Target language ('en', 'kn', 'hi')")
    location: Optional[Dict[str, Any]] = None
    crop_type: Optional[str] = None
    crop_stage: Optional[str] = None
    forecast: Optional[Dict[str, Any]] = None
    history: Optional[List[ChatMessageHistory]] = None

class ChatResponse(BaseModel):
    response: str
    suggested_options: List[str]
    language: str
    model_used: str
    grounded: bool

