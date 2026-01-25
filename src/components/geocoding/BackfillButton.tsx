import React from 'react';
import { MapPin, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useBackfillGeocoding } from '@/hooks/useGeocoding';
import { Link } from 'react-router-dom';

interface BackfillButtonProps {
  missingCount?: number;
  compact?: boolean;
}

export function BackfillButton({ missingCount = 0, compact = false }: BackfillButtonProps) {
  const { isRunning, progress, startBackfill, resetProgress } = useBackfillGeocoding();

  const handleStartBackfill = () => {
    resetProgress();
    startBackfill(10);
  };

  if (compact) {
    if (missingCount === 0) return null;
    
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartBackfill}
        disabled={isRunning}
        className="gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Geocoding...
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            Backfill {missingCount} Locations
          </>
        )}
      </Button>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Backfill
        </CardTitle>
        <CardDescription>
          Geocode properties missing map coordinates using Google Maps API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {progress && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Processed {progress.processed} of {progress.total} properties
              </span>
              <span className="text-muted-foreground">
                {progress.succeeded} succeeded, {progress.failed} failed
              </span>
            </div>
            <Progress 
              value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} 
            />
            
            {!isRunning && progress.processed === progress.total && progress.total > 0 && (
              <Alert variant={progress.failed === 0 ? "default" : "destructive"}>
                {progress.failed === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {progress.failed === 0 ? 'Backfill Complete' : 'Backfill Complete with Errors'}
                </AlertTitle>
                <AlertDescription>
                  Successfully geocoded {progress.succeeded} properties.
                  {progress.failed > 0 && ` ${progress.failed} properties could not be geocoded.`}
                </AlertDescription>
              </Alert>
            )}

            {progress.failures.length > 0 && !isRunning && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Failed Properties:</p>
                <ul className="text-sm space-y-1">
                  {progress.failures.slice(0, 5).map((failure) => (
                    <li key={failure.propertyId} className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <Link 
                        to={`/properties/${failure.propertyId}/edit`}
                        className="text-primary hover:underline"
                      >
                        {failure.address}
                      </Link>
                    </li>
                  ))}
                  {progress.failures.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {progress.failures.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleStartBackfill}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Geocoding...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {progress ? 'Run Again' : 'Start Backfill'}
              </>
            )}
          </Button>

          {progress && !isRunning && (
            <Button variant="outline" onClick={resetProgress}>
              Clear Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
