import type { SupportedLanguage, LanguageOption, Translations } from "./types";
import { en } from "./translations/en";
import { kn } from "./translations/kn";
import { hi } from "./translations/hi";

export * from "./types";

export const translations: Record<SupportedLanguage, Translations> = {
  en,
  kn,
  hi,
};

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    label: "English",
    subLabel: "English",
  },
  {
    code: "kn",
    label: "ಕನ್ನಡ",
    subLabel: "Kannada",
  },
  {
    code: "hi",
    label: "हिन्दी",
    subLabel: "Hindi",
  },
];

export const LANGUAGE_STORAGE_KEY = "varsha_setu_language";

export function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "kn" || stored === "hi") {
      return stored;
    }
  } catch {
    // Ignore localStorage access failures
  }
  return "en";
}

export function getTranslations(lang: SupportedLanguage = "en"): Translations {
  return translations[lang] || translations.en;
}
