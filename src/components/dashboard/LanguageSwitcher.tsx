import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { useAuth } from '@/context/AuthContext';
import type { SupportedLanguage } from '@/lib/types';
import { Languages, Bookmark, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * CORRECTION 1: Language values must strictly be codes ('en' | 'kn' | 'hi').
 * Display labels are UI text only.
 */
const LANGUAGES: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिन्दी' },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useDashboard();
  const { isAuthenticated, user, updatePreferences } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const isCurrentDefault = user?.preferred_language === language;

  const handleSaveDefault = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({ preferred_language: language });
      const langName = LANGUAGES.find((l) => l.code === language)?.label || language;
      toast.success(`Saved ${langName} as your default language.`);
    } catch {
      toast.error('Failed to save default language.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-lg border border-border/80 bg-background/60 p-1 backdrop-blur-md">
        <div className="flex items-center pl-2 pr-1.5 text-muted-foreground">
          <Languages className="size-3.5" />
        </div>
        <div className="flex items-center gap-0.5">
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-all ${
                  isActive
                    ? 'bg-signal text-signal-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save as default language button (visible when logged in and current selection differs from default) */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleSaveDefault}
          disabled={isSaving || isCurrentDefault}
          title={isCurrentDefault ? 'Current default language' : 'Save as default language'}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-all ${
            isCurrentDefault
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default'
              : 'border-border/70 bg-glass/60 text-muted-foreground hover:text-foreground hover:border-signal/50 hover:bg-signal/10'
          }`}
        >
          {isCurrentDefault ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="hidden sm:inline">Default</span>
            </>
          ) : (
            <>
              <Bookmark className="size-3 text-signal" />
              <span className="hidden sm:inline">Save Default</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
