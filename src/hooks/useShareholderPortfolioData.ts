import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShareholderSession } from './useShareholderSession';

interface PropertyWithFinancials {
  id: string;
  address_line: string;
  address_line2: string | null;
  town_city: string | null;
  postcode: string | null;
  property_type: string | null;
  tenure: string | null;
  beds: number | null;
  bathrooms: number | null;
  lifecycle_type: string | null;
  current_value_gbp: number | null;
  legal_owner_company_id: string | null;
  legal_owner_company?: {
    id: string;
    legal_name: string;
  } | null;
  loans: Array<{
    id: string;
    current_mortgage_balance_gbp: number | null;
    interest_rate_percent: number | null;
    lender: string | null;
    fixed_rate_expires: string | null;
    mortgage_payment_gbp: number | null;
  }>;
  income: Array<{
    id: string;
    annual_rent_gbp: number;
    year: number;
  }>;
  costs: Array<{
    id: string;
    year: number;
    management_gbp_manual: number | null;
    bills_gbp_manual: number | null;
    repairs_gbp_manual: number | null;
    insurance_gbp_manual: number | null;
    other_gbp_manual: number | null;
  }>;
}

export function useShareholderPortfolioData() {
  const { orgId, isShareholderUser } = useShareholderSession();

  const { data: properties, isLoading: propertiesLoading } = useQuery<PropertyWithFinancials[]>({
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
          legal_owner_company_id,
          legal_owner_company:companies!properties_legal_owner_company_id_fkey (
            id,
            legal_name
          ),
          loans (
            id,
            current_mortgage_balance_gbp,
            interest_rate_percent,
            lender,
            fixed_rate_expires,
            mortgage_payment_gbp
          ),
          income (
            id,
            annual_rent_gbp,
            year
          ),
          costs (
            id,
            year,
            management_gbp_manual,
            bills_gbp_manual,
            repairs_gbp_manual,
            insurance_gbp_manual,
            other_gbp_manual
          )
        `)
        .eq('org_id', orgId)
        .eq('lifecycle_type', 'core_rental')
        .order('address_line');

      if (error) throw error;
      return data as PropertyWithFinancials[];
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

  // Fetch cover photos
  const { data: coverPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ['shareholder-cover-photos', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('photos')
        .select('id, property_id, file_url, is_cover')
        .eq('is_cover', true);

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isShareholderUser,
  });

  // Build cover photo map
  const coverPhotoMap = new Map<string, string>();
  coverPhotos?.forEach((photo) => {
    if (photo.is_cover) {
      coverPhotoMap.set(photo.property_id, photo.file_url);
    }
  });

  return {
    properties,
    complianceItems,
    coverPhotoMap,
    isLoading: propertiesLoading || complianceLoading || photosLoading,
  };
}
