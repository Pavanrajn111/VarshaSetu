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
import { useLanguage } from "@/context/LanguageContext";

export interface LocationState {
  lat: number;
  lon: number;
  district: string;
  taluk: string;
  locationName: string;
  scaleTag: string;
}

interface DashboardContextType {
  // Global Authoritative Location
  location: LocationState;
  setLocation: (loc: LocationState) => void;
  hasOnboardedLocation: boolean;
  setHasOnboardedLocation: (val: boolean) => void;
  isLocationSetupOpen: boolean;
  setIsLocationSetupOpen: (open: boolean) => void;

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

export const LOCATION_STORAGE_KEY = "varsha_selected_location";
export const ONBOARDED_LOCATION_STORAGE_KEY = "varsha_location_onboarded";

const DEFAULT_LOCATION: LocationState = {
  lat: 14.7336,
  lon: 74.7788,
  district: "Uttara Kannada",
  taluk: "Sirsi",
  locationName: "Sirsi Taluk HQ",
  scaleTag: "Administrative Taluk Node",
};

function getInitialLocation(): LocationState {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.lat && parsed.lon && parsed.district && parsed.taluk) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_LOCATION;
}

function getInitialOnboarded(): boolean {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem(ONBOARDED_LOCATION_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }
  return false;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationState>(getInitialLocation);
  const [hasOnboardedLocation, setHasOnboardedLocationState] = useState<boolean>(getInitialOnboarded);
  const [isLocationSetupOpen, setIsLocationSetupOpen] = useState<boolean>(false);

  const { language, setLanguage } = useLanguage();
  const [cropType, setCropType] = useState<string>("Finger Millet (Ragi)");
  const [cropStage, setCropStage] = useState<string>("Sowing & Germination");

  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [advisoryText, setAdvisoryText] = useState<string>("");
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState<boolean>(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const setHasOnboardedLocation = useCallback((val: boolean) => {
    setHasOnboardedLocationState(val);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ONBOARDED_LOCATION_STORAGE_KEY, String(val));
      } catch {
        // ignore
      }
    }
  }, []);

  // Pre-fill user default location when authenticated
  useEffect(() => {
    if (!user) return;

    if (user.default_taluk && user.default_taluk !== location.taluk) {
      apiClient
        .resolveLocation(user.default_taluk)
        .then((res) => {
          if (res.selected) {
            const loc: LocationState = {
              lat: res.selected.lat,
              lon: res.selected.lon,
              district: res.selected.district,
              taluk: res.selected.taluk,
              locationName: res.selected.label,
              scaleTag: res.scale_tag,
            };
            setLocationState(loc);
            setHasOnboardedLocationState(true);
            if (typeof window !== "undefined") {
              localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
              localStorage.setItem(ONBOARDED_LOCATION_STORAGE_KEY, "true");
            }
          }
        })
        .catch(() => {
          const loc: LocationState = {
            ...location,
            taluk: user.default_taluk || location.taluk,
            district: user.default_district || location.district,
            locationName: `${user.default_taluk} Taluk HQ`,
          };
          setLocationState(loc);
          setHasOnboardedLocationState(true);
          if (typeof window !== "undefined") {
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
            localStorage.setItem(ONBOARDED_LOCATION_STORAGE_KEY, "true");
          }
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
          language: "en",
        },
        signal,
      );
    },
    staleTime: 1000 * 60 * 30, // 30 minutes in-memory freshness
    gcTime: 1000 * 60 * 60 * 24, // 24 hours persistent cache retention
    placeholderData: (previousData) => previousData,
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
      if (overrideLoc) {
        setLocationState(overrideLoc);
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(overrideLoc));
          localStorage.setItem(ONBOARDED_LOCATION_STORAGE_KEY, "true");
        }
      }
      if (overrideLang) setLanguage(overrideLang);
      await queryClient.invalidateQueries({
        queryKey: ["forecast"],
      });
    },
    [queryClient, setLanguage],
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
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLoc));
          localStorage.setItem(ONBOARDED_LOCATION_STORAGE_KEY, "true");
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  return (
    <DashboardContext.Provider
      value={{
        location,
        setLocation,
        hasOnboardedLocation,
        setHasOnboardedLocation,
        isLocationSetupOpen,
        setIsLocationSetupOpen,
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
