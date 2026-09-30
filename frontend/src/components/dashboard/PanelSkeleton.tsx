import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function PanelSkeleton({ title = "Loading service..." }: { title?: string }) {
  return (
    <Card className="border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl p-6 space-y-6">
      <CardHeader className="p-0 pb-4 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md bg-muted/40" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48 bg-muted/40" />
            <Skeleton className="h-3 w-64 bg-muted/30" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-signal" />
          <span>{title}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <Skeleton className="h-28 w-full rounded-lg bg-muted/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-lg bg-muted/20" />
          <Skeleton className="h-24 w-full rounded-lg bg-muted/20" />
          <Skeleton className="h-24 w-full rounded-lg bg-muted/20" />
          <Skeleton className="h-24 w-full rounded-lg bg-muted/20" />
        </div>
        <Skeleton className="h-44 w-full rounded-lg bg-muted/20" />
      </CardContent>
    </Card>
  );
}
