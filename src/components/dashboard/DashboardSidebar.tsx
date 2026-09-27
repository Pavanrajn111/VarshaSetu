import React from "react";
import {
  CloudRain,
  BarChart3,
  Sprout,
  Map,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const DASHBOARD_SECTIONS = [
  "forecast",
  "outlook",
  "advisory",
  "risk_map",
  "alerts",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export interface SidebarItemDef {
  id: DashboardSection;
  label: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  {
    id: "forecast",
    label: "4-Week Forecast",
    tag: "13 ML Targets",
    icon: CloudRain,
  },
  {
    id: "outlook",
    label: "Rainfall Outlook",
    tag: "7–30d Ensemble",
    icon: BarChart3,
  },
  {
    id: "advisory",
    label: "Soil & Advisory",
    tag: "FAO-56 & Voice",
    icon: Sprout,
  },
  {
    id: "risk_map",
    label: "Statewide Risk Map",
    tag: "Taluk Choropleth",
    icon: Map,
  },
  {
    id: "alerts",
    label: "Dispatches & Alerts",
    tag: "SMS & WhatsApp",
    icon: BellRing,
  },
];

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function DashboardSidebar({
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileOpenChange,
}: DashboardSidebarProps) {
  const renderNavList = (isMobile = false) => (
    <nav className="flex flex-col gap-1.5 p-3" aria-label="Dashboard navigation">
      {SIDEBAR_ITEMS.map((item) => {
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
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all cursor-pointer relative",
              isActive
                ? "bg-signal/15 text-signal font-semibold shadow-[0_0_12px_rgba(var(--signal),0.12)] border border-signal/30"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent",
              isCollapsed && !isMobile && "justify-center px-2 py-3",
            )}
          >
            {/* Active accent bar */}
            {isActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-signal" />
            )}

            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-md border transition-colors",
                isActive
                  ? "border-signal/40 bg-signal/20 text-signal"
                  : "border-border/60 bg-background/50 text-muted-foreground group-hover:border-signal/30 group-hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>

            {(!isCollapsed || isMobile) && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {item.tag}
                </span>
              </div>
            )}

            {isActive && (!isCollapsed || isMobile) && (
              <span className="size-1.5 rounded-full bg-signal" />
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar (< md) */}
      <div className="flex md:hidden items-center justify-between border-b border-border/50 bg-card/60 px-4 py-2.5 backdrop-blur-md rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-border/80 bg-glass/80 text-xs font-medium cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="size-4 text-signal" />
                <span>Services</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] p-0 bg-background/95 backdrop-blur-2xl border-r border-border/60"
            >
              <SheetHeader className="border-b border-border/40 p-4 text-left">
                <SheetTitle className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <CloudRain className="size-4 text-signal" />
                  Monsoon Intelligence Suite
                </SheetTitle>
              </SheetHeader>
              <div className="py-2">{renderNavList(true)}</div>
            </SheetContent>
          </Sheet>

          {/* Active section label on mobile header */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {SIDEBAR_ITEMS.find((s) => s.id === activeSection)?.label}
            </span>
            <Badge
              variant="outline"
              className="font-mono text-[9px] border-signal/30 text-signal hidden xs:inline-flex"
            >
              {SIDEBAR_ITEMS.find((s) => s.id === activeSection)?.tag}
            </Badge>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Left Sidebar (>= md) */}
      <aside
        aria-label="Dashboard services"
        className={cn(
          "hidden md:flex flex-col shrink-0 border border-border/60 bg-card/75 backdrop-blur-xl shadow-lg rounded-xl transition-all duration-300 self-start sticky top-20",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        {/* Sidebar Header & Collapse Toggle */}
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-3">
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-display text-xs font-semibold tracking-wide text-foreground uppercase">
                Services
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                Karnataka Operational Suite
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer mx-auto"
            aria-label={isCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="flex-1 py-1">{renderNavList(false)}</div>
      </aside>
    </>
  );
}
