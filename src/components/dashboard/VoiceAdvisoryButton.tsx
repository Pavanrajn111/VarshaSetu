import React, { useState, useRef, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { SupportedLanguage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, Pause, AlertCircle } from "lucide-react";

interface VoiceAdvisoryButtonProps {
  text: string;
  language: SupportedLanguage;
}

export function VoiceAdvisoryButton({ text, language }: VoiceAdvisoryButtonProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentKeyRef = useRef<string>("");

  // Clean up audio on unmount or text/language change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // When text or language changes, invalidate cached audio
  useEffect(() => {
    const key = `${language}:${text}`;
    if (currentKeyRef.current !== key) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setAudioUrl(null);
      setError(null);
      currentKeyRef.current = key;
    }
  }, [text, language]);

  const handleTogglePlay = async () => {
    if (!text.trim()) return;

    setError(null);

    // If already playing, pause it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If audio is already loaded, resume it
    if (audioRef.current && audioUrl) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (playErr) {
        console.warn("Playback error:", playErr);
      }
      return;
    }

    // Fetch audio from API
    setIsLoading(true);
    try {
      // CORRECTION 1: language is strictly 'en' | 'kn' | 'hi'
      const blob = await apiClient.streamAdvisoryAudio(text, language);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setError("Browser could not decode the audio stream.");
      };

      await audio.play();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("Voice synthesis is rate limited. Try again shortly.");
        } else {
          setError(err.message);
        }
      } else {
        const msg = err instanceof Error ? err.message : "Audio synthesis failed.";
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        size="sm"
        onClick={handleTogglePlay}
        disabled={isLoading || !text.trim()}
        className={`gap-2 font-mono text-xs shadow-sm transition-all ${
          isPlaying
            ? "bg-warning text-warning-foreground hover:bg-warning/90"
            : "bg-signal text-signal-foreground hover:bg-signal/90"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>Generating Audio...</span>
          </>
        ) : isPlaying ? (
          <>
            <Pause className="size-3.5" />
            <span>Pause Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="size-3.5" />
            <span>Listen Voice Advisory</span>
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
