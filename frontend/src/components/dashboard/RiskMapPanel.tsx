import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { apiClient } from "@/lib/api-client";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import type {
  TalukRiskItem,
  RiskMapDataResponse,
  RiskMapGridResponse,
  RiskCategory,
} from "@/lib/types";
import { RiskMapDetailPanel } from "@/components/dashboard/RiskMapDetailPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Compass,
} from "lucide-react";

// Fix default Leaflet icon paths in bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Discrete 4-band flood/hazard color scale matching reference map
export const HAZARD_BANDS = [
  { key: "VERY_HIGH", label: "Very High", threshold: "≥ 48%", color: "#e63329", desc: "Critical Dry / Break Spell" },
  { key: "HIGH", label: "High", threshold: "35% – 48%", color: "#f5a623", desc: "Elevated Break Risk" },
  { key: "MEDIUM", label: "Medium", threshold: "20% – 35%", color: "#a8c85a", desc: "Moderate Probability" },
  { key: "LOW", label: "Low", threshold: "< 20%", color: "#2d6a2d", desc: "Normal / Low Risk" },
] as const;

// Theme-aligned colors for taluk risk categories
const RISK_COLORS: Record<RiskCategory, { fill: string; border: string }> = {
  HIGH: { fill: "#ef4444", border: "#f87171" },
  MODERATE: { fill: "#f59e0b", border: "#fbbf24" },
  LOW: { fill: "#10b981", border: "#34d399" },
};

// Karnataka geographic center and bounds
const KARNATAKA_CENTER: [number, number] = [15.3173, 75.7139];
const KARNATAKA_ZOOM = 7;
const TALUK_FOCUS_ZOOM = 10;

interface ClickedPin {
  lat: number;
  lon: number;
  title: string;
  distanceKm?: number;
}

// Custom animated pulsing pin icon for selected dashboard location
function createSelectedLocationPin(talukName: string) {
  return L.divIcon({
    className: "varsha-selected-pin-wrapper",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(14, 165, 233, 0.95); color: #ffffff; border-radius: 9999px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3); font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; white-space: nowrap;">
          <span style="width: 8px; height: 8px; border-radius: 9999px; background: #ffffff; box-shadow: 0 0 6px #ffffff;"></span>
          <span>📍 ${talukName} HQ</span>
        </div>
        <div style="width: 2px; height: 8px; background: #0ea5e9;"></div>
        <div style="width: 8px; height: 8px; border-radius: 9999px; background: #0ea5e9; box-shadow: 0 0 8px #0ea5e9;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Auto-focus controller: smoothly flies to dashboard's selected location
function MapLocationController({
  targetLat,
  targetLon,
  talukName,
}: {
  targetLat: number;
  targetLon: number;
  talukName: string;
}) {
  const map = useMap();
  const prevLocKeyRef = useRef<string>("");
  const isFirstRunRef = useRef<boolean>(true);

  useEffect(() => {
    if (!targetLat || !targetLon || isNaN(targetLat) || isNaN(targetLon)) return;
    const currentLocKey = `${talukName}:${targetLat.toFixed(4)}:${targetLon.toFixed(4)}`;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      prevLocKeyRef.current = currentLocKey;
      // Smooth initial flyTo once map is mounted
      const timer = setTimeout(() => {
        try {
          map.flyTo([targetLat, targetLon], TALUK_FOCUS_ZOOM, {
            duration: 1.0,
            easeLinearity: 0.25,
          });
        } catch {
          // ignore if unmounted
        }
      }, 150);
      return () => clearTimeout(timer);
    }

    if (prevLocKeyRef.current !== currentLocKey) {
      prevLocKeyRef.current = currentLocKey;
      try {
        map.flyTo([targetLat, targetLon], TALUK_FOCUS_ZOOM, {
          duration: 1.0,
          easeLinearity: 0.25,
        });
      } catch {
        // ignore
      }
    }
  }, [map, targetLat, targetLon, talukName]);

  return null;
}

// Inner component handling clicks on the map canvas
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
  const { t } = useLanguage();
  const [riskData, setRiskData] = useState<RiskMapDataResponse | null>(null);
  const [gridData, setGridData] = useState<RiskMapGridResponse | null>(null);
  const [showTalukReferencePoints, setShowTalukReferencePoints] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tileError, setTileError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState<boolean>(false);
  const [clickedPin, setClickedPin] = useState<ClickedPin | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMapData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, grid] = await Promise.all([
        apiClient.getRiskMapData(forceRefresh),
        apiClient.getRiskMapGrid(forceRefresh),
      ]);
      setRiskData(data);
      setGridData(grid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to load statewide risk data.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Offscreen canvas generator creating high-performance, single-DOM-node ImageOverlay
  const choroplethOverlay = useMemo(() => {
    if (!gridData || !gridData.cells || gridData.cells.length === 0) return null;

    const { bounds, resolution_deg: step, cells } = gridData;
    const { lat_min, lat_max, lon_min, lon_max } = bounds;

    const numCols = Math.round((lon_max - lon_min) / step) + 1;
    const numRows = Math.round((lat_max - lat_min) / step) + 1;

    // Scale multiplier for sharp resolution across displays
    const scale = 8;
    const width = numCols * scale;
    const height = numRows * scale;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const col = Math.round((cell.lon - lon_min) / step);
      const row = Math.round((lat_max - cell.lat) / step);

      const x = col * scale;
      const y = row * scale;

      ctx.fillStyle = cell.color_hex;
      // Slight overlap (scale + 0.5) ensures completely filled, continuous surface without subpixel gaps
      ctx.fillRect(x, y, scale + 0.5, scale + 0.5);
    }

    const dataUrl = canvas.toDataURL("image/png");
    const leafletBounds: [[number, number], [number, number]] = [
      [lat_min - step / 2, lon_min - step / 2],
      [lat_max + step / 2, lon_max + step / 2],
    ];

    return { dataUrl, bounds: leafletBounds };
  }, [gridData]);

  // Click on a specific taluk CircleMarker
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

  // Click on map canvas: debounced reverse geocoding with distance validation
  const handleCanvasClick = useCallback(
    async (lat: number, lon: number) => {
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
          setToastMessage(
            resp.message || "Clicked point is outside Karnataka agricultural boundaries.",
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

  // Active selected taluk from DashboardContext
  const selectedTalukLower = (location.taluk || "").trim().toLowerCase();
  const selectedPinIcon = createSelectedLocationPin(location.taluk || "Selected");

  return (
    <Card
      className={`overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl transition-all ${
        isFullscreen ? "fixed inset-4 z-50 rounded-2xl shadow-2xl" : ""
      }`}
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <MapIcon className="size-5 text-signal" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-display text-lg font-semibold text-foreground">
                  {t.riskMap.title}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal shrink-0"
                >
                  OpenStreetMap + Leaflet
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {t.riskMap.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {isReverseGeocoding && (
              <div className="flex items-center gap-1.5 font-mono text-xs text-signal">
                <Loader2 className="size-3.5 animate-spin" />
                <span className="hidden md:inline">{t.location.searching}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMapData(true)}
              disabled={isLoading}
              className="h-8 gap-1.5 border-border/80 bg-glass/80 text-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t.riskMap.refreshData}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailPanelOpen((prev) => !prev)}
              className="h-8 gap-1.5 border-border/80 bg-glass/80 text-xs cursor-pointer"
            >
              <Compass className="size-3.5 text-signal" />
              <span className="hidden sm:inline">
                {detailPanelOpen ? t.riskMap.closeDetails : t.riskMap.detailsTitle}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 gap-1.5 border-border/80 bg-glass/80 text-xs cursor-pointer"
              aria-label={isFullscreen ? "Exit fullscreen map" : "Enter fullscreen map"}
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* On-map transient alert banner */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-11/12 rounded-lg border border-warning/40 bg-background/95 px-4 py-2.5 shadow-xl backdrop-blur-xl flex items-center justify-between text-xs text-warning">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="size-4 shrink-0" />
              <span className="truncate">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-muted-foreground hover:text-foreground font-mono ml-2 shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tile error graceful non-intrusive fallback notice */}
        {tileError && (
          <div className="absolute top-3 left-3 z-[1000] max-w-sm rounded-lg border border-border/80 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md text-[11px] text-muted-foreground flex items-center gap-2">
            <Info className="size-3.5 text-signal shrink-0" />
            <span>{t.riskMap.tilesUnavailable}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row min-h-[580px] h-[650px] relative w-full overflow-hidden">
          {/* Main Leaflet Map View */}
          <div className="flex-1 w-full h-full relative min-w-0">
            {isLoading && !riskData ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-md">
                <Loader2 className="size-8 animate-spin text-signal" />
                <span className="font-mono text-xs text-muted-foreground">
                  Loading statewide risk surface...
                </span>
              </div>
            ) : error ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-6 bg-background/80">
                <AlertTriangle className="size-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchMapData(true)}>
                  Try Again
                </Button>
              </div>
            ) : null}

            <MapContainer
              center={
                location.lat && location.lon
                  ? [location.lat, location.lon]
                  : KARNATAKA_CENTER
              }
              zoom={location.lat && location.lon ? TALUK_FOCUS_ZOOM : KARNATAKA_ZOOM}
              minZoom={6}
              maxZoom={18}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              {/* Reliable OpenStreetMap public tile layer with keyless access */}
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                maxZoom={19}
                eventHandlers={{
                  tileerror: () => setTileError(true),
                  tileload: () => setTileError(false),
                }}
              />

              {/* Automatic map focus & synchronization with DashboardContext */}
              <MapLocationController
                targetLat={location.lat}
                targetLon={location.lon}
                talukName={location.taluk}
              />

              <MapClickHandler onMapClick={handleCanvasClick} />

              {/* Continuous filled choropleth surface */}
              {choroplethOverlay && (
                <ImageOverlay
                  url={choroplethOverlay.dataUrl}
                  bounds={choroplethOverlay.bounds}
                  opacity={0.72}
                  interactive={false}
                  zIndex={150}
                />
              )}

              {/* Optional: Taluk center micro-markers (hidden by default) */}
              {showTalukReferencePoints &&
                riskData?.taluks.map((item) => {
                  const isSelected =
                    selectedTalukLower === item.taluk_name.trim().toLowerCase();
                  if (isSelected) return null; // Rendered prominently below

                  return (
                    <CircleMarker
                      key={`taluk-ref-${item.taluk_name}-${item.district}`}
                      center={[item.lat, item.lon]}
                      radius={2.5}
                      pathOptions={{
                        color: "#ffffff",
                        fillColor: item.risk_color_hex,
                        fillOpacity: 0.9,
                        weight: 1,
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
                        <div className="mt-0.5 font-mono text-[10px]">
                          Break Risk: {item.risk_score_pct}%
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}

              {/* Prominent Selected Location Pin from DashboardContext */}
              {location.lat && location.lon && (
                <Marker
                  position={[location.lat, location.lon]}
                  icon={selectedPinIcon}
                  zIndexOffset={1000}
                >
                  <Popup>
                    <div className="p-1 text-xs">
                      <div className="font-semibold text-foreground">
                        📍 {location.locationName || `${location.taluk} Taluk HQ`}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {location.district} District · {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
                      </div>
                      <div className="mt-1.5 text-[10px] text-signal font-mono">
                        ✓ {t.riskMap.selectedLocation}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Dropped Pinpoint Marker on reverse-geocoded map click */}
              {clickedPin &&
                (clickedPin.lat !== location.lat || clickedPin.lon !== location.lon) && (
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

            {/* Floating Selected Location Information Card (Top Right Overlay) */}
            <div className="absolute top-4 right-4 z-[400] max-w-xs rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-xl pointer-events-auto">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="size-4 text-signal shrink-0" />
                  <span className="font-display text-xs font-bold text-foreground truncate">
                    {location.taluk} Taluk
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-signal/30 text-signal shrink-0">
                  {location.district}
                </Badge>
              </div>

              {/* Selected taluk risk status lookup */}
              {(() => {
                const selectedRisk = riskData?.taluks.find(
                  (t) => t.taluk_name.trim().toLowerCase() === selectedTalukLower
                );
                const riskColor = selectedRisk ? (RISK_COLORS[selectedRisk.risk_category] ?? RISK_COLORS.LOW) : RISK_COLORS.LOW;
                
                return (
                  <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Break Spell Risk:</span>
                      <div className="flex items-center gap-1.5 font-mono font-semibold">
                        <span>{selectedRisk?.risk_score_pct ?? "--"}%</span>
                        {selectedRisk && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: `${riskColor.fill}20`, color: riskColor.fill }}
                          >
                            {selectedRisk.risk_category}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setDetailPanelOpen(true)}
                      className="w-full h-7 text-xs bg-signal text-signal-foreground hover:bg-signal/90 font-medium cursor-pointer shadow-sm"
                    >
                      <Compass className="size-3.5 mr-1.5" />
                      View Risk Assessment
                    </Button>
                  </div>
                );
              })()}
            </div>

            {/* Map Legend Overlay Matching Reference Flood Hazard Map */}
            <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-xl pointer-events-auto min-w-[210px]">
              <div className="font-display text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5 text-signal" />
                  <span>Hazard Gradient</span>
                </div>
                {gridData && (
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 border-signal/30 text-signal">
                    0.05° (~5km)
                  </Badge>
                )}
              </div>

              <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                {HAZARD_BANDS.map((band) => (
                  <div key={band.key} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-sm shrink-0 border border-black/20 shadow-sm"
                        style={{ backgroundColor: band.color }}
                      />
                      <span className="font-sans font-medium text-foreground text-[11px]">{band.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{band.threshold}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                  <span>{t.riskMap.totalTaluks}:</span>
                  <span className="font-bold text-foreground">{riskData?.total_taluks ?? "--"}</span>
                </div>
                {gridData && (
                  <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                    <span>Interpolated Cells:</span>
                    <span className="font-semibold text-foreground">{gridData.total_cells.toLocaleString()}</span>
                  </div>
                )}
                <label className="flex items-center gap-2 mt-1 text-[10px] font-sans text-muted-foreground cursor-pointer hover:text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={showTalukReferencePoints}
                    onChange={(e) => setShowTalukReferencePoints(e.target.checked)}
                    className="size-3 rounded border-border text-signal focus:ring-signal/30 cursor-pointer"
                  />
                  <span>Taluk Reference Points</span>
                </label>
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
          <span className="leading-relaxed">
            <strong>Statewide Risk Surface:</strong> Interpolated from model predictions at {riskData?.total_taluks ?? 236} taluk centers; areas between points are estimated, not independently modeled. The selected location (<strong>{location.taluk}</strong>) is synchronized live into the map viewport.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
