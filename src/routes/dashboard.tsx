import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardProvider } from "@/context/DashboardContext";
import { AppHeader } from "@/components/AppHeader";
import { BackendStatusBadge } from "@/components/dashboard/BackendStatusBadge";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { LocationPicker } from "@/components/dashboard/LocationPicker";
import { ForecastPanel } from "@/components/dashboard/ForecastPanel";
import { RainfallOutlookPanel } from "@/components/dashboard/RainfallOutlookPanel";
import { SoilProfilePanel } from "@/components/dashboard/SoilProfilePanel";
import { CropAdvisoryPanel } from "@/components/dashboard/CropAdvisoryPanel";
import { RiskMapPanel } from "@/components/dashboard/RiskMapPanel";
import { NotificationOptInPanel } from "@/components/dashboard/NotificationOptInPanel";
import { ChatAssistantWidget } from "@/components/dashboard/ChatAssistantWidget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ShieldCheck, CloudRain, BarChart3, Sprout, Map, BellRing } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live Prediction Studio | Varsha Setu" },
      {
        name: "description",
        content:
          "AI-powered hyperlocal monsoon prediction and crop advisory studio for Karnataka agriculture, SIH 2026 PS 26086.",
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
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex border-border/80 bg-glass/80 backdrop-blur-lg h-8 text-xs cursor-pointer"
          >
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-3.5" /> Landing
            </Link>
          </Button>
        </div>
      </AppHeader>

      {/* Main Dashboard Body */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-10 space-y-6">
        {/* Studio Title Banner */}
        <div className="flex flex-col gap-2 border-b border-border/40 pb-5">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-signal">
            <Link to="/" className="hover:underline">
              Home
            </Link>
            <span>/</span>
            <span>Live Prediction Studio</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                Karnataka Monsoon Intelligence Studio
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Multi-model ensemble bias-corrected against 24-year IMD climatology & FAO-56 crop
                water demand
              </p>
            </div>
            <Badge
              variant="outline"
              className="self-start sm:self-auto border-signal/40 bg-signal/10 px-3 py-1 font-mono text-xs text-signal"
            >
              SIH 2026 · PS 26086
            </Badge>
          </div>
        </div>

        {/* Master Context: Location Picker (Pinned Top) */}
        <section aria-label="Location Targeting">
          <LocationPicker />
        </section>

        {/* Modular Service Option Tabs */}
        <Tabs defaultValue="forecast" className="space-y-6">
          <div className="overflow-x-auto pb-1.5">
            <TabsList className="h-auto p-1.5 bg-card/85 border border-border/70 backdrop-blur-xl rounded-xl inline-flex gap-2 shadow-md">
              <TabsTrigger
                value="forecast"
                className="gap-2.5 px-4 py-2.5 rounded-lg data-[state=active]:bg-signal/15 data-[state=active]:text-signal data-[state=active]:border-signal/40 border border-transparent transition-all cursor-pointer font-sans"
              >
                <CloudRain className="size-4 text-signal shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">4-Week Forecast</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    13 ML Targets
                  </div>
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="outlook"
                className="gap-2.5 px-4 py-2.5 rounded-lg data-[state=active]:bg-cyan/15 data-[state=active]:text-cyan data-[state=active]:border-cyan/40 border border-transparent transition-all cursor-pointer font-sans"
              >
                <BarChart3 className="size-4 text-cyan shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">Rainfall Outlook</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    7–30d Ensemble
                  </div>
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="advisory"
                className="gap-2.5 px-4 py-2.5 rounded-lg data-[state=active]:bg-warning/15 data-[state=active]:text-warning data-[state=active]:border-warning/40 border border-transparent transition-all cursor-pointer font-sans"
              >
                <Sprout className="size-4 text-warning shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">Soil & Advisory</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    FAO-56 & Voice
                  </div>
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="map"
                className="gap-2.5 px-4 py-2.5 rounded-lg data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/40 border border-transparent transition-all cursor-pointer font-sans"
              >
                <Map className="size-4 text-purple-400 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">Statewide Risk Map</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Taluk Choropleth
                  </div>
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="alerts"
                className="gap-2.5 px-4 py-2.5 rounded-lg data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent transition-all cursor-pointer font-sans"
              >
                <BellRing className="size-4 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">Dispatches & Alerts</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    SMS & WhatsApp
                  </div>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Service 1: 4-Week Probabilistic Monsoon Forecast & Onset */}
          <TabsContent value="forecast" className="space-y-4 focus-visible:outline-none">
            <ForecastPanel />
          </TabsContent>

          {/* Service 2: 7-30 Day Precipitation Outlook (Multi-Source Ensemble) */}
          <TabsContent value="outlook" className="space-y-4 focus-visible:outline-none">
            <RainfallOutlookPanel />
          </TabsContent>

          {/* Service 3: Soil Profile & Voice-Enabled Crop Advisory */}
          <TabsContent value="advisory" className="space-y-4 focus-visible:outline-none">
            <div className="grid gap-8 lg:grid-cols-2">
              <SoilProfilePanel />
              <CropAdvisoryPanel />
            </div>
          </TabsContent>

          {/* Service 4: Statewide Risk Choropleth Map */}
          <TabsContent value="map" className="space-y-4 focus-visible:outline-none">
            <RiskMapPanel />
          </TabsContent>

          {/* Service 5: Farmer Alert Subscriptions (SMS & WhatsApp) */}
          <TabsContent value="alerts" className="space-y-4 focus-visible:outline-none">
            <NotificationOptInPanel />
          </TabsContent>
        </Tabs>

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
