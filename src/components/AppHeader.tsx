import { CloudRain, User, LogOut, ChevronDown, Sliders, MapPin } from "lucide-react";
import { motion, useScroll, useSpring } from "motion/react";
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  children?: ReactNode;
  showProgress?: boolean;
}

export function AppHeader({ children, showProgress = true }: AppHeaderProps) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 22, restDelta: 0.001 });
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <>
      {showProgress && (
        <motion.div
          className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-signal shadow-[0_0_8px_rgba(var(--signal),0.5)]"
          style={{ scaleX: progress }}
        />
      )}
      <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="group flex items-center gap-3 transition-opacity hover:opacity-90"
              aria-label="Varsha Setu home"
            >
              <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10 transition-colors group-hover:bg-signal/20">
                <CloudRain className="size-5 text-signal" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-foreground">
                Varsha Setu
              </span>
            </Link>

            <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Karnataka network live
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Custom page slots (e.g. Language switcher, backend status) */}
            {children}

            {/* Global Authentication Navigation Slot */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-border/80 bg-glass/80 backdrop-blur-lg gap-1.5 text-xs font-medium px-2.5"
                  >
                    <User className="size-3.5 text-signal" />
                    <span className="max-w-[100px] truncate hidden sm:inline">
                      {user.full_name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] uppercase px-1 py-0 h-4 border-signal/40 bg-signal/10 text-signal"
                    >
                      {user.role}
                    </Badge>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 border-border/80 bg-background/95 shadow-xl backdrop-blur-xl"
                >
                  <div className="px-2.5 py-2 border-b border-border/40">
                    <div className="text-xs font-semibold text-foreground">{user.full_name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      +91 {user.phone_number}
                    </div>
                    {user.default_taluk && (
                      <div className="flex items-center gap-1 text-[10px] text-signal mt-1 font-mono">
                        <MapPin className="size-3 shrink-0" />
                        <span>
                          {user.default_taluk}, {user.default_district}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer text-xs">
                    <Link to="/dashboard">
                      <Sliders className="mr-2 size-3.5 text-muted-foreground" />
                      Prediction Studio
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-xs text-rose-400 focus:text-rose-300 focus:bg-rose-500/10"
                  >
                    <LogOut className="mr-2 size-3.5" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Link to="/login">Log in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="h-8 text-xs bg-signal text-signal-foreground hover:bg-signal/90 font-medium"
                >
                  <Link to="/signup">Sign up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
