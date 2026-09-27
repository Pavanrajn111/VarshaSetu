import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map, Loader2, Info, RefreshCw, Maximize2, ShieldAlert } from 'lucide-react';

export function RiskMapPanel() {
  const [mapHtml, setMapHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const fetchMap = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // CORRECTION 2: GET /risk-map with NO query parameters
      const html = await apiClient.getRiskMapHtml();
      setMapHtml(html);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load statewide risk map.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMap();
  }, []);

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-signal/30 bg-signal/10">
              <Map className="size-5 text-signal" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-display text-lg font-semibold text-foreground">
                  Statewide Climatological Risk Map
                </CardTitle>
                <Badge variant="outline" className="border-warning/40 bg-warning/10 font-mono text-[10px] text-warning">
                  Illustrative Baseline
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Macro-regional choropleth illustrating baseline risk variations across Karnataka taluks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMap}
              disabled={isLoading}
              className="h-8 border-border bg-background/50 text-xs hover:bg-background"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 border-border bg-background/50 text-xs hover:bg-background"
            >
              <Maximize2 className="mr-1.5 size-3.5" />
              {isFullscreen ? 'Exit Full' : 'Expand'}
            </Button>
          </div>
        </div>

        {/* CORRECTION 2: Transparency notice regarding illustrative formula vs live model */}
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 text-warning shrink-0" />
          <p>
            <strong className="text-foreground">Baseline Visualization Note:</strong> This map displays a pre-rendered statewide geographic choropleth for regional context. For operational field decisions and live ensemble ML predictions, refer to the 4-week probability grid above.
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 bg-background/30 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-signal" />
            <span className="font-mono text-xs">Rendering geospatial choropleth layers...</span>
          </div>
        ) : error ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 bg-destructive/5 p-6 text-center text-destructive">
            <ShieldAlert className="size-8 opacity-80" />
            <div className="font-medium text-sm">Failed to load risk map</div>
            <p className="max-w-md text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchMap} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : (
          <iframe
            srcDoc={mapHtml || ''}
            title="Karnataka Statewide Risk Map"
            className={`w-full border-0 transition-all ${
              isFullscreen ? 'h-[75vh]' : 'h-96 sm:h-[450px]'
            }`}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </CardContent>
    </Card>
  );
}
