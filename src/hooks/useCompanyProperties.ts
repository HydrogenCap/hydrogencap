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

export interface PropertyWithBeneficialOwners {
  id: string;
  address_line: string;
  postcode: string | null;
  area_name: string | null;
  beneficialOwners: {
    id: string;
    beneficial_percent: number;
    owner_type: string;
    company?: { id: string; legal_name: string } | null;
    party?: { id: string; display_name: string; party_type: string } | null;
  }[];
}

/**
 * Fetch all properties where this company is either:
 * - A legal owner (via properties.legal_owner_company_id)
 * - A beneficial owner (via property_beneficial_owners.company_id)
 */
export function useCompanyProperties(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company_properties', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Get properties where company is legal owner (using the new FK)
      const { data: legalProperties, error: legalError } = await supabase
        .from('properties')
        .select('id, address_line, postcode, area_name, current_value_gbp')
        .eq('legal_owner_company_id', companyId);

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
      for (const prop of legalProperties || []) {
        propertiesMap.set(prop.id, {
          id: prop.id,
          address_line: prop.address_line,
          postcode: prop.postcode,
          area_name: prop.area_name,
          current_value_gbp: prop.current_value_gbp ? Number(prop.current_value_gbp) : null,
          isLegalOwner: true,
          legalOwnerPercent: 100, // When you're the legal owner, it's 100%
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
 * Fetch properties where this company is legal owner, with their beneficial ownership splits
 */
export function useCompanyPropertiesWithBeneficialOwners(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company_properties_beneficial', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Get properties where company is legal owner
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, address_line, postcode, area_name')
        .eq('legal_owner_company_id', companyId);

      if (propError) throw propError;
      if (!properties || properties.length === 0) return [];

      // Get beneficial owners for these properties
      const propertyIds = properties.map(p => p.id);
      const { data: beneficialOwners, error: boError } = await supabase
        .from('property_beneficial_owners')
        .select(`
          id,
          property_id,
          beneficial_percent,
          owner_type,
          company:companies(id, legal_name),
          party:parties(id, display_name, party_type)
        `)
        .in('property_id', propertyIds)
        .is('end_date', null)
        .order('beneficial_percent', { ascending: false });

      if (boError) throw boError;

      // Group beneficial owners by property
      const result: PropertyWithBeneficialOwners[] = properties.map(prop => ({
        id: prop.id,
        address_line: prop.address_line,
        postcode: prop.postcode,
        area_name: prop.area_name,
        beneficialOwners: (beneficialOwners || [])
          .filter(bo => bo.property_id === prop.id)
          .map(bo => ({
            id: bo.id,
            beneficial_percent: Number(bo.beneficial_percent),
            owner_type: bo.owner_type,
            company: bo.company as { id: string; legal_name: string } | null,
            party: bo.party as { id: string; display_name: string; party_type: string } | null,
          })),
      }));

      return result;
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
