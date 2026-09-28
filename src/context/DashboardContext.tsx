import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ForecastResponse, SupportedLanguage } from "@/lib/types";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export interface LocationState {
  lat: number;
  lon: number;
  district: string;
  taluk: string;
  locationName: string;
  scaleTag: string;
}

interface DashboardContextType {
  // Location
  location: LocationState;
  setLocation: (loc: LocationState) => void;

  // Language
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;

  // Agronomic parameters
  cropType: string;
  setCropType: (crop: string) => void;
  cropStage: string;
  setCropStage: (stage: string) => void;

  // Forecast state
  forecast: ForecastResponse | null;
  isLoadingForecast: boolean;
  forecastError: string | null;
  rateLimitCountdown: number | null;
  loadForecast: (overrideLoc?: LocationState, overrideLang?: SupportedLanguage) => Promise<void>;

  // Advisory state
  advisoryText: string;
  setAdvisoryText: (text: string) => void;
  isLoadingAdvisory: boolean;
  advisoryError: string | null;
  loadAdvisory: () => Promise<void>;
}

const DEFAULT_LOCATION: LocationState = {
  lat: 14.7336,
  lon: 74.7788,
  district: "Uttara Kannada",
  taluk: "Sirsi",
  locationName: "Sirsi Taluk HQ",
  scaleTag: "Administrative Taluk Node",
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationState>(DEFAULT_LOCATION);
  const [language, setLanguageState] = useState<SupportedLanguage>("en");
  const [cropType, setCropType] = useState<string>("Finger Millet (Ragi)");
  const [cropStage, setCropStage] = useState<string>("Sowing & Germination");

  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [advisoryText, setAdvisoryText] = useState<string>("");
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState<boolean>(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Pre-fill user default location & language when authenticated
  useEffect(() => {
    if (!user) return;

    if (user.preferred_language && user.preferred_language !== language) {
      setLanguageState(user.preferred_language);
    }

    if (user.default_taluk && user.default_taluk !== location.taluk) {
      apiClient
        .resolveLocation(user.default_taluk)
        .then((res) => {
          if (res.selected) {
            setLocationState({
              lat: res.selected.lat,
              lon: res.selected.lon,
              district: res.selected.district,
              taluk: res.selected.taluk,
              locationName: res.selected.label,
              scaleTag: res.scale_tag,
            });
          }
        })
        .catch(() => {
          setLocationState((prev) => ({
            ...prev,
            taluk: user.default_taluk || prev.taluk,
            district: user.default_district || prev.district,
            locationName: `${user.default_taluk} Taluk HQ`,
          }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Rate-limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  // TanStack React Query for Forecast with instant cache and automatic SWR
  const forecastQuery = useQuery({
    queryKey: [
      "forecast",
      location.district,
      location.taluk,
      cropType,
      cropStage,
      language,
    ],
    queryFn: async ({ signal }) => {
      return apiClient.computeForecast(
        {
          lat: location.lat,
          lon: location.lon,
          district: location.district,
          taluk: location.taluk,
          location_name: location.locationName,
          scale_tag: location.scaleTag,
          crop_type: cropType,
          crop_stage: cropStage,
          language: language,
        },
        signal,
      );
    },
    staleTime: 1000 * 60 * 30, // 30 minutes in-memory freshness
    gcTime: 1000 * 60 * 60 * 24, // 24 hours persistent cache retention
    placeholderData: (previousData) => previousData, // Instant smooth rendering without layout jumps
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.isRateLimited()) {
        const waitSec = error.retryAfterSeconds || 5;
        setRateLimitCountdown(waitSec);
        return failureCount < 2;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const forecast = forecastQuery.data ?? null;
  const isLoadingForecast = forecastQuery.isFetching;

  // Sync advisory text from forecast data when received
  useEffect(() => {
    if (forecast?.advisory_text) {
      setAdvisoryText(forecast.advisory_text);
    }
  }, [forecast?.advisory_text]);

  const forecastError = forecastQuery.error
    ? forecastQuery.error instanceof Error
      ? forecastQuery.error.message
      : "Unable to compute forecast for the selected location."
    : null;

  // Load forecast on-demand / manual refresh
  const loadForecast = useCallback(
    async (overrideLoc?: LocationState, overrideLang?: SupportedLanguage) => {
      if (overrideLoc) setLocationState(overrideLoc);
      if (overrideLang) setLanguageState(overrideLang);
      await queryClient.invalidateQueries({
        queryKey: ["forecast"],
      });
    },
    [queryClient],
  );

  // Load agronomic advisory on demand
  const loadAdvisory = useCallback(async () => {
    setIsLoadingAdvisory(true);
    setAdvisoryError(null);

    try {
      const w1Break = forecast?.targets?.["target_break_w1"];
      const w1Heavy = forecast?.targets?.["target_heavy_w1"];
      const w1Active = forecast?.targets?.["target_active_w1"];

      const res = await apiClient.getAdvisory({
        district: location.district || "Uttara Kannada",
        taluk: location.taluk || "Sirsi",
        crop_type: cropType,
        crop_stage: cropStage,
        language,
        t1_break_triggered: Boolean(w1Break?.triggered),
        t1_break_prob: w1Break?.probability ?? 0.0,
        t1_heavy_triggered: Boolean(w1Heavy?.triggered),
        t1_heavy_prob: w1Heavy?.probability ?? 0.0,
        t1_active_prob: w1Active?.probability ?? 0.0,
      });
      if (res.advisory_text) {
        setAdvisoryText(res.advisory_text);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve crop advisory.";
      setAdvisoryError(msg);
    } finally {
      setIsLoadingAdvisory(false);
    }
  }, [location, cropType, cropStage, language, forecast]);

  const setLocation = useCallback(
    (newLoc: LocationState) => {
      setLocationState(newLoc);
    },
    [],
  );

  const setLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      setLanguageState(newLang);
    },
    [],
  );

  return (
    <DashboardContext.Provider
      value={{
        location,
        setLocation,
        language,
        setLanguage,
        cropType,
        setCropType,
        cropStage,
        setCropStage,
        forecast,
        isLoadingForecast,
        forecastError,
        rateLimitCountdown,
        loadForecast,
        advisoryText,
        setAdvisoryText,
        isLoadingAdvisory,
        advisoryError,
        loadAdvisory,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

