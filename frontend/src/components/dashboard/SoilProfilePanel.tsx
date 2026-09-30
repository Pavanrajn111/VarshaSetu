import React from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Droplets, Clock, Activity, Waves } from "lucide-react";

export function SoilProfilePanel() {
  const { forecast } = useDashboard();
  const { t } = useLanguage();
  const soil = forecast?.soil;
  const tele = forecast?.teleconnections;

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl w-full min-w-0">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-warning/30 bg-warning/10">
              <Layers className="size-5 text-warning" />
            </span>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg font-semibold text-foreground truncate">
                {t.soil.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {t.soil.subtitle}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="self-start sm:self-auto border-warning/40 bg-warning/10 font-mono text-[10px] text-warning shrink-0"
          >
            {t.soil.faoBadge}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {/* Soil Classification: Wide feature card with ample horizontal space */}
        <div className="rounded-xl border border-border/70 bg-background/50 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
              <Layers className="size-3.5 text-warning" />
              {t.soil.classificationCardTitle || t.soil.classification}
            </span>
            <Badge
              variant="outline"
              className="border-border/60 bg-background/80 font-mono text-[10px] text-muted-foreground"
            >
              Taxonomy Blend
            </Badge>
          </div>
          <div className="mt-2.5 font-display text-lg sm:text-xl font-bold text-foreground leading-snug break-words">
            {soil?.type || "Deep Black & Lateritic Blend"}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {t.soil.topsoilProfile}
          </p>
        </div>

        {/* 3 Metric Cards: Balanced responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {/* 1. Available Water Capacity (AWC) */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/50 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider">
                {t.soil.awc}
              </span>
              <Droplets className="size-4 text-cyan shrink-0" />
            </div>
            <div className="my-2.5">
              <div className="flex items-baseline gap-1.5 font-display text-2xl font-bold text-foreground">
                <span>{soil?.awc ?? 160}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">mm/m</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {t.soil.awcDesc}
            </p>
          </div>

          {/* 2. Moisture Buffer Days */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/50 p-4 transition-colors hover:border-border">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider">
                {t.soil.drySpellBuffer}
              </span>
              <Clock className="size-4 text-signal shrink-0" />
            </div>
            <div className="my-2.5">
              <div className="flex items-baseline gap-1.5 font-display text-2xl font-bold text-foreground">
                <span>{soil?.buffer_days ?? 8}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {t.soil.bufferDays}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {t.soil.bufferDesc}
            </p>
          </div>

          {/* 3. Drainage Characteristic */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/50 p-4 transition-colors hover:border-border sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider">
                {t.soil.drainageDynamics}
              </span>
              <Waves className="size-4 text-success shrink-0" />
            </div>
            <div className="my-2.5">
              <div className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
                {soil?.drainage || "Moderate"}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {t.soil.drainageDesc}
            </p>
          </div>
        </div>

        {/* Global Teleconnection Drivers */}
        {tele && (
          <div className="mt-4 rounded-xl border border-border/40 bg-background/30 p-3.5">
            <div className="flex items-center gap-2 mb-2 font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Activity className="size-3.5 text-signal" /> {t.soil.teleconnections}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 font-mono">
              <div className="rounded-lg bg-background/60 p-2 border border-border/30">
                <span className="text-muted-foreground">ONI ({t.soil.ensoStatus}): </span>
                <span className="font-bold text-foreground">
                  {tele.oni !== undefined && tele.oni !== null ? tele.oni.toFixed(2) : t.common.n_a}
                </span>
              </div>
              <div className="rounded-lg bg-background/60 p-2 border border-border/30">
                <span className="text-muted-foreground">DMI ({t.soil.iodStatus}): </span>
                <span className="font-bold text-foreground">
                  {tele.dmi !== undefined && tele.dmi !== null ? tele.dmi.toFixed(2) : t.common.n_a}
                </span>
              </div>
              <div className="rounded-lg bg-background/60 p-2 border border-border/30">
                <span className="text-muted-foreground">MJO Amp: </span>
                <span className="font-bold text-foreground">
                  {tele.mjo_amp !== undefined && tele.mjo_amp !== null
                    ? tele.mjo_amp.toFixed(2)
                    : t.common.n_a}
                </span>
              </div>
              <div className="rounded-lg bg-background/60 p-2 border border-border/30">
                <span className="text-muted-foreground">{t.soil.mjoStatus}: </span>
                <span className="font-bold text-foreground">{tele.mjo_phase ?? t.common.n_a}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
