/**
 * Varsha Setu (SIH 26086) — Context-Grounded Advisory Assistant
 * Deterministic, rule-grounded assistant that interprets active machine learning
 * model predictions, teleconnections, and regional soil metrics for the selected taluk.
 *
 * NOTE: Operates transparently in deterministic context mode (no ungrounded LLM hallucinations).
 */

import type { LocationProfile, ForecastResponse } from "./types";

export interface ChatContext {
  location?: Partial<LocationProfile> & { locationName?: string };
  forecast?: ForecastResponse | null;
  cropType?: string;
  cropStage?: string;
}

export async function sendChatMessage(message: string, context?: ChatContext): Promise<string> {
  // Simulate slight cognitive latency for natural feel
  await new Promise((resolve) => setTimeout(resolve, 500));

  const q = message.toLowerCase().trim();
  const taluk = context?.location?.taluk || context?.location?.title || "your selected taluk";
  const district = context?.location?.district || "Karnataka";
  const crop = context?.cropType || "your crop";
  const stage = context?.cropStage || "current stage";
  const fc = context?.forecast;

  if (!fc) {
    return (
      `I am ready to help, but no forecast data has been loaded yet for ${taluk}. ` +
      `Please select a district and taluk or run the forecast calculation on your dashboard.`
    );
  }

  // Extract key metrics from active forecast
  const w1 = fc.horizons?.w1 || fc.horizons?.week_1;
  const w2 = fc.horizons?.w2 || fc.horizons?.week_2;
  const soil = fc.soil;
  const onset = fc.onset;

  const w1ActiveProb =
    w1?.active_monsoon?.probability !== null && w1?.active_monsoon?.probability !== undefined
      ? (w1.active_monsoon.probability * 100).toFixed(1)
      : null;
  const w1HeavyProb =
    w1?.heavy_rain?.probability !== null && w1?.heavy_rain?.probability !== undefined
      ? (w1.heavy_rain.probability * 100).toFixed(1)
      : null;
  const w1BreakProb =
    w1?.break_spell?.probability !== null && w1?.break_spell?.probability !== undefined
      ? (w1.break_spell.probability * 100).toFixed(1)
      : null;

  // 1. Rain / Precipitation / Weather inquiry
  if (
    q.includes("rain") ||
    q.includes("precip") ||
    q.includes("weather") ||
    q.includes("forecast") ||
    q.includes("next 7 days") ||
    q.includes("downpour")
  ) {
    if (w1ActiveProb && w1BreakProb) {
      let advice = "";
      if (w1?.heavy_rain?.triggered) {
        advice = `⚠️ High alert: Heavy rainfall threshold triggered (${w1HeavyProb}%). Ensure field drainage channels are clear to prevent waterlogging.`;
      } else if (w1?.break_spell?.triggered) {
        advice = `⚠️ Dry spell warning: Break spell threshold triggered (${w1BreakProb}%). Prepare conservation furrowing or protective mulch.`;
      } else {
        advice = `Normal conditions expected across Week 1. Active monsoon probability is ${w1ActiveProb}%. Standard agronomic operations may proceed.`;
      }

      return (
        `**Rainfall Outlook for ${taluk} (${district}):**\n\n` +
        `• **Week 1 Active Monsoon (≥30mm):** ${w1ActiveProb}%\n` +
        `• **Week 1 Heavy Rain (≥64.5mm):** ${w1HeavyProb ?? "N/A"}%\n` +
        `• **Week 1 Break Spell (<5mm):** ${w1BreakProb}%\n\n` +
        `**Recommendation:** ${advice}\n\n` +
        `*(Data source: ${fc.weather_data_source === "open_meteo_live" ? "Live Open-Meteo + 0.60 XGB / 0.40 RF Model" : "CHIRPS Climatology Fallback + ML Ensemble"})*`
      );
    }
  }

  // 2. Fertilizer / Chemical spray / Pesticide inquiry
  if (
    q.includes("fertiliz") ||
    q.includes("spray") ||
    q.includes("pesticide") ||
    q.includes("chemical") ||
    q.includes("urea")
  ) {
    const isHeavy = w1?.heavy_rain?.triggered || (w1?.heavy_rain?.probability ?? 0) > 0.3;
    if (isHeavy) {
      return (
        `**Fertilizer & Spray Advisory for ${crop} (${stage}) in ${taluk}:**\n\n` +
        `🚫 **Do NOT apply fertilizer or foliar spray today.**\n` +
        `The ensemble model detects a elevated severe downpour probability (${w1HeavyProb ?? "30+"}%). ` +
        `Rainfall will cause nutrient leaching and chemical run-off. Wait until rainfall stabilizes.`
      );
    }
    return (
      `**Fertilizer Advisory for ${crop} (${stage}) in ${taluk}:**\n\n` +
      `✅ **Conditions are suitable.** Week 1 heavy rain risk is low (${w1HeavyProb ?? "<20"}%). ` +
      `Soil in ${district} is **${soil.type}** with a moisture buffer of **${soil.buffer_days} days**. ` +
      `Apply fertilizer in split doses during morning hours when soil is moist but not saturated.`
    );
  }

  // 3. Soil / Moisture buffer / Irrigation inquiry
  if (
    q.includes("soil") ||
    q.includes("buffer") ||
    q.includes("irrigat") ||
    q.includes("water") ||
    q.includes("awc")
  ) {
    return (
      `**Soil Hydrology Profile for ${district} (${taluk}):**\n\n` +
      `• **Predominant Soil:** ${soil.type}\n` +
      `• **Available Water Capacity (AWC):** ${soil.awc} mm/m\n` +
      `• **Moisture Buffer Retention:** ${soil.buffer_days} days\n` +
      `• **Drainage Characteristics:** ${soil.drainage}\n\n` +
      `**Irrigation Guidance for ${crop}:** Because this soil retains moisture for approximately ${soil.buffer_days} days, ` +
      `if a break spell occurs, apply light supplemental irrigation only after ${Math.max(1, soil.buffer_days - 1)} consecutive dry days.`
    );
  }

  // 4. Monsoon Onset inquiry
  if (
    q.includes("onset") ||
    q.includes("arrival") ||
    q.includes("start of monsoon") ||
    q.includes("monsoon start")
  ) {
    const onsetProb =
      onset?.probability !== null && onset?.probability !== undefined
        ? (onset.probability * 100).toFixed(1)
        : "N/A";
    return (
      `**Monsoon Onset Outlook for ${taluk}:**\n\n` +
      `• **Status:** ${onset.status_tag}\n` +
      `• **14-Day Onset Arrival Probability:** ${onsetProb}%\n` +
      `• **Normal Climatological Window:** ${onset.normal_date_window}\n` +
      `• **Macro Driver Outlook:** ${onset.driver_outlook}\n\n` +
      `*(Note: Climatological onset over Karnataka typically occurs between June 1–10. Outside this window, models monitor late active monsoon surges.)*`
    );
  }

  // 5. Default Context-Aware Synthesis
  return (
    `**Varsha Setu Agronomic Intelligence (${taluk}, ${district}):**\n\n` +
    `• **Target Crop:** ${crop} (${stage})\n` +
    `• **Week 1 Active Rain Probability:** ${w1ActiveProb ?? "N/A"}%\n` +
    `• **Week 2 Outlook:** Active: ${w2?.active_monsoon?.probability ? (w2.active_monsoon.probability * 100).toFixed(1) + "%" : "Normal"}\n` +
    `• **Soil Moisture Buffer:** ${soil.buffer_days} days (${soil.type})\n\n` +
    `**Agronomic Advisory:** ${fc.advisory_text}\n\n` +
    `*Ask me specific questions like: "Will it rain in the next 7 days?", "Is it safe to fertilize?", or "How much moisture does my soil hold?"*`
  );
}
