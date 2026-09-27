import { createFileRoute, Link } from '@tanstack/react-router';
import { DashboardProvider } from '@/context/DashboardContext';
import { AppHeader } from '@/components/AppHeader';
import { BackendStatusBadge } from '@/components/dashboard/BackendStatusBadge';
import { LanguageSwitcher } from '@/components/dashboard/LanguageSwitcher';
import { LocationPicker } from '@/components/dashboard/LocationPicker';
import { ForecastPanel } from '@/components/dashboard/ForecastPanel';
import { RainfallOutlookPanel } from '@/components/dashboard/RainfallOutlookPanel';
import { SoilProfilePanel } from '@/components/dashboard/SoilProfilePanel';
import { CropAdvisoryPanel } from '@/components/dashboard/CropAdvisoryPanel';
import { RiskMapPanel } from '@/components/dashboard/RiskMapPanel';
import { NotificationOptInPanel } from '@/components/dashboard/NotificationOptInPanel';
import { ChatAssistantWidget } from '@/components/dashboard/ChatAssistantWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react';

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Live Prediction Studio | Varsha Setu' },
      {
        name: 'description',
        content:
          'AI-powered hyperlocal monsoon prediction and crop advisory studio for Karnataka agriculture, SIH 2026 PS 26086.',
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardContent() {
  return (
    <div className="relative min-h-screen text-foreground">
      {/* Shared Unified Header */}
      <AppHeader showProgress={true}>
        <div className="flex items-center gap-3">
          <BackendStatusBadge />
          <LanguageSwitcher />
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex border-border/80 bg-glass/80 backdrop-blur-lg h-8 text-xs">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-3.5" /> Landing
            </Link>
          </Button>
        </div>
      </AppHeader>

      {/* Main Dashboard Body */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-10 space-y-8">
        {/* Studio Title Banner */}
        <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-signal">
            <Link to="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span>Live Prediction Studio</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                Karnataka Monsoon Intelligence Studio
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Multi-model ensemble bias-corrected against 24-year IMD climatology & FAO-56 crop water demand
              </p>
            </div>
            <Badge variant="outline" className="self-start sm:self-auto border-signal/40 bg-signal/10 px-3 py-1 font-mono text-xs text-signal">
              SIH 2026 · PS 26086
            </Badge>
          </div>
        </div>

        {/* Phase 2: Location Picker */}
        <section aria-label="Location Targeting">
          <LocationPicker />
        </section>

        {/* Phase 3: Forecast Panel (Onset Card + 4-Week Grid) */}
        <section aria-label="4-Week Monsoon Forecast & Onset">
          <ForecastPanel />
        </section>

        {/* 7-30 Day Precipitation Outlook (Multi-Source Ensemble) */}
        <section aria-label="7-30 Day Rainfall Outlook">
          <RainfallOutlookPanel />
        </section>

        {/* Phase 4 & 5: Soil Profile & Crop Advisory */}
        <section aria-label="Soil & Crop Intelligence" className="grid gap-8 lg:grid-cols-2">
          <SoilProfilePanel />
          <CropAdvisoryPanel />
        </section>

        {/* Phase 4: Risk Map */}
        <section aria-label="Statewide Risk Choropleth">
          <RiskMapPanel />
        </section>

        {/* Phase 8: Last-Mile SMS & WhatsApp Opt-In */}
        <section aria-label="Farmer Alert Subscriptions">
          <NotificationOptInPanel />
        </section>

        {/* Floating Conversational AI Assistant */}
        <ChatAssistantWidget />
      </main>

      {/* Dashboard Footer */}
      <footer className="mt-16 border-t border-border/50 bg-background/60 py-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 font-mono text-[11px] text-muted-foreground sm:flex-row sm:px-8 lg:px-10">
          <div>Varsha Setu · Smart India Hackathon 2026 · Team Nexus</div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-success" />
            <span>Operational ML Ensemble Serving Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
