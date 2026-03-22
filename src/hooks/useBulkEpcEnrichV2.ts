import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

export function useBulkEpcEnrichV2() {
  const [isEnriching, setIsEnriching] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const enrichAll = async (mode: 'missing-only' | 'all' = 'missing-only') => {
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-epc-enrich-v2', {
        body: { mode },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      qc.invalidateQueries({ queryKey: ['properties_v2'] });

      toast({
        title: 'EPC Enrichment Complete',
        description: `Updated ${data.updated} of ${data.total} properties.${data.failed ? ` ${data.failed} failed.` : ''}`,
      });
      return data;
    } catch (error: unknown) {
      toast({ title: 'EPC Enrichment Failed', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsEnriching(false);
    }
  };

  return { enrichAll, isEnriching };
}
