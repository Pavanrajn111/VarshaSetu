import React from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import type { TargetPrediction, OnsetOutlook, HorizonForecast } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CloudRain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Droplets,
  SunMedium,
  CloudLightning,
  Calendar,
  AlertOctagon,
} from "lucide-react";

export function ForecastPanel() {
  const { forecast, isLoadingForecast, forecastError, rateLimitCountdown, loadForecast } =
    useDashboard();
  const { t } = useLanguage();

  if (isLoadingForecast && !forecast) {
    return (
      <div className="space-y-6">
        <Card className="border border-border/70 bg-card/75 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="size-9 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </Card>

        <Card className="border border-border/70 bg-card/75 p-6 backdrop-blur-xl">
          <Skeleton className="h-6 w-56 mb-4" />
          <div className="grid gap-4 sm:grid-cols-4">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rate Limit Banner (429) */}
      {rateLimitCountdown !== null && (
        <Alert className="border-warning/50 bg-warning/10 text-warning">
          <Clock className="size-4 animate-spin text-warning" />
          <AlertTitle className="font-mono text-xs font-semibold uppercase tracking-wider">
            {t.forecast.rateLimiterActive}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {t.forecast.rateLimiterDesc}{" "}
            <span className="font-mono font-bold text-foreground">{rateLimitCountdown}s</span>...
          </AlertDescription>
        </Alert>
      )}

      {/* General Forecast Error */}
      {forecastError && rateLimitCountdown === null && (
        <Alert className="border-destructive/50 bg-destructive/10 text-destructive">
          <AlertOctagon className="size-4" />
          <AlertTitle className="font-mono text-xs font-semibold uppercase tracking-wider">
            {t.forecast.modelServingNotice}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between text-xs">
            <span>{forecastError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadForecast()}
              className="ml-4 h-7 border-destructive/40 bg-background/50 text-xs hover:bg-background"
            >
              <RefreshCw className="mr-1.5 size-3" /> {t.forecast.retryButton}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Onset Outlook Card */}
      <OnsetOutlookCard onset={forecast?.onset} />

      {/* 4-Week Horizon Grid */}
      <HorizonGrid horizons={forecast?.horizons} />
    </div>
  );
}

/**
 * Onset Outlook Card
 */
function OnsetOutlookCard({ onset }: { onset: OnsetOutlook | undefined }) {
  const { t } = useLanguage();
  const isOnsetUnavailable = !onset || onset.error || onset.probability === null;

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-cyan/30 bg-cyan/10">
              <Calendar className="size-5 text-cyan" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                {t.forecast.onsetTitle}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t.forecast.onsetSubtitle}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-cyan/40 bg-cyan/10 font-mono text-[10px] text-cyan"
          >
            {t.forecast.climatologyPlusML}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {isOnsetUnavailable || onset.probability === null ? (
          /* Isolated Muted Fallback State */
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/40 p-6 text-center">
            <AlertTriangle className="size-6 text-muted-foreground mb-2 opacity-70" />
            <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
              {t.forecast.temporarilyUnavailable}
            </Badge>
            <p className="mt-2 max-w-md text-xs text-muted-foreground">
              {onset?.error
                ? `${t.forecast.modelServingNotice}: ${onset.error}`
                : t.forecast.temporarilyUnavailableDesc}
            </p>
          </div>
        ) : (
          /* Live Onset Outlook Content */
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Probability Metric */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.forecast.onsetProb}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold text-foreground">
                  {Math.round(onset.probability > 1 ? onset.probability : onset.probability * 100)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({t.forecast.cutoff}:{" "}
                  {onset.cutoff !== null && onset.cutoff !== undefined
                    ? `${Math.round(onset.cutoff > 1 ? onset.cutoff : onset.cutoff * 100)}%`
                    : t.common.n_a}
                  )
                </span>
              </div>
              <div className="mt-3">
                {onset.triggered ? (
                  <Badge className="gap-1 border-warning/40 bg-warning/15 text-warning font-mono text-[10px]">
                    <AlertTriangle className="size-3" /> {t.forecast.onsetTriggered}
                  </Badge>
                ) : (
                  <Badge className="gap-1 border-success/40 bg-success/15 text-success font-mono text-[10px]">
                    <CheckCircle2 className="size-3" /> {t.forecast.withinNormal}
                  </Badge>
                )}
              </div>
            </div>

            {/* Normal Date Window */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.forecast.historicalWindow}
              </div>
              <div className="mt-2 font-display text-xl font-medium text-foreground">
                {onset.normal_date_window || "June 05 – June 10"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {t.forecast.historicalWindowDesc}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {t.forecast.statusTag}:{" "}
                <span className="font-mono text-signal">{onset.status_tag || "Standard"}</span>
              </div>
            </div>

            {/* Drivers / Synoptic Context */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.forecast.dynamicalDrivers}
              </div>
              <div className="mt-2 text-xs leading-relaxed text-foreground/90">
                {onset.driver_outlook ||
                  "Synoptic flow and Bay of Bengal low-pressure development align with baseline."}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 4-Week Horizon Grid
 */
function HorizonGrid({ horizons }: { horizons: Record<string, HorizonForecast> | undefined }) {
  const { t } = useLanguage();
  const weeks = [1, 2, 3, 4];

  const getHorizon = (weekNum: number): HorizonForecast | null => {
    if (!horizons) return null;
    return (
      horizons[`week_${weekNum}`] ||
      horizons[String(weekNum)] ||
      Object.values(horizons).find((h) => h.week === weekNum) ||
      null
    );
  };

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <CloudRain className="size-5 text-signal" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                {t.forecast.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t.forecast.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-warning" /> {t.forecast.alertStatus}
            <span className="ml-2 size-2 rounded-full bg-success" /> {t.forecast.normalStatus}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {weeks.map((w) => {
            const h = getHorizon(w);
            return (
              <div
                key={`week-card-${w}`}
                className="flex flex-col rounded-xl border border-border/70 bg-background/50 p-4 transition-all hover:border-signal/40"
              >
                {/* Week Header */}
                <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-2.5">
                  <div className="font-display text-base font-semibold text-foreground">
                    {t.forecast.week} {w}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {h?.horizon_label || `T+${(w - 1) * 7} to T+${w * 7}d`}
                  </span>
                </div>

                {/* 3 Meteorological Targets */}
                <div className="space-y-4">
                  <TargetCell
                    title={t.forecast.breakSpell}
                    icon={<SunMedium className="size-3.5 text-warning" />}
                    target={h?.break_spell}
                    colorClass="bg-warning"
                    textColorClass="text-warning"
                  />
                  <TargetCell
                    title={t.forecast.activeMonsoon}
                    icon={<Droplets className="size-3.5 text-cyan" />}
                    target={h?.active_monsoon}
                    colorClass="bg-cyan"
                    textColorClass="text-cyan"
                  />
                  <TargetCell
                    title={t.forecast.heavyRain}
                    icon={<CloudLightning className="size-3.5 text-signal" />}
                    target={h?.heavy_rain}
                    colorClass="bg-signal"
                    textColorClass="text-signal"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual Target Cell
 */
function TargetCell({
  title,
  icon,
  target,
  colorClass,
  textColorClass,
}: {
  title: string;
  icon: React.ReactNode;
  target: TargetPrediction | null | undefined;
  colorClass: string;
  textColorClass: string;
}) {
  const { t } = useLanguage();
  const isUnavailable = !target || target.error !== null || target.probability === null;

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        {isUnavailable ? (
          <Badge
            variant="outline"
            className="border-border text-[9px] font-mono text-muted-foreground"
          >
            {t.common.n_a}
          </Badge>
        ) : target.triggered ? (
          <Badge className="border-warning/40 bg-warning/15 font-mono text-[9px] text-warning">
            ⚠️ {t.forecast.triggered}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-success/30 bg-success/10 font-mono text-[9px] text-success"
          >
            ✔️ {t.forecast.normal}
          </Badge>
        )}
      </div>

      {isUnavailable ? (
        <div className="mt-2.5 rounded bg-background/50 px-2 py-1.5 text-center">
          <span className="font-mono text-[10px] text-muted-foreground">
            {t.forecast.temporarilyUnavailable}
          </span>
        </div>
      ) : (
        (() => {
          const prob = Math.round(
            target.probability! > 1 ? target.probability! : target.probability! * 100,
          );
          const cutoff = target.cutoff
            ? Math.round(target.cutoff > 1 ? target.cutoff : target.cutoff * 100)
            : null;
          return (
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className={`font-semibold ${textColorClass}`}>{prob}%</span>
                {cutoff !== null && (
                  <span className="text-[10px] text-muted-foreground">{t.forecast.cutoff}: {cutoff}%</span>
                )}
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                  style={{ width: `${Math.min(100, Math.max(0, prob))}%` }}
                />
                {cutoff !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 z-10"
                    style={{ left: `${Math.min(100, Math.max(0, cutoff))}%` }}
                    title={`${t.forecast.cutoff}: ${cutoff}%`}
                  />
                )}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
