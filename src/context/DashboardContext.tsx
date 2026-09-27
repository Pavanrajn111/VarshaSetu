import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  ForecastResponse,
  SupportedLanguage,
} from '@/lib/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

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

  // Language (CORRECTION 1: strictly 'en' | 'kn' | 'hi')
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
  district: 'Uttara Kannada',
  taluk: 'Sirsi',
  locationName: 'Sirsi Taluk HQ',
  scaleTag: 'Administrative Taluk Node',
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationState>(DEFAULT_LOCATION);
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [cropType, setCropType] = useState<string>('Finger Millet (Ragi)');
  const [cropStage, setCropStage] = useState<string>('Sowing & Germination');

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const [advisoryText, setAdvisoryText] = useState<string>('');
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState<boolean>(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);

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
  }, [user]);

  // Rate-limit countdown effect
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

  // Load forecast for selected location
  const loadForecast = useCallback(
    async (overrideLoc?: LocationState, overrideLang?: SupportedLanguage) => {
      const activeLoc = overrideLoc || location;
      const activeLang = overrideLang || language;

      setIsLoadingForecast(true);
      setForecastError(null);

      const attemptFetch = async (): Promise<ForecastResponse> => {
        return apiClient.computeForecast({
          lat: activeLoc.lat,
          lon: activeLoc.lon,
          district: activeLoc.district,
          taluk: activeLoc.taluk,
          location_name: activeLoc.locationName,
          scale_tag: activeLoc.scaleTag,
          crop_type: cropType,
          crop_stage: cropStage,
          language: activeLang,
        });
      };

      try {
        const data = await attemptFetch();
        setForecast(data);
        if (data.advisory_text) {
          setAdvisoryText(data.advisory_text);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.isRateLimited() && err.retryAfterSeconds) {
          const waitSec = err.retryAfterSeconds;
          setRateLimitCountdown(waitSec);
          setForecastError(`System is busy under rate limiting. Auto-retrying in ${waitSec}s...`);

          // Auto-retry once after retryAfter duration
          setTimeout(async () => {
            try {
              const retryData = await attemptFetch();
              setForecast(retryData);
              setForecastError(null);
              setRateLimitCountdown(null);
              if (retryData.advisory_text) {
                setAdvisoryText(retryData.advisory_text);
              }
            } catch (retryErr: unknown) {
              const msg = retryErr instanceof Error ? retryErr.message : 'Forecast request failed after retry.';
              setForecastError(msg);
              setRateLimitCountdown(null);
            }
          }, waitSec * 1000);
        } else {
          const msg = err instanceof Error ? err.message : 'Unable to compute forecast for the selected location.';
          setForecastError(msg);
        }
      } finally {
        setIsLoadingForecast(false);
      }
    },
    [location, language, cropType, cropStage]
  );

  // Load agronomic advisory
  const loadAdvisory = useCallback(async () => {
    setIsLoadingAdvisory(true);
    setAdvisoryError(null);

    try {
      const res = await apiClient.getAdvisory({
        lat: location.lat,
        lon: location.lon,
        district: location.district,
        taluk: location.taluk,
        crop_type: cropType,
        crop_stage: cropStage,
        language,
      });
      if (res.advisory_text) {
        setAdvisoryText(res.advisory_text);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve crop advisory.';
      setAdvisoryError(msg);
    } finally {
      setIsLoadingAdvisory(false);
    }
  }, [location, cropType, cropStage, language]);

  const setLocation = useCallback(
    (newLoc: LocationState) => {
      setLocationState(newLoc);
      loadForecast(newLoc, language);
    },
    [language, loadForecast]
  );

  const setLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      setLanguageState(newLang);
      loadForecast(location, newLang);
    },
    [location, loadForecast]
  );

  // Initial fetch on mount
  useEffect(() => {
    loadForecast();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
