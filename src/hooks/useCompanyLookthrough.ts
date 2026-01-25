import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Company, CompanyWithDetails, Shareholding } from './useCompanies';

export interface EffectiveOwnershipNew {
  partyId: string;
  partyName: string;
  partyType: string;
  effectivePercent: number;
  pathDescription: string; // e.g., "100% of Galocha Ltd × 33.3% = 33.3%"
}

export interface LookthroughResult {
  propertyId: string;
  propertyAddress: string;
  legalOwners: {
    companyId: string;
    companyName: string;
    ownerPercent: number;
  }[];
  effectiveOwnership: EffectiveOwnershipNew[];
  totalLegalPercent: number;
  totalEffectivePercent: number;
}

/**
 * Calculate look-through ownership using the new company/shareholding model
 * Property → Company (legal owner) → Shareholders (via share classes)
 */
export function useCompanyLookthrough(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['company_lookthrough', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;

      // 1. Get the property with its legal ownership links
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('id, address_line, postcode')
        .eq('id', propertyId)
        .single();

      if (propError) throw propError;

      // 2. Get legal ownership from property_legal_ownership joined with companies
      const { data: legalOwnership, error: loError } = await supabase
        .from('property_legal_ownership')
        .select(`
          id,
          owner_percent,
          owning_company_id,
          ownership_entities(id, name, entity_type)
        `)
        .eq('property_id', propertyId);

      if (loError) throw loError;

      // 3. For each legal owner, get company details and shareholdings
      const effectiveOwnership: Map<string, EffectiveOwnershipNew> = new Map();
      const legalOwners: LookthroughResult['legalOwners'] = [];

      for (const owner of legalOwnership || []) {
        const legalPercent = Number(owner.owner_percent);
        
        // If there's an owning_company_id, look up that company's shareholders
        if (owner.owning_company_id) {
          const { data: company, error: compError } = await supabase
            .from('companies')
            .select('id, legal_name')
            .eq('id', owner.owning_company_id)
            .single();

          if (compError || !company) continue;

          legalOwners.push({
            companyId: company.id,
            companyName: company.legal_name,
            ownerPercent: legalPercent,
          });

          // Get share classes and shareholdings for this company
          const { data: shareClasses } = await supabase
            .from('share_classes')
            .select('id, name, issued_shares')
            .eq('company_id', company.id);

          const { data: shareholdings } = await supabase
            .from('shareholdings')
            .select(`
              id,
              shares_held,
              share_class_id,
              shareholder_party:parties(id, display_name, party_type)
            `)
            .eq('company_id', company.id)
            .is('effective_to', null);

          // Calculate effective ownership for each shareholder
          for (const holding of shareholdings || []) {
            const shareClass = shareClasses?.find(sc => sc.id === holding.share_class_id);
            if (!shareClass || !holding.shareholder_party) continue;

            const shareholderPercent = (holding.shares_held / shareClass.issued_shares) * 100;
            const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;

            const party = holding.shareholder_party as { id: string; display_name: string; party_type: string };
            const existingEntry = effectiveOwnership.get(party.id);
            const pathDesc = `${legalPercent.toFixed(1)}% of ${company.legal_name} × ${shareholderPercent.toFixed(1)}% = ${effectivePercent.toFixed(2)}%`;

            if (existingEntry) {
              existingEntry.effectivePercent += effectivePercent;
              existingEntry.pathDescription += ` + ${pathDesc}`;
            } else {
              effectiveOwnership.set(party.id, {
                partyId: party.id,
                partyName: party.display_name,
                partyType: party.party_type,
                effectivePercent,
                pathDescription: pathDesc,
              });
            }
          }
        } else if (owner.ownership_entities) {
          // Legacy: using old ownership_entities directly
          const entity = owner.ownership_entities as { id: string; name: string; entity_type: string };
          legalOwners.push({
            companyId: entity.id,
            companyName: entity.name,
            ownerPercent: legalPercent,
          });

          // Check for old-style shareholdings
          const { data: oldShareholdings } = await supabase
            .from('entity_shareholdings')
            .select(`
              id,
              shareholder_percent,
              shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(id, name, entity_type)
            `)
            .eq('parent_entity_id', entity.id);

          if (oldShareholdings && oldShareholdings.length > 0) {
            for (const sh of oldShareholdings) {
              const shareholderPercent = Number(sh.shareholder_percent);
              const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;
              const shareholder = sh.shareholder_entity as { id: string; name: string; entity_type: string };
              
              const existingEntry = effectiveOwnership.get(shareholder.id);
              const pathDesc = `${legalPercent.toFixed(1)}% of ${entity.name} × ${shareholderPercent.toFixed(1)}% = ${effectivePercent.toFixed(2)}%`;

              if (existingEntry) {
                existingEntry.effectivePercent += effectivePercent;
                existingEntry.pathDescription += ` + ${pathDesc}`;
              } else {
                effectiveOwnership.set(shareholder.id, {
                  partyId: shareholder.id,
                  partyName: shareholder.name,
                  partyType: shareholder.entity_type,
                  effectivePercent,
                  pathDescription: pathDesc,
                });
              }
            }
          } else {
            // Direct owner without shareholders
            const existingEntry = effectiveOwnership.get(entity.id);
            if (existingEntry) {
              existingEntry.effectivePercent += legalPercent;
            } else {
              effectiveOwnership.set(entity.id, {
                partyId: entity.id,
                partyName: entity.name,
                partyType: entity.entity_type,
                effectivePercent: legalPercent,
                pathDescription: `Direct ownership: ${legalPercent.toFixed(1)}%`,
              });
            }
          }
        }
      }

      const effectiveArray = Array.from(effectiveOwnership.values())
        .sort((a, b) => b.effectivePercent - a.effectivePercent);

      return {
        propertyId: property.id,
        propertyAddress: `${property.address_line}${property.postcode ? `, ${property.postcode}` : ''}`,
        legalOwners,
        effectiveOwnership: effectiveArray,
        totalLegalPercent: legalOwners.reduce((sum, lo) => sum + lo.ownerPercent, 0),
        totalEffectivePercent: effectiveArray.reduce((sum, eo) => sum + eo.effectivePercent, 0),
      } as LookthroughResult;
    },
    enabled: !!propertyId,
  });
}
