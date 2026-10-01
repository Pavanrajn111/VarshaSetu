/**
 * Varsha Setu (SIH 26086) — Multilingual AI Agronomic Assistant Client Service
 * Calls backend POST /chat backed by Google Gemini API with real-time Karnataka
 * agricultural telemetry, soil moisture buffer, and weather forecast grounding.
 */

import { apiClient } from "./api-client";
import type {
  LocationProfile,
  ForecastResponse,
  SupportedLanguage,
  ChatMessageHistoryItem,
  ChatResponse,
} from "./types";

export interface ChatContext {
  location?: Partial<LocationProfile> & { locationName?: string };
  forecast?: ForecastResponse | null;
  cropType?: string;
  cropStage?: string;
  language?: SupportedLanguage;
  history?: ChatMessageHistoryItem[];
}

export async function sendChatMessage(
  message: string,
  context?: ChatContext
): Promise<ChatResponse> {
  const payload = {
    message,
    language: context?.language || "en",
    location: context?.location,
    crop_type: context?.cropType,
    crop_stage: context?.cropStage,
    forecast: context?.forecast,
    history: context?.history,
  };

  try {
    const res = await apiClient.post<ChatResponse>("/chat", payload);
    return res;
  } catch (err) {
    console.warn("[Varsha Setu] Backend chat request failed, using client fallback:", err);
    return {
      response:
        context?.language === "kn"
          ? "ಕ್ಷಮಿಸಿ, ಸಂಪರ್ಕ ದೋಷ ಉಂಟಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ."
          : context?.language === "hi"
          ? "क्षमा करें, नेटवर्क त्रुटि हुई। कृपया पुनः प्रयास करें।"
          : "Sorry, a temporary network error occurred. Please try again.",
      suggested_options:
        context?.language === "kn"
          ? ["ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಮಳೆಯಾಗುವುದೇ?", "ಇಂದು ಗೊಬ್ಬರ ಹಾಕಲು ಹವಾಮಾನ ಸೂಕ್ತವೇ?"]
          : context?.language === "hi"
          ? ["क्या अगले 7 दिनों में बारिश होगी?", "क्या आज खाद डालना सुरक्षित है?"]
          : ["Will it rain in the next 7 days?", "Is it safe to apply fertilizer today?"],
      language: context?.language || "en",
      model_used: "client-fallback",
      grounded: false,
    };
  }
}
