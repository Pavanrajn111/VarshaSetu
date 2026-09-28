import React, { useState, useRef, useEffect, useCallback } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { SupportedLanguage } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, Pause, AlertCircle, Sparkles } from "lucide-react";

interface VoiceAdvisoryButtonProps {
  text: string;
  language: SupportedLanguage;
}

const BCP47_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en-IN",
  kn: "kn-IN",
  hi: "hi-IN",
};

/**
 * Strict regional voice finder.
 * Ensures Kannada/Hindi never falls back to an English voice.
 */
function findMatchingBrowserVoice(
  voices: SpeechSynthesisVoice[],
  language: SupportedLanguage,
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (language === "kn") {
    // Look strictly for Kannada voices (kn-IN or kn)
    return (
      voices.find((v) => v.lang.toLowerCase() === "kn-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("kn")) ||
      null
    );
  }

  if (language === "hi") {
    // Look strictly for Hindi voices (hi-IN or hi)
    return (
      voices.find((v) => v.lang.toLowerCase() === "hi-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
      null
    );
  }

  if (language === "en") {
    // Look for Indian English first, then any English voice
    return (
      voices.find((v) => v.lang.toLowerCase() === "en-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  return null;
}

export function VoiceAdvisoryButton({ text, language }: VoiceAdvisoryButtonProps) {
  const { t } = useLanguage();
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [usingBackendFallback, setUsingBackendFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentKeyRef = useRef<string>("");

  // 1. Asynchronously load and listen for browser voiceschanged event
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setBrowserVoices(available);
      if (import.meta.env.DEV && available.length > 0) {
        console.log(`[VOICE] Available voices: ${available.length}`);
      }
    };

    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  // Stop all active audio / utterances
  const stopAllAudio = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  // When text or language changes, stop active speech and reset state
  useEffect(() => {
    const key = `${language}:${text}`;
    if (currentKeyRef.current !== key) {
      stopAllAudio();
      setError(null);
      setUsingBackendFallback(false);
      currentKeyRef.current = key;
    }
  }, [text, language, stopAllAudio]);

  // Backend gTTS stream execution
  const playBackendFallback = async (cleanText: string) => {
    stopAllAudio();
    setIsLoading(true);
    setUsingBackendFallback(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await apiClient.streamAdvisoryAudio(cleanText, language, controller.signal);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        setError("Audio stream playback failed in browser.");
      };

      await audio.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // ignore intentional abort
      }
      setIsPlaying(false);
      setIsLoading(false);

      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("Voice synthesis rate limited. Try again shortly.");
        } else {
          setError(err.message);
        }
      } else {
        const msg = err instanceof Error ? err.message : t.crop.audioError;
        setError(msg);
      }
    }
  };

  const handleTogglePlay = async () => {
    const cleanText = text.trim();
    if (!cleanText) return;

    setError(null);

    // 1. If currently playing or loading, toggle pause/cancel
    if (isPlaying || isLoading) {
      stopAllAudio();
      return;
    }

    // 2. Check for matching browser voices
    const availableVoices =
      browserVoices.length > 0
        ? browserVoices
        : typeof window !== "undefined" && "speechSynthesis" in window
          ? window.speechSynthesis.getVoices()
          : [];

    const matchedVoice = findMatchingBrowserVoice(availableVoices, language);
    const targetLangTag = BCP47_LANG_MAP[language] || "en-IN";

    if (import.meta.env.DEV) {
      console.log("[VOICE] Diagnostic Dispatch:", {
        requestedLanguage: language,
        targetLangTag,
        availableMatchingVoice: matchedVoice ? `${matchedVoice.name} (${matchedVoice.lang})` : "None",
        strategy: matchedVoice ? "Browser SpeechSynthesis" : "Backend gTTS Audio Fallback",
      });
    }

    // 3. If genuine matching browser voice exists, use it
    if (matchedVoice && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
        utterance.rate = 0.95;

        utterance.onstart = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setIsLoading(false);
        };

        utterance.onerror = (e) => {
          console.warn("[VOICE] Browser speech error encountered:", e.error);
          setIsPlaying(false);
          // If not manually canceled/interrupted, gracefully use backend fallback
          if (e.error !== "canceled" && e.error !== "interrupted") {
            playBackendFallback(cleanText);
          }
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (browserErr) {
        console.warn("[VOICE] SpeechSynthesis exception:", browserErr);
      }
    }

    // 4. Fallback: Seamless backend gTTS synthesis (Guaranteed genuine Kannada / Hindi / English voice)
    await playBackendFallback(cleanText);
  };

  const getButtonLabel = () => {
    if (isLoading) return t.crop.audioLoading;
    if (isPlaying) return t.crop.stopAudio;
    if (language === "kn") return t.crop.listenKannada;
    if (language === "hi") return t.crop.listenHindi;
    return t.crop.listenEnglish;
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        size="sm"
        onClick={handleTogglePlay}
        disabled={isLoading || !text.trim()}
        aria-label={getButtonLabel()}
        className={`gap-2 font-mono text-xs shadow-sm transition-all cursor-pointer ${
          isPlaying
            ? "bg-warning text-warning-foreground hover:bg-warning/90"
            : "bg-signal text-signal-foreground hover:bg-signal/90"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>{getButtonLabel()}</span>
          </>
        ) : isPlaying ? (
          <>
            <Pause className="size-3.5" />
            <span>{getButtonLabel()}</span>
          </>
        ) : (
          <>
            <Volume2 className="size-3.5" />
            <span>{getButtonLabel()}</span>
          </>
        )}
      </Button>

      {usingBackendFallback && isPlaying && (
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Sparkles className="size-3 text-signal" />
          <span>Regional Voice Synthesizer Active</span>
        </span>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive font-mono">
          <AlertCircle className="size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
