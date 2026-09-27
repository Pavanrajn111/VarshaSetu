import { useState, useEffect, lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardProvider } from "@/context/DashboardContext";
import { AppHeader } from "@/components/AppHeader";
import { BackendStatusBadge } from "@/components/dashboard/BackendStatusBadge";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { LocationPicker } from "@/components/dashboard/LocationPicker";
import {
  DashboardSidebar,
  DASHBOARD_SECTIONS,
  type DashboardSection,
} from "@/components/dashboard/DashboardSidebar";
import { PanelSkeleton } from "@/components/dashboard/PanelSkeleton";
import { ChatAssistantWidget } from "@/components/dashboard/ChatAssistantWidget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// PART A: Code-split panels so only the active section's bundle is downloaded initially
const ForecastPanel = lazy(() =>
  import("@/components/dashboard/ForecastPanel").then((m) => ({ default: m.ForecastPanel })),
);
const RainfallOutlookPanel = lazy(() =>
  import("@/components/dashboard/RainfallOutlookPanel").then((m) => ({
    default: m.RainfallOutlookPanel,
  })),
);
const SoilProfilePanel = lazy(() =>
  import("@/components/dashboard/SoilProfilePanel").then((m) => ({ default: m.SoilProfilePanel })),
);
const CropAdvisoryPanel = lazy(() =>
  import("@/components/dashboard/CropAdvisoryPanel").then((m) => ({
    default: m.CropAdvisoryPanel,
  })),
);
const RiskMapPanel = lazy(() =>
  import("@/components/dashboard/RiskMapPanel").then((m) => ({ default: m.RiskMapPanel })),
);
const NotificationOptInPanel = lazy(() =>
  import("@/components/dashboard/NotificationOptInPanel").then((m) => ({
    default: m.NotificationOptInPanel,
  })),
);

const SECTION_STORAGE_KEY = "varsha_active_section";
const COLLAPSED_STORAGE_KEY = "varsha_sidebar_collapsed";

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
  // Precedence: URL parameter > Validated localStorage > Default 'forecast'
  const [activeSection, setActiveSection] = useState<DashboardSection>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSection = urlParams.get("section") as DashboardSection | null;
      if (urlSection && DASHBOARD_SECTIONS.includes(urlSection)) {
        return urlSection;
      }
      try {
        const stored = localStorage.getItem(SECTION_STORAGE_KEY) as DashboardSection | null;
        if (stored && DASHBOARD_SECTIONS.includes(stored)) {
          return stored;
        }
      } catch {
        // Fall through to default on restricted storage environments
      }
    }
    return "forecast";
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const handleSelectSection = (section: DashboardSection) => {
    setActiveSection(section);
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, section);
    } catch {
      // Ignore localStorage write failures
    }
  };

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

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

        {/* PART B: Two-Column Dashboard Architecture (Sidebar + Active Panel) */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Left Persistent / Collapsible Sidebar */}
          <DashboardSidebar
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
            mobileOpen={mobileSidebarOpen}
            onMobileOpenChange={setMobileSidebarOpen}
          />

          {/* Active Service Panel (Lazy-Loaded with Suspense Fallback) */}
          <section
            aria-label="Active Operational Service"
            className="flex-1 w-full min-w-0 transition-opacity duration-200"
          >
            <Suspense fallback={<PanelSkeleton title="Loading operational service..." />}>
              {activeSection === "forecast" && <ForecastPanel />}
              {activeSection === "outlook" && <RainfallOutlookPanel />}
              {activeSection === "advisory" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <SoilProfilePanel />
                  <CropAdvisoryPanel />
                </div>
              )}
              {activeSection === "risk_map" && <RiskMapPanel />}
              {activeSection === "alerts" && <NotificationOptInPanel />}
            </Suspense>
          </section>
        </div>

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
