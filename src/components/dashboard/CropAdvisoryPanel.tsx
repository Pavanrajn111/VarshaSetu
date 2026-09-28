import React from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceAdvisoryButton } from "./VoiceAdvisoryButton";
import {
  Sprout,
  RefreshCw,
  Loader2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

const CROP_OPTIONS = [
  "Finger Millet (Ragi)",
  "Maize",
  "Groundnut",
  "Sugarcane",
  "Paddy",
  "Cotton",
  "Red Gram (Tur)",
  "Soybean",
];

const STAGE_OPTIONS = [
  "Pre-Sowing / Land Preparation",
  "Sowing & Germination",
  "Vegetative Growth",
  "Flowering / Grain Formation",
  "Harvesting & Post-Harvest",
];

export function CropAdvisoryPanel() {
  const {
    location,
    language,
    cropType,
    setCropType,
    cropStage,
    setCropStage,
    advisoryText,
    isLoadingForecast,
    isLoadingAdvisory,
    advisoryError,
    loadAdvisory,
  } = useDashboard();

  const { t, isKannada } = useLanguage();

  const handleCropChange = (crop: string) => {
    setCropType(crop);
  };

  const handleStageChange = (stage: string) => {
    setCropStage(stage);
  };

  const handleRefreshAdvisory = (e: React.FormEvent) => {
    e.preventDefault();
    loadAdvisory();
  };

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl w-full min-w-0">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-success/30 bg-success/10">
              <Sprout className="size-5 text-success" />
            </span>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg font-semibold text-foreground truncate">
                {t.crop.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {t.crop.subtitle}
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="self-start sm:self-auto border-success/40 bg-success/10 font-mono text-[10px] text-success shrink-0"
          >
            {t.crop.faoCalculatedBadge}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* Selector Controls Form */}
        <form
          onSubmit={handleRefreshAdvisory}
          className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_auto] items-end"
        >
          <div className="min-w-0">
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t.crop.targetCrop || t.crop.selectCrop}
            </label>
            <select
              value={cropType}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal truncate cursor-pointer"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-popover text-foreground">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t.crop.phenologicalStage || t.crop.selectStage}
            </label>
            <select
              value={cropStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal truncate cursor-pointer"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-popover text-foreground">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={isLoadingAdvisory || isLoadingForecast}
            className="w-full sm:w-auto sm:col-span-2 lg:col-span-1 bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10 px-4 cursor-pointer shrink-0"
          >
            {isLoadingAdvisory || isLoadingForecast ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                {t.crop.generating}
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 size-3.5" />
                {t.crop.updateAdvisory || t.crop.generateAdvisory}
              </>
            )}
          </Button>
        </form>

        {/* Actionable Advisory Output Display */}
        <div className="rounded-xl border border-border/80 bg-background/60 p-4 sm:p-5 shadow-inner">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="size-4 text-signal shrink-0" />
              <div className="min-w-0">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground block truncate">
                  {t.crop.actionableAdvisory || t.crop.advisoryOutput}
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  {cropType} · {cropStage}
                </span>
              </div>
            </div>

            {/* Audio Voice Advisory Playback Button */}
            {advisoryText && (
              <div className="self-start sm:self-auto shrink-0">
                <VoiceAdvisoryButton text={advisoryText} language={language} />
              </div>
            )}
          </div>

          {isLoadingAdvisory || isLoadingForecast ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-signal" />
              <span className="font-mono text-xs">
                {t.common.loading}
              </span>
            </div>
          ) : advisoryError ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-xs">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <div className="font-semibold">{t.common.error}</div>
                <div>{advisoryError}</div>
              </div>
            </div>
          ) : advisoryText ? (
            <div className="space-y-4">
              <div
                className={`text-[15px] sm:text-[16px] leading-[1.65] text-foreground/90 whitespace-pre-line break-words ${
                  isKannada ? "font-kannada text-base sm:text-lg leading-[1.75]" : ""
                }`}
              >
                {advisoryText}
              </div>

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30 min-w-0">
                <Badge
                  variant="outline"
                  className="border-signal/30 bg-signal/5 text-[10px] font-mono text-signal truncate max-w-full"
                >
                  📍 {location.locationName || `${location.taluk} Taluk HQ, ${location.district}`}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-background/70 text-[10px] font-mono text-muted-foreground truncate max-w-full"
                >
                  {t.crop.selectCrop}: {cropType}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-background/70 text-[10px] font-mono text-muted-foreground truncate max-w-full"
                >
                  {t.crop.selectStage}: {cropStage}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {t.crop.subtitle}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
