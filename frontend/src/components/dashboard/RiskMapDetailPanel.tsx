import React from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  X,
  SunMedium,
  CloudLightning,
  Sparkles,
  Layers,
  Loader2,
} from "lucide-react";

interface RiskMapDetailPanelProps {
  onClose: () => void;
  clickedPointName?: string | undefined;
  clickedPointDistance?: number | undefined;
}

export function RiskMapDetailPanel({
  onClose,
  clickedPointDistance,
}: RiskMapDetailPanelProps) {
  const { location, forecast, isLoadingForecast, forecastError } = useDashboard();
  const { t } = useLanguage();

  // Guard against displaying stale data from a previous location
  const isForecastStale =
    forecast &&
    location &&
    forecast.location.taluk.trim().toLowerCase() !== location.taluk.trim().toLowerCase();

  const isDataLoading = isLoadingForecast || isForecastStale;

  const horizons = forecast?.horizons;
  const onset = forecast?.onset;
  const soil = forecast?.soil;

  return (
    <Card className="border border-border/80 bg-card/95 shadow-2xl backdrop-blur-2xl transition-all">
      <CardHeader className="border-b border-border/40 p-4 pb-3 flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-signal/40 bg-signal/15 text-signal">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate font-display text-sm font-semibold text-foreground">
              {location.locationName || `${location.taluk} ${t.location.talukLabel}`}
            </CardTitle>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground truncate">
              <span>{location.district} {t.location.districtLabel}</span>
              {clickedPointDistance !== undefined && clickedPointDistance > 0 && (
                <>
                  <span>·</span>
                  <span className="text-signal">{clickedPointDistance.toFixed(1)} km away</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label={t.riskMap.closeDetails}
        >
          <X className="size-4" />
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {isDataLoading ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 font-mono text-xs text-signal">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t.common.loading} {location.taluk}...</span>
            </div>
            <Skeleton className="h-16 w-full rounded-lg bg-muted/30" />
            <Skeleton className="h-28 w-full rounded-lg bg-muted/30" />
            <Skeleton className="h-16 w-full rounded-lg bg-muted/30" />
          </div>
        ) : forecastError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {forecastError}
          </div>
        ) : forecast ? (
          <>
            {/* Onset Status Card */}
            {onset && (
              <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-signal" />
                    <span>{t.forecast.onsetTitle}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-signal/40 bg-signal/10 text-signal"
                  >
                    {onset.status_tag || "Standard"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{t.forecast.onsetProb}:</span>
                  <span className="font-semibold text-foreground">
                    {onset.probability !== null
                      ? `${(onset.probability * 100).toFixed(1)}%`
                      : t.common.n_a}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>{t.forecast.historicalWindow}:</span>
                  <span>{onset.normal_date_window}</span>
                </div>
              </div>
            )}

            {/* Weekly Horizons Break & Heavy Spell Spreads */}
            {horizons && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{t.forecast.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ML Ensemble
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(horizons).map(([key, h]) => {
                    const breakProb = h.break_spell.probability;
                    const heavyProb = h.heavy_rain.probability;

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-border/50 bg-background/40 p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {h.horizon_label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-amber-400">
                            <SunMedium className="size-3" /> {t.forecast.breakSpell}
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            {breakProb !== null ? `${(breakProb * 100).toFixed(0)}%` : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-rose-400">
                            <CloudLightning className="size-3" /> {t.forecast.heavyRain}
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            {heavyProb !== null ? `${(heavyProb * 100).toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Soil Profile & Moisture Buffer */}
            {soil && (
              <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-warning" />
                    <span>{t.soil.title}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-warning/40 text-warning"
                  >
                    {t.soil.faoBadge}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">{t.soil.classification}:</span>
                    <span className="font-medium text-foreground">{soil.type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t.soil.drainageDynamics}:</span>
                    <span className="font-medium text-foreground">{soil.drainage}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t.soil.awc}:</span>
                    <span className="font-medium text-foreground">{soil.awc} mm/m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t.soil.drySpellBuffer}:</span>
                    <span className="font-medium text-signal">{soil.buffer_days} {t.soil.bufferDays}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
