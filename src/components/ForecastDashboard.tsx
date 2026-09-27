import React, { useState, useEffect, useRef } from "react";
import { apiClient as api, ApiError } from "@/lib/api-client";
import type {
  ForecastResponse,
  DistrictTaluks,
  CandidateLocation,
  SupportedLanguage,
  TargetPrediction,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

function normalizeLang(l: string): SupportedLanguage {
  if (l.toLowerCase().includes("kannada") || l === "kn") return "kn";
  if (l.toLowerCase().includes("hindi") || l === "hi") return "hi";
  return "en";
}
import {
  CloudRain,
  MapPin,
  Search,
  Volume2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  Loader2,
  RefreshCw,
  Layers,
  Sprout,
} from "lucide-react";

const CROP_OPTIONS = ["Finger Millet (Ragi)", "Maize", "Groundnut", "Sugarcane", "Paddy", "Cotton"];

const STAGE_OPTIONS = [
  "Pre-Sowing / Land Preparation",
  "Sowing & Germination",
  "Vegetative Growth",
  "Flowering / Grain Formation",
  "Harvesting",
];

const LANGUAGES = [
  { code: "English", label: "English (EN)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

export function ForecastDashboard() {
  // Administrative state
  const [districts, setDistricts] = useState<DistrictTaluks[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Uttara Kannada");
  const [selectedTaluk, setSelectedTaluk] = useState<string>("Sirsi");
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({
    lat: 14.7336,
    lon: 74.7788,
  });
  const [locationTitle, setLocationTitle] = useState<string>("Sirsi Taluk HQ");
  const [scaleTag, setScaleTag] = useState<string>("Administrative Taluk Node");

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [disambiguationList, setDisambiguationList] = useState<CandidateLocation[]>([]);

  // Agronomic parameters
  const [cropType, setCropType] = useState<string>("Finger Millet (Ragi)");
  const [cropStage, setCropStage] = useState<string>("Sowing & Germination");
  const [language, setLanguage] = useState<string>("English");

  // Forecast results & loading
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);

  // Audio synthesis state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load verified administrative taluks on mount
  useEffect(() => {
    async function loadHierarchy() {
      try {
        const data = await api.getTaluks();
        setDistricts(data.districts);
      } catch (err: unknown) {
        console.warn("Failed to load taluk hierarchy:", err);
      }
    }
    loadHierarchy();
  }, []);

  // Handle location search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGeneralError(null);
    setRateLimitWarning(null);
    setDisambiguationList([]);

    try {
      const res = await api.resolveLocation(searchQuery);
      if (res.disambiguation_required && res.candidates.length > 0) {
        setDisambiguationList(res.candidates);
      } else if (res.selected) {
        applyCandidate(res.selected, res.scale_tag);
      } else {
        setGeneralError(`Location '${searchQuery}' could not be resolved inside Karnataka.`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimitWarning(err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Location resolution failed.";
        setGeneralError(msg);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const applyCandidate = (cand: CandidateLocation, tag?: string) => {
    setSelectedDistrict(cand.district);
    setSelectedTaluk(cand.taluk);
    setCoords({ lat: cand.lat, lon: cand.lon });
    setLocationTitle(cand.label || cand.name);
    setScaleTag(tag || "Hyperlocal Resolved Location");
    setDisambiguationList([]);
    setSearchQuery("");
  };

  // Run Forecast
  const handleRunForecast = async () => {
    setIsLoadingForecast(true);
    setGeneralError(null);
    setRateLimitWarning(null);
    setAudioUrl(null);
    setAudioError(null);

    try {
      const res = await api.computeForecast({
        lat: coords.lat,
        lon: coords.lon,
        district: selectedDistrict,
        taluk: selectedTaluk,
        location_name: locationTitle,
        scale_tag: scaleTag,
        crop_type: cropType,
        crop_stage: cropStage,
        language: normalizeLang(language),
      });
      setForecast(res);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimitWarning(err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Forecast calculation failed.";
        setGeneralError(msg);
      }
    } finally {
      setIsLoadingForecast(false);
    }
  };

  // Run on initial load with Sirsi
  useEffect(() => {
    handleRunForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synthesize Voice Advisory
  const handlePlayAudio = async () => {
    if (!forecast || !forecast.advisory_text) return;

    if (audioUrl) {
      if (audioRef.current) {
        audioRef.current.play();
      }
      return;
    }

    setIsPlayingAudio(true);
    setAudioError(null);

    try {
      const blob = await api.streamAdvisoryAudio(forecast.advisory_text, normalizeLang(language));
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 429) {
        setAudioError("Voice synthesizer is rate limited. Please wait a moment.");
      } else {
        const msg = err instanceof Error ? err.message : "Audio generation failed.";
        setAudioError(msg);
      }
    } finally {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-foreground">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cyan-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Karnataka Hyperlocal Monsoon Serving Layer (SIH 26086)
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mt-1">
            Varsha Setu <span className="text-signal text-cyan-400">Inference Studio</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Probabilistic 13-Target Dual-Model Outlook · 236 Verified Taluks · 31 Soil Profiles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunForecast}
            disabled={isLoadingForecast}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold"
          >
            {isLoadingForecast ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Computing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> Recalculate Outlook
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Warnings & Alerts */}
      {rateLimitWarning && (
        <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 text-amber-200">
          <Clock className="h-5 w-5 text-amber-400" />
          <AlertTitle>Rate Limit Active</AlertTitle>
          <AlertDescription>{rateLimitWarning}</AlertDescription>
        </Alert>
      )}

      {generalError && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-200">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <AlertTitle>Execution Notice</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      {forecast?.weather_fallback_warning && (
        <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-200">
          <Info className="h-5 w-5 text-blue-400" />
          <AlertTitle>Meteorological Baseline Notice</AlertTitle>
          <AlertDescription>{forecast.weather_fallback_warning}</AlertDescription>
        </Alert>
      )}

      {/* Parameters Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Location Picker */}
        <Card className="bg-card/70 border-border/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan-400" /> 1. Spatial Resolution Node
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Search Box */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search village, GP, or taluk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </form>

            {/* Disambiguation Dropdown if multiple village matches */}
            {disambiguationList.length > 0 && (
              <div className="p-2 border border-amber-500/40 bg-amber-500/10 rounded space-y-2">
                <div className="text-xs font-semibold text-amber-300">
                  Multiple matches found. Select correct village:
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {disambiguationList.map((cand, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyCandidate(cand, "Village Cluster (Disambiguated)")}
                      className="w-full text-left p-1.5 hover:bg-amber-500/20 rounded text-xs text-slate-200"
                    >
                      {cand.name} ({cand.taluk}, {cand.district})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* District & Taluk Selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">District (31)</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    const d = districts.find((x) => x.district === e.target.value);
                    if (d && d.taluks.length > 0) {
                      setSelectedTaluk(d.taluks[0].taluk_name);
                      setCoords({ lat: d.taluks[0].lat, lon: d.taluks[0].lon });
                      setLocationTitle(`${d.taluks[0].taluk_name} Taluk HQ`);
                      setScaleTag("Administrative Taluk Node");
                    }
                  }}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                  {districts.map((d) => (
                    <option key={d.district} value={d.district}>
                      {d.district}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Taluk (236)</label>
                <select
                  value={selectedTaluk}
                  onChange={(e) => {
                    setSelectedTaluk(e.target.value);
                    const d = districts.find((x) => x.district === selectedDistrict);
                    const t = d?.taluks.find((x) => x.taluk_name === e.target.value);
                    if (t) {
                      setCoords({ lat: t.lat, lon: t.lon });
                      setLocationTitle(`${t.taluk_name} Taluk HQ`);
                      setScaleTag("Administrative Taluk Node");
                    }
                  }}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                  {districts
                    .find((x) => x.district === selectedDistrict)
                    ?.taluks.map((t) => (
                      <option key={t.taluk_name} value={t.taluk_name}>
                        {t.taluk_name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Active Node Display */}
            <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded font-mono text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Selected:</span>
                <span className="text-cyan-300 font-semibold">{locationTitle}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Coordinates:</span>
                <span className="text-slate-300">
                  {coords.lat.toFixed(4)}°N, {coords.lon.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Resolution Tag:</span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 border-cyan-500/30 text-cyan-400"
                >
                  {scaleTag}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agronomy Parameters */}
        <Card className="bg-card/70 border-border/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Sprout className="h-4 w-4 text-emerald-400" /> 2. Crop & Language Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <label className="text-xs text-muted-foreground">Cultivated Crop</label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                {CROP_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Current Growth Stage</label>
              <select
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Advisory & Speech Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Planetary Teleconnections & Soil Moisture Profile */}
        <Card className="bg-card/70 border-border/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-400" /> 3. Regional Drivers & Soil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {forecast ? (
              <>
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded space-y-1">
                  <div className="font-semibold text-slate-300">Soil Moisture Capacity</div>
                  <div className="text-muted-foreground">{forecast.soil.type}</div>
                  <div className="flex justify-between pt-1">
                    <span>Available Water (AWC):</span>
                    <span className="font-mono text-cyan-300">{forecast.soil.awc} mm/m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Moisture Buffer:</span>
                    <span className="font-mono text-cyan-300">
                      ~{forecast.soil.buffer_days} Days
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded space-y-1 font-mono">
                  <div className="font-semibold text-slate-300">Planetary Climate Indices</div>
                  <div className="flex justify-between">
                    <span>ENSO (ONI):</span>
                    <span
                      className={
                        forecast.teleconnections.is_el_nino ? "text-amber-400" : "text-slate-300"
                      }
                    >
                      {forecast.teleconnections.oni} (
                      {forecast.teleconnections.is_el_nino ? "El Niño" : "Neutral/La Niña"})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>IOD (DMI):</span>
                    <span
                      className={
                        forecast.teleconnections.is_pos_iod ? "text-emerald-400" : "text-slate-300"
                      }
                    >
                      {forecast.teleconnections.dmi} (
                      {forecast.teleconnections.is_pos_iod ? "Positive" : "Neutral/Neg"})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MJO State:</span>
                    <span className="text-slate-300">
                      Phase {forecast.teleconnections.mjo_phase} (Amp:{" "}
                      {forecast.teleconnections.mjo_amp})
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Run forecast to load soil and teleconnections
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 14-Day Onset Outlook Bar */}
      {forecast && (
        <Card className="bg-slate-900/90 border-cyan-500/30">
          <CardContent className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                14-Day Monsoon Arrival Probability
              </div>
              <div className="text-2xl font-display font-semibold flex items-center gap-3">
                <span>{forecast.onset.status_tag}</span>
                {forecast.onset.probability !== null && (
                  <Badge
                    variant="outline"
                    className="text-base px-2.5 border-cyan-400/40 text-cyan-300"
                  >
                    {(forecast.onset.probability * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Normal Historical Window:{" "}
                <span className="text-slate-200">{forecast.onset.normal_date_window}</span> ·{" "}
                {forecast.onset.driver_outlook}
              </div>
            </div>

            <div className="text-xs font-mono text-muted-foreground">
              Weather Data Feed:{" "}
              <Badge variant="secondary" className="text-[10px]">
                {forecast.weather_data_source}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 Weekly Forecast Horizons Grid */}
      {forecast && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <CloudRain className="h-5 w-5 text-cyan-400" /> 4-Week Horizon Probabilistic Outlook
            </h2>
            <div className="text-xs text-muted-foreground font-mono">13 targets calibrated</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(forecast.horizons).map(([key, h]) => (
              <Card key={key} className="bg-card/80 border-border/80">
                <CardHeader className="p-4 border-b border-border/60 bg-slate-950/40">
                  <CardTitle className="text-sm font-semibold flex justify-between items-center">
                    <span>{h.horizon_label}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-700">
                      Week {h.week}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {/* Break Spell */}
                  <TargetCardRow
                    label="Break Spell (<5mm)"
                    pred={h.break_spell}
                    colorClass="text-amber-400"
                  />

                  {/* Active Monsoon */}
                  <TargetCardRow
                    label="Active Monsoon (≥30mm)"
                    pred={h.active_monsoon}
                    colorClass="text-emerald-400"
                  />

                  {/* Heavy Rain */}
                  <TargetCardRow
                    label="Severe Downpour (≥64.5mm)"
                    pred={h.heavy_rain}
                    colorClass="text-red-400"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Agronomic Advisory & Speech Synthesis Card */}
      {forecast && (
        <Card className="bg-slate-950 border-emerald-500/30">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2 text-emerald-400">
                <Sparkles className="h-5 w-5" /> Agronomic Soil & Field Advisory (
                {forecast.language})
              </CardTitle>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePlayAudio}
                  disabled={isPlayingAudio}
                  className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                >
                  {isPlayingAudio ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing Speech...
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" /> Listen to Advisory (gTTS)
                    </>
                  )}
                </Button>
                <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} className="hidden" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-base sm:text-lg leading-relaxed text-slate-100 font-serif">
              "{forecast.advisory_text}"
            </p>

            {audioError && (
              <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800 p-2 rounded flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{audioError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80 text-xs text-muted-foreground font-mono">
              <span>
                Target Crop: <span className="text-slate-300">{forecast.crop_type}</span>
              </span>
              <span>·</span>
              <span>
                Growth Stage: <span className="text-slate-300">{forecast.crop_stage}</span>
              </span>
              <span>·</span>
              <span>
                Soil Texture: <span className="text-slate-300">{forecast.soil.type}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Individual Target row with per-target fault isolation support */
function TargetCardRow({
  label,
  pred,
  colorClass,
}: {
  label: string;
  pred?: TargetPrediction | null;
  colorClass: string;
}) {
  // Graceful handling for single target failure
  if (!pred || pred.error === "model_unavailable" || pred.probability === null) {
    return (
      <div className="p-2 rounded bg-slate-900/60 border border-slate-800 space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>{label}</span>
          <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">
            Temporarily Unavailable
          </Badge>
        </div>
        <div className="text-[10px] text-slate-500 italic">Target model evaluation offline</div>
      </div>
    );
  }

  const pct = (pred.probability * 100).toFixed(1);
  const cutoffPct = pred.cutoff ? (pred.cutoff * 100).toFixed(0) : "45";

  return (
    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/90 space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-mono font-semibold text-sm ${colorClass}`}>{pct}%</span>
      </div>

      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full ${pred.triggered ? "bg-amber-400" : "bg-cyan-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, pred.probability * 100))}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
        <span>Cutoff: {cutoffPct}%</span>
        {pred.triggered ? (
          <span className="text-amber-400 font-semibold flex items-center gap-0.5">
            <AlertTriangle className="h-3 w-3" /> ALERT
          </span>
        ) : (
          <span className="text-emerald-400 flex items-center gap-0.5">
            <CheckCircle className="h-3 w-3" /> Normal
          </span>
        )}
      </div>
    </div>
  );
}
