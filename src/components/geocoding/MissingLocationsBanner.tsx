import React from 'react';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBackfillGeocoding } from '@/hooks/useGeocoding';

interface MissingLocationsBannerProps {
  missingCount: number;
  totalCount: number;
}

export function MissingLocationsBanner({ missingCount, totalCount }: MissingLocationsBannerProps) {
  const { isRunning, progress, startBackfill, resetProgress } = useBackfillGeocoding();

  if (missingCount === 0) return null;

  const handleBackfill = () => {
    resetProgress();
    startBackfill(10);
  };

  const progressPercent = progress && progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <Alert className="bg-warning/10 border-warning/30">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Properties Missing from Map</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {isRunning && progress ? (
            <>
              Geocoding in progress: {progress.processed}/{progress.total} ({progressPercent}%)
              {progress.succeeded > 0 && ` — ${progress.succeeded} succeeded`}
            </>
          ) : (
            <>
              {missingCount} of {totalCount} properties don't have map coordinates yet.
            </>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackfill}
          disabled={isRunning}
          className="ml-4 gap-2 border-warning/50 hover:bg-warning/10"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Geocoding...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Backfill Locations
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
