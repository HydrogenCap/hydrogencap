import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { resolveOwnershipGraph } from '@/lib/ownershipResolver';

// Types for ownership attribution
export interface OwnerAttribution {
  ownerId: string;
  ownerName: string;
  ownerType: string;
  properties: PropertyAttribution[];
  totals: OwnerTotals;
}

export interface PropertyAttribution {
  propertyId: string;
  propertyAddress: string;
  effectivePercent: number;
  pathDescription: string;
  attributableValue: number;
  attributableEquity: number;
  attributableDebt: number;
  attributableRent: number;
  attributableNOI: number;
  attributableCashflow: number;
}

export interface OwnerTotals {
  totalAttributableValue: number;
  totalAttributableEquity: number;
  totalAttributableDebt: number;
  totalAttributableRent: number;
  totalAttributableNOI: number;
  totalAttributableCashflow: number;
  propertyCount: number;
  weightedYield: number | null;
  weightedROCE: number | null;
}

export interface PropertyFinancialAttribution {
  ownerId: string;
  ownerName: string;
  ownerType: string;
  effectivePercent: number;
  pathDescription: string;
  attributableValue: number;
  attributableEquity: number;
  attributableDebt: number;
  attributableRent: number;
  attributableNOI: number;
  attributableCashflow: number;
}

interface OwnershipShareholderRow {
  id: string;
  entity_id: string;
  shareholder_name: string;
  shareholder_entity_id: string | null;
  shares_held: number | null;
  percentage: number | null;
  share_class_id: string | null;
}

interface OwnershipEntityLinkRow {
  parent_entity_id: string;
  shareholder_entity_id: string;
  shareholder_percent: number | null;
}

/**
 * Hook: Get ownership attribution for a single property using V2 data
 */
export function usePropertyAttribution(propertyId: string | undefined) {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['property_attribution_v2', org?.id, propertyId],
    queryFn: async () => {
      if (!propertyId || !org?.id) return [];

      const [
        { data: entities },
        { data: shareholders },
        { data: entityLinks },
        { data: properties },
        { data: loans },
        { data: snapshots },
      ] = await Promise.all([
        supabase.from('legal_entities').select('id, entity_name, entity_type, company_number').eq('org_id', org.id),
        supabase.from('entity_shareholders').select('id, entity_id, shareholder_name, shareholder_entity_id, shares_held, percentage, share_class_id').in('entity_id', (await supabase.from('legal_entities').select('id').eq('org_id', org.id)).data?.map(e => e.id) || []).is('effective_to', null),
        supabase.from('entity_shareholdings').select('parent_entity_id, shareholder_entity_id, shareholder_percent'),
        supabase.from('properties_v2').select('id, address_line_1, entity_id, current_valuation').eq('id', propertyId),
        supabase.from('loan_facilities').select('property_id, current_balance, monthly_payment, status').eq('property_id', propertyId).eq('status', 'active'),
        supabase.from('property_annual_performance').select('property_id, annual_rent_received, annual_costs, annual_noi, annual_cash_flow').eq('property_id', propertyId),
      ]);

      const graph = resolveOwnershipGraph(entities || [], shareholders || [], entityLinks || [], properties || []);

      const property = (properties || []).find(p => p.id === propertyId);
      if (!property) return [];

      const value = property.current_valuation || 0;
      const debt = (loans || []).reduce((s, l) => s + Number(l.current_balance || 0), 0);
      const snapshot = (snapshots || [])[0];
      const rent = snapshot?.annual_rent_received || 0;
      const noi = snapshot?.annual_noi || 0;
      const cashflow = snapshot?.annual_cash_flow || 0;

      // Filter chains to this property
      const propertyChains = graph.chains.filter(c => {
        return graph.edges.some(e => e.type === 'property_ownership' && e.toId === propertyId && c.path.some(pp => pp.node.id === e.fromId));
      });

      const attributions: PropertyFinancialAttribution[] = propertyChains.map(chain => {
        const factor = chain.effectivePercent / 100;
        return {
          ownerId: chain.ultimateOwner.id,
          ownerName: chain.ultimateOwner.name,
          ownerType: chain.ultimateOwner.type === 'individual' ? 'INDIVIDUAL' : 'COMPANY',
          effectivePercent: chain.effectivePercent,
          pathDescription: chain.path.map(p => p.node.name).join(' → '),
          attributableValue: value * factor,
          attributableEquity: (value - debt) * factor,
          attributableDebt: debt * factor,
          attributableRent: rent * factor,
          attributableNOI: noi * factor,
          attributableCashflow: cashflow * factor,
        };
      });

      // Merge by owner
      const merged = new Map<string, PropertyFinancialAttribution>();
      for (const a of attributions) {
        const existing = merged.get(a.ownerId);
        if (existing) {
          existing.effectivePercent += a.effectivePercent;
          existing.attributableValue += a.attributableValue;
          existing.attributableEquity += a.attributableEquity;
          existing.attributableDebt += a.attributableDebt;
          existing.attributableRent += a.attributableRent;
          existing.attributableNOI += a.attributableNOI;
          existing.attributableCashflow += a.attributableCashflow;
          existing.pathDescription += ` + ${a.pathDescription}`;
        } else {
          merged.set(a.ownerId, { ...a });
        }
      }

      return Array.from(merged.values()).sort((a, b) => b.effectivePercent - a.effectivePercent);
    },
    enabled: !!propertyId && !!org?.id,
  });
}

/**
 * Hook: Self-contained portfolio-wide ownership attribution using V2 data.
 * No longer requires PropertyWithFinancials[] parameter.
 */
export function usePortfolioAttribution(
  _propertiesLegacy?: unknown,
  asOfDate?: string
) {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['portfolio_attribution_v2', org?.id, asOfDate],
    queryFn: async () => {
      if (!org?.id) return [];

      // Fetch all V2 data in parallel
      const [
        { data: entities },
        { data: properties },
        { data: loans },
        { data: snapshots },
      ] = await Promise.all([
        supabase.from('legal_entities').select('id, entity_name, entity_type, company_number').eq('org_id', org.id),
        supabase.from('properties_v2').select('id, address_line_1, entity_id, current_valuation, lifecycle_stage').eq('org_id', org.id),
        supabase.from('loan_facilities').select('property_id, current_balance, monthly_payment, status').eq('status', 'active'),
        supabase.from('property_annual_performance').select('property_id, annual_rent_received, annual_costs, annual_noi, annual_cash_flow').eq('org_id', org.id),
      ]);

      const entityIds = (entities || []).map(e => e.id);
      const emptyShareholders: OwnershipShareholderRow[] = [];
      const emptyEntityLinks: OwnershipEntityLinkRow[] = [];

      const [
        { data: shareholders },
        { data: entityLinks },
      ] = await Promise.all([
        entityIds.length > 0
          ? supabase.from('entity_shareholders').select('id, entity_id, shareholder_name, shareholder_entity_id, shares_held, percentage, share_class_id').in('entity_id', entityIds).is('effective_to', null)
          : Promise.resolve({ data: emptyShareholders, error: null }),
        entityIds.length > 0
          ? supabase.from('entity_shareholdings').select('parent_entity_id, shareholder_entity_id, shareholder_percent').in('parent_entity_id', entityIds)
          : Promise.resolve({ data: emptyEntityLinks, error: null }),
      ]);

      // Only include active SPV properties
      const activeProperties = (properties || []).filter(p => p.lifecycle_stage !== 'development' && p.entity_id);

      const graph = resolveOwnershipGraph(
        entities || [],
        shareholders || [],
        entityLinks || [],
        activeProperties
      );

      // Build loan and snapshot maps
      const loansByProperty = new Map<string, { balance: number; payment: number }>();
      (loans || []).forEach(l => {
        const existing = loansByProperty.get(l.property_id) || { balance: 0, payment: 0 };
        existing.balance += Number(l.current_balance || 0);
        existing.payment += Number(l.monthly_payment || 0);
        loansByProperty.set(l.property_id, existing);
      });

      const snapshotByProperty = new Map<string, typeof snapshots extends Array<infer T> ? T : never>();
      (snapshots || []).forEach(s => snapshotByProperty.set(s.property_id, s));

      // Build attribution per ultimate owner
      const ownerMap = new Map<string, OwnerAttribution>();

      for (const chain of graph.chains) {
        // Find the property this chain leads to
        const propertyEdge = graph.edges.find(e =>
          e.type === 'property_ownership' && e.fromId === chain.path[0]?.node.id
        );
        if (!propertyEdge) continue;

        const propertyId = propertyEdge.toId;
        const property = activeProperties.find(p => p.id === propertyId);
        if (!property) continue;

        const effectivePct = chain.effectivePercent / 100;
        const propLoan = loansByProperty.get(propertyId) || { balance: 0, payment: 0 };
        const propSnapshot = snapshotByProperty.get(propertyId);

        const value = property.current_valuation || 0;
        const debt = propLoan.balance;
        const rent = propSnapshot?.annual_rent_received || 0;
        const noi = propSnapshot?.annual_noi || 0;
        const cashflow = propSnapshot?.annual_cash_flow || 0;

        const ownerId = chain.ultimateOwner.id;
        let owner = ownerMap.get(ownerId);
        if (!owner) {
          owner = {
            ownerId,
            ownerName: chain.ultimateOwner.name,
            ownerType: chain.ultimateOwner.type === 'individual' ? 'INDIVIDUAL' : 'COMPANY',
            properties: [],
            totals: {
              totalAttributableValue: 0, totalAttributableEquity: 0,
              totalAttributableDebt: 0, totalAttributableRent: 0,
              totalAttributableNOI: 0, totalAttributableCashflow: 0,
              propertyCount: 0, weightedYield: null, weightedROCE: null,
            },
          };
          ownerMap.set(ownerId, owner);
        }

        // Check if property already exists for this owner (merge stakes)
        const existingProp = owner.properties.find(p => p.propertyId === propertyId);
        if (existingProp) {
          existingProp.effectivePercent += chain.effectivePercent;
          existingProp.attributableValue += value * effectivePct;
          existingProp.attributableEquity += (value - debt) * effectivePct;
          existingProp.attributableDebt += debt * effectivePct;
          existingProp.attributableRent += rent * effectivePct;
          existingProp.attributableNOI += noi * effectivePct;
          existingProp.attributableCashflow += cashflow * effectivePct;
          existingProp.pathDescription += ` + ${chain.path.map(p => p.node.name).join(' → ')}`;
        } else {
          owner.properties.push({
            propertyId,
            propertyAddress: property.address_line_1,
            effectivePercent: chain.effectivePercent,
            pathDescription: chain.path.map(p => p.node.name).join(' → '),
            attributableValue: value * effectivePct,
            attributableEquity: (value - debt) * effectivePct,
            attributableDebt: debt * effectivePct,
            attributableRent: rent * effectivePct,
            attributableNOI: noi * effectivePct,
            attributableCashflow: cashflow * effectivePct,
          });
        }
      }

      // Calculate totals and yields
      for (const owner of ownerMap.values()) {
        owner.totals.propertyCount = owner.properties.length;
        owner.totals.totalAttributableValue = owner.properties.reduce((s, p) => s + p.attributableValue, 0);
        owner.totals.totalAttributableEquity = owner.properties.reduce((s, p) => s + p.attributableEquity, 0);
        owner.totals.totalAttributableDebt = owner.properties.reduce((s, p) => s + p.attributableDebt, 0);
        owner.totals.totalAttributableRent = owner.properties.reduce((s, p) => s + p.attributableRent, 0);
        owner.totals.totalAttributableNOI = owner.properties.reduce((s, p) => s + p.attributableNOI, 0);
        owner.totals.totalAttributableCashflow = owner.properties.reduce((s, p) => s + p.attributableCashflow, 0);

        if (owner.totals.totalAttributableValue > 0) {
          owner.totals.weightedYield = (owner.totals.totalAttributableNOI / owner.totals.totalAttributableValue) * 100;
        }
        if (owner.totals.totalAttributableEquity > 0) {
          owner.totals.weightedROCE = (owner.totals.totalAttributableCashflow / owner.totals.totalAttributableEquity) * 100;
        }
      }

      return Array.from(ownerMap.values()).sort(
        (a, b) => b.totals.totalAttributableValue - a.totals.totalAttributableValue
      );
    },
    enabled: !!org?.id,
  });
}

/**
 * Calculate total ownership percentage sum for validation
 */
export function calculateOwnershipSum(items: Array<{ owner_percent?: number | null; shareholder_percent?: number | null }>): number {
  return items.reduce((sum, item) => {
    const percent = item.owner_percent ?? item.shareholder_percent ?? 0;
    return sum + Number(percent);
  }, 0);
}

/**
 * Check if ownership sums to 100% (with tolerance)
 */
export function validateOwnershipSum(sum: number, tolerance: number = 0.01): boolean {
  return Math.abs(sum - 100) <= tolerance;
}
