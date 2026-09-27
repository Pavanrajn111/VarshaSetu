import React from "react";
import { useDashboard } from "@/context/DashboardContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Droplets, Clock, Activity, Waves } from "lucide-react";

export function SoilProfilePanel() {
  const { forecast } = useDashboard();
  const soil = forecast?.soil;
  const tele = forecast?.teleconnections;

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-warning/30 bg-warning/10">
              <Layers className="size-5 text-warning" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                Hydrological & Soil Moisture Profile
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                FAO-56 root-zone moisture capacity and dry-spell buffer resilience
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-warning/40 bg-warning/10 font-mono text-[10px] text-warning"
          >
            FAO-56 Hydro-Soil
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Soil Classification */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Classification</span>
              <Layers className="size-4 text-warning" />
            </div>
            <div className="mt-2 font-display text-lg font-semibold text-foreground">
              {soil?.type || "Red Sandy Loam"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dominant regional agricultural topsoil profile
            </p>
          </div>

          {/* Available Water Capacity (AWC) */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Available Water (AWC)
              </span>
              <Droplets className="size-4 text-cyan" />
            </div>
            <div className="mt-2 flex items-baseline gap-1 font-display text-2xl font-semibold text-foreground">
              <span>{soil?.awc ?? 120}</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">mm/m</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Effective plant-available rootzone moisture
            </p>
          </div>

          {/* Moisture Buffer Days */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Dry-Spell Buffer
              </span>
              <Clock className="size-4 text-signal" />
            </div>
            <div className="mt-2 flex items-baseline gap-1 font-display text-2xl font-semibold text-foreground">
              <span>{soil?.buffer_days ?? 6}</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">days</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Estimated days crop can withstand zero rainfall
            </p>
          </div>

          {/* Drainage Characteristic */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Drainage Dynamics
              </span>
              <Waves className="size-4 text-success" />
            </div>
            <div className="mt-2 font-display text-lg font-semibold text-foreground">
              {soil?.drainage || "Well Drained"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Waterlogging vulnerability profile
            </p>
          </div>
        </div>

        {/* Global Teleconnection Drivers */}
        {tele && (
          <div className="mt-4 rounded-lg border border-border/40 bg-background/30 p-3.5">
            <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              <Activity className="size-3.5 text-signal" /> Global Teleconnection Couplings
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 font-mono">
              <div className="rounded bg-background/60 p-2">
                <span className="text-muted-foreground">ONI (ENSO): </span>
                <span className="font-bold text-foreground">{tele.oni?.toFixed(2) ?? "N/A"}</span>
              </div>
              <div className="rounded bg-background/60 p-2">
                <span className="text-muted-foreground">DMI (IOD): </span>
                <span className="font-bold text-foreground">{tele.dmi?.toFixed(2) ?? "N/A"}</span>
              </div>
              <div className="rounded bg-background/60 p-2">
                <span className="text-muted-foreground">MJO Amp: </span>
                <span className="font-bold text-foreground">
                  {tele.mjo_amp?.toFixed(2) ?? "N/A"}
                </span>
              </div>
              <div className="rounded bg-background/60 p-2">
                <span className="text-muted-foreground">MJO Phase: </span>
                <span className="font-bold text-foreground">{tele.mjo_phase ?? "N/A"}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
