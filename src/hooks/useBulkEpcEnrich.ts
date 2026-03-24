import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

interface EPCResult {
  propertyId: string;
  address: string;
  postcode: string;
  epcRating: string | null;
  expiryDate: string | null;
  propertyType: string | null;
  tenure: string | null;
  constructionAgeBand: string | null;
  success: boolean;
  error?: string;
}

interface BulkEnrichResult {
  success: boolean;
  total: number;
  updated: number;
  failed: number;
  results: EPCResult[];
}

export function useBulkEpcEnrich() {
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastResult, setLastResult] = useState<BulkEnrichResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const enrichAll = async (mode: 'missing-only' | 'all' = 'missing-only'): Promise<BulkEnrichResult | null> => {
    setIsEnriching(true);
    
    try {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.functions.invoke('bulk-epc-enrich', {
        body: { mode, orgId },
      });

      if (error) {
        console.error('Bulk EPC enrich error:', error);
        toast({
          title: 'Enrichment failed',
          description: error.message || 'Failed to fetch EPC data.',
          variant: 'destructive',
        });
        return null;
      }

      const result = data as BulkEnrichResult;
      setLastResult(result);

      if (result.updated > 0) {
        toast({
          title: 'EPC data updated',
          description: `Updated ${result.updated} of ${result.total} properties with EPC data.`,
        });
        // Invalidate properties cache to refresh the table
        queryClient.invalidateQueries({ queryKey: ['properties'] });
      } else if (result.total === 0) {
        toast({
          title: 'No properties to update',
          description: mode === 'missing-only' 
            ? 'All properties already have EPC data.' 
            : 'No properties with postcodes found.',
        });
      } else {
        toast({
          title: 'No EPC data found',
          description: `Checked ${result.total} properties but no matching EPC records were found.`,
          variant: 'default',
        });
      }

      return result;
    } catch (err) {
      console.error('Bulk EPC enrich error:', err);
      toast({
        title: 'Enrichment failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
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
