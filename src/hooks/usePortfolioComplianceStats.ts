import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shared hook that provides compliance stats from the V2 compliance_matrix_v2 view.
 * Used by the dashboard widget and sidebar badge.
 */
export function usePortfolioComplianceStats() {
  const { data: matrixRows, isLoading } = useQuery({
    queryKey: ['compliance_matrix_v2_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_matrix_v2')
        .select('calculated_status');
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    if (!matrixRows) return { valid: 0, expiring: 0, expired: 0, total: 0, notRequired: 0 };

    let valid = 0, expiring = 0, expired = 0, notRequired = 0;
    for (const row of matrixRows) {
      switch (row.calculated_status) {
        case 'valid': valid++; break;
        case 'expiring_soon': expiring++; break;
        case 'expired': case 'missing': expired++; break;
        case 'not_required': notRequired++; break;
      }
    }
    return { valid, expiring, expired, total: matrixRows.length, notRequired };
  }, [matrixRows]);

  return { stats, isLoading };
}
