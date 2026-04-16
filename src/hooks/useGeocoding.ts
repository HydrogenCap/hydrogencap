import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type GeocodeStatus = 'NOT_STARTED' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type GeocodeSource = 'PLACES' | 'GEOCODE';

export interface GeocodeResult {
  place_id: string | null;
  formatted_address: string;
  latitude: number;
  longitude: number;
  address_line: string;
  address_line2: string | null;
  town_city: string | null;
  county: string | null;
  postcode: string | null;
  country: string;
  geocode_confidence: 'exact' | 'approximate' | 'unknown';
}

export interface BackfillProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  failures: Array<{
    propertyId: string;
    address: string;
    error: string;
  }>;
}

export function useGeocoding() {
  const queryClient = useQueryClient();
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geocode a single address using the edge function
  const geocodeAddress = useCallback(async (address: string): Promise<GeocodeResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address },
      });

      if (error || !data?.success) {
        console.error('Geocoding failed:', error || data?.error);
        return null;
      }

      const result = data.data;
      return {
        place_id: result.place_id,
        formatted_address: result.formatted_address,
        latitude: result.latitude,
        longitude: result.longitude,
        address_line: result.address_line1,
        address_line2: result.address_line2,
        town_city: result.town_city,
        county: result.county,
        postcode: result.postcode,
        country: result.country,
        geocode_confidence: result.geocode_confidence,
      };
    } catch (err) {
      console.error('Failed to geocode address:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to geocode address');
      return null;
    }
  }, []);

  // Update a property with geocode data
  const updatePropertyGeocode = useCallback(async (
    propertyId: string,
    geocodeData: GeocodeResult,
    source: GeocodeSource
  ) => {
    const status: GeocodeStatus = geocodeData.geocode_confidence === 'exact' ? 'SUCCESS' : 'PARTIAL';
    
    const { error } = await (supabase as any)
      .from('properties_v2')
      .update({
        place_id: geocodeData.place_id,
        formatted_address: geocodeData.formatted_address,
        latitude: geocodeData.latitude,
        longitude: geocodeData.longitude,
        city: geocodeData.town_city,
        county: geocodeData.county,
        country: geocodeData.country,
        geocode_status: status,
        geocode_source: source,
        geocode_error: null,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', propertyId);

    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
    queryClient.invalidateQueries({ queryKey: ['property_v2', propertyId] });
  }, [queryClient]);

  // Mark a property geocode as failed
  const markGeocodeFailed = useCallback(async (
    propertyId: string,
    errorMessage: string
  ) => {
    const { error } = await (supabase as any)
      .from('properties_v2')
      .update({
        geocode_status: 'FAILED' as GeocodeStatus,
        geocode_error: errorMessage,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', propertyId);

    if (error) throw error;
  }, []);

  // Geocode a property by building address from its fields
  const geocodeProperty = useCallback(async (property: {
    id: string;
    address_line_1: string;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  }): Promise<boolean> => {
    // Build full address string
    const addressParts = [
      property.address_line_1,
      property.address_line_2,
      property.city,
      property.postcode,
      property.country || 'United Kingdom',
    ].filter(Boolean);
    
    const fullAddress = addressParts.join(', ');
    
    const result = await geocodeAddress(fullAddress);
    
    if (result) {
      await updatePropertyGeocode(property.id, result, 'GEOCODE');
      return true;
    } else {
      await markGeocodeFailed(property.id, 'Could not geocode address');
      return false;
    }
  }, [geocodeAddress, updatePropertyGeocode, markGeocodeFailed]);

  return {
    isGeocoding,
    setIsGeocoding,
    geocodeAddress,
    geocodeProperty,
    updatePropertyGeocode,
    markGeocodeFailed,
  };
}

// Hook for batch geocoding with progress tracking and toast notifications
export function useBackfillGeocoding() {
  const { geocodeProperty } = useGeocoding();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);

  // AbortController so the backfill loop stops cleanly when:
  //   - the hook unmounts (navigate away mid-run)
  //   - the user explicitly clicks Cancel
  // Previously the loop kept running, making HTTP calls and calling setState
  // on an unmounted component — producing React warnings and wasting geocode
  // API quota.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const cancelBackfill = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startBackfill = useCallback(async (batchSize: number = 10) => {
    // Cancel any prior run before starting a new one.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsRunning(true);
    // Track progress in a local ref so we can read a consistent snapshot at
    // the end without the setState-promise race the previous version used.
    let localProgress: BackfillProgress = {
      total: 0, processed: 0, succeeded: 0, failed: 0, failures: [],
    };
    const updateProgress = (next: BackfillProgress) => {
      localProgress = next;
      if (mountedRef.current) setProgress(next);
    };
    updateProgress(localProgress);

    // Import toast dynamically to avoid hook rules violation
    const { toast } = await import('@/hooks/use-toast');

    try {
      // Fetch all properties needing geocoding
      const { data: properties, error } = await (supabase as any)
        .from('properties_v2')
        .select('id, address_line_1, address_line_2, city, postcode, country')
        .or('geocode_status.eq.NOT_STARTED,geocode_status.eq.FAILED,latitude.is.null');

      if (error) throw error;
      if (ac.signal.aborted) return;
      if (!properties?.length) {
        updateProgress({ ...localProgress, total: 0 });
        if (mountedRef.current) setIsRunning(false);
        toast({
          title: 'No properties to geocode',
          description: 'All properties already have location data',
        });
        return;
      }

      updateProgress({ ...localProgress, total: properties.length });

      toast({
        title: 'Geocoding started',
        description: `Processing ${properties.length} properties...`,
      });

      // Process in batches
      outer: for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);

        for (const property of batch) {
          if (ac.signal.aborted) break outer;

          let success = false;
          let failureMessage = 'Geocoding failed';
          try {
            success = await geocodeProperty(property);
          } catch (err) {
            // Previously thrown errors from markGeocodeFailed or updatePropertyGeocode
            // would abort the whole loop. Swallow per-property so the batch continues.
            failureMessage = err instanceof Error ? err.message : String(err);
            console.error(`Geocode failed for ${property.id}:`, err);
          }

          if (ac.signal.aborted) break outer;

          updateProgress({
            ...localProgress,
            processed: localProgress.processed + 1,
            succeeded: success ? localProgress.succeeded + 1 : localProgress.succeeded,
            failed: success ? localProgress.failed : localProgress.failed + 1,
            failures: success ? localProgress.failures : [
              ...localProgress.failures,
              { propertyId: property.id, address: property.address_line_1, error: failureMessage },
            ],
          });

          // Rate limit: wait 200ms between requests (abortable)
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 200);
            ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
          });
        }
      }

      // Refresh property list after backfill
      queryClient.invalidateQueries({ queryKey: ['properties_v2'] });

      if (ac.signal.aborted) {
        toast({
          title: 'Geocoding cancelled',
          description: `Stopped after ${localProgress.processed} of ${localProgress.total} properties`,
        });
      } else if (localProgress.failed === 0) {
        toast({
          title: 'Geocoding complete',
          description: `Successfully geocoded ${localProgress.succeeded} properties`,
        });
      } else {
        toast({
          title: 'Geocoding complete with errors',
          description: `${localProgress.succeeded} succeeded, ${localProgress.failed} failed`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Backfill error:', err);
      toast({
        title: 'Geocoding failed',
        description: err instanceof Error ? err.message : 'An error occurred while geocoding properties',
        variant: 'destructive',
      });
    } finally {
      if (mountedRef.current) setIsRunning(false);
    }
  }, [geocodeProperty, queryClient]);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    isRunning,
    progress,
    startBackfill,
    cancelBackfill,
    resetProgress,
  };
}

// Calculate distance between two coordinates in miles
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Check if new geocode is suspiciously far from previous location
export function isSuspiciousGeocodeChange(
  oldLat: number | null,
  oldLng: number | null,
  newLat: number,
  newLng: number,
  thresholdMiles: number = 25
): boolean {
  if (oldLat === null || oldLng === null) return false;
  const distance = calculateDistanceMiles(oldLat, oldLng, newLat, newLng);
  return distance > thresholdMiles;
}
