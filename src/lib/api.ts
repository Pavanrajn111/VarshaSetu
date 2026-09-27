/**
 * Varsha Setu — Frontend API Client Layer
 * Handles communication with the FastAPI ML Serving Layer (Local or Live Render/Railway).
 * Supports rate limit (429) interceptors, X-API-Key injection for audio synthesis,
 * and resilient fallbacks for missing/error targets.
 */

export interface CandidateLocation {
  name: string;
  label: string;
  taluk: string;
  district: string;
  lat: number;
  lon: number;
}

export interface LocationResolveResponse {
  status: 'success' | 'disambiguation_required' | 'not_found' | 'error';
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
  language: string;
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
  language?: string;
}

// Environment configured Backend URL and Audio API Key
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
const AUDIO_API_KEY = import.meta.env.VITE_ADVISORY_AUDIO_API_KEY || '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const delayMsg = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please wait a moment before trying again.';
    throw new ApiError(`System is busy under rate limiting.${delayMsg}`, 429);
  }

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.detail || data.error || errMsg;
    } catch {
      // ignore json parse failure
    }
    throw new ApiError(errMsg, res.status);
  }

  return res.json();
}

export const api = {
  getBaseUrl(): string {
    return BACKEND_URL;
  },

  /** Check backend health */
  async getHealth() {
    const res = await fetch(`${BACKEND_URL}/health`);
    return handleResponse<{
      status: string;
      artifacts_loaded: boolean;
      verified_taluks_count: number;
      model_targets_count: number;
      feature_columns_count: number;
      version: string;
    }>(res);
  },

  /** Get complete 31-district administrative hierarchy */
  async getTaluks(): Promise<DistrictHierarchyResponse> {
    const res = await fetch(`${BACKEND_URL}/location/taluks`);
    return handleResponse<DistrictHierarchyResponse>(res);
  },

  /** Resolve village or taluk name via 3-tier offline/OSM resolution */
  async resolveLocation(query: string): Promise<LocationResolveResponse> {
    const res = await fetch(`${BACKEND_URL}/location/resolve?query=${encodeURIComponent(query)}`);
    return handleResponse<LocationResolveResponse>(res);
  },

  /** Compute full 13-target monsoon outlook */
  async computeForecast(payload: ForecastRequest): Promise<ForecastResponse> {
    const res = await fetch(`${BACKEND_URL}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<ForecastResponse>(res);
  },

  /** Synthesize and stream advisory audio (MP3) */
  async streamAdvisoryAudio(text: string, language: string): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (AUDIO_API_KEY) {
      headers['X-API-Key'] = AUDIO_API_KEY;
    }

    const res = await fetch(`${BACKEND_URL}/advisory/audio`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, language }),
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const delayMsg = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please wait a moment.';
      throw new ApiError(`Audio voice synthesis is rate limited.${delayMsg}`, 429);
    }

    if (res.status === 401) {
      throw new ApiError('Authentication required: Missing or invalid audio API key.', 401);
    }

    if (!res.ok) {
      let err = `Audio synthesis failed (${res.status})`;
      try {
        const d = await res.json();
        err = d.detail || err;
      } catch {
        // ignore
      }
      throw new ApiError(err, res.status);
    }

    return res.blob();
  },
};
