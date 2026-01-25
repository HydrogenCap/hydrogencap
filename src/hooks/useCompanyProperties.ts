import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyProperty {
  id: string;
  address_line: string;
  postcode: string | null;
  area_name: string | null;
  current_value_gbp: number | null;
  // Ownership role info
  isLegalOwner: boolean;
  legalOwnerPercent: number | null;
  beneficialPercent: number | null;
}

/**
 * Fetch all properties where this company is either:
 * - A legal owner (via property_legal_ownership.owning_company_id)
 * - A beneficial owner (via property_beneficial_owners.company_id)
 */
export function useCompanyProperties(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company_properties', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Get properties where company is legal owner
      const { data: legalOwnership, error: legalError } = await supabase
        .from('property_legal_ownership')
        .select(`
          property_id,
          owner_percent,
          properties:property_id(id, address_line, postcode, area_name, current_value_gbp)
        `)
        .eq('owning_company_id', companyId)
        .is('end_date', null);

      if (legalError) throw legalError;

      // 2. Get properties where company is beneficial owner
      const { data: beneficialOwnership, error: beneficialError } = await supabase
        .from('property_beneficial_owners')
        .select(`
          property_id,
          beneficial_percent,
          properties:property_id(id, address_line, postcode, area_name, current_value_gbp)
        `)
        .eq('company_id', companyId)
        .is('end_date', null);

      if (beneficialError) throw beneficialError;

      // 3. Merge results
      const propertiesMap = new Map<string, CompanyProperty>();

      // Process legal ownership
      for (const lo of legalOwnership || []) {
        const prop = lo.properties as unknown as { id: string; address_line: string; postcode: string | null; area_name: string | null; current_value_gbp: number | null };
        if (!prop) continue;

        propertiesMap.set(prop.id, {
          id: prop.id,
          address_line: prop.address_line,
          postcode: prop.postcode,
          area_name: prop.area_name,
          current_value_gbp: prop.current_value_gbp,
          isLegalOwner: true,
          legalOwnerPercent: Number(lo.owner_percent),
          beneficialPercent: null,
        });
      }

      // Process beneficial ownership
      for (const bo of beneficialOwnership || []) {
        const prop = bo.properties as unknown as { id: string; address_line: string; postcode: string | null; area_name: string | null; current_value_gbp: number | null };
        if (!prop) continue;

        const existing = propertiesMap.get(prop.id);
        if (existing) {
          existing.beneficialPercent = Number(bo.beneficial_percent);
        } else {
          propertiesMap.set(prop.id, {
            id: prop.id,
            address_line: prop.address_line,
            postcode: prop.postcode,
            area_name: prop.area_name,
            current_value_gbp: prop.current_value_gbp,
            isLegalOwner: false,
            legalOwnerPercent: null,
            beneficialPercent: Number(bo.beneficial_percent),
          });
        }
      }

      return Array.from(propertiesMap.values());
    },
    enabled: !!companyId,
  });
}

/**
 * Calculate aggregate stats for company properties
 */
export function calculateCompanyPropertyStats(properties: CompanyProperty[]) {
  const totalProperties = properties.length;
  const legallyOwnedCount = properties.filter(p => p.isLegalOwner).length;
  const beneficiallyOwnedCount = properties.filter(p => p.beneficialPercent !== null).length;
  
  // Sum of beneficial percentages across all properties
  const totalBeneficialPercent = properties.reduce(
    (sum, p) => sum + (p.beneficialPercent ?? 0),
    0
  );
  
  // Weighted value exposure = sum(property_value * beneficial_percent / 100)
  const totalValueExposure = properties.reduce((sum, p) => {
    const value = p.current_value_gbp ?? 0;
    const percent = p.beneficialPercent ?? (p.isLegalOwner ? 100 : 0);
    return sum + (value * percent / 100);
  }, 0);

  return {
    totalProperties,
    legallyOwnedCount,
    beneficiallyOwnedCount,
    totalBeneficialPercent,
    totalValueExposure,
  };
}
