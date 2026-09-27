import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { HealthResponse } from "@/lib/types";
import { Activity, ShieldCheck, AlertCircle } from "lucide-react";

export function BackendStatusBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("");

  const checkHealth = async () => {
    try {
      const data = await apiClient.getHealth();
      setHealth(data);
      setIsOnline(true);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setIsOnline(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline === null) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-md">
        <span className="size-1.5 animate-ping rounded-full bg-warning" />
        <span>Checking backend...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className="group relative flex items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] text-destructive backdrop-blur-md cursor-help"
        title={`Backend at ${apiClient.getBaseUrl()} is unreachable. Make sure your FastAPI server is running.`}
      >
        <span className="size-1.5 rounded-full bg-destructive" />
        <span>Backend Unreachable</span>
      </div>
    );
  }

  // CORRECTION 4: Do not hardcode "v1.0.0". Only show version if returned by /health.
  const versionString = health?.version ? ` (v${health.version})` : "";

  return (
    <div
      className="group relative flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 font-mono text-[10px] text-success backdrop-blur-md cursor-help"
      title={`Backend Status: Operational\nTaluks: ${health?.verified_taluks_count ?? 31}\nTargets: ${health?.model_targets_count ?? 13}\nLast verified: ${lastChecked}`}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      <span>Backend Connected{versionString}</span>
    </div>
  );
}
