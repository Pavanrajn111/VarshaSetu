/**
 * Varsha Setu (SIH 26086) — Conversational AI Service (Scaffold)
 * Currently returns structured contextual stub responses after simulated latency.
 * Swapping in a real LLM provider (e.g. Gemini / vLLM) requires editing ONLY this file.
 */

import type { LocationProfile, ForecastResponse } from './types';

export interface ChatContext {
  location?: Partial<LocationProfile> & { locationName?: string };
  forecast?: ForecastResponse | null;
  cropType?: string;
  cropStage?: string;
}

export async function sendChatMessage(
  message: string,
  context?: ChatContext
): Promise<string> {
  // Simulate network latency of 800ms
  await new Promise((resolve) => setTimeout(resolve, 800));

  // TODO: replace with real API call once an LLM provider is chosen
  const locationName = context?.location?.taluk || context?.location?.locationName || 'Karnataka';
  const crop = context?.cropType || 'crops';

  return `[Varsha Setu Agro-Assistant]: Thank you for asking about "${message}". For ${locationName}, current ensemble indicators suggest monitoring Week 1-2 convective rainfall. For your ${crop}, align irrigation according to soil buffer days shown in your dashboard. // Note: This conversational assistant is currently running in scaffold mode and will be connected to a live agro-meteorology LLM backend soon.`;
}
