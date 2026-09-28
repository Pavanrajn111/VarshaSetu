import React from "react";
import {
  LayoutDashboard,
  CloudRain,
  BarChart3,
  Layers,
  Sprout,
  Map,
  BellRing,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Menu,
  MapPin,
  Compass,
  LogOut,
  User,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useDashboard } from "@/context/DashboardContext";
import { useAuth } from "@/context/AuthContext";

export const DASHBOARD_SECTIONS = [
  "overview",
  "forecast",
  "outlook",
  "soil",
  "crop",
  "risk_map",
  "alerts",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export interface SidebarItemDef {
  id: DashboardSection;
  label: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  section: "overview" | "intelligence";
}

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onOpenLocationSetup: () => void;
}

export function DashboardSidebar({
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileOpenChange,
  onOpenLocationSetup,
}: DashboardSidebarProps) {
  const { t } = useLanguage();
  const { location } = useDashboard();
  const { user, logout, isAuthenticated } = useAuth();

  const sidebarItems: SidebarItemDef[] = [
    {
      id: "overview",
      label: t.sidebar.overviewLabel || "Overview",
      tag: t.sidebar.overviewTag || "Summary",
      icon: LayoutDashboard,
      section: "overview",
    },
    {
      id: "forecast",
      label: t.sidebar.forecastLabel,
      tag: t.sidebar.forecastTag,
      icon: CloudRain,
      section: "intelligence",
    },
    {
      id: "outlook",
      label: t.sidebar.outlookLabel,
      tag: t.sidebar.outlookTag,
      icon: BarChart3,
      section: "intelligence",
    },
    {
      id: "soil",
      label: t.sidebar.soilLabel || "Soil & Hydrology",
      tag: t.sidebar.soilTag || "FAO-56 AWC",
      icon: Layers,
      section: "intelligence",
    },
    {
      id: "crop",
      label: t.sidebar.cropLabel || "Crop Advisory",
      tag: t.sidebar.cropTag || "Dual Kc",
      icon: Sprout,
      section: "intelligence",
    },
    {
      id: "risk_map",
      label: t.sidebar.riskMapLabel,
      tag: t.sidebar.riskMapTag,
      icon: Map,
      section: "intelligence",
    },
    {
      id: "alerts",
      label: t.sidebar.alertsLabel,
      tag: t.sidebar.alertsTag,
      icon: BellRing,
      section: "intelligence",
    },
  ];

  const overviewItems = sidebarItems.filter((i) => i.section === "overview");
  const intelligenceItems = sidebarItems.filter((i) => i.section === "intelligence");

  const renderNavGroup = (items: SidebarItemDef[], isMobile = false) => (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectSection(item.id);
              if (isMobile) {
                onMobileOpenChange(false);
              }
            }}
            title={isCollapsed && !isMobile ? `${item.label} (${item.tag})` : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all cursor-pointer relative w-full",
              isActive
                ? "bg-signal/15 text-signal font-semibold shadow-[0_0_12px_rgba(var(--signal),0.12)] border border-signal/30"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent",
              isCollapsed && !isMobile && "justify-center px-2 py-2.5",
            )}
          >
            {/* Active accent vertical bar */}
            {isActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-signal" />
            )}

            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-md border transition-colors",
                isActive
                  ? "border-signal/40 bg-signal/20 text-signal"
                  : "border-border/60 bg-background/50 text-muted-foreground group-hover:border-signal/30 group-hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </span>

            {(!isCollapsed || isMobile) && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                <span className="truncate font-mono text-[9.5px] text-muted-foreground">
                  {item.tag}
                </span>
              </div>
            )}

            {isActive && (!isCollapsed || isMobile) && (
              <span className="size-1.5 rounded-full bg-signal shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* 1. Mobile Top Bar with Navigation Sheet Drawer */}
      <div className="sticky top-16 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-xl md:hidden w-full">
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border/80 bg-glass/80 text-xs font-mono"
            >
              <Menu className="size-4 text-signal" />
              <span>{t.sidebar.mobileTitle}</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 border-r border-border/80 bg-card/95 p-0 backdrop-blur-2xl flex flex-col justify-between"
          >
            <div>
              <SheetHeader className="border-b border-border/40 p-4 pb-3 text-left">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-md border border-signal/40 bg-signal/15 text-signal font-bold text-xs">
                    VS
                  </div>
                  <SheetTitle className="font-display text-sm font-semibold text-foreground">
                    Varsha Setu Suite
                  </SheetTitle>
                </div>
              </SheetHeader>

              <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                {/* Overview Section */}
                <div>
                  <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t.sidebar.overviewSection}
                  </div>
                  {renderNavGroup(overviewItems, true)}
                </div>

                {/* Intelligence Section */}
                <div>
                  <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t.sidebar.intelligenceSection}
                  </div>
                  {renderNavGroup(intelligenceItems, true)}
                </div>

                {/* Compact Location Box */}
                <div className="p-3 rounded-xl border border-border/70 bg-background/60 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 text-signal" />
                      {t.sidebar.currentLocation}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate">
                    {location.taluk}, {location.district}
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      onMobileOpenChange(false);
                      onOpenLocationSetup();
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-mono h-7 border-signal/30 text-signal hover:bg-signal/10 cursor-pointer"
                  >
                    <Compass className="mr-1 size-3" />
                    {t.sidebar.changeLocation}
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile User Footer */}
            {isAuthenticated && (
              <div className="p-3 border-t border-border/40 bg-background/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs truncate">
                    <User className="size-3.5 text-signal shrink-0" />
                    <span className="truncate">{user?.full_name || "User"}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
                    className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Current Active Location Tag */}
        <button
          type="button"
          onClick={onOpenLocationSetup}
          className="flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-signal transition-colors cursor-pointer"
        >
          <MapPin className="size-3.5 text-signal" />
          <span className="font-semibold">{location.taluk}</span>
        </button>
      </div>

      {/* 2. Desktop Persistent Collapsible Sidebar */}
      <aside
        aria-label="Service navigation"
        className={cn(
          "sticky top-20 hidden md:flex flex-col justify-between shrink-0 rounded-2xl border border-border/70 bg-card/80 shadow-xl backdrop-blur-xl transition-all duration-300 overflow-hidden min-h-[580px]",
          isCollapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div className="p-3 space-y-4">
          {/* Header Bar with Toggle Collapse */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid size-6 place-items-center rounded-md border border-signal/40 bg-signal/15 text-signal font-bold text-[11px]">
                  VS
                </span>
                <span className="font-display text-xs font-bold tracking-tight text-foreground truncate">
                  Varsha Setu
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
              className={cn(
                "size-7 text-muted-foreground hover:text-foreground cursor-pointer shrink-0",
                isCollapsed && "mx-auto",
              )}
            >
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>

          {/* Navigation Items */}
          <div className="space-y-4">
            {/* Overview Group */}
            <div>
              {!isCollapsed && (
                <div className="px-2 pb-1 font-mono text-[9px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  {t.sidebar.overviewSection}
                </div>
              )}
              {renderNavGroup(overviewItems)}
            </div>

            {/* Intelligence Group */}
            <div>
              {!isCollapsed && (
                <div className="px-2 pb-1 font-mono text-[9px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                  {t.sidebar.intelligenceSection}
                </div>
              )}
              {renderNavGroup(intelligenceItems)}
            </div>
          </div>
        </div>

        {/* Bottom Section: Location & User */}
        <div className="p-3 border-t border-border/40 bg-background/30 space-y-2.5">
          {/* Compact Location Display */}
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl border border-border/60 bg-background/50 space-y-1.5">
              <div className="flex items-center justify-between text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-signal" />
                  {t.sidebar.currentLocation}
                </span>
              </div>
              <div className="text-xs font-semibold text-foreground truncate">
                {location.taluk}, {location.district}
              </div>
              <Button
                type="button"
                onClick={onOpenLocationSetup}
                variant="outline"
                size="sm"
                className="w-full text-[11px] font-mono h-7 border-signal/30 text-signal hover:bg-signal/10 hover:border-signal/50 cursor-pointer"
              >
                <Compass className="mr-1 size-3" />
                {t.sidebar.changeLocation}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLocationSetup}
              title={`${location.taluk}, ${location.district} (${t.sidebar.changeLocation})`}
              className="grid size-9 mx-auto place-items-center rounded-lg border border-signal/40 bg-signal/15 text-signal hover:bg-signal/25 transition-all cursor-pointer"
            >
              <MapPin className="size-4" />
            </button>
          )}

          {/* User Section */}
          {isAuthenticated && (
            <div className="flex items-center justify-between pt-1">
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <User className="size-3.5 text-signal shrink-0" />
                  <span className="font-mono text-[11px] text-foreground truncate">
                    {user?.full_name || "Account"}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title={t.sidebar.logoutLabel}
                className={cn(
                  "size-7 text-muted-foreground hover:text-destructive cursor-pointer",
                  isCollapsed && "mx-auto",
                )}
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
