import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiClient } from "@/lib/api-client";
import { useDashboard } from "@/context/DashboardContext";
import type { TalukRiskItem, RiskMapDataResponse, RiskCategory } from "@/lib/types";
import { RiskMapDetailPanel } from "@/components/dashboard/RiskMapDetailPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Map as MapIcon,
  RefreshCw,
  Maximize2,
  Minimize2,
  Info,
  AlertTriangle,
  Loader2,
  Layers,
  MapPin,
} from "lucide-react";

// Fix default Leaflet icon paths in bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Theme-aligned colors for risk categories
const RISK_COLORS: Record<RiskCategory, { fill: string; border: string }> = {
  HIGH: { fill: "#ef4444", border: "#f87171" },
  MODERATE: { fill: "#f59e0b", border: "#fbbf24" },
  LOW: { fill: "#10b981", border: "#34d399" },
};

// Karnataka geographic center and bounds
const KARNATAKA_CENTER: [number, number] = [15.3173, 75.7139];
const KARNATAKA_ZOOM = 7;

interface ClickedPin {
  lat: number;
  lon: number;
  title: string;
  distanceKm?: number;
}

// Inner component handling clicks on the empty map canvas
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function RiskMapPanel() {
  const { location, setLocation } = useDashboard();
  const [riskData, setRiskData] = useState<RiskMapDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState<boolean>(false);
  const [clickedPin, setClickedPin] = useState<ClickedPin | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRiskData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRiskMapData(forceRefresh);
      setRiskData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to load statewide risk data.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  // Click on a specific taluk CircleMarker (authoritative data, no reverse geocode)
  const handleMarkerClick = useCallback(
    (item: TalukRiskItem) => {
      setClickedPin({
        lat: item.lat,
        lon: item.lon,
        title: `${item.taluk_name} Taluk, ${item.district}`,
        distanceKm: 0,
      });

      // Avoid redundant forecast refetch if clicking the already selected taluk
      if (location.taluk.trim().toLowerCase() !== item.taluk_name.trim().toLowerCase()) {
        setLocation({
          taluk: item.taluk_name,
          district: item.district,
          lat: item.lat,
          lon: item.lon,
          locationName: `${item.taluk_name} Taluk HQ`,
          scaleTag: "Administrative Taluk Node",
        });
      }

      setDetailPanelOpen(true);
    },
    [location.taluk, setLocation],
  );

  // Click on empty map canvas: debounced reverse geocoding with 60km sanity cap
  const handleCanvasClick = useCallback(
    async (lat: number, lon: number) => {
      // Cancel any ongoing reverse geocoding request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsReverseGeocoding(true);
      setToastMessage(null);

      try {
        const resp = await apiClient.reverseGeocode(lat, lon);

        if (resp.status === "success" && resp.selected) {
          const sel = resp.selected;
          setClickedPin({
            lat,
            lon,
            title: sel.label,
            distanceKm: 0,
          });

          // Only update location if resolved node is different
          if (
            location.taluk.trim().toLowerCase() !== sel.taluk.trim().toLowerCase() ||
            location.locationName.trim().toLowerCase() !== sel.name.trim().toLowerCase()
          ) {
            setLocation({
              taluk: sel.taluk,
              district: sel.district,
              lat: sel.lat,
              lon: sel.lon,
              locationName: sel.name,
              scaleTag: resp.scale_tag,
            });
          }

          setDetailPanelOpen(true);
        } else {
          // Point outside Karnataka or exceeding distance cap
          setToastMessage(
            resp.message || "Clicked point is too far from any known Karnataka agricultural node.",
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Reverse geocoding failed.";
        setToastMessage(msg);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [location, setLocation],
  );

  return (
    <Card
      className={`overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl transition-all ${
        isFullscreen ? "fixed inset-4 z-50 rounded-2xl shadow-2xl" : ""
      }`}
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <MapIcon className="size-5 text-signal" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-display text-lg font-semibold text-foreground">
                  Statewide Interactive Risk Map
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal"
                >
                  Interactive Folium / Leaflet
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Click any taluk or coordinate to inspect localized break spell risk and trigger ML
                forecast
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isReverseGeocoding && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-signal">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Resolving location...</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRiskData(true)}
              disabled={isLoading}
              className="h-8 gap-1.5 border-border/80 bg-glass/80 text-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 gap-1.5 border-border/80 bg-glass/80 text-xs cursor-pointer"
              aria-label={isFullscreen ? "Exit fullscreen map" : "Enter fullscreen map"}
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* On-map transient alert banner */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-11/12 rounded-lg border border-warning/40 bg-background/95 px-4 py-2.5 shadow-xl backdrop-blur-xl flex items-center justify-between text-xs text-warning">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-muted-foreground hover:text-foreground font-mono ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row min-h-[580px] h-[650px] relative">
          {/* Main Leaflet Map View */}
          <div className="flex-1 w-full h-full relative">
            {isLoading && !riskData ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-md">
                <Loader2 className="size-8 animate-spin text-signal" />
                <span className="font-mono text-xs text-muted-foreground">
                  Loading 236 taluk risk coordinates...
                </span>
              </div>
            ) : error ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6 bg-background/80">
                <AlertTriangle className="size-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchRiskData(true)}>
                  Try Again
                </Button>
              </div>
            ) : null}

            <MapContainer
              center={KARNATAKA_CENTER}
              zoom={KARNATAKA_ZOOM}
              minZoom={6}
              maxZoom={14}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
              style={{ background: "#0b1329" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                maxZoom={19}
              />

              <MapClickHandler onMapClick={handleCanvasClick} />

              {/* 236 Taluk CircleMarkers */}
              {riskData?.taluks.map((item) => {
                const colors = RISK_COLORS[item.risk_category] ?? RISK_COLORS.LOW;
                const isSelected =
                  location.taluk.trim().toLowerCase() === item.taluk_name.trim().toLowerCase();

                return (
                  <CircleMarker
                    key={`${item.taluk_name}-${item.district}`}
                    center={[item.lat, item.lon]}
                    radius={isSelected ? 9 : 6}
                    pathOptions={{
                      color: isSelected ? "#38bdf8" : colors.border,
                      fillColor: colors.fill,
                      fillOpacity: isSelected ? 0.9 : 0.65,
                      weight: isSelected ? 3 : 1.5,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        handleMarkerClick(item);
                      },
                    }}
                  >
                    <Tooltip sticky direction="top" className="font-sans text-xs">
                      <div className="font-semibold text-foreground">{item.taluk_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.district} District
                      </div>
                      <div className="mt-1 font-mono text-[10px] flex items-center gap-1.5">
                        <span>Break Risk:</span>
                        <span className="font-bold">{item.risk_score_pct}%</span>
                        <span
                          className="px-1 py-0.2 rounded text-[9px]"
                          style={{ background: `${colors.fill}25`, color: colors.fill }}
                        >
                          {item.risk_category}
                        </span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}

              {/* Dropped Pinpoint Marker on Clicked Coordinates */}
              {clickedPin && (
                <Marker position={[clickedPin.lat, clickedPin.lon]}>
                  <Popup>
                    <div className="p-1 text-xs">
                      <div className="font-semibold">{clickedPin.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {clickedPin.lat.toFixed(4)}°N, {clickedPin.lon.toFixed(4)}°E
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-border/80 bg-background/90 p-3 shadow-xl backdrop-blur-xl pointer-events-auto">
              <div className="font-display text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="size-3 text-signal" />
                <span>Break Spell Risk Scale</span>
              </div>
              <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <span className="text-foreground">Low Risk (&lt; 25%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <span className="text-foreground">Moderate (25–45%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                  <span className="text-foreground">High Risk (&gt; 45%)</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 font-mono text-[9px] text-muted-foreground">
                Showing {riskData?.total_taluks ?? 236} taluks
              </div>
            </div>
          </div>

          {/* Right-Hand Location Forecast Summary Drawer */}
          {detailPanelOpen && (
            <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border/60 bg-card/95 backdrop-blur-2xl p-4 overflow-y-auto max-h-[650px] shrink-0">
              <RiskMapDetailPanel
                onClose={() => setDetailPanelOpen(false)}
                clickedPointName={clickedPin?.title}
                clickedPointDistance={clickedPin?.distanceKm}
              />
            </div>
          )}
        </div>

        {/* Grounded Methodology Transparency Notice */}
        <div className="flex items-start gap-2.5 border-t border-border/40 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-signal" />
          <span>
            <strong>Authoritative Risk Methodology:</strong> Map colors represent calibrated
            statistical Break Spell Probability derived from the project's verified 236-taluk
            baseline, standardized across pilot and non-pilot taluks. Clicking any location
            automatically loads live dual-model (0.60 XGB + 0.40 RF) 4-week forward inferences.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
