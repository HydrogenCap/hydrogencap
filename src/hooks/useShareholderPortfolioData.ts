import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShareholderSession } from './useShareholderSession';

export function useShareholderPortfolioData() {
  const { orgId, isShareholderUser } = useShareholderSession();

  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['shareholder-properties', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address_line,
          address_line2,
          town_city,
          postcode,
          property_type,
          tenure,
          beds,
          bathrooms,
          lifecycle_type,
          current_value_gbp,
          loans (
            id,
            current_mortgage_balance_gbp,
            interest_rate_percent,
            lender,
            fixed_rate_expires
          )
        `)
        .eq('org_id', orgId)
        .eq('lifecycle_type', 'core_rental')
        .order('address_line');

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isShareholderUser,
  });

  const { data: complianceItems, isLoading: complianceLoading } = useQuery({
    queryKey: ['shareholder-compliance', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('compliance_items')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isShareholderUser,
  });

  return {
    properties,
    complianceItems,
    isLoading: propertiesLoading || complianceLoading,
  };
}
