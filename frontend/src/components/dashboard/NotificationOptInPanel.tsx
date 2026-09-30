import React, { useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToAdvisories } from "@/lib/notification-service";
import type { SupportedLanguage } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BellRing,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Send,
  Radio,
} from "lucide-react";

export function NotificationOptInPanel() {
  const { location, cropType, language: globalLanguage, advisoryText } = useDashboard();
  const { t, availableLanguages } = useLanguage();

  const [phone, setPhone] = useState<string>("");
  const [receiveSms, setReceiveSms] = useState<boolean>(true);
  const [receiveWhatsapp, setReceiveWhatsapp] = useState<boolean>(true);
  const [langPreference, setLangPreference] = useState<SupportedLanguage>(globalLanguage);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setPhoneError(
        "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      );
      return;
    }
    setPhoneError(null);

    const channels: ("sms" | "whatsapp")[] = [];
    if (receiveSms) channels.push("sms");
    if (receiveWhatsapp) channels.push("whatsapp");
    if (channels.length === 0) return;

    setIsSubmitting(true);
    try {
      await subscribeToAdvisories({
        phone: cleanPhone,
        channels,
        language: langPreference,
        location: location.taluk || location.district || "Karnataka",
        crop: cropType,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setPhoneError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Plain-text SMS message preview
  const plainSmsPreview = advisoryText
    ? `[Varsha Setu Alert: ${location.taluk}] For ${cropType}: ${advisoryText.slice(0, 160)}${advisoryText.length > 160 ? "..." : ""} Call 1800-VS-AGRO for audio.`
    : `[Varsha Setu Alert: ${location.taluk}] Monsoon Advisory for ${cropType}: Sowing windows open based on soil moisture buffer.`;

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <BellRing className="size-5 text-signal" />
            </span>
            <div>
              <CardTitle className="font-display text-lg font-semibold text-foreground">
                {t.alerts.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t.alerts.subtitle}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 font-mono text-[10px] text-amber-300"
          >
            {t.alerts.demoBadge}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Subscription Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t.alerts.mobileNumber} (+91)
              </label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-md border border-border bg-background/80 px-3 font-mono text-xs text-muted-foreground">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder={t.alerts.mobilePlaceholder}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  maxLength={10}
                  className="border-border/80 bg-background/80 font-mono text-sm text-foreground focus-visible:ring-signal"
                />
              </div>
              {phoneError && (
                <p className="mt-1 font-mono text-[11px] text-destructive">{phoneError}</p>
              )}
            </div>

            {/* Channels */}
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t.alerts.channels}
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={receiveSms}
                    onChange={(e) => setReceiveSms(e.target.checked)}
                    className="size-4 rounded border-border text-signal focus:ring-signal"
                  />
                  <Smartphone className="size-3.5 text-signal" />
                  {t.alerts.smsChannel}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={receiveWhatsapp}
                    onChange={(e) => setReceiveWhatsapp(e.target.checked)}
                    className="size-4 rounded border-border text-signal focus:ring-signal"
                  />
                  <MessageSquare className="size-3.5 text-success" />
                  {t.alerts.whatsappChannel}
                </label>
              </div>
            </div>

            {/* Language Preference */}
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t.alerts.langPref}
              </label>
              <div className="flex gap-2">
                {availableLanguages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLangPreference(l.code)}
                    className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                      langPreference === l.code
                        ? "border-signal bg-signal/15 text-signal font-semibold"
                        : "border-border/70 bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                phone.replace(/\D/g, "").length < 10 ||
                (!receiveSms && !receiveWhatsapp)
              }
              className="w-full bg-signal text-signal-foreground hover:bg-signal/90 font-mono text-xs font-semibold h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t.alerts.subscribing}
                </>
              ) : submitted ? (
                <>
                  <CheckCircle2 className="mr-2 size-4 text-signal-foreground" />
                  {t.alerts.subscribedSuccess}
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  {t.alerts.subscribeBtn}
                </>
              )}
            </Button>
          </form>

          {/* SMS / WhatsApp Mobile Preview Card */}
          <div className="flex flex-col rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="size-3.5 text-signal animate-pulse" />
                {t.alerts.previewTitle}
              </span>
              <Badge variant="secondary" className="font-mono text-[9px]">
                GSM-7 / UTF-8
              </Badge>
            </div>

            {/* Mock SMS Screen */}
            <div className="flex-1 rounded-lg border border-border/60 bg-card/90 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/30 pb-1 mb-2 font-mono">
                <span>SENDER: VM-VARSHA</span>
                <span>NOW</span>
              </div>
              <p className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {plainSmsPreview}
              </p>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Chars: {plainSmsPreview.length} / 160</span>
                <span className="text-signal">Delivery: Priority</span>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-muted-foreground font-mono">
              {t.alerts.voiceCallNote}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
