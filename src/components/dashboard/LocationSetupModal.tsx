import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard, type LocationState } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { apiClient } from "@/lib/api-client";
import type { CandidateLocation, DistrictTaluks, TalukItem } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import {
  MapPin,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Compass,
  ArrowRight,
  Sparkles,
  CloudRain,
  Layers,
  Sprout,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

let cachedDistricts: DistrictTaluks[] | null = null;

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; subLabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  emptyText = "No results found",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOpt = options.find((o) => o.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.subLabel && o.subLabel.toLowerCase().includes(q)),
    );
  }, [options, search]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle open direction based on viewport space
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Only open upward if space below is too tight (< 260px) and space above is larger
      setOpenUpward(spaceBelow < 260 && spaceAbove > spaceBelow);
    }
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setSearch("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return next;
    });
  }, [disabled, isOpen]);

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" && !isOpen) {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between rounded-md border border-border/80 bg-background/80 px-3 py-2.5 text-sm text-foreground transition-all cursor-pointer",
          isOpen && "border-signal ring-1 ring-signal bg-background",
          disabled && "opacity-50 cursor-not-allowed bg-muted/20",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("truncate font-medium", !selectedOpt && "text-muted-foreground")}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
          {selectedOpt?.subLabel && (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              ({selectedOpt.subLabel})
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2",
            isOpen && "rotate-180 text-signal",
          )}
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-[60] w-full rounded-xl border border-border/90 bg-popover/95 shadow-2xl backdrop-blur-2xl ring-1 ring-border/50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150",
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
          style={{ maxHeight: "280px" }}
        >
          {/* Internal Search Bar */}
          <div className="p-2 border-b border-border/50 bg-popover/90 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-background/80 border border-border/70 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-signal"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List with Internal Scrollbar */}
          <div className="overflow-y-auto p-1 max-h-[210px] space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground font-mono">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer",
                      isSelected
                        ? "bg-signal/20 text-signal font-semibold border border-signal/30"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-3.5 text-signal shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface LocationSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLocationSelected?: (loc: LocationState) => void;
  isMandatoryOnboarding?: boolean;
}

export function LocationSetupModal({
  isOpen,
  onClose,
  onLocationSelected,
  isMandatoryOnboarding = false,
}: LocationSetupModalProps) {
  const { location, setLocation, loadForecast } = useDashboard();
  const { t } = useLanguage();
  const { isAuthenticated, updatePreferences } = useAuth();

  // Mode: "admin" vs "search"
  const [mode, setMode] = useState<"admin" | "search">("admin");

  // Admin hierarchy state
  const [districts, setDistricts] = useState<DistrictTaluks[]>(cachedDistricts || []);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    location.district || "Belagavi",
  );
  const [selectedTaluk, setSelectedTaluk] = useState<string>(location.taluk || "Hukkeri");
  const [isLoadingTaluks, setIsLoadingTaluks] = useState<boolean>(!cachedDistricts);

  // Sync pre-filled location whenever modal opens
  useEffect(() => {
    if (isOpen && location) {
      if (location.district) setSelectedDistrict(location.district);
      if (location.taluk) setSelectedTaluk(location.taluk);
    }
  }, [isOpen, location]);

  // Search village state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateLocation[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateLocation | null>(null);

  // Loading state after pressing "Update Location"
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);

  // Load district hierarchy
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
        console.warn("Could not load administrative hierarchy:", err);
      } finally {
        if (isMounted) setIsLoadingTaluks(false);
      }
    }

    fetchTaluks();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync selected taluk options when district changes
  const activeDistrictData = districts.find((d) => d.district === selectedDistrict);
  const availableTaluks = activeDistrictData ? activeDistrictData.taluks : [];

  const handleDistrictSelect = (newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    const distData = districts.find((d) => d.district === newDistrict);
    if (distData && distData.taluks && distData.taluks.length > 0 && distData.taluks[0]) {
      setSelectedTaluk(distData.taluks[0].taluk_name);
    } else {
      setSelectedTaluk("");
    }
  };

  useEffect(() => {
    if (availableTaluks.length > 0 && !availableTaluks.some((t) => t.taluk_name === selectedTaluk) && availableTaluks[0]) {
      setSelectedTaluk(availableTaluks[0].taluk_name);
    }
  }, [selectedDistrict, availableTaluks, selectedTaluk]);

  // Village search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSelectedCandidate(null);

    try {
      const res = await apiClient.resolveLocation(query);
      if (res.candidates && res.candidates.length > 0 && res.candidates[0]) {
        setCandidates(res.candidates);
        setSelectedCandidate(res.candidates[0]);
      } else if (res.selected) {
        const singleCandidate: CandidateLocation = {
          name: res.selected.name || res.selected.label,
          label: res.selected.label,
          taluk: res.selected.taluk,
          district: res.selected.district,
          lat: res.selected.lat,
          lon: res.selected.lon,
        };
        setCandidates([singleCandidate]);
        setSelectedCandidate(singleCandidate);
      } else {
        setCandidates([]);
        setSearchError(t.location.noResults);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setSearchError(msg);
      setCandidates([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Perform Location Update with polished loading sequence
  const handleUpdateLocation = async () => {
    let targetLoc: LocationState;

    if (mode === "admin") {
      const matchedTalukObj = availableTaluks.find((t) => t.taluk_name === selectedTaluk);
      if (!matchedTalukObj) {
        toast.error("Please select a valid district and taluk.");
        return;
      }
      targetLoc = {
        lat: matchedTalukObj.lat,
        lon: matchedTalukObj.lon,
        district: selectedDistrict,
        taluk: matchedTalukObj.taluk_name,
        locationName: `${matchedTalukObj.taluk_name} Taluk HQ`,
        scaleTag: "Administrative Taluk Node",
      };
    } else {
      if (!selectedCandidate) {
        toast.error("Please select a resolved village location from search results.");
        return;
      }
      targetLoc = {
        lat: selectedCandidate.lat,
        lon: selectedCandidate.lon,
        district: selectedCandidate.district,
        taluk: selectedCandidate.taluk,
        locationName: selectedCandidate.label,
        scaleTag: "Village Node",
      };
    }

    setIsUpdatingLocation(true);
    setLoadingStep(1);

    try {
      // Step 1: Set location in state and storage
      setLocation(targetLoc);
      if (typeof window !== "undefined") {
        localStorage.setItem("varsha_location_onboarded", "true");
        localStorage.setItem("varsha_selected_location", JSON.stringify(targetLoc));
      }

      // Step 2: Animate progress steps and load live forecast
      setLoadingStep(2);
      await loadForecast(targetLoc);

      setLoadingStep(3);

      // Save as default in user profile if authenticated
      if (isAuthenticated) {
        updatePreferences({
          default_taluk: targetLoc.taluk,
          default_district: targetLoc.district,
        }).catch(() => {});
      }

      toast.success(
        `${t.location.savedDefault}: ${targetLoc.locationName || `${targetLoc.taluk}, ${targetLoc.district}`}`,
      );

      // Brief delay for smooth checkmark transition
      setTimeout(() => {
        setIsUpdatingLocation(false);
        if (onLocationSelected) onLocationSelected(targetLoc);
        if (onClose) onClose();
      }, 350);
    } catch (err: unknown) {
      console.error("Location update failed:", err);
      setIsUpdatingLocation(false);
      toast.error(t.common.error);
    }
  };

  if (!isOpen) return null;

  const districtOptions = districts.map((d) => ({
    value: d.district,
    label: d.district,
    subLabel: `${d.taluks.length} ${t.location.talukLabel}`,
  }));

  const talukOptions = availableTaluks.map((tItem) => ({
    value: tItem.taluk_name,
    label: tItem.taluk_name,
  }));

  const activeTalukData = availableTaluks.find((t) => t.taluk_name === selectedTaluk);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <Card className="w-full max-w-xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-2xl overflow-visible relative">
        {/* Top Header Bar with Live Language Switcher */}
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-signal/40 bg-signal/15 text-signal shadow-md shadow-signal/10">
                <Compass className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="font-display text-lg sm:text-xl font-bold text-foreground truncate">
                  {t.location.onboardingTitle}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground truncate">
                  {t.location.onboardingSubtitle}
                </CardDescription>
              </div>
            </div>

            {/* Language Switcher at Top */}
            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitcher />
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  disabled={isUpdatingLocation}
                  className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Close"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isUpdatingLocation ? (
          /* Polished Loading State */
          <CardContent className="py-12 px-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mx-auto size-16">
              <div className="absolute inset-0 rounded-full border-2 border-signal/20 animate-ping"></div>
              <div className="grid size-16 place-items-center rounded-full border border-signal/40 bg-signal/10 text-signal shadow-lg shadow-signal/20">
                <Loader2 className="size-8 animate-spin" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-foreground">
                {t.location.preparingForecast}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedDistrict} · {selectedTaluk}
              </p>
            </div>

            <div className="max-w-xs mx-auto space-y-2.5 font-mono text-xs text-left bg-background/60 p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <CloudRain className="size-3.5 text-signal" />
                  {t.location.loadingWeather}
                </span>
                <span className={loadingStep >= 1 ? "text-success" : "text-muted-foreground"}>
                  {loadingStep >= 1 ? "✓" : "◌"}
                </span>
              </div>
              <div className="flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Layers className="size-3.5 text-warning" />
                  {t.location.loadingSoil}
                </span>
                <span className={loadingStep >= 2 ? "text-success" : "text-muted-foreground"}>
                  {loadingStep >= 2 ? "✓" : "◌"}
                </span>
              </div>
              <div className="flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Sprout className="size-3.5 text-success" />
                  {t.location.preparingAdvisory}
                </span>
                <span className={loadingStep >= 3 ? "text-success" : "text-muted-foreground"}>
                  {loadingStep >= 3 ? "✓" : "◌"}
                </span>
              </div>
            </div>
          </CardContent>
        ) : (
          /* Selection Mode Body */
          <CardContent className="p-6 space-y-5 overflow-visible">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 rounded-lg border border-border/80 bg-background/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode("admin")}
                className={`flex items-center justify-center gap-2 rounded-md py-2 font-medium transition-all cursor-pointer ${
                  mode === "admin"
                    ? "bg-signal text-signal-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="size-3.5" />
                <span>{t.location.adminHierarchy}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("search")}
                className={`flex items-center justify-center gap-2 rounded-md py-2 font-medium transition-all cursor-pointer ${
                  mode === "search"
                    ? "bg-signal text-signal-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Search className="size-3.5" />
                <span>{t.location.searchVillage}</span>
              </button>
            </div>

            {mode === "admin" ? (
              /* Administrative Hierarchy: District + Taluk */
              <div className="space-y-4 overflow-visible">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SearchableSelect
                    label={t.location.selectDistrict}
                    value={selectedDistrict}
                    onChange={handleDistrictSelect}
                    options={districtOptions}
                    placeholder="Select District"
                    searchPlaceholder="Search Karnataka District..."
                    disabled={isLoadingTaluks}
                    emptyText="No matching district found"
                  />

                  <SearchableSelect
                    label={t.location.selectTaluk}
                    value={selectedTaluk}
                    onChange={(val) => setSelectedTaluk(val)}
                    options={talukOptions}
                    placeholder={availableTaluks.length === 0 ? "Loading Taluks..." : "Select Taluk"}
                    searchPlaceholder={`Search ${selectedDistrict} Taluks...`}
                    disabled={isLoadingTaluks || availableTaluks.length === 0}
                    emptyText="No matching taluk found"
                  />
                </div>

                {/* Selected Taluk Coordinates Preview Badge */}
                {selectedDistrict && selectedTaluk && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4 text-signal shrink-0" />
                      <span className="font-medium text-foreground">
                        {selectedTaluk} Taluk HQ, {selectedDistrict}
                      </span>
                    </div>
                    {activeTalukData && (
                      <span className="font-mono text-[11px] text-signal">
                        {activeTalukData.lat.toFixed(4)}°N, {activeTalukData.lon.toFixed(4)}°E
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Search Village / Landmark */
              <div className="space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.location.searchPlaceholder}
                      className="border-border/80 bg-background/80 pr-9 text-sm"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-signal" />
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-signal text-signal-foreground hover:bg-signal/90 text-xs px-4 cursor-pointer"
                  >
                    <Search className="mr-1.5 size-3.5" />
                    Search
                  </Button>
                </form>

                {searchError && (
                  <Alert variant="destructive" className="py-2 text-xs">
                    <AlertTriangle className="size-3.5" />
                    <AlertDescription>{searchError}</AlertDescription>
                  </Alert>
                )}

                {candidates.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-2">
                    {candidates.map((cand, idx) => {
                      const isSelected = selectedCandidate?.label === cand.label;
                      return (
                        <button
                          key={`${cand.label}-${idx}`}
                          type="button"
                          onClick={() => setSelectedCandidate(cand)}
                          className={`w-full text-left rounded-md p-2.5 transition-all text-xs flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-signal/20 text-signal border border-signal/40 font-semibold"
                              : "hover:bg-muted/40 text-foreground"
                          }`}
                        >
                          <div>
                            <div className="font-medium">{cand.label}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {cand.taluk} Taluk, {cand.district} District
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono">
                            {cand.lat.toFixed(2)}°N, {cand.lon.toFixed(2)}°E
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}

        {!isUpdatingLocation && (
          <CardFooter className="border-t border-border/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10">
            <div className="text-xs text-muted-foreground text-center sm:text-left">
              <span>{t.dashboard.footerServing}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onClose && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-full sm:w-auto text-xs h-10 px-4 cursor-pointer border-border/80 text-muted-foreground hover:text-foreground"
                >
                  Explore Dashboard
                </Button>
              )}
              <Button
                type="button"
                onClick={handleUpdateLocation}
                disabled={isLoadingTaluks || (mode === "search" && !selectedCandidate)}
                className="w-full sm:w-auto bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10 px-6 shadow-lg shadow-signal/20 cursor-pointer"
              >
                <Sparkles className="mr-1.5 size-3.5" />
                {t.location.updateLocationBtn || "Update Location"}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
