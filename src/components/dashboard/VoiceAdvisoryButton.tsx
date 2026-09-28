import React, { useState, useRef, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { SupportedLanguage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, Pause, AlertCircle } from "lucide-react";

interface VoiceAdvisoryButtonProps {
  text: string;
  language: SupportedLanguage;
}

const BROWSER_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en-IN",
  kn: "kn-IN",
  hi: "hi-IN",
};

export function VoiceAdvisoryButton({ text, language }: VoiceAdvisoryButtonProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentKeyRef = useRef<string>("");

  // Clean up audio & speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // When text or language changes, cancel playing speech
  useEffect(() => {
    const key = `${language}:${text}`;
    if (currentKeyRef.current !== key) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
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
    const cleanText = text.trim();
    if (!cleanText) return;

    setError(null);

    // 1. If currently speaking or playing, toggle pause/cancel
    if (isPlaying) {
      if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    // 2. Primary: Fast browser Web Speech API (Instant <10ms execution)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel(); // Stop any pending utterance
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const targetLang = BROWSER_LANG_MAP[language] || "en-IN";
        utterance.lang = targetLang;
        utterance.rate = 0.95; // Clear natural tempo

        // Match regional voice if available
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(language) || v.lang.includes(targetLang));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onstart = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = (e) => {
          console.warn("Browser SpeechSynthesis notice:", e);
          setIsPlaying(false);
          // If browser utterance was interrupted by user, don't trigger fallback
          if (e.error !== "canceled" && e.error !== "interrupted") {
            playBackendFallbackAudio(cleanText);
          }
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (browserErr) {
        console.warn("Browser speech synthesis failed; switching to backend audio fallback:", browserErr);
      }
    }

    // 3. Fallback: Backend gTTS streaming
    await playBackendFallbackAudio(cleanText);
  };

  const playBackendFallbackAudio = async (cleanText: string) => {
    // If audio is already loaded in memory, resume
    if (audioRef.current && audioUrl) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (playErr) {
        console.warn("Audio playback error:", playErr);
      }
      return;
    }

    setIsLoading(true);
    try {
      const blob = await apiClient.streamAdvisoryAudio(cleanText, language);
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
          setError("Voice synthesis rate limited. Try again shortly.");
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
            <span>Generating Voice...</span>
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

