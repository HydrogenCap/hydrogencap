import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { logError } from '@/lib/errorLogger';
import { toast } from "sonner";

interface PricePaidResult {
  propertyId: string;
  address: string;
  postcode: string;
  pricePaid: number | null;
  transactionDate: string | null;
  propertyType: string | null;
  success: boolean;
  error?: string;
}

interface BulkEnrichResult {
  success: boolean;
  total: number;
  updated: number;
  failed: number;
  results: PricePaidResult[];
}

export function useBulkPricePaidEnrich() {
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastResult, setLastResult] = useState<BulkEnrichResult | null>(null);
  const queryClient = useQueryClient();

  const enrichAll = async (mode: 'missing-only' | 'all' = 'missing-only'): Promise<BulkEnrichResult | null> => {
    setIsEnriching(true);
    
    try {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.functions.invoke('bulk-price-paid-enrich', {
        body: { mode, orgId },
      });

      if (error) {
        console.error('Bulk Price Paid enrich error:', error);
        logError({ source: 'useBulkPricePaidEnrich.enrichAll', message: 'Edge function bulk-price-paid-enrich returned error', severity: 'error', error });
        toast.error('Enrichment failed', { description: error.message || 'Failed to fetch Price Paid data.' });
        return null;
      }

      const result = data as BulkEnrichResult;
      setLastResult(result);

      if (result.updated > 0) {
        toast.success('Price data updated', { description: `Updated ${result.updated} of ${result.total} properties with Land Registry prices.` });
        // Invalidate properties cache to refresh the table
        queryClient.invalidateQueries({ queryKey: ['properties'] });
      } else if (result.total === 0) {
        toast('No properties to update', { description: mode === 'missing-only' 
                      ? 'All properties already have purchase price data.' 
                      : 'No properties with postcodes found.' });
      } else {
        toast('No price data found', { description: `Checked ${result.total} properties but no matching Land Registry records were found.` });
      }

      return result;
    } catch (err) {
      console.error('Bulk Price Paid enrich error:', err);
      logError({ source: 'useBulkPricePaidEnrich.enrichAll', message: 'Unexpected error during bulk Price Paid enrichment', severity: 'error', error: err });
      toast.error('Enrichment failed', { description: 'An unexpected error occurred.' });
      return null;
    } finally {
      setIsEnriching(false);
    }
  };

  return {
    enrichAll,
    isEnriching,
    lastResult,
  };
}
