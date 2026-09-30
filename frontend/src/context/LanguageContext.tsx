import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { SupportedLanguage, Translations, LanguageOption } from "@/i18n/types";
import {
  translations,
  AVAILABLE_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  getTranslations,
} from "@/i18n";
import { useAuth } from "@/context/AuthContext";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  translations: Translations;
  t: Translations;
  availableLanguages: LanguageOption[];
  isKannada: boolean;
  isHindi: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => getInitialLanguage());
  const { user } = useAuth();

  // Sync with authenticated user preference when available
  useEffect(() => {
    if (user?.preferred_language && (user.preferred_language === "en" || user.preferred_language === "kn" || user.preferred_language === "hi")) {
      if (user.preferred_language !== language) {
        setLanguageState(user.preferred_language);
      }
    }
  }, [user?.preferred_language]);

  // Handle language updates and persist to localStorage
  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  // Update HTML document lang attribute when language changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const currentTranslations = getTranslations(language);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        translations: currentTranslations,
        t: currentTranslations,
        availableLanguages: AVAILABLE_LANGUAGES,
        isKannada: language === "kn",
        isHindi: language === "hi",
        isEnglish: language === "en",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside of LanguageProvider
    const fallbackLang = getInitialLanguage();
    const fallbackTrans = getTranslations(fallbackLang);
    return {
      language: fallbackLang,
      setLanguage: () => {},
      translations: fallbackTrans,
      t: fallbackTrans,
      availableLanguages: AVAILABLE_LANGUAGES,
      isKannada: fallbackLang === "kn",
      isHindi: fallbackLang === "hi",
      isEnglish: fallbackLang === "en",
    };
  }
  return context;
}
