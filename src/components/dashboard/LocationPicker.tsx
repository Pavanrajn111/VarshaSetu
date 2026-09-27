import React, { useState, useEffect } from "react";
import { useDashboard, type LocationState } from "@/context/DashboardContext";
import { apiClient } from "@/lib/api-client";
import type { CandidateLocation, DistrictTaluks } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation,
  Compass,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

let cachedDistricts: DistrictTaluks[] | null = null;

export function LocationPicker() {
  const { location, setLocation } = useDashboard();
  const { isAuthenticated, user, updatePreferences } = useAuth();
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // Mode selection: 'admin' vs 'search'
  const [mode, setMode] = useState<"admin" | "search">("admin");

  // Admin Mode state
  const [districts, setDistricts] = useState<DistrictTaluks[]>(cachedDistricts || []);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    location.district || "Uttara Kannada",
  );
  const [selectedTaluk, setSelectedTaluk] = useState<string>(location.taluk || "Sirsi");
  const [isLoadingTaluks, setIsLoadingTaluks] = useState<boolean>(!cachedDistricts);

  // Search Village Mode state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateLocation[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateLocation | null>(null);

  // Load administrative taluks (with module-level caching)
  useEffect(() => {
    if (cachedDistricts) {
      setDistricts(cachedDistricts);
      return;
    }

    let isMounted = true;
    async function fetchTaluks() {
      setIsLoadingTaluks(true);
      try {
        const data = await apiClient.getTaluks();
        if (isMounted) {
          cachedDistricts = data.districts;
          setDistricts(data.districts);
        }
      } catch (err) {
        console.warn("Could not load administrative hierarchy from backend:", err);
      } finally {
        if (isMounted) setIsLoadingTaluks(false);
      }
    }

    fetchTaluks();
    return () => {
      isMounted = false;
    };
  }, []);

  const isCurrentDefaultLocation = user?.default_taluk === location.taluk;

  const handleSaveDefaultLocation = async () => {
    if (!location.taluk) return;
    setIsSavingDefault(true);
    try {
      await updatePreferences({
        default_taluk: location.taluk,
        default_district: location.district,
      });
      toast.success(`Saved ${location.taluk} as your default location.`);
    } catch {
      toast.error("Failed to save default location.");
    } finally {
      setIsSavingDefault(false);
    }
  };

  // Sync selected taluk options when district changes
  const activeDistrictData = districts.find((d) => d.district === selectedDistrict);
  const availableTaluks = activeDistrictData ? activeDistrictData.taluks : [];

  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    const distData = districts.find((d) => d.district === distName);
    if (distData && distData.taluks.length > 0) {
      const firstTaluk = distData.taluks[0];
      if (!firstTaluk) {
        return;
      }
      setSelectedTaluk(firstTaluk.taluk_name);
      setLocation({
        lat: firstTaluk.lat,
        lon: firstTaluk.lon,
        district: distName,
        taluk: firstTaluk.taluk_name,
        locationName: `${firstTaluk.taluk_name} Taluk HQ`,
        scaleTag: "Administrative Taluk Node",
      });
    }
  };

  const handleTalukChange = (talukName: string) => {
    setSelectedTaluk(talukName);
    const talukItem = availableTaluks.find((t) => t.taluk_name === talukName);
    if (talukItem) {
      setLocation({
        lat: talukItem.lat,
        lon: talukItem.lon,
        district: selectedDistrict,
        taluk: talukItem.taluk_name,
        locationName: `${talukItem.taluk_name} Taluk HQ`,
        scaleTag: "Administrative Taluk Node",
      });
    }
  };

  // Village search handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setCandidates([]);
    setSelectedCandidate(null);

    try {
      const res = await apiClient.resolveLocation(query);

      // Case A: Single match
      if (res.status === "success" && res.selected) {
        const item = res.selected;
        setLocation({
          lat: item.lat,
          lon: item.lon,
          district: item.district,
          taluk: item.taluk,
          locationName: item.label || item.name,
          scaleTag: res.scale_tag || "Resolved Spatial Point",
        });
        setCandidates([]);
      }
      // Case B: Disambiguation required
      else if (res.disambiguation_required || res.status === "disambiguation_required") {
        if (res.candidates && res.candidates.length > 0) {
          setCandidates(res.candidates);
        } else {
          setSearchError(
            `Multiple potential matches found for "${query}", but no candidates could be parsed.`,
          );
        }
      }
      // Case C: 404 / Not found
      else {
        setSearchError(
          `Could not locate "${query}". Please check the spelling or switch to Administrative mode to choose by district.`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error resolving village coordinates.";
      setSearchError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = (candidate: CandidateLocation) => {
    setSelectedCandidate(candidate);
    setLocation({
      lat: candidate.lat,
      lon: candidate.lon,
      district: candidate.district,
      taluk: candidate.taluk,
      locationName: candidate.label || candidate.name,
      scaleTag: "Disambiguated Village Node",
    });
  };

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <MapPin className="size-5 text-signal" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                Target Location Resolution
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                3-tier offline/OSM spatial node targeting for Karnataka
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border/80 bg-background/50 p-1">
            <button
              type="button"
              onClick={() => setMode("admin")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                mode === "admin"
                  ? "bg-signal text-signal-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="size-3.5" />
              Administrative
            </button>
            <button
              type="button"
              onClick={() => setMode("search")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                mode === "search"
                  ? "bg-signal text-signal-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="size-3.5" />
              Search Village
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {mode === "admin" ? (
          /* Mode 1: Administrative Dropdowns */
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                District (31 Karnataka Districts)
              </label>
              {isLoadingTaluks ? (
                <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background/50 px-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-signal" />
                  Loading districts...
                </div>
              ) : (
                <select
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                >
                  {districts.map((d) => (
                    <option
                      key={d.district}
                      value={d.district}
                      className="bg-popover text-foreground"
                    >
                      {d.district} ({d.taluks.length} taluks)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Taluk Headquarters
              </label>
              <select
                value={selectedTaluk}
                onChange={(e) => handleTalukChange(e.target.value)}
                disabled={availableTaluks.length === 0}
                className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal disabled:opacity-50"
              >
                {availableTaluks.map((t) => (
                  <option
                    key={t.taluk_name}
                    value={t.taluk_name}
                    className="bg-popover text-foreground"
                  >
                    {t.taluk_name} ({t.lat.toFixed(3)}°N, {t.lon.toFixed(3)}°E)
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* Mode 2: Search Village with Disambiguation */
          <div className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter village, hobli, or town name (e.g. Yellapur, Banavasi, Hunsur)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border/80 bg-background/80 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-signal"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="bg-signal px-5 font-mono text-xs font-semibold text-signal-foreground hover:bg-signal/90"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Resolving
                  </>
                ) : (
                  "Resolve"
                )}
              </Button>
            </form>

            {/* Error or Not Found state */}
            {searchError && (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription className="text-xs">{searchError}</AlertDescription>
              </Alert>
            )}

            {/* Disambiguation Candidates List */}
            {candidates.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-warning">
                  <Compass className="size-4" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                    Disambiguation Required — {candidates.length} Locations Found
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Multiple revenue villages or taluks match your query. Select the exact location
                  below:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {candidates.map((c, idx) => {
                    const isSelected =
                      selectedCandidate?.name === c.name &&
                      selectedCandidate?.district === c.district;
                    return (
                      <button
                        key={`${c.name}-${c.district}-${idx}`}
                        type="button"
                        onClick={() => handleSelectCandidate(c)}
                        className={`flex items-start justify-between rounded-md border p-2.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-signal bg-signal/15 text-foreground"
                            : "border-border/60 bg-background/60 hover:border-signal/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-foreground">{c.label || c.name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Taluk: <span className="text-foreground">{c.taluk}</span> · District:{" "}
                            <span className="text-foreground">{c.district}</span>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-signal">
                            {c.lat.toFixed(4)}°N, {c.lon.toFixed(4)}°E
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="size-4 text-signal shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resolved Location Status Banner */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Navigation className="size-4 text-signal" />
            <div>
              <span className="font-medium text-foreground text-sm">
                {location.locationName || `${location.taluk} Taluk HQ`}
              </span>
              <span className="text-muted-foreground text-xs ml-2">
                ({location.district} District)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-signal/40 bg-signal/10 font-mono text-[10px] text-signal"
            >
              {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {location.scaleTag}
            </Badge>
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDefaultLocation}
                disabled={isSavingDefault || isCurrentDefaultLocation}
                className={`h-7 px-2.5 font-mono text-[10px] ${
                  isCurrentDefaultLocation
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default"
                    : "border-signal/40 bg-signal/10 text-signal hover:bg-signal/20"
                }`}
              >
                {isCurrentDefaultLocation ? (
                  <>
                    <CheckCircle2 className="mr-1 size-3 text-emerald-400" />
                    Default Location
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-1 size-3" />
                    Save as Default
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
