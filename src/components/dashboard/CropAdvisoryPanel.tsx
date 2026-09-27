import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VoiceAdvisoryButton } from './VoiceAdvisoryButton';
import { Sprout, Sparkles, RefreshCw, Loader2, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';

const CROP_OPTIONS = [
  'Finger Millet (Ragi)',
  'Maize',
  'Groundnut',
  'Sugarcane',
  'Paddy',
  'Cotton',
  'Red Gram (Tur)',
  'Soybean',
];

const STAGE_OPTIONS = [
  'Pre-Sowing / Land Preparation',
  'Sowing & Germination',
  'Vegetative Growth',
  'Flowering / Grain Formation',
  'Harvesting & Post-Harvest',
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
    isLoadingAdvisory,
    advisoryError,
    loadAdvisory,
  } = useDashboard();

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

  const isKannada = language === 'kn';

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-success/30 bg-success/10">
              <Sprout className="size-5 text-success" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                Hyperlocal Crop Advisory Engine
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Fused FAO-56 crop coefficient (Kc), soil buffer days, and ensemble rainfall risk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-success/40 bg-success/10 font-mono text-[10px] text-success">
              Language: {language.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* Selector Controls */}
        <form onSubmit={handleRefreshAdvisory} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Target Crop
            </label>
            <select
              value={cropType}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-popover text-foreground">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Current Phenological Stage
            </label>
            <select
              value={cropStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
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
            disabled={isLoadingAdvisory}
            className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10 px-5"
          >
            {isLoadingAdvisory ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Synthesizing
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 size-3.5" />
                Update Advisory
              </>
            )}
          </Button>
        </form>

        {/* Advisory Output Display */}
        <div className="rounded-xl border border-border/80 bg-background/60 p-5 shadow-inner">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-signal" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                Actionable Advisory for {cropType} ({cropStage})
              </span>
            </div>

            {/* Audio Synthesis Playback Button */}
            {advisoryText && (
              <VoiceAdvisoryButton text={advisoryText} language={language} />
            )}
          </div>

          {isLoadingAdvisory ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-signal" />
              <span className="font-mono text-xs">Computing Penman-Monteith water balance & crop rules...</span>
            </div>
          ) : advisoryError ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-xs">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <div className="font-semibold">Unable to load customized advisory</div>
                <div>{advisoryError}</div>
              </div>
            </div>
          ) : advisoryText ? (
            <div className="space-y-4">
              <div
                className={`text-sm leading-relaxed sm:text-base text-foreground/90 whitespace-pre-line ${
                  isKannada ? 'font-kannada text-base sm:text-lg leading-relaxed' : ''
                }`}
              >
                {advisoryText}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
                <Badge variant="outline" className="border-signal/30 bg-signal/5 text-[10px] font-mono text-signal">
                  📍 {location.locationName || `${location.taluk}, ${location.district}`}
                </Badge>
                <Badge variant="outline" className="border-border text-[10px] font-mono text-muted-foreground">
                  Crop: {cropType}
                </Badge>
                <Badge variant="outline" className="border-border text-[10px] font-mono text-muted-foreground">
                  Stage: {cropStage}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Select a location and click "Update Advisory" to generate stage-specific farm advisories.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
