import React, { useEffect, useState, useMemo } from "react";
import { useDashboard, type LocationState } from "@/context/DashboardContext";
import { apiClient, ApiError } from "@/lib/api-client";
import type { OutlookResponse, DailyOutlookRecord } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CloudRain,
  Calendar,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
  Compass,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export const PILOT_TALUKS: {
  taluk: string;
  district: string;
  lat: number;
  lon: number;
  zone: string;
}[] = [
  {
    taluk: "Sirsi",
    district: "Uttara Kannada",
    lat: 14.62,
    lon: 74.835,
    zone: "Western Ghats / Malnad",
  },
  { taluk: "Belagavi", district: "Belagavi", lat: 15.85, lon: 74.498, zone: "Northern Transition" },
  { taluk: "Ballari", district: "Ballari", lat: 15.139, lon: 76.921, zone: "North-Eastern Dry" },
  { taluk: "Mysuru", district: "Mysuru", lat: 12.296, lon: 76.639, zone: "Southern Dry" },
  {
    taluk: "Kalaburagi",
    district: "Kalaburagi",
    lat: 17.33,
    lon: 76.834,
    zone: "North-Eastern Transition",
  },
  {
    taluk: "Shivamogga",
    district: "Shivamogga",
    lat: 13.93,
    lon: 75.568,
    zone: "Central Wet / Malnad",
  },
  {
    taluk: "Mangaluru",
    district: "Dakshina Kannada",
    lat: 12.87,
    lon: 75.243,
    zone: "Coastal Zone",
  },
  {
    taluk: "Bengaluru South",
    district: "Bengaluru Urban",
    lat: 12.92,
    lon: 77.58,
    zone: "Eastern Dry",
  },
];

function getAgreementBadgeClass(agreement: string) {
  switch (agreement) {
    case "HIGH":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "MODERATE":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "LOW":
      return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-400";
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: DailyOutlookRecord & { dayIndex: number; formattedDate: string };
  }>;
  label?: string;
}

function CustomOutlookTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data: DailyOutlookRecord & { dayIndex: number; formattedDate: string } =
    payload[0]?.payload;
  if (!data) return null;

  const isBlended = data.forecast_basis === "blended";

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-md font-sans text-xs min-w-[240px] space-y-2">
      <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
        <div className="font-semibold text-foreground">
          Day {data.dayIndex} · {data.forecast_date}
        </div>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] uppercase ${getAgreementBadgeClass(data.source_agreement)}`}
        >
          {data.source_agreement}
        </Badge>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground font-mono">Expected Rainfall:</span>
        <span className="font-mono text-base font-bold text-signal">
          {data.combined_mm.toFixed(1)}{" "}
          <span className="text-xs font-normal text-muted-foreground">mm</span>
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Horizon Basis: </span>
        {isBlended
          ? "70% 3-Agency Ensemble + 30% Climatology"
          : "100% Climatology Baseline (Beyond 16-day live cutoff)"}
      </div>

      {isBlended && (
        <div className="border-t border-border/40 pt-1.5 space-y-1 text-[11px] font-mono">
          <div className="text-muted-foreground font-sans font-medium text-[10px] uppercase tracking-wider">
            Underlying Agency Forecasts:
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
            <div>
              GFS (US):{" "}
              <span className="text-foreground">
                {data.gfs_mm !== null ? `${data.gfs_mm} mm` : "—"}
              </span>
            </div>
            <div>
              ICON (DWD):{" "}
              <span className="text-foreground">
                {data.icon_mm !== null ? `${data.icon_mm} mm` : "—"}
              </span>
            </div>
            <div>
              ECMWF (EU):{" "}
              <span className="text-foreground">
                {data.ecmwf_mm !== null ? `${data.ecmwf_mm} mm` : "—"}
              </span>
            </div>
            <div>
              Normal Baseline:{" "}
              <span className="text-foreground">
                {data.climatology_mm !== null ? `${data.climatology_mm} mm` : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RainfallOutlookPanel() {
  const { location, setLocation } = useDashboard();
  const [outlook, setOutlook] = useState<OutlookResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPilotOnlyError, setIsPilotOnlyError] = useState<boolean>(false);

  const fetchOutlook = async (talukName: string) => {
    setIsLoading(true);
    setError(null);
    setIsPilotOnlyError(false);

    try {
      const data = await apiClient.getOutlook(talukName);
      setOutlook(data);
    } catch (err) {
      setOutlook(null);
      if (err instanceof ApiError && err.status === 404) {
        setIsPilotOnlyError(true);
        setError(
          err.message || "Extended outlook available for pilot taluks only (expanding soon).",
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to retrieve 7-30 day precipitation outlook.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (location?.taluk) {
      fetchOutlook(location.taluk);
    }
  }, [location?.taluk]);

  // Transform data for Recharts:
  // Days 1-16: blended_line (solid cyan)
  // Days 16-30: climatology_line (dashed purple/slate)
  // Day 16 bridges both for visual continuity without a disjoint gap.
  const chartData = useMemo(() => {
    if (!outlook?.daily_outlook) return [];

    return outlook.daily_outlook.map((record, idx) => {
      const dayNum = idx + 1;
      const isBlended = record.forecast_basis === "blended";
      const isBridgeDay = dayNum === 16;

      return {
        ...record,
        dayIndex: dayNum,
        shortDate: record.forecast_date.slice(5),
        // Blended line has values on days 1-16
        blendedLineMm: isBlended ? record.combined_mm : null,
        // Climatology line has values on days 16-30 (including day 16 to connect smoothly)
        climatologyLineMm: !isBlended || isBridgeDay ? record.combined_mm : null,
      };
    });
  }, [outlook]);

  // Aggregate 4-week totals
  const weeklyAggregates = useMemo(() => {
    if (!outlook?.daily_outlook || outlook.daily_outlook.length < 28) return null;

    const weeks = [
      {
        label: "Week 1 (Days 1–7)",
        slice: outlook.daily_outlook.slice(0, 7),
        type: "Blended Live",
      },
      {
        label: "Week 2 (Days 8–14)",
        slice: outlook.daily_outlook.slice(7, 14),
        type: "Blended Live",
      },
      {
        label: "Week 3 (Days 15–21)",
        slice: outlook.daily_outlook.slice(14, 21),
        type: "Transition",
      },
      {
        label: "Week 4 (Days 22–30)",
        slice: outlook.daily_outlook.slice(21, 30),
        type: "Climatology",
      },
    ];

    return weeks.map((w) => {
      const totalMm = w.slice.reduce((acc, curr) => acc + (curr.combined_mm || 0), 0);
      const lowCount = w.slice.filter((d) => d.source_agreement === "LOW").length;
      const agreementSummary =
        w.type === "Climatology"
          ? "Baseline Normal"
          : lowCount > 2
            ? "Low Agreement"
            : lowCount > 0
              ? "Moderate Agreement"
              : "High Agreement";

      return {
        label: w.label,
        type: w.type,
        totalMm: Math.round(totalMm * 10) / 10,
        agreementSummary,
      };
    });
  }, [outlook]);

  return (
    <Card className="border border-border/70 bg-card/75 shadow-xl backdrop-blur-xl transition-all">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-signal/15 text-signal">
                <CloudRain className="size-4" />
              </div>
              <CardTitle className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                7–30 Day Rainfall Outlook (mm)
              </CardTitle>
              <Badge
                variant="outline"
                className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal uppercase"
              >
                Quantitative Amount
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Complementary rainfall volume outlook — 70/30 multi-model blend (Days 1–16) and
              climatology baseline (Days 17–30). Answers{" "}
              <em>&quot;how much rain is expected?&quot;</em> alongside the 13-target event
              probability grid.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => location?.taluk && fetchOutlook(location.taluk)}
              disabled={isLoading}
              className="h-8 border-border/80 bg-glass/60 text-xs font-mono"
            >
              <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary stat strip if loaded */}
        {outlook && !isLoading && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 pt-2 border-t border-border/40 font-mono text-xs">
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground block font-sans">
                30-Day Cumulative
              </span>
              <span className="text-sm font-bold text-foreground sm:text-base">
                {outlook.summary.total_expected_precip_mm.toFixed(1)}{" "}
                <span className="text-xs font-normal text-muted-foreground">mm</span>
              </span>
            </div>
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground block font-sans">
                Daily Normal Mean
              </span>
              <span className="text-sm font-bold text-foreground sm:text-base">
                {outlook.summary.mean_daily_precip_mm.toFixed(1)}{" "}
                <span className="text-xs font-normal text-muted-foreground">mm/d</span>
              </span>
            </div>
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground block font-sans">
                Days 1–16 (Blended)
              </span>
              <span className="text-sm font-semibold text-signal sm:text-base flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-signal" />
                {outlook.summary.blended_days} Days Live
              </span>
            </div>
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground block font-sans">
                Days 17–30 (Climatology)
              </span>
              <span className="text-sm font-semibold text-purple-400 sm:text-base flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-purple-400" />
                {outlook.summary.climatology_days} Days Baseline
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 py-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          </div>
        )}

        {/* 404 / Non-pilot taluk state with quick-switch */}
        {!isLoading && isPilotOnlyError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-md space-y-4">
            <div className="flex items-start gap-3">
              <Compass className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-sm">
                  Extended 7–30 Day Outlook Available for Pilot Taluks Only
                </h4>
                <p className="text-xs text-muted-foreground">
                  The multi-agency ensemble (GFS + ICON + ECMWF) currently runs for 8 pilot taluks
                  representing Karnataka&apos;s distinct agro-climatic zones to prevent external API
                  rate-limiting during operational evaluation. Full statewide expansion across all
                  236 taluks is scheduled next.
                </p>
              </div>
            </div>

            <div className="border-t border-amber-500/20 pt-3">
              <div className="text-[11px] font-mono text-amber-300 mb-2 uppercase tracking-wider">
                Select an active pilot taluk to view live extended outlook:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PILOT_TALUKS.map((p) => (
                  <Button
                    key={p.taluk}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLocation({
                        taluk: p.taluk,
                        district: p.district,
                        lat: p.lat,
                        lon: p.lon,
                        locationName: `${p.taluk} Taluk HQ`,
                        scaleTag: "Administrative Taluk Node",
                      });
                    }}
                    className="h-auto py-1.5 px-2 flex flex-col items-start text-left border-border/80 bg-background/60 hover:bg-signal/15 hover:border-signal/50"
                  >
                    <span className="font-semibold text-foreground text-xs">{p.taluk}</span>
                    <span className="text-[10px] text-muted-foreground">{p.zone}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generic Error state */}
        {!isLoading && error && !isPilotOnlyError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Active 30-Day Recharts Visualization */}
        {!isLoading && outlook && chartData.length > 0 && (
          <div className="space-y-4">
            {/* Legend banner explaining the visual divergence */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono px-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-signal">
                  <span className="inline-block h-0.5 w-5 bg-signal" />
                  <span>Days 1–16: 70/30 Blended Ensemble</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-400">
                  <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-purple-400" />
                  <span>Days 17–30: Climatology Baseline</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Model Agreement:</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">● High</span>
                <span className="inline-flex items-center gap-1 text-amber-400">● Moderate</span>
                <span className="inline-flex items-center gap-1 text-rose-400">
                  ● Low Divergence
                </span>
              </div>
            </div>

            {/* Main Recharts Area & Composed Chart */}
            <div className="h-72 w-full rounded-xl border border-border/50 bg-background/40 p-2 sm:p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="blendedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="climatologyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.3}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="dayIndex"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `D${val}`}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    unit=" mm"
                    domain={[0, "auto"]}
                  />

                  <Tooltip content={<CustomOutlookTooltip />} />

                  {/* Vertical demarcation at Day 16 */}
                  <ReferenceLine
                    x={16}
                    stroke="#64748b"
                    strokeDasharray="3 3"
                    label={{
                      value: "16-Day Forecast Horizon Cutoff",
                      position: "insideTopLeft",
                      fill: "#94a3b8",
                      fontSize: 10,
                    }}
                  />

                  {/* Days 1-16 Solid Blended Area & Line */}
                  <Area
                    type="monotone"
                    dataKey="blendedLineMm"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#blendedGradient)"
                    name="Blended Ensemble"
                    connectNulls={false}
                  />

                  {/* Days 17-30 Dashed Climatology Area & Line */}
                  <Line
                    type="monotone"
                    dataKey="climatologyLineMm"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Climatology Baseline"
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 4-Week Aggregates Cards */}
            {weeklyAggregates && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {weeklyAggregates.map((wk, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-background/50 p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{wk.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                        {wk.type}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between border-t border-border/40 pt-2 font-mono">
                      <div>
                        <span className="text-base font-bold text-foreground">{wk.totalMm}</span>
                        <span className="text-xs text-muted-foreground ml-1">mm</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          wk.agreementSummary.includes("Low")
                            ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                            : wk.agreementSummary.includes("Mod")
                              ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              : wk.agreementSummary.includes("High")
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                : "border-slate-500/30 text-slate-400 bg-slate-500/10"
                        }`}
                      >
                        {wk.agreementSummary}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
