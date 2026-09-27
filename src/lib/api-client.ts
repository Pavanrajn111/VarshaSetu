/**
 * Varsha Setu (SIH 26086) — Resilient API Client
 * Typed fetch wrapper handling backend communication, X-API-Key injection,
 * and distinct 422, 429 (Retry-After), and 500 error classification.
 */

import type {
  AdvisoryRequest,
  AdvisoryResponse,
  AuthMeResponse,
  AuthResponse,
  DistrictHierarchyResponse,
  ForecastRequest,
  ForecastResponse,
  HealthResponse,
  LocationResolveResponse,
  OutlookResponse,
  SupportedLanguage,
  UserProfile,
} from "./types";

export const TOKEN_STORAGE_KEY = "varsha_setu_token";

const API_BASE_URL = (
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) || "http://localhost:8000"
).replace(/\/+$/, "");

if (import.meta.env.DEV) {
  console.log("[Varsha Setu] Active API Base URL:", API_BASE_URL);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, details?: unknown, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
    if (retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }

  isValidationError(): boolean {
    return this.status === 422;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  injectApiKey?: boolean;
}

async function handleFetchResponse<T>(res: Response): Promise<T> {
  // 429: Rate Limit handling with Retry-After header
  if (res.status === 429) {
    const retryHeader = res.headers.get("Retry-After");
    const retrySec = retryHeader ? Math.max(1, parseInt(retryHeader, 10) || 5) : 5;
    throw new ApiError(
      `Rate limit exceeded. System is processing requests. Please retry in ${retrySec} seconds.`,
      429,
      null,
      retrySec,
    );
  }

  // 422: Validation error from FastAPI / Pydantic
  if (res.status === 422) {
    let detailMsg = "Request failed validation.";
    let detailData: unknown = null;
    try {
      const data = await res.json();
      detailData = data;
      if (Array.isArray(data.detail)) {
        detailMsg = data.detail
          .map((err: { loc?: string[]; msg?: string }) => err.msg || "Invalid field")
          .join("; ");
      } else if (typeof data.detail === "string") {
        detailMsg = data.detail;
      }
    } catch {
      // ignore json parse error
    }
    throw new ApiError(`Validation error (422): ${detailMsg}`, 422, detailData);
  }

  // 500+: Internal server error
  if (res.status >= 500) {
    let detailMsg = "Internal server error processing meteorological models.";
    try {
      const data = await res.json();
      detailMsg = data.detail || data.error || detailMsg;
    } catch {
      // ignore
    }
    throw new ApiError(`Server error (${res.status}): ${detailMsg}`, res.status);
  }

  // Other non-2xx errors
  if (!res.ok) {
    let detailMsg = `HTTP Error ${res.status}`;
    try {
      const data = await res.json();
      detailMsg = data.detail || data.error || data.message || detailMsg;
    } catch {
      // ignore
    }
    throw new ApiError(detailMsg, res.status);
  }

  return res.json();
}

function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

export const apiClient = {
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    return handleFetchResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
    if (opts?.params) {
      Object.entries(opts.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    const { headers: customHeaders, body: _callerBody, ...restOpts } = opts ?? {};

    const token = getStoredToken();
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const finalHeaders: Record<string, string> = {
      ...baseHeaders,
      ...(customHeaders as Record<string, string> | undefined),
    };

    const fetchInit: RequestInit = {
      ...restOpts,
      method: "POST",
      headers: finalHeaders,
    };

    if (body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), fetchInit);
    return handleFetchResponse<T>(res);
  },

  async patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
    if (opts?.params) {
      Object.entries(opts.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    const { headers: customHeaders, body: _callerBody, ...restOpts } = opts ?? {};

    const token = getStoredToken();
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const finalHeaders: Record<string, string> = {
      ...baseHeaders,
      ...(customHeaders as Record<string, string> | undefined),
    };

    const fetchInit: RequestInit = {
      ...restOpts,
      method: "PATCH",
      headers: finalHeaders,
    };

    if (body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), fetchInit);
    return handleFetchResponse<T>(res);
  },

  // --- Specialized Endpoints ---

  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health");
  },

  async getTaluks(): Promise<DistrictHierarchyResponse> {
    return this.get<DistrictHierarchyResponse>("/location/taluks");
  },

  async resolveLocation(query: string): Promise<LocationResolveResponse> {
    return this.get<LocationResolveResponse>("/location/resolve", { query });
  },

  async computeForecast(payload: ForecastRequest): Promise<ForecastResponse> {
    return this.post<ForecastResponse>("/forecast", payload);
  },

  /**
   * Correction 2: GET /risk-map with NO query parameters.
   * Fetches static statewide HTML choropleth.
   */
  async getRiskMapHtml(): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/risk-map`);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch risk map HTML (${res.status})`, res.status);
    }
    return res.text();
  },

  async getOutlook(talukName: string): Promise<OutlookResponse> {
    return this.get<OutlookResponse>(`/outlook/${encodeURIComponent(talukName)}`);
  },

  async getAdvisory(payload: AdvisoryRequest): Promise<AdvisoryResponse> {
    return this.post<AdvisoryResponse>("/advisory", payload);
  },

  async streamAdvisoryAudio(text: string, language: SupportedLanguage): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/advisory/audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, language }),
    });

    if (res.status === 401) {
      throw new ApiError("Advisory voice synthesis requires server authorization.", 401);
    }

    if (res.status === 429) {
      const retryHeader = res.headers.get("Retry-After");
      const retrySec = retryHeader ? Math.max(1, parseInt(retryHeader, 10) || 5) : 5;
      throw new ApiError(
        `Voice synthesis rate limited. Please retry in ${retrySec} seconds.`,
        429,
        null,
        retrySec,
      );
    }

    if (!res.ok) {
      let msg = `Voice synthesis failed (${res.status})`;
      try {
        const data = await res.json();
        msg = data.detail || msg;
      } catch {
        // ignore
      }
      throw new ApiError(msg, res.status);
    }

    return res.blob();
  },

  // --- Authentication Endpoints ---

  async register(payload: {
    full_name: string;
    phone_number: string;
    password: string;
    preferred_language: SupportedLanguage;
    role?: string;
    default_taluk?: string;
    default_district?: string;
  }): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/register", payload);
  },

  async login(payload: { phone_number: string; password: string }): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/login", payload);
  },

  async getMe(): Promise<AuthMeResponse> {
    return this.get<AuthMeResponse>("/auth/me");
  },

  async updateMe(payload: {
    preferred_language?: SupportedLanguage;
    default_taluk?: string;
    default_district?: string;
    notification_prefs?: Record<string, unknown>;
  }): Promise<AuthMeResponse> {
    return this.patch<AuthMeResponse>("/auth/me", payload);
  },
};
