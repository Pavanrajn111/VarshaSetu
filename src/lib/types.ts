/**
 * Varsha Setu (SIH 26086) — Core TypeScript Data Models
 * Exactly mirrors backend FastAPI / Pydantic schemas.
 *
 * NOTE: Language codes must ALWAYS be 'en' | 'kn' | 'hi'.
 * String labels like "English" are UI display only.
 */

export type SupportedLanguage = "en" | "kn" | "hi";

export interface CandidateLocation {
  name: string;
  label: string;
  taluk: string;
  district: string;
  lat: number;
  lon: number;
}

export interface LocationResolveResponse {
  status: "success" | "disambiguation_required" | "not_found" | "error";
  query: string;
  disambiguation_required: boolean;
  scale_tag: string;
  selected?: CandidateLocation;
  candidates: CandidateLocation[];
  message?: string;
}

export interface TalukItem {
  taluk_name: string;
  lat: number;
  lon: number;
}

export interface DistrictTaluks {
  district: string;
  taluks: TalukItem[];
}

export interface DistrictHierarchyResponse {
  total_taluks: number;
  districts: DistrictTaluks[];
}

export type RiskCategory = "LOW" | "MODERATE" | "HIGH";

export interface TalukRiskItem {
  taluk_name: string;
  district: string;
  lat: number;
  lon: number;
  risk_category: RiskCategory;
  risk_score_pct: number;
  risk_color_hex: string;
  risk_basis: string;
}

export interface RiskMapDataResponse {
  total_taluks: number;
  generated_at: string;
  taluks: TalukRiskItem[];
}

/**
 * Per-target fault-isolated prediction schema.
 * All fields are nullable to handle cases where a model target fails or is offline.
 */
export interface TargetPrediction {
  target: string;
  probability: number | null;
  cutoff: number | null;
  threshold: number | null;
  triggered: boolean | null;
  badge: string | null;
  error: string | null;
}

export interface HorizonForecast {
  week: number;
  horizon_label: string;
  break_spell: TargetPrediction;
  active_monsoon: TargetPrediction;
  heavy_rain: TargetPrediction;
}

/**
 * Onset Outlook model schema.
 * Has independent fault isolation (error / probability nullable).
 */
export interface OnsetOutlook {
  probability: number | null;
  cutoff: number | null;
  triggered: boolean | null;
  status_tag: string;
  normal_date_window: string;
  driver_outlook: string;
  error?: string | null;
}

export interface LocationProfile {
  spatial_node: string;
  title: string;
  taluk: string;
  district: string;
  lat: number;
  lon: number;
}

export interface SoilProfile {
  type: string;
  awc: number;
  buffer_days: number;
  drainage: string;
}

export interface TeleconnectionProfile {
  oni: number;
  dmi: number;
  mjo_amp: number;
  mjo_phase: number;
  is_el_nino: number;
  is_pos_iod: number;
}

export interface ForecastResponse {
  location: LocationProfile;
  soil: SoilProfile;
  teleconnections: TeleconnectionProfile;
  onset: OnsetOutlook;
  horizons: Record<string, HorizonForecast>;
  targets: Record<string, TargetPrediction>;
  advisory_text: string;
  crop_type: string;
  crop_stage: string;
  language: SupportedLanguage;
  weather_data_source: string;
  weather_fallback_warning?: string | null;
  generated_at: string;
}

export interface ForecastRequest {
  lat: number;
  lon: number;
  district?: string;
  taluk?: string;
  location_name?: string;
  scale_tag?: string;
  crop_type?: string;
  crop_stage?: string;
  language?: SupportedLanguage;
}

export interface AdvisoryRequest {
  district: string;
  taluk?: string;
  crop_type?: string;
  crop_stage?: string;
  language?: SupportedLanguage;
  lat?: number;
  lon?: number;
  t1_break_triggered?: boolean;
  t1_break_prob?: number;
  t1_heavy_triggered?: boolean;
  t1_heavy_prob?: number;
  t1_active_prob?: number;
}

export interface AdvisoryResponse {
  crop_type: string;
  crop_stage: string;
  language: SupportedLanguage;
  advisory_text: string;
  actions?: string[];
  generated_at?: string;
}

export interface HealthResponse {
  status: string;
  artifacts_loaded?: boolean;
  verified_taluks_count?: number;
  model_targets_count?: number;
  feature_columns_count?: number;
  version?: string;
}

export interface DailyOutlookRecord {
  id?: number;
  taluk_name: string;
  district: string;
  forecast_date: string;
  run_timestamp: string;
  gfs_mm: number | null;
  icon_mm: number | null;
  ecmwf_mm: number | null;
  climatology_mm: number | null;
  combined_mm: number;
  forecast_basis: "blended" | "climatology_only";
  source_agreement: "HIGH" | "MODERATE" | "LOW" | "CLIMATOLOGY";
  actual_precip_mm?: number | null;
}

export interface OutlookSummary {
  blended_days: number;
  climatology_days: number;
  total_expected_precip_mm: number;
  mean_daily_precip_mm: number;
}

export interface OutlookResponse {
  status: string;
  taluk_name: string;
  district: string;
  coordinates: { lat: number; lon: number };
  run_timestamp: string;
  total_days: number;
  summary: OutlookSummary;
  daily_outlook: DailyOutlookRecord[];
}

export interface UserProfile {
  id: number;
  full_name: string;
  phone_number: string;
  role: "farmer" | "officer" | "admin";
  preferred_language: SupportedLanguage;
  default_taluk?: string | null;
  default_district?: string | null;
  notification_prefs?: Record<string, unknown>;
  created_at: string;
}

export interface AuthResponse {
  status: string;
  message?: string;
  token: string;
  user: UserProfile;
}

export interface AuthMeResponse {
  status: string;
  user: UserProfile;
}
