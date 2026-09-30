import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import type { SupportedLanguage } from "@/i18n/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, ChevronDown, Check, Bookmark } from "lucide-react";
import { toast } from "sonner";

export function LanguageSwitcher() {
  const { language, setLanguage, availableLanguages, t } = useLanguage();
  const { isAuthenticated, user, updatePreferences } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const currentOption =
    availableLanguages.find((l) => l.code === language) || availableLanguages[0];
  const isCurrentDefault = user?.preferred_language === language;

  const handleSelectLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
  };

  const handleSaveDefault = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await updatePreferences({ preferred_language: language });
      toast.success(`${t.header.savedAsDefault} (${currentOption.label})`);
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/80 bg-background/70 px-2.5 font-sans text-xs font-medium backdrop-blur-md transition-all hover:border-signal/50 hover:bg-background/90 focus-visible:ring-1 focus-visible:ring-signal"
            aria-label={`Select language, currently ${currentOption.label}`}
          >
            <Languages className="size-3.5 text-signal" />
            <span className="font-medium tracking-tight text-foreground">
              {currentOption.label}
            </span>
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180 text-signal" : ""
              }`}
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-48 rounded-xl border border-border/80 bg-background/95 p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <DropdownMenuLabel className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t.header.preferredLanguage}
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          {availableLanguages.map((opt) => {
            const isSelected = language === opt.code;
            return (
              <DropdownMenuItem
                key={opt.code}
                onClick={() => handleSelectLanguage(opt.code)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-signal/15 text-signal font-semibold"
                    : "text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{opt.label}</span>
                  {opt.subLabel && opt.code !== "en" && (
                    <span className="text-[10px] text-muted-foreground">({opt.subLabel})</span>
                  )}
                </div>

                {isSelected ? (
                  <Check className="size-3.5 text-signal stroke-[2.5]" />
                ) : (
                  <span className="size-3.5" />
                )}
              </DropdownMenuItem>
            );
          })}

          {isAuthenticated && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border/40" />
              <button
                type="button"
                onClick={handleSaveDefault}
                disabled={isSaving || isCurrentDefault}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-mono transition-colors ${
                  isCurrentDefault
                    ? "text-emerald-400 cursor-default bg-emerald-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Bookmark className="size-3 text-signal" />
                  <span>{isCurrentDefault ? t.location.savedDefault : t.location.saveDefault}</span>
                </span>
                {isCurrentDefault && <Check className="size-3 text-emerald-400" />}
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
