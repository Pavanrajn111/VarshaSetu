import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import type { SupportedLanguage } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Volume2,
  Play,
  Pause,
  Square,
  Sparkles,
  MapPin,
  CloudRain,
  Layers,
  Sprout,
  Map as MapIcon,
  HelpCircle,
  CheckCircle2,
  Info,
  Compass,
  ArrowRight,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface VarshaAudioGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AUDIO_GUIDE_SEEN_KEY = "varsha_audio_guide_seen";

/**
 * Strict regional voice finder.
 * Ensures Kannada/Hindi never falls back to an English browser voice.
 */
function findMatchingBrowserVoice(
  voices: SpeechSynthesisVoice[],
  language: SupportedLanguage,
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (language === "kn") {
    return (
      voices.find((v) => v.lang.toLowerCase() === "kn-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("kn")) ||
      null
    );
  }

  if (language === "hi") {
    return (
      voices.find((v) => v.lang.toLowerCase() === "hi-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
      null
    );
  }

  if (language === "en") {
    return (
      voices.find((v) => v.lang.toLowerCase() === "en-in") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  return null;
}

/**
 * Builds the natural 2-minute audio guide script dynamically for the selected language & location.
 */
export function buildAudioGuideScript(
  language: SupportedLanguage,
  taluk: string,
  district: string,
): { title: string; script: string } {
  const talukName = taluk || "your selected taluk";
  const districtName = district || "Karnataka";

  if (language === "kn") {
    return {
      title: "ವರ್ಷ ಸೇತು ಆಡಿಯೋ ಮಾರ್ಗದರ್ಶಿ",
      script: `ವರ್ಷ ಸೇತು ಕೃಷಿ ಹವಾಮಾನ ಮತ್ತು ಮಣ್ಣಿನ ಮಾಹಿತಿ ವೇದಿಕೆಗೆ ಸುಸ್ವಾಗತ. ಈ ಕಿರು ಮಾರ್ಗದರ್ಶಿಯು ಪ್ರತಿ ವಿಭಾಗದಲ್ಲಿ ನೀವು ಯಾವ ಮಾಹಿತಿಯನ್ನು ನೋಡಬಹುದು, ಅದರ ಅರ್ಥವೇನು ಮತ್ತು ಅದು ನಿಮ್ಮ ಕೃಷಿ ಕೆಲಸಗಳಿಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ ಎಂಬುದನ್ನು ವಿವರಿಸುತ್ತದೆ.

ಮೊದಲನೆಯದಾಗಿ ನಿಮ್ಮ ಸ್ಥಳ: ನೀವು ${districtName} ಜಿಲ್ಲೆಯ ${talukName} ತಾಲೂಕನ್ನು ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ. ಸಂಪೂರ್ಣ ವೇದಿಕೆಯಲ್ಲಿನ ಎಲ್ಲಾ ಮುನ್ಸೂಚನೆಗಳು, ಮಣ್ಣಿನ ತೇವಾಂಶ ಮತ್ತು ಬೆಳೆ ಸಲಹೆಗಳು ಈ ಪ್ರದೇಶಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಿದ್ಧಗೊಳ್ಳುತ್ತವೆ.

ಅವಲೋಕನ ವಿಭಾಗದಲ್ಲಿ, ನೀವು ಪ್ರಸ್ತುತ ಹವಾಮಾನ, 30 ದಿನಗಳ ನಿರೀಕ್ಷಿತ ಮಳೆ, ಮಣ್ಣಿನ ತೇವಾಂಶ ಸಾಮರ್ಥ್ಯ, ಅಪಾಯದ ಮಟ್ಟ ಮತ್ತು ಇಂದಿನ ಪ್ರಮುಖ ಕೃಷಿ ಆದ್ಯತೆಗಳ ಸಂಕ್ಷಿಪ್ತ ವಿವರವನ್ನು ಒಂದೇ ಕಡೆ ನೋಡಬಹುದು.

4-ವಾರಗಳ ಮುನ್ಸೂಚನೆ ವಿಭಾಗದಲ್ಲಿ, ಮುಂದಿನ ನಾಲ್ಕು ವಾರಗಳ ಮಳೆಯ ಅಂದಾಜು, ಮಳೆ ವಿರಾಮದ ಸಾಧ್ಯತೆ ಮತ್ತು ಭಾರಿ ಮಳೆಯ ಮುನ್ಸೂಚನೆಯನ್ನು ವೀಕ್ಷಿಸಬಹುದು. ಇದರಿಂದ ಬರುವ ವಾರಗಳಲ್ಲಿ ಮಳೆ ಹೆಚ್ಚಿರುತ್ತದೆಯೇ ಅಥವಾ ಒಣ ಹವೆ ಇರುತ್ತದೆಯೇ ಎಂದು ತಿಳಿದು ಬಿತ್ತನೆ, ಗೊಬ್ಬರ ಮತ್ತು ಕೃಷಿ ಕೆಲಸಗಳನ್ನು ಯೋಜಿಸಲು ಸಹಾಯವಾಗುತ್ತದೆ.

ಮಳೆ ಮುನ್ನೋಟ ವಿಭಾಗದಲ್ಲಿ, 30 ದಿನಗಳ ಮಳೆಯ ಪ್ರವೃತ್ತಿಯನ್ನು ನೋಡಬಹುದು. ಇದು ದೀರ್ಘಾವಧಿಯ ನೀರಿನ ನಿರ್ವಹಣೆಗೆ ಸಹಕಾರಿಯಾಗಿದೆ.

ಮಣ್ಣು ಮತ್ತು ಜಲವಿಜ್ಞಾನ ವಿಭಾಗದಲ್ಲಿ, ನಿಮ್ಮ ಮಣ್ಣಿನ ಮಾದರಿ, ತೇವಾಂಶ ಧಾರಣ ಸಾಮರ್ಥ್ಯ ಮತ್ತು ಮಳೆ ವಿರಾಮದ ಬಫರ್ ದಿನಗಳನ್ನು ನೋಡಬಹುದು. ಮಣ್ಣಿನಲ್ಲಿ ಎಷ್ಟು ದಿನ ತೇವಾಂಶ ಉಳಿಯುತ್ತದೆ ಎಂದು ತಿಳಿದು ನೀರಾವರಿಯನ್ನು ಸರಿಯಾಗಿ ನಿರ್ವಹಿಸಲು ಇದು ನೆರವಾಗುತ್ತದೆ.

ಬೆಳೆ ಸಲಹೆ ವಿಭಾಗದಲ್ಲಿ, ನಿಮ್ಮ ಬೆಳೆ ಮತ್ತು ಅದರ ಬೆಳವಣಿಗೆಯ ಹಂತಕ್ಕೆ ತಕ್ಕಂತೆ ನೀರಿನ ಅಗತ್ಯತೆ ಮತ್ತು ಉಪಯುಕ್ತ ಕೃಷಿ ಸಲಹೆಗಳನ್ನು ಪಡೆಯಬಹುದು.

ಅಪಾಯದ ನಕ್ಷೆ ವಿಭಾಗದಲ್ಲಿ, ಕರ್ನಾಟಕದ ಎಲ್ಲಾ ತಾಲೂಕುಗಳ ಮಾನ್ಸೂನ್ ಅಪಾಯದ ಸ್ಥಿತಿಯನ್ನು ಬಣ್ಣಗಳ ಮೂಲಕ ಸುಲಭವಾಗಿ ವೀಕ್ಷಿಸಬಹುದು.

ನೀವು ಓದುವುದಕ್ಕಿಂತ ಕೇಳಲು ಬಯಸಿದರೆ, ಧ್ವನಿ ಸಲಹೆ ಮೂಲಕ ಕನ್ನಡದಲ್ಲೇ ಆಡಿಯೋ ಕೇಳಬಹುದು.

ಅವಲೋಕನದಿಂದ ಪ್ರಾರಂಭಿಸಿ, ಮುನ್ಸೂಚನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ನಿಮ್ಮ ಕೃಷಿಗೆ ಅಗತ್ಯವಿರುವಾಗ ಯಾವುದೇ ವಿಭಾಗವನ್ನು ಬಳಸಿ. ವರ್ಷ ಸೇತು ಜೊತೆ ಉತ್ತಮ ಕೃಷಿ ಯೋಜನೆಯನ್ನು ರೂಪಿಸಿ!`,
    };
  }

  if (language === "hi") {
    return {
      title: "वर्षा सेतु ऑडियो मार्गदर्शिका",
      script: `वर्षा सेतु कृषि मौसम और मृदा सूचना मंच पर आपका स्वागत है। यह संक्षिप्त मार्गदर्शिका आपको बताएगी कि प्रत्येक अनुभाग में आप क्या जानकारी देख सकते हैं, उसका क्या अर्थ है और यह आपकी खेती की योजना बनाने में कैसे मदद कर सकती है।

सबसे पहले आपका स्थान: आपने ${districtName} जिले का ${talukName} तालुका चुना है। पूरे प्लेटफॉर्म पर सभी पूर्वानुमान, मिट्टी की नमी और फसल सलाह स्वचालित रूप से इसी क्षेत्र के अनुसार अपडेट होते हैं।

अवलोकन अनुभाग में, आप वर्तमान मौसम, 30 दिनों की अपेक्षित वर्षा, मिट्टी की जल धारण क्षमता, जोखिम स्तर और आज की मुख्य प्राथमिकताओं का सारांश एक ही स्थान पर देख सकते हैं।

4-सप्ताह का पूर्वानुमान अनुभाग में, आप आने वाले चार हफ्तों के लिए सक्रिय मानसून, शुष्क दौर और भारी बारिश की संभावना देख सकते हैं। इससे आपको यह समझने में मदद मिलती है कि आने वाले समय में मौसम कैसा रहेगा, ताकि आप बुवाई, सिंचाई और खेत के काम की सही योजना बना सकें।

वर्षा परिदृश्य में 30 दिनों का वर्षा रुझान देखा जा सकता है, जो जल प्रबंधन में उपयोगी है।

मृदा एवं जलविज्ञान अनुभाग में, आपकी मिट्टी का प्रकार, जल धारण क्षमता और शुष्क दौर के बफर दिन देख सकते हैं। इससे पता चलता है कि मिट्टी में कितने दिनों तक नमी बनी रहेगी, जिससे सिंचाई का सही समय तय किया जा सकता है।

फसल सलाह अनुभाग में, आपकी फसल और उसकी विकास अवस्था के अनुसार पानी की आवश्यकता और जरूरी कृषि सलाह मिलती है।

जोखिम मानचित्र में, आप कर्नाटक के सभी तालुकों में सूखे या भारी बारिश के जोखिम स्तर को देख सकते हैं।

यदि आप पढ़ना नहीं चाहते, तो वॉइस बटन दबाकर हिंदी, कन्नड़ या अंग्रेजी में ऑडियो सुन सकते हैं।

अवलोकन से शुरुआत करें, पूर्वानुमान देखें, और अपनी जरूरत के अनुसार किसी भी सेवा का उपयोग करें। वर्षा सेतु में आपका स्वागत है!`,
    };
  }

  return {
    title: "Varsha Setu Audio Guide",
    script: `Welcome to Varsha Setu, your agricultural weather and soil intelligence platform for Karnataka. This short guide will explain what information you can see in each section, what it means, and how it can help you plan your farm activities.

First, your location: You have selected ${talukName} in ${districtName} district. All forecasts, soil metrics, crop recommendations, and risk indices across the entire platform automatically update for this area.

In the Overview, you get a quick consolidated picture of current weather, 30-day expected rainfall, soil water capacity, active risk levels, and today's operational priorities all in one place.

In the 4-Week Forecast, you can see sub-seasonal weather predictions for the next four weeks. It shows the probabilities of active monsoon rainfall, dry spell pauses, and heavy rainfall events exceeding 65 millimeters. This helps you anticipate whether coming weeks will be wetter or drier so you can plan land preparation, sowing, spraying, and field work.

In the Rainfall Outlook, you can see a 30-day rainfall trajectory based on an ensemble of global weather models. This helps you plan longer-term irrigation and water conservation.

In Soil and Hydrology, you can see your soil classification, available water capacity, and dry spell buffer days. This tells you how much water your root-zone can hold and how many days stored moisture can sustain crops during dry periods, helping you plan irrigation more carefully.

In Crop Advisory, you can see tailored recommendations for your selected crop and growth stage, using FAO-56 crop water demand calculations to help you use irrigation water efficiently.

In the Statewide Risk Map, you can explore agricultural risk classifications across all 236 taluks in Karnataka, highlighting areas with elevated dry spell or heavy rainfall possibilities.

You can also use the Voice button to listen to any advisory in English, Kannada, or Hindi.

Start with the Overview, explore the forecasts, check your soil and crop needs, and use the risk map whenever you need deeper insights. Welcome to Varsha Setu!`,
  };
}

export function VarshaAudioGuideModal({ isOpen, onClose }: VarshaAudioGuideModalProps) {
  const { location, language: globalLang } = useDashboard();
  const { t } = useLanguage();

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(globalLang);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync with global language on initial open
  useEffect(() => {
    if (isOpen) {
      setSelectedLang(globalLang);
    }
  }, [isOpen, globalLang]);

  // Load browser speech synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setBrowserVoices(available);
    };

    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  // Stop and cleanup all active audio
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
    setIsPaused(false);
    setIsLoadingAudio(false);
    setStatusMessage("");
  }, []);

  // Handle modal close
  const handleClose = () => {
    stopAllAudio();
    try {
      localStorage.setItem(AUDIO_GUIDE_SEEN_KEY, "true");
    } catch {
      // ignore
    }
    onClose();
  };

  // Pause playback
  const handlePause = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
      setStatusMessage("Paused");
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
      setStatusMessage("Paused");
    }
  };

  // Resume playback
  const handleResume = () => {
    if (audioRef.current && isPaused) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsPaused(false);
        setStatusMessage(
          selectedLang === "kn"
            ? "ಆಡಿಯೋ ಮಾರ್ಗದರ್ಶಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ..."
            : selectedLang === "hi"
            ? "ऑडियो मार्गदर्शिका चल रही है..."
            : "Playing audio guide...",
        );
      });
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window && isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      setStatusMessage(
        selectedLang === "kn"
          ? "ಆಡಿಯೋ ಮಾರ್ಗದರ್ಶಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ..."
          : selectedLang === "hi"
          ? "ऑडियो मार्गदर्शिका चल रही है..."
          : "Playing audio guide...",
      );
      return;
    }

    handlePlay();
  };

  // Start playback
  const handlePlay = async () => {
    stopAllAudio();
    setIsLoadingAudio(true);
    setStatusMessage(
      selectedLang === "kn"
        ? "ಧ್ವನಿ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ..."
        : selectedLang === "hi"
        ? "ऑडियो तैयार किया जा रहा है..."
        : "Preparing audio guide...",
    );

    const { script } = buildAudioGuideScript(
      selectedLang,
      location.taluk,
      location.district,
    );

    // 1. Try Browser TTS with strict voice matching
    const matchingVoice = findMatchingBrowserVoice(browserVoices, selectedLang);

    if (matchingVoice && typeof window !== "undefined" && "speechSynthesis" in window) {
      if (import.meta.env.DEV) {
        console.log(`[AUDIO GUIDE] Using browser voice: ${matchingVoice.name} (${matchingVoice.lang})`);
      }

      const utterance = new SpeechSynthesisUtterance(script);
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
      utterance.rate = 0.95; // Friendly, clear pacing
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsLoadingAudio(false);
        setIsPlaying(true);
        setIsPaused(false);
        setStatusMessage(
          selectedLang === "kn"
            ? "ಕನ್ನಡ ಆಡಿಯೋ ಮಾರ್ಗದರ್ಶಿ ಕೇಳುತ್ತಿದೆ..."
            : selectedLang === "hi"
            ? "हिंदी ऑडियो मार्गदर्शिका सुन रहे हैं..."
            : "Playing audio guide in English...",
        );
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setStatusMessage("Guide completed.");
      };

      utterance.onerror = (e) => {
        if (import.meta.env.DEV) {
          console.warn("[AUDIO GUIDE] Browser utterance error, attempting backend fallback:", e);
        }
        playWithBackendFallback(script, selectedLang);
      };

      window.speechSynthesis.speak(utterance);
      return;
    }

    // 2. Fallback to high-quality Backend TTS (Google TTS)
    await playWithBackendFallback(script, selectedLang);
  };

  const playWithBackendFallback = async (script: string, lang: SupportedLanguage) => {
    if (import.meta.env.DEV) {
      console.log(`[AUDIO GUIDE] Invoking backend TTS fallback for lang=${lang}`);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setStatusMessage(
        lang === "kn"
          ? "ಕನ್ನಡ ಧ್ವನಿ ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ..."
          : lang === "hi"
          ? "उच्च-गुणवत्ता ऑडियो लोड हो रहा है..."
          : "Generating high-quality audio...",
      );

      const blob = await apiClient.streamAdvisoryAudio(script, lang, abortController.signal);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoadingAudio(false);
        setIsPlaying(true);
        setIsPaused(false);
        setStatusMessage(
          lang === "kn"
            ? "ಕನ್ನಡ ಆಡಿಯೋ ಮಾರ್ಗದರ್ಶಿ ಕೇಳುತ್ತಿದೆ..."
            : lang === "hi"
            ? "हिंदी ऑडियो मार्गदर्शिका सुन रहे हैं..."
            : "Playing audio guide...",
        );
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setStatusMessage("Guide completed.");
      };

      audio.onerror = () => {
        setIsLoadingAudio(false);
        setIsPlaying(false);
        setStatusMessage("Audio is currently unavailable. Please try again.");
      };

      await audio.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setStatusMessage("Audio is currently unavailable. Please try again.");
    }
  };

  // Switch language
  const handleSelectLanguage = (lang: SupportedLanguage) => {
    if (lang === selectedLang) return;
    stopAllAudio();
    setSelectedLang(lang);
  };

  // Walkthrough Section Data
  const guideSections = useMemo(
    () => [
      {
        id: "loc",
        icon: MapPin,
        title: "1. Your Selected Location",
        whatYouSee: `Dynamic coordinates and taluk profile for ${location.taluk}, ${location.district}.`,
        whatItMeans:
          "All weather predictions, soil metrics, and advisories are calibrated to this exact micro-climate.",
        howItHelps:
          "You select your taluk once, and the entire studio automatically synchronizes without needing re-entry.",
      },
      {
        id: "overview",
        icon: BarChart3,
        title: "2. Executive Overview",
        whatYouSee:
          "Current conditions, 30-day expected rainfall, soil water capacity, risk index, and today's priority.",
        whatItMeans:
          "A consolidated high-level dashboard summarizing your farm's operational status at a glance.",
        howItHelps:
          "Enables you to assess key conditions immediately before diving into specific technical tools.",
      },
      {
        id: "forecast",
        icon: CloudRain,
        title: "3. 4-Week Monsoon Forecast",
        whatYouSee:
          "Weekly rolling horizons (Weeks 1 to 4) with probabilities for Active Monsoon, Break Spells, and Heavy Rain (>65mm).",
        whatItMeans:
          "Sub-seasonal probabilistic forecast trained on 24-year IMD gridded datasets indicating wet vs. dry trends.",
        howItHelps:
          "Helps you plan land preparation, sowing windows, weeding, and fertilizer applications weeks in advance.",
      },
      {
        id: "outlook",
        icon: BarChart3,
        title: "4. 30-Day Rainfall Outlook",
        whatYouSee:
          "30-day daily precipitation trajectory blending GFS, ECMWF, and ICON global models with historical baselines.",
        whatItMeans:
          "Day-by-day expected rainfall trajectory and multi-agency model agreement confidence.",
        howItHelps:
          "Assists in longer-term water harvesting, pond storage planning, and seasonal operational preparation.",
      },
      {
        id: "soil",
        icon: Layers,
        title: "5. Soil Moisture & Hydrology",
        whatYouSee:
          "Soil taxonomy classification, Available Water Capacity (AWC in mm/m), and dry spell buffer days.",
        whatItMeans:
          "Quantifies how much moisture your soil can store and how many days it can support crops during a dry pause.",
        howItHelps:
          "Allows you to optimize irrigation scheduling and prevent root-zone moisture stress during breaks.",
      },
      {
        id: "crop",
        icon: Sprout,
        title: "6. Hyperlocal Crop Advisory",
        whatYouSee:
          "Stage-specific water demand calculations (FAO-56 Dual-Kc) and actionable agronomic recommendations.",
        whatItMeans:
          "Calculates crop evapotranspiration based on the active growth stage of your selected crop.",
        howItHelps:
          "Guides precise irrigation water management to save resources and enhance crop yield.",
      },
      {
        id: "risk",
        icon: MapIcon,
        title: "7. Statewide Risk Map",
        whatYouSee:
          "Interactive map covering 236 taluks with color-coded risk levels (Low, Moderate, High).",
        whatItMeans:
          "Highlights regional vulnerability to prolonged dry spells or extreme precipitation events.",
        howItHelps:
          "Provides broad spatial awareness of weather risks across neighboring taluks and districts.",
      },
      {
        id: "voice",
        icon: Volume2,
        title: "8. Multi-Lingual Voice Advisory",
        whatYouSee:
          "Audio voice synthesis button on crop advisories supporting English, Kannada, and Hindi.",
        whatItMeans:
          "Reads out localized advisories aloud using regional speech synthesis.",
        howItHelps:
          "Allows farmers to listen to critical recommendations directly in the field without reading dense text.",
      },
    ],
    [location.taluk, location.district],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl border-border/80 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <DialogHeader className="p-5 sm:p-6 border-b border-border/40 bg-card/60">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-signal/40 bg-signal/15 text-signal shadow-md shadow-signal/10">
              <Volume2 className="size-5" />
            </span>
            <div>
              <DialogTitle className="font-display text-lg sm:text-xl font-bold text-foreground">
                How Varsha Setu Works
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Your friendly 2-minute audio guide to understanding predictions, soil metrics, and crop advice.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Audio Player Card */}
          <div className="rounded-2xl border border-signal/30 bg-gradient-to-br from-signal/10 via-card/80 to-card p-5 shadow-lg backdrop-blur-xl space-y-4">
            {/* Language Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Select Guide Language:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedLang === "en" ? "default" : "outline"}
                  onClick={() => handleSelectLanguage("en")}
                  className={`h-8 px-3 text-xs font-medium cursor-pointer transition-all ${
                    selectedLang === "en"
                      ? "bg-signal text-signal-foreground shadow-sm"
                      : "border-border/70 hover:bg-secondary/50"
                  }`}
                  aria-label="Play Varsha Setu guide in English"
                >
                  English
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedLang === "kn" ? "default" : "outline"}
                  onClick={() => handleSelectLanguage("kn")}
                  className={`h-8 px-3 text-xs font-medium cursor-pointer transition-all ${
                    selectedLang === "kn"
                      ? "bg-signal text-signal-foreground shadow-sm"
                      : "border-border/70 hover:bg-secondary/50"
                  }`}
                  aria-label="Play Varsha Setu guide in Kannada"
                >
                  ಕನ್ನಡ (Kannada)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedLang === "hi" ? "default" : "outline"}
                  onClick={() => handleSelectLanguage("hi")}
                  className={`h-8 px-3 text-xs font-medium cursor-pointer transition-all ${
                    selectedLang === "hi"
                      ? "bg-signal text-signal-foreground shadow-sm"
                      : "border-border/70 hover:bg-secondary/50"
                  }`}
                  aria-label="Play Varsha Setu guide in Hindi"
                >
                  हिन्दी (Hindi)
                </Button>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30">
              <div className="flex items-center gap-2.5">
                {!isPlaying && !isPaused ? (
                  <Button
                    type="button"
                    onClick={handlePlay}
                    disabled={isLoadingAudio}
                    className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10 px-5 gap-2 cursor-pointer shadow-md shadow-signal/20"
                  >
                    {isLoadingAudio ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4 fill-current" />
                    )}
                    <span>Play Guide</span>
                  </Button>
                ) : isPaused ? (
                  <Button
                    type="button"
                    onClick={handleResume}
                    className="bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10 px-5 gap-2 cursor-pointer"
                  >
                    <Play className="size-4 fill-current" />
                    <span>Resume</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handlePause}
                    variant="outline"
                    className="border-warning/50 bg-warning/10 text-warning hover:bg-warning/20 font-mono text-xs font-semibold h-10 px-5 gap-2 cursor-pointer"
                  >
                    <Pause className="size-4 fill-current" />
                    <span>Pause</span>
                  </Button>
                )}

                {(isPlaying || isPaused) && (
                  <Button
                    type="button"
                    onClick={stopAllAudio}
                    variant="outline"
                    className="border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 font-mono text-xs h-10 px-3 cursor-pointer"
                  >
                    <Square className="size-3.5 fill-current" />
                    <span className="ml-1.5 hidden sm:inline">Stop</span>
                  </Button>
                )}
              </div>

              {/* Status / Live Wave Indicator */}
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                {isPlaying && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-signal animate-ping" />
                    <span className="size-1.5 rounded-full bg-signal animate-bounce" />
                    <span className="size-1.5 rounded-full bg-signal animate-pulse" />
                  </span>
                )}
                <span className="truncate max-w-[220px]">
                  {statusMessage ||
                    (selectedLang === "kn"
                      ? "ಪ್ಲೇ ಬಟನ್ ಒತ್ತಿ ಆಡಿಯೋ ಕೇಳಿ"
                      : selectedLang === "hi"
                      ? "प्ले बटन दबाकर गाइड सुनें"
                      : "Press Play to listen to the audio guide")}
                </span>
              </div>
            </div>
          </div>

          {/* Guide Topics / Written Transcript Outline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Guide Breakdown (What, Why & How):
              </span>
              <span className="text-[11px] font-mono text-signal">
                📍 {location.taluk}, {location.district}
              </span>
            </div>

            <div className="space-y-2.5">
              {guideSections.map((sec) => {
                const Icon = sec.icon;
                const isExpanded = expandedSection === sec.id;
                return (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-border/60 bg-card/60 p-3.5 transition-colors hover:border-border"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-7 place-items-center rounded-lg border border-border bg-background/60 text-signal">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="font-display text-sm font-semibold text-foreground">
                          {sec.title}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-2 text-xs leading-relaxed">
                        <div>
                          <span className="font-semibold text-signal font-mono text-[11px] uppercase">
                            What you can see:{" "}
                          </span>
                          <span className="text-foreground/90">{sec.whatYouSee}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-cyan font-mono text-[11px] uppercase">
                            What it means:{" "}
                          </span>
                          <span className="text-muted-foreground">{sec.whatItMeans}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-400 font-mono text-[11px] uppercase">
                            How it helps you:{" "}
                          </span>
                          <span className="text-foreground/90">{sec.howItHelps}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border/40 bg-card/60 flex items-center justify-between">
          <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
            Varsha Setu Multi-Lingual Decision Support
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="border-border text-xs font-mono ml-auto cursor-pointer"
          >
            Close Guide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact, friendly Header Trigger Button for first-time / returning users.
 */
export function AudioGuideTriggerButton({ onClick }: { onClick: () => void }) {
  const [isFirstTime, setIsFirstTime] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(AUDIO_GUIDE_SEEN_KEY) === "true";
      setIsFirstTime(!seen);
    }
  }, []);

  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      size="sm"
      className={`h-8 px-2.5 sm:px-3 text-xs font-mono font-medium gap-1.5 cursor-pointer backdrop-blur-lg transition-all ${
        isFirstTime
          ? "border-signal/50 bg-signal/15 text-signal hover:bg-signal/25 shadow-xs shadow-signal/20 animate-pulse"
          : "border-border/80 bg-glass/80 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
      }`}
      title="Listen to a quick 2-minute guide on how Varsha Setu works"
    >
      <Volume2 className="size-3.5 text-signal shrink-0" />
      <span className="hidden sm:inline">
        {isFirstTime ? "New? Audio Guide" : "Audio Guide"}
      </span>
      <span className="sm:hidden">Guide</span>
    </Button>
  );
}
