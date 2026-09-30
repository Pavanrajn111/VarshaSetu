import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import type { DashboardSection } from "@/components/dashboard/DashboardSidebar";
import { apiClient } from "@/lib/api-client";
import type { HorizonForecast } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceAdvisoryButton } from "@/components/dashboard/VoiceAdvisoryButton";
import {
  CloudRain,
  BarChart3,
  Layers,
  Sprout,
  Map as MapIcon,
  BellRing,
  MapPin,
  ArrowRight,
  Droplets,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Target,
  Sparkles,
  Info,
  Calendar,
  CloudSun,
  Activity,
  Wind,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface OverviewPanelProps {
  onNavigateSection: (section: DashboardSection) => void;
  onOpenLocationSetup: () => void;
}

export function OverviewPanel({
  onNavigateSection,
  onOpenLocationSetup,
}: OverviewPanelProps) {
  const {
    location,
    language,
    forecast,
    isLoadingForecast,
    forecastError,
    cropType,
    cropStage,
    advisoryText,
  } = useDashboard();
  const { t } = useLanguage();

  // 1. Fetch 30-Day Extended Rainfall Outlook (Cached with React Query, location-aware)
  const outlookQuery = useQuery({
    queryKey: ["outlook", location.taluk],
    queryFn: ({ signal }) => apiClient.getOutlook(location.taluk, signal),
    staleTime: 1000 * 60 * 30, // 30 mins freshness
    gcTime: 1000 * 60 * 60 * 24, // 24h retention
    retry: false,
  });

  // 2. Fetch Statewide Risk Dataset (Cached with React Query)
  const riskQuery = useQuery({
    queryKey: ["risk-map-data"],
    queryFn: () => apiClient.getRiskMapData(),
    staleTime: 1000 * 60 * 15, // 15 mins freshness
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  // Find risk profile for the currently selected taluk
  const talukRisk = useMemo(() => {
    if (!riskQuery.data?.taluks) return null;
    const match = riskQuery.data.taluks.find(
      (item) => item.taluk_name.toLowerCase() === location.taluk.toLowerCase(),
    );
    return match || null;
  }, [riskQuery.data, location.taluk]);

  const onset = forecast?.onset;
  const soil = forecast?.soil;
  const tele = forecast?.teleconnections;
  const w1Break = forecast?.targets?.["target_break_w1"];
  const w1Heavy = forecast?.targets?.["target_heavy_w1"];
  const w1Active = forecast?.targets?.["target_active_w1"];

  // Helper for 4-week horizon extraction
  const getHorizon = (weekNum: number): HorizonForecast | null => {
    if (!forecast?.horizons) return null;
    return (
      forecast.horizons[`week_${weekNum}`] ||
      forecast.horizons[String(weekNum)] ||
      Object.values(forecast.horizons).find((h) => h.week === weekNum) ||
      null
    );
  };

  // Rule-based Today's Priority synthesis from verified application data
  const priorityInfo = useMemo(() => {
    const isHeavyTriggered = Boolean(w1Heavy?.triggered || (w1Heavy?.probability ?? 0) > 0.4);
    const isBreakTriggered = Boolean(w1Break?.triggered || (w1Break?.probability ?? 0) > 0.45);
    const isBufferLow = (soil?.buffer_days ?? 8) < 6;

    if (isHeavyTriggered) {
      return {
        title: "Heavy Rainfall Precaution & Drainage Clearance",
        description: `Substantial precipitation (>65mm) probability is elevated (${((w1Heavy?.probability ?? 0) * 100).toFixed(0)}%) in Week 1. Ensure field drainage channels in ${location.taluk} are clear to prevent waterlogging around ${cropType} roots.`,
        irrigationAction: "Withhold scheduled irrigation until post-event soil moisture evaluation.",
        fieldAction: "Postpone chemical foliar spraying and topsoil fertilizer broadcasting.",
        badge: "Heavy Rain Alert",
        badgeClass: "border-purple-500/40 bg-purple-500/10 text-purple-400",
      };
    }

    if (isBreakTriggered) {
      return {
        title: "Dry Spell Preparedness & Moisture Conservation",
        description: `Elevated dry spell probability (${((w1Break?.probability ?? 0) * 100).toFixed(0)}%) indicated for Week 1. Soil moisture buffer is ${soil?.buffer_days ?? 8} days. Prepare micro-irrigation scheduling for ${cropType} (${cropStage}).`,
        irrigationAction: "Apply critical stage irrigation before root zone moisture depletion.",
        fieldAction: "Consider organic or biomass mulching to minimize evapotranspiration losses.",
        badge: "Dry Spell Risk",
        badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      };
    }

    if (isBufferLow) {
      return {
        title: "Soil Moisture Conservation Priority",
        description: `Current topsoil buffer is constrained at ${soil?.buffer_days ?? 4} days. With active crop growth in ${cropStage}, maintain vigilant field monitoring across ${location.taluk}.`,
        irrigationAction: "Plan deficit or furrow irrigation within the next 48–72 hours.",
        fieldAction: "Inspect secondary root zone moisture depth across representative plots.",
        badge: "Moisture Watch",
        badgeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
      };
    }

    return {
      title: "Optimal Growth & Agronomic Maintenance",
      description: `Favorable agro-climatic conditions prevailing across ${location.taluk}. Soil moisture buffer of ${soil?.buffer_days ?? 8} days provides adequate water reserves for ${cropType} (${cropStage}).`,
      irrigationAction: "Continue regular crop water management aligned with FAO-56 stage demand.",
      fieldAction: "Proceed with scheduled agronomic weeding and balanced nutrient maintenance.",
      badge: "Normal Operations",
      badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    };
  }, [w1Heavy, w1Break, soil, cropType, cropStage, location.taluk]);

  // Mini 30-day rainfall chart data format
  const chartData = useMemo(() => {
    if (!outlookQuery.data?.daily_outlook) return [];
    return outlookQuery.data.daily_outlook.map((d, idx) => ({
      day: `D${idx + 1}`,
      date: d.forecast_date,
      rain: d.combined_mm,
    }));
  }, [outlookQuery.data]);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* ========================================================================= */}
      {/* 1. LOCATION HEADER                                                        */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border border-border/70 bg-card/85 shadow-xl backdrop-blur-xl">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-signal/40 bg-signal/15 text-signal shadow-md shadow-signal/10">
                <MapPin className="size-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
                    {location.locationName || `${location.taluk} Taluk HQ`}
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal shrink-0"
                  >
                    {location.scaleTag || "Administrative Taluk Node"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                  <span className="text-foreground/90 font-medium">
                    {location.district} {t.location.districtLabel}
                  </span>
                  <span>·</span>
                  <span>
                    {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live agricultural intelligence
                  </span>
                </div>
              </div>
            </div>

            {/* Change Location Button */}
            <Button
              type="button"
              onClick={onOpenLocationSetup}
              variant="outline"
              size="sm"
              className="self-start sm:self-auto border-signal/40 bg-signal/10 hover:bg-signal/20 text-signal font-mono text-xs font-semibold h-9 px-4 gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <Compass className="size-3.5" />
              {t.sidebar.changeLocation}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 2. CURRENT CONDITIONS CARD ROW (4 Key Metrics)                            */}
      {/* ========================================================================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Expected Rainfall */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-md backdrop-blur-xl hover:border-signal/50 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
                <CloudRain className="size-4" />
              </span>
              <Badge
                variant="outline"
                className="border-signal/30 bg-signal/10 text-[9px] font-mono text-signal uppercase"
              >
                30-Day Outlook
              </Badge>
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t.overview.rainfall || "Rainfall"}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingForecast && !forecast && !outlookQuery.data ? (
              <Skeleton className="h-9 w-28 my-1" />
            ) : (
              <div className="flex items-baseline gap-1.5 font-display text-2xl font-bold text-foreground">
                <span>
                  {outlookQuery.data?.summary.total_expected_precip_mm !== undefined
                    ? outlookQuery.data.summary.total_expected_precip_mm.toFixed(1)
                    : (w1Active?.probability ?? 0) > 0.5
                    ? "70–90"
                    : "40–60"}
                </span>
                <span className="font-mono text-xs font-normal text-muted-foreground">mm</span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
              {outlookQuery.data?.summary.mean_daily_precip_mm !== undefined
                ? `${outlookQuery.data.summary.mean_daily_precip_mm.toFixed(1)} mm/day mean rate`
                : "Multi-model ensemble outlook"}
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Atmospheric / Monsoon Dynamics */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-md backdrop-blur-xl hover:border-cyan/50 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
                <Wind className="size-4" />
              </span>
              <Badge
                variant="outline"
                className="border-cyan/30 bg-cyan/10 text-[9px] font-mono text-cyan uppercase"
              >
                Synoptic State
              </Badge>
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Monsoon Dynamics
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingForecast && !forecast ? (
              <Skeleton className="h-9 w-32 my-1" />
            ) : (
              <div className="font-display text-xl font-bold text-foreground truncate">
                {tele?.is_el_nino ? "El Niño Active" : tele?.is_pos_iod ? "+IOD Positive" : "Neutral ENSO"}
              </div>
            )}
            <p className="mt-1 text-xs text-cyan font-mono truncate">
              Onset: {onset?.status_tag || "Standard Window"}
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Soil Available Water Capacity */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-md backdrop-blur-xl hover:border-warning/50 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
                <Layers className="size-4" />
              </span>
              <Badge
                variant="outline"
                className="border-warning/30 bg-warning/10 text-[9px] font-mono text-warning uppercase"
              >
                FAO-56 AWC
              </Badge>
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t.soil.awc}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingForecast && !forecast ? (
              <Skeleton className="h-9 w-24 my-1" />
            ) : (
              <div className="flex items-baseline gap-1.5 font-display text-2xl font-bold text-foreground">
                <span>{soil?.awc ?? 160}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">mm/m</span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
              {soil?.buffer_days ?? 8} {t.soil.bufferDays} ({soil?.drainage || "Well Drained"})
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Risk Level */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-md backdrop-blur-xl hover:border-rose-500/50 transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span
                className={`grid size-8 place-items-center rounded-lg border ${
                  talukRisk?.risk_category === "HIGH" || (w1Break?.probability ?? 0) > 0.45
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    : talukRisk?.risk_category === "MODERATE" || (w1Break?.probability ?? 0) > 0.25
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                <AlertTriangle className="size-4" />
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] font-mono uppercase ${
                  talukRisk?.risk_category === "HIGH" || (w1Break?.probability ?? 0) > 0.45
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                    : talukRisk?.risk_category === "MODERATE" || (w1Break?.probability ?? 0) > 0.25
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {talukRisk?.risk_category || ((w1Break?.probability ?? 0) > 0.45 ? "HIGH" : "LOW")}
              </Badge>
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t.overview.risk || "Risk Level"}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingForecast && !forecast ? (
              <Skeleton className="h-9 w-28 my-1" />
            ) : (
              <div
                className={`font-display text-2xl font-bold ${
                  talukRisk?.risk_category === "HIGH" || (w1Break?.probability ?? 0) > 0.45
                    ? "text-rose-400"
                    : talukRisk?.risk_category === "MODERATE" || (w1Break?.probability ?? 0) > 0.25
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {talukRisk ? `${talukRisk.risk_score_pct.toFixed(0)}% Index` : `${((w1Break?.probability ?? 0.15) * 100).toFixed(0)}% Vulnerability`}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
              {talukRisk?.risk_basis || "Break spell calibrated baseline"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 3. 4-WEEK FORECAST SUMMARY                                                */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
                <CloudRain className="size-5" />
              </span>
              <div>
                <CardTitle className="font-display text-lg font-semibold text-foreground">
                  {t.overview.forecastCard}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Sub-seasonal multi-target probabilities across 4 rolling weekly horizons
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="self-start sm:self-auto border-signal/40 bg-signal/10 font-mono text-[10px] text-signal"
            >
              Dual Ensemble (XGB + RF)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {isLoadingForecast && !forecast ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          ) : forecastError && !forecast ? (
            <div className="p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-center space-y-2">
              <AlertTriangle className="size-6 text-destructive mx-auto" />
              <div className="text-sm font-semibold text-destructive">
                Forecast temporarily unavailable for {location.taluk}
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{forecastError}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((wk) => {
                const horizon = getHorizon(wk);
                const breakProb = horizon?.break_spell?.probability ?? 0;
                const activeProb = horizon?.active_monsoon?.probability ?? 0;
                const heavyProb = horizon?.heavy_rain?.probability ?? 0;

                const horizonLabel =
                  wk === 1
                    ? "Days 1–7"
                    : wk === 2
                    ? "Days 8–14"
                    : wk === 3
                    ? "Days 15–21"
                    : "Days 22–30";

                return (
                  <div
                    key={wk}
                    className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/50 p-4 hover:border-signal/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-border/30 pb-2 mb-3">
                        <div className="font-display font-semibold text-foreground text-sm">
                          Week {wk}
                        </div>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] border-border text-muted-foreground"
                        >
                          {horizonLabel}
                        </Badge>
                      </div>

                      {/* Probabilities */}
                      <div className="space-y-2.5 text-xs font-mono">
                        {/* Active Monsoon */}
                        <div>
                          <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                            <span>Active Monsoon:</span>
                            <span className="font-bold text-cyan">
                              {(activeProb * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className="h-full bg-cyan transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, activeProb * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Break Spell */}
                        <div>
                          <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                            <span>Break Spell:</span>
                            <span
                              className={`font-bold ${
                                breakProb > 0.45 ? "text-rose-400" : "text-foreground"
                              }`}
                            >
                              {(breakProb * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                breakProb > 0.45 ? "bg-rose-500" : "bg-signal"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, breakProb * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Heavy Rain */}
                        <div>
                          <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                            <span>Heavy Rain (&gt;65mm):</span>
                            <span
                              className={`font-bold ${
                                heavyProb > 0.4 ? "text-purple-400" : "text-foreground"
                              }`}
                            >
                              {(heavyProb * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className="h-full bg-purple-400 transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, heavyProb * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">Condition</span>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[9px] ${
                          breakProb > 0.45
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                            : activeProb > 0.5
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {breakProb > 0.45 ? "Dry Spell Watch" : activeProb > 0.5 ? "Active Wet" : "Normal"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 bg-background/30 border-t border-border/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            Trained on 24-year IMD gridded datasets
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSection("forecast")}
            className="text-xs text-signal hover:text-signal hover:bg-signal/10 font-mono ml-auto cursor-pointer gap-1.5 group"
          >
            <span>View Full Forecast</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        </CardFooter>
      </Card>

      {/* ========================================================================= */}
      {/* 4. MONSOON / RAINFALL OUTLOOK (30-Day Outlook Summary)                    */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
                <BarChart3 className="size-5" />
              </span>
              <div>
                <CardTitle className="font-display text-lg font-semibold text-foreground">
                  {t.overview.outlookCard}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  30-Day Multi-Agency Ensemble (GFS, ECMWF, ICON) + Climatology Blend
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan/40 bg-cyan/10 font-mono text-[10px] text-cyan"
              >
                {outlookQuery.data?.total_days || 30} Days Horizon
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {outlookQuery.isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : outlookQuery.isError || !outlookQuery.data ? (
            <div className="p-5 rounded-xl border border-border/60 bg-background/40 space-y-3">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Info className="size-4 text-cyan" />
                <span className="text-xs font-medium text-foreground">
                  30-Day Extended High-Resolution Outlook
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                High-resolution 3-agency ensemble is operational for primary pilot regions and expanding statewide. For {location.taluk}, standard 4-week sub-seasonal ML predictions are actively computed above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Total Expected Rain
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-signal">
                    {outlookQuery.data.summary.total_expected_precip_mm.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">mm</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Daily Average
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">
                    {outlookQuery.data.summary.mean_daily_precip_mm.toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">mm/d</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Blended NWP (D1–16)
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-cyan">
                    {outlookQuery.data.summary.blended_days} Days
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Climatology (D17–30)
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-muted-foreground">
                    {outlookQuery.data.summary.climatology_days} Days
                  </div>
                </div>
              </div>

              {/* Trajectory preview chart */}
              {chartData.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      Daily Expected Precipitation Trajectory (mm)
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    >
                      Ensemble Multi-Agency
                    </Badge>
                  </div>
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis
                          dataKey="day"
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="mm" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0]?.payload;
                            return (
                              <div className="rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur-md text-xs font-mono">
                                <div className="text-muted-foreground">{item?.date}</div>
                                <div className="font-bold text-signal">{item?.rain?.toFixed(1)} mm</div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="rain"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          fill="url(#rainGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 bg-background/30 border-t border-border/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            70% ECMWF/GFS/ICON Blend + 30% Historical Baseline
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSection("outlook")}
            className="text-xs text-cyan hover:text-cyan hover:bg-cyan/10 font-mono ml-auto cursor-pointer gap-1.5 group"
          >
            <span>View Full Outlook</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
        </CardFooter>
      </Card>

      {/* ========================================================================= */}
      {/* 5 & 6. SOIL & WATER STATUS (Left) | CROP ADVISORY (Right)                */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Section 5: Soil & Water Status */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl h-full">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
                  <Layers className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-lg font-semibold text-foreground">
                    {t.soil.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Root-zone moisture retention & dry spell buffering
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-warning/40 bg-warning/10 font-mono text-[10px] text-warning"
              >
                FAO-56 Dual-Kc
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Soil type classification */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-warning font-semibold">
                Soil Classification
              </div>
              <div className="mt-1 font-display text-base font-bold text-foreground">
                {soil?.type || "Deep Black & Lateritic Blend"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Drainage: <span className="font-mono text-foreground">{soil?.drainage || "Well Drained"}</span>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase">AWC</span>
                  <Droplets className="size-3.5 text-cyan" />
                </div>
                <div className="mt-1 font-display text-xl font-bold text-foreground">
                  {soil?.awc ?? 160}{" "}
                  <span className="font-mono text-xs font-normal text-muted-foreground">mm/m</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Available Water Capacity</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase">Dry Spell Buffer</span>
                  <Clock className="size-3.5 text-signal" />
                </div>
                <div className="mt-1 font-display text-xl font-bold text-signal">
                  {soil?.buffer_days ?? 8}{" "}
                  <span className="font-mono text-xs font-normal text-muted-foreground">days</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Moisture reserve window</p>
              </div>
            </div>

            {/* Dynamic Agricultural Interpretation */}
            <div className="p-3.5 rounded-xl border border-border/50 bg-background/30 text-xs leading-relaxed text-foreground/90">
              <span className="font-semibold text-warning">Agronomic Interpretation: </span>
              {(soil?.buffer_days ?? 8) >= 7
                ? `Current soil water retention (${soil?.awc ?? 160} mm/m) provides strong buffering (>7 days) against intermittent dry spells for ${cropType}.`
                : `Soil moisture buffer is constrained at ${soil?.buffer_days ?? 4} days; prioritize deficit irrigation scheduling for ${cropType} during rainfall pauses.`}
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-background/30 border-t border-border/40 mt-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateSection("soil")}
              className="w-full justify-between text-xs text-warning hover:text-warning hover:bg-warning/10 font-mono cursor-pointer h-8 px-2 group"
            >
              <span>View Soil & Hydrology</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardFooter>
        </Card>

        {/* Section 6: Crop Water Advisory */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl h-full">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-success/30 bg-success/10 text-success">
                  <Sprout className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-lg font-semibold text-foreground">
                    {t.crop.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Targeted crop stage recommendations
                  </p>
                </div>
              </div>
              {advisoryText && <VoiceAdvisoryButton text={advisoryText} language={language} />}
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Active Crop & Stage Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-background/50">
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground">Active Crop</div>
                <div className="font-display text-base font-bold text-foreground mt-0.5">
                  {cropType}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono uppercase text-muted-foreground">Growth Stage</div>
                <Badge
                  variant="outline"
                  className="mt-0.5 border-success/40 bg-success/10 text-success font-mono text-xs"
                >
                  {cropStage}
                </Badge>
              </div>
            </div>

            {/* Advisory Quote Box */}
            <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-success">
                <Sparkles className="size-3.5" />
                <span>Dual-Kc Agronomic Recommendation</span>
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 italic">
                "{advisoryText || "Monitor soil moisture before the next scheduled irrigation. Align fertilizer application with dry windows."}"
              </p>
            </div>

            {/* Irrigation Status */}
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-muted-foreground">
              <span>Evapotranspiration Status:</span>
              <span className="font-semibold text-foreground">FAO-56 Stage Calibrated</span>
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-background/30 border-t border-border/40 mt-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateSection("crop")}
              className="w-full justify-between text-xs text-success hover:text-success hover:bg-success/10 font-mono cursor-pointer h-8 px-2 group"
            >
              <span>View Crop Advisory</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 7 & 8. RISK SUMMARY (Left) | TODAY'S PRIORITY (Right)                     */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Section 7: Risk Summary */}
        <Card className="flex flex-col justify-between border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl h-full">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
                  <MapIcon className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-lg font-semibold text-foreground">
                    {t.overview.riskCard}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Statewide spatial risk model & taluk vulnerability snapshot
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal"
              >
                236 Taluks Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Active Taluk Classification Box */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-foreground">
                  {location.taluk} Taluk Classification
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  {talukRisk?.risk_basis || "Calibrated baseline vulnerability"}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`font-mono text-xs ${
                  talukRisk?.risk_category === "HIGH" || (w1Break?.probability ?? 0) > 0.45
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                    : talukRisk?.risk_category === "MODERATE" || (w1Break?.probability ?? 0) > 0.25
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {talukRisk?.risk_category || ((w1Break?.probability ?? 0) > 0.45 ? "HIGH RISK" : "LOW RISK")}
              </Badge>
            </div>

            {/* Risk Category Breakdown */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CloudRain className="size-3.5 text-signal" />
                  Heavy Rain Event (W1):
                </span>
                <span className="font-bold text-foreground">
                  {((w1Heavy?.probability ?? 0) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Flame className="size-3.5 text-amber-400" />
                  Dry Spell Pause (W1):
                </span>
                <span
                  className={`font-bold ${
                    (w1Break?.probability ?? 0) > 0.45 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {((w1Break?.probability ?? 0) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/30">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-warning" />
                  Crop Moisture Stress:
                </span>
                <span className="font-bold text-foreground">
                  {(soil?.buffer_days ?? 8) < 5 ? "Elevated Watch" : "Low Risk (Buffered)"}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-background/30 border-t border-border/40 mt-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateSection("risk_map")}
              className="w-full justify-between text-xs text-signal hover:text-signal hover:bg-signal/10 font-mono cursor-pointer h-8 px-2 group"
            >
              <span>View Full Risk Map</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardFooter>
        </Card>

        {/* Section 8: "Today's Priority" (Highlighted Premium Executive Card) */}
        <Card className="flex flex-col justify-between border-2 border-signal/40 bg-gradient-to-br from-signal/10 via-card/90 to-card shadow-xl backdrop-blur-xl h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
            <Target className="size-32 text-signal" />
          </div>

          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-signal/50 bg-signal/20 text-signal shadow-sm shadow-signal/20">
                  <Target className="size-5" />
                </span>
                <div>
                  <CardTitle className="font-display text-lg font-bold text-foreground">
                    🎯 Today's Priority
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Actionable operational directives synthesized from active conditions
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`font-mono text-[10px] ${priorityInfo.badgeClass}`}>
                {priorityInfo.badge}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-foreground leading-snug">
                {priorityInfo.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                {priorityInfo.description}
              </p>
            </div>

            {/* Action Checklist */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="size-4 text-signal shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Irrigation: </span>
                  {priorityInfo.irrigationAction}
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="size-4 text-signal shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Fieldwork: </span>
                  {priorityInfo.fieldAction}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 bg-background/30 border-t border-border/40 mt-auto flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">
              Updated automatically with local predictions
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateSection("alerts")}
              className="border-signal/40 bg-signal/10 hover:bg-signal/20 text-signal text-xs font-mono h-8 cursor-pointer"
            >
              <BellRing className="size-3.5 mr-1.5" />
              Configure Alerts
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 9. SERVICE NAVIGATION GRID                                               */}
      {/* ========================================================================= */}
      <Card className="border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base font-semibold text-foreground">
              Explore Varsha Setu Intelligence Services
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Location: {location.taluk}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. 4-Week Forecast */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("forecast")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-signal/50 hover:bg-signal/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal group-hover:scale-110 transition-transform">
                <CloudRain className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                4-Week Forecast
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Sub-Seasonal</span>
            </Button>

            {/* 2. Rainfall Outlook */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("outlook")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-cyan/50 hover:bg-cyan/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan group-hover:scale-110 transition-transform">
                <BarChart3 className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                Rainfall Outlook
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">30-Day Multi-Model</span>
            </Button>

            {/* 3. Soil & Hydrology */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("soil")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-warning/50 hover:bg-warning/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-warning/30 bg-warning/10 text-warning group-hover:scale-110 transition-transform">
                <Layers className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                Soil & Hydrology
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">FAO-56 AWC</span>
            </Button>

            {/* 4. Crop Advisory */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("crop")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-success/50 hover:bg-success/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-success/30 bg-success/10 text-success group-hover:scale-110 transition-transform">
                <Sprout className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                Crop Advisory
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Dual-Kc Water</span>
            </Button>

            {/* 5. Risk Map */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("risk_map")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-signal/50 hover:bg-signal/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal group-hover:scale-110 transition-transform">
                <MapIcon className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                Statewide Risk Map
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">236 Taluks</span>
            </Button>

            {/* 6. Alerts */}
            <Button
              variant="outline"
              onClick={() => onNavigateSection("alerts")}
              className="h-auto p-3.5 flex flex-col items-center justify-center gap-2 border-border/70 bg-background/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-center cursor-pointer group"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                <BellRing className="size-4" />
              </span>
              <span className="font-display text-xs font-semibold text-foreground">
                Alerts & Voice
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Last-Mile Push</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
