import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackfillGeocoding } from '@/hooks/useGeocoding';

interface GeocodePromptProps {
  importedCount: number;
  onComplete?: () => void;
}

export function GeocodePrompt({ importedCount, onComplete }: GeocodePromptProps) {
  const { isRunning, progress, startBackfill } = useBackfillGeocoding();
  const [dismissed, setDismissed] = React.useState(false);

  const handleGeocode = () => {
    startBackfill(10);
  };

  // Auto-complete when geocoding finishes
  React.useEffect(() => {
    if (progress && !isRunning && progress.processed === progress.total && progress.total > 0) {
      // Geocoding complete - parent can navigate
      onComplete?.();
    }
  }, [progress, isRunning, onComplete]);

  if (dismissed) return null;

  if (isRunning || (progress && progress.processed < progress.total)) {
    return (
      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            Geocoding properties... {progress?.processed || 0}/{progress?.total || importedCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Adding map coordinates to your imported properties
          </p>
        </div>
      </div>
    );
  }

  if (progress && progress.processed === progress.total) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/5 border border-success/20 rounded-lg">
        <MapPin className="h-5 w-5 text-success" />
        <div className="flex-1">
          <p className="text-sm font-medium text-success">
            Geocoding complete! {progress.succeeded} properties located
          </p>
          {progress.failed > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.failed} properties could not be geocoded
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg">
      <MapPin className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          Add map locations to imported properties?
        </p>
        <p className="text-xs text-muted-foreground">
          Geocode {importedCount} properties so they appear on your portfolio map
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
          Skip
        </Button>
        <Button size="sm" onClick={handleGeocode} className="gap-2">
          <MapPin className="h-4 w-4" />
          Geocode Now
        </Button>
      </div>
    </div>
  );
}
