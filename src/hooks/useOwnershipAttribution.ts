import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import {
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNOI,
  calculateAnnualCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
} from '@/lib/calculations';

// Types for ownership attribution
export interface OwnerAttribution {
  ownerId: string;
  ownerName: string;
  ownerType: string; // 'INDIVIDUAL' | 'COMPANY' | 'TRUST' etc.
  properties: PropertyAttribution[];
  totals: OwnerTotals;
}

export interface PropertyAttribution {
  propertyId: string;
  propertyAddress: string;
  effectivePercent: number;
  pathDescription: string;
  // Financial attribution (scaled by ownership %)
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

/**
 * Calculate financial metrics for a single property
 */
function calculatePropertyFinancials(property: PropertyWithFinancials) {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);

  const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
  const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
  const interestRate = loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null;
  const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : 0;

  const equity = calculateEquity(currentValue, mortgageBalance) || 0;
  const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
  const noi = calculateNOI(annualRent, effectiveCosts.total) || 0;

  const paymentResult = calculateMonthlyMortgagePayment({
    balance: mortgageBalance,
    interestRate: interestRate,
    termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
    isInterestOnly: loan?.capital_or_interest === 'interest_only',
    paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
  });

  const cashflow = calculateAnnualCashflowAfterDebt(
    annualRent || null,
    effectiveCosts.total,
    paymentResult.effective
  ) || 0;

  return {
    currentValue,
    mortgageBalance,
    equity,
    annualRent,
    noi,
    cashflow,
  };
}

/**
 * Fetch all look-through ownership data for portfolio attribution
 */
async function fetchAllLookthroughData() {
  // Get all properties with legal ownership
  const { data: legalOwnership, error: loError } = await supabase
    .from('property_legal_ownership')
    .select(`
      id,
      property_id,
      owner_percent,
      owning_company_id,
      ownership_entities(id, name, entity_type)
    `);

  if (loError) throw loError;

  // Get all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, legal_name');

  // Get all share classes
  const { data: shareClasses } = await supabase
    .from('share_classes')
    .select('id, company_id, issued_shares');

  // Get all shareholdings
  const { data: shareholdings } = await supabase
    .from('shareholdings')
    .select(`
      id,
      company_id,
      share_class_id,
      shares_held,
      shareholder_party:parties(id, display_name, party_type)
    `)
    .is('effective_to', null);

  // Get all entity shareholdings (legacy)
  const { data: entityShareholdings } = await supabase
    .from('entity_shareholdings')
    .select(`
      id,
      parent_entity_id,
      shareholder_percent,
      shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(id, name, entity_type)
    `);

  return {
    legalOwnership: legalOwnership || [],
    companies: companies || [],
    shareClasses: shareClasses || [],
    shareholdings: shareholdings || [],
    entityShareholdings: entityShareholdings || [],
  };
}

/**
 * Calculate look-through ownership for a single property
 */
function calculatePropertyLookthrough(
  propertyId: string,
  data: Awaited<ReturnType<typeof fetchAllLookthroughData>>
): Map<string, { partyId: string; partyName: string; partyType: string; effectivePercent: number; pathDescription: string }> {
  const effectiveOwnership = new Map<string, { partyId: string; partyName: string; partyType: string; effectivePercent: number; pathDescription: string }>();

  const propertyOwnership = data.legalOwnership.filter(lo => lo.property_id === propertyId);

  for (const owner of propertyOwnership) {
    const legalPercent = Number(owner.owner_percent);

    // New model: owning_company_id
    if (owner.owning_company_id) {
      const company = data.companies.find(c => c.id === owner.owning_company_id);
      if (!company) continue;

      const companyShareClasses = data.shareClasses.filter(sc => sc.company_id === company.id);
      const companyShareholdings = data.shareholdings.filter(sh => sh.company_id === company.id);

      if (companyShareholdings.length > 0) {
        for (const holding of companyShareholdings) {
          const shareClass = companyShareClasses.find(sc => sc.id === holding.share_class_id);
          if (!shareClass || !holding.shareholder_party) continue;

          const shareholderPercent = (holding.shares_held / shareClass.issued_shares) * 100;
          const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;

          const party = holding.shareholder_party as { id: string; display_name: string; party_type: string };
          const pathDesc = `${legalPercent.toFixed(1)}% via ${company.legal_name} × ${shareholderPercent.toFixed(1)}%`;

          const existing = effectiveOwnership.get(party.id);
          if (existing) {
            existing.effectivePercent += effectivePercent;
            existing.pathDescription += ` + ${pathDesc}`;
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
      } else {
        // Company without shareholders - attribute to company itself
        effectiveOwnership.set(company.id, {
          partyId: company.id,
          partyName: company.legal_name,
          partyType: 'COMPANY',
          effectivePercent: legalPercent,
          pathDescription: `Direct via ${company.legal_name}: ${legalPercent.toFixed(1)}%`,
        });
      }
    } else if (owner.ownership_entities) {
      // Legacy: ownership_entities
      const entity = owner.ownership_entities as { id: string; name: string; entity_type: string };
      const entityShareholders = data.entityShareholdings.filter(es => es.parent_entity_id === entity.id);

      if (entityShareholders.length > 0) {
        for (const sh of entityShareholders) {
          const shareholderPercent = Number(sh.shareholder_percent);
          const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;
          const shareholder = sh.shareholder_entity as { id: string; name: string; entity_type: string };
          const pathDesc = `${legalPercent.toFixed(1)}% via ${entity.name} × ${shareholderPercent.toFixed(1)}%`;

          const existing = effectiveOwnership.get(shareholder.id);
          if (existing) {
            existing.effectivePercent += effectivePercent;
            existing.pathDescription += ` + ${pathDesc}`;
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
        // Direct owner
        const existing = effectiveOwnership.get(entity.id);
        if (existing) {
          existing.effectivePercent += legalPercent;
        } else {
          effectiveOwnership.set(entity.id, {
            partyId: entity.id,
            partyName: entity.name,
            partyType: entity.entity_type,
            effectivePercent: legalPercent,
            pathDescription: `Direct: ${legalPercent.toFixed(1)}%`,
          });
        }
      }
    }
  }

  return effectiveOwnership;
}

/**
 * Hook: Get ownership attribution for a single property
 */
export function usePropertyAttribution(propertyId: string | undefined, property: PropertyWithFinancials | undefined) {
  return useQuery({
    queryKey: ['property_attribution', propertyId],
    queryFn: async () => {
      if (!propertyId || !property) return [];

      const data = await fetchAllLookthroughData();
      const lookthrough = calculatePropertyLookthrough(propertyId, data);
      const financials = calculatePropertyFinancials(property);

      const attributions: PropertyFinancialAttribution[] = [];

      lookthrough.forEach((ownership) => {
        const factor = ownership.effectivePercent / 100;
        attributions.push({
          ownerId: ownership.partyId,
          ownerName: ownership.partyName,
          ownerType: ownership.partyType,
          effectivePercent: ownership.effectivePercent,
          pathDescription: ownership.pathDescription,
          attributableValue: financials.currentValue * factor,
          attributableEquity: financials.equity * factor,
          attributableDebt: financials.mortgageBalance * factor,
          attributableRent: financials.annualRent * factor,
          attributableNOI: financials.noi * factor,
          attributableCashflow: financials.cashflow * factor,
        });
      });

      return attributions.sort((a, b) => b.effectivePercent - a.effectivePercent);
    },
    enabled: !!propertyId && !!property,
  });
}

/**
 * Hook: Get portfolio-wide ownership attribution (aggregated by owner)
 */
export function usePortfolioAttribution(properties: PropertyWithFinancials[] | undefined) {
  return useQuery({
    queryKey: ['portfolio_attribution', properties?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!properties || properties.length === 0) return [];

      const data = await fetchAllLookthroughData();
      const ownerMap = new Map<string, OwnerAttribution>();

      for (const property of properties) {
        const lookthrough = calculatePropertyLookthrough(property.id, data);
        const financials = calculatePropertyFinancials(property);

        lookthrough.forEach((ownership) => {
          const factor = ownership.effectivePercent / 100;
          
          const propertyAttribution: PropertyAttribution = {
            propertyId: property.id,
            propertyAddress: property.address_line,
            effectivePercent: ownership.effectivePercent,
            pathDescription: ownership.pathDescription,
            attributableValue: financials.currentValue * factor,
            attributableEquity: financials.equity * factor,
            attributableDebt: financials.mortgageBalance * factor,
            attributableRent: financials.annualRent * factor,
            attributableNOI: financials.noi * factor,
            attributableCashflow: financials.cashflow * factor,
          };

          const existing = ownerMap.get(ownership.partyId);
          if (existing) {
            existing.properties.push(propertyAttribution);
          } else {
            ownerMap.set(ownership.partyId, {
              ownerId: ownership.partyId,
              ownerName: ownership.partyName,
              ownerType: ownership.partyType,
              properties: [propertyAttribution],
              totals: {
                totalAttributableValue: 0,
                totalAttributableEquity: 0,
                totalAttributableDebt: 0,
                totalAttributableRent: 0,
                totalAttributableNOI: 0,
                totalAttributableCashflow: 0,
                propertyCount: 0,
                weightedYield: null,
                weightedROCE: null,
              },
            });
          }
        });
      }

      // Calculate totals for each owner
      ownerMap.forEach((owner) => {
        owner.totals.propertyCount = owner.properties.length;
        owner.totals.totalAttributableValue = owner.properties.reduce((sum, p) => sum + p.attributableValue, 0);
        owner.totals.totalAttributableEquity = owner.properties.reduce((sum, p) => sum + p.attributableEquity, 0);
        owner.totals.totalAttributableDebt = owner.properties.reduce((sum, p) => sum + p.attributableDebt, 0);
        owner.totals.totalAttributableRent = owner.properties.reduce((sum, p) => sum + p.attributableRent, 0);
        owner.totals.totalAttributableNOI = owner.properties.reduce((sum, p) => sum + p.attributableNOI, 0);
        owner.totals.totalAttributableCashflow = owner.properties.reduce((sum, p) => sum + p.attributableCashflow, 0);

        // Calculate weighted yield and ROCE
        owner.totals.weightedYield = owner.totals.totalAttributableValue > 0
          ? (owner.totals.totalAttributableNOI / owner.totals.totalAttributableValue) * 100
          : null;
        owner.totals.weightedROCE = owner.totals.totalAttributableEquity > 0
          ? (owner.totals.totalAttributableCashflow / owner.totals.totalAttributableEquity) * 100
          : null;
      });

      // Sort by total equity descending
      return Array.from(ownerMap.values()).sort(
        (a, b) => b.totals.totalAttributableEquity - a.totals.totalAttributableEquity
      );
    },
    enabled: !!properties && properties.length > 0,
  });
}
