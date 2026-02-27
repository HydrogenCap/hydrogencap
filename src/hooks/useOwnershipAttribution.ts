import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
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
 * Fetch beneficial ownership data for property attribution
 * Now uses unified ownership_links table instead of legacy property_beneficial_owners
 */
async function fetchBeneficialOwnership(propertyId: string, asOfDate?: string) {
  let query = supabase
    .from('ownership_links')
    .select(`
      id,
      percent,
      ownership_type,
      notes,
      owner_party:parties!owner_party_id(id, display_name, party_type, company_number)
    `)
    .eq('subject_type', 'PROPERTY')
    .eq('subject_id', propertyId)
    .eq('ownership_type', 'BENEFICIAL');

  if (asOfDate) {
    // Records active on the given date: effective_from <= date AND (effective_to IS NULL OR effective_to > date)
    query = query.or(`effective_from.is.null,effective_from.lte.${asOfDate}`)
      .or(`effective_to.is.null,effective_to.gt.${asOfDate}`);
  } else {
    query = query.is('effective_to', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch company shareholders as beneficial owners (for SPV look-through)
 */
async function fetchCompanyShareholders(companyId: string, asOfDate?: string) {
  let query = supabase
    .from('ownership_links')
    .select(`
      id,
      percent,
      ownership_type,
      notes,
      owner_party:parties!owner_party_id(id, display_name, party_type, company_number)
    `)
    .eq('subject_type', 'COMPANY')
    .eq('subject_id', companyId)
    .eq('ownership_type', 'SHAREHOLDING');

  if (asOfDate) {
    query = query.or(`effective_from.is.null,effective_from.lte.${asOfDate}`)
      .or(`effective_to.is.null,effective_to.gt.${asOfDate}`);
  } else {
    query = query.is('effective_to', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Hook: Get ownership attribution for a single property
 * Uses beneficial ownership split from ownership_links as the source of truth
 * Falls back to SPV shareholders if no direct beneficial ownership is set
 */
export function usePropertyAttribution(propertyId: string | undefined, property: PropertyWithFinancials | undefined) {
  return useQuery({
    queryKey: ['property_attribution', propertyId, property?.legal_owner_company_id],
    queryFn: async () => {
      if (!propertyId || !property) return [];

      // First, try direct beneficial ownership on the property
      let beneficialOwners = await fetchBeneficialOwnership(propertyId);
      let isSpvDerived = false;
      
      // If no direct beneficial owners but has an SPV, derive from company shareholders
      if (beneficialOwners.length === 0 && property.legal_owner_company_id) {
        beneficialOwners = await fetchCompanyShareholders(property.legal_owner_company_id);
        isSpvDerived = true;
      }
      
      const financials = calculatePropertyFinancials(property);

      const attributions: PropertyFinancialAttribution[] = beneficialOwners.map((owner) => {
        const percent = Number(owner.percent);
        const factor = percent / 100;
        
        // Determine owner name and type from joined party data
        let ownerName = 'Unknown';
        let ownerType = 'INDIVIDUAL';
        let ownerId = '';
        
        if (owner.owner_party) {
          const party = owner.owner_party as { id: string; display_name: string; party_type: string; company_number: string | null };
          ownerName = party.display_name;
          ownerId = party.id;
          ownerType = party.party_type || 'INDIVIDUAL';
        }

        return {
          ownerId,
          ownerName,
          ownerType,
          effectivePercent: percent,
          pathDescription: isSpvDerived 
            ? owner.notes || `Via SPV: ${percent.toFixed(1)}%`
            : owner.notes || `Beneficial: ${percent.toFixed(1)}%`,
          attributableValue: financials.currentValue * factor,
          attributableEquity: financials.equity * factor,
          attributableDebt: financials.mortgageBalance * factor,
          attributableRent: financials.annualRent * factor,
          attributableNOI: financials.noi * factor,
          attributableCashflow: financials.cashflow * factor,
        };
      });

      return attributions.sort((a, b) => b.effectivePercent - a.effectivePercent);
    },
    enabled: !!propertyId && !!property,
  });
}

/**
 * Fetch all beneficial ownership data for portfolio attribution
 * Now uses unified ownership_links table instead of legacy property_beneficial_owners
 */
async function fetchAllBeneficialOwnership(asOfDate?: string) {
  let query = supabase
    .from('ownership_links')
    .select(`
      id,
      subject_id,
      percent,
      ownership_type,
      notes,
      owner_party:parties!owner_party_id(id, display_name, party_type, company_number)
    `)
    .eq('subject_type', 'PROPERTY')
    .eq('ownership_type', 'BENEFICIAL');

  if (asOfDate) {
    query = query.or(`effective_from.is.null,effective_from.lte.${asOfDate}`)
      .or(`effective_to.is.null,effective_to.gt.${asOfDate}`);
  } else {
    query = query.is('effective_to', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch all company shareholdings for SPV look-through
 */
async function fetchAllCompanyShareholders(asOfDate?: string) {
  let query = supabase
    .from('ownership_links')
    .select(`
      id,
      subject_id,
      percent,
      ownership_type,
      notes,
      owner_party:parties!owner_party_id(id, display_name, party_type, company_number)
    `)
    .eq('subject_type', 'COMPANY')
    .eq('ownership_type', 'SHAREHOLDING');

  if (asOfDate) {
    query = query.or(`effective_from.is.null,effective_from.lte.${asOfDate}`)
      .or(`effective_to.is.null,effective_to.gt.${asOfDate}`);
  } else {
    query = query.is('effective_to', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch all companies with their party IDs for look-through
 */
async function fetchAllCompaniesWithParties() {
  const { data, error } = await supabase
    .from('companies')
    .select('id, legal_name, party_id');

  if (error) throw error;
  return data || [];
}

interface UltimateBeneficiary {
  partyId: string;
  partyName: string;
  partyType: string;
  effectivePercent: number;
  pathDescription: string;
}

/**
 * Recursively resolve ownership through holding company structures
 * This traces through companies that are shareholders to find the ultimate beneficial owners
 */
function resolveUltimateBeneficiaries(
  ownerPartyId: string,
  ownerName: string,
  ownerType: string,
  ownershipPercent: number,
  path: string,
  companyShareholders: Array<{
    subject_id: string;
    percent: number;
    notes: string | null;
    owner_party: { id: string; display_name: string; party_type: string; company_number: string | null } | null;
  }>,
  companiesWithParties: Array<{ id: string; legal_name: string; party_id: string }>,
  visited: Set<string> = new Set()
): UltimateBeneficiary[] {
  // Prevent infinite loops from circular ownership
  if (visited.has(ownerPartyId)) {
    return [];
  }
  visited.add(ownerPartyId);

  // If owner is an individual, they are the ultimate beneficiary
  if (ownerType === 'INDIVIDUAL') {
    return [{
      partyId: ownerPartyId,
      partyName: ownerName,
      partyType: 'INDIVIDUAL',
      effectivePercent: ownershipPercent,
      pathDescription: path,
    }];
  }

  // If owner is a company, check if it has shareholders we can look through
  const companyRecord = companiesWithParties.find(c => c.party_id === ownerPartyId);
  if (!companyRecord) {
    // No company record found - treat as terminal owner
    return [{
      partyId: ownerPartyId,
      partyName: ownerName,
      partyType: ownerType,
      effectivePercent: ownershipPercent,
      pathDescription: path,
    }];
  }

  // Find shareholders of this company
  const companyShareholdings = companyShareholders.filter(sh => sh.subject_id === companyRecord.id);
  
  if (companyShareholdings.length === 0) {
    // No shareholders defined - treat company as terminal owner
    return [{
      partyId: ownerPartyId,
      partyName: ownerName,
      partyType: ownerType,
      effectivePercent: ownershipPercent,
      pathDescription: path,
    }];
  }

  // Recursively resolve each shareholder
  const ultimateBeneficiaries: UltimateBeneficiary[] = [];
  for (const holding of companyShareholdings) {
    if (!holding.owner_party) continue;
    
    const shareholderPercent = Number(holding.percent);
    const effectivePercent = (ownershipPercent / 100) * (shareholderPercent / 100) * 100;
    const newPath = `${path} → ${companyRecord.legal_name} (${shareholderPercent.toFixed(1)}%)`;
    
    const resolved = resolveUltimateBeneficiaries(
      holding.owner_party.id,
      holding.owner_party.display_name,
      holding.owner_party.party_type,
      effectivePercent,
      newPath,
      companyShareholders,
      companiesWithParties,
      new Set(visited)
    );
    
    ultimateBeneficiaries.push(...resolved);
  }

  return ultimateBeneficiaries;
}

/**
 * Hook: Get portfolio-wide ownership attribution (aggregated by ultimate beneficial owner)
 * Uses beneficial ownership split from ownership_links as the source of truth
 * Falls back to SPV shareholders when no direct beneficial ownership exists
 * Performs full look-through for holding company structures (e.g., Hydrogen Capital → David O'Neill)
 */
export function usePortfolioAttribution(properties: PropertyWithFinancials[] | undefined, asOfDate?: string) {
  return useQuery({
    queryKey: ['portfolio_attribution', properties?.map(p => p.id).join(','), asOfDate],
    queryFn: async () => {
      if (!properties || properties.length === 0) return [];

      const [directOwners, companyShareholders, companiesWithParties] = await Promise.all([
        fetchAllBeneficialOwnership(asOfDate),
        fetchAllCompanyShareholders(asOfDate),
        fetchAllCompaniesWithParties(),
      ]);
      
      // Transform companyShareholders to the format needed for look-through
      const shareholdersForLookthrough = companyShareholders.map(sh => ({
        subject_id: sh.subject_id,
        percent: Number(sh.percent),
        notes: sh.notes,
        owner_party: sh.owner_party as { id: string; display_name: string; party_type: string; company_number: string | null } | null,
      }));
      
      const ownerMap = new Map<string, OwnerAttribution>();

      for (const property of properties) {
        // First try direct beneficial ownership
        let propertyOwners = directOwners.filter(bo => bo.subject_id === property.id);
        let isSpvDerived = false;
        
        // If no direct owners but has SPV, use company shareholders
        if (propertyOwners.length === 0 && property.legal_owner_company_id) {
          propertyOwners = companyShareholders.filter(sh => sh.subject_id === property.legal_owner_company_id);
          isSpvDerived = true;
        }
        
        const financials = calculatePropertyFinancials(property);

        for (const owner of propertyOwners) {
          const percent = Number(owner.percent);
          
          if (!owner.owner_party) continue;
          
          const party = owner.owner_party as { id: string; display_name: string; party_type: string; company_number: string | null };
          const basePath = isSpvDerived 
            ? `Via SPV: ${percent.toFixed(1)}%`
            : `Beneficial: ${percent.toFixed(1)}%`;

          // Resolve to ultimate beneficial owners (look through holding companies)
          const ultimateBeneficiaries = resolveUltimateBeneficiaries(
            party.id,
            party.display_name,
            party.party_type || 'INDIVIDUAL',
            percent,
            basePath,
            shareholdersForLookthrough,
            companiesWithParties
          );

          // Add each ultimate beneficiary to the map
          for (const beneficiary of ultimateBeneficiaries) {
            const factor = beneficiary.effectivePercent / 100;

            const propertyAttribution: PropertyAttribution = {
              propertyId: property.id,
              propertyAddress: property.address_line,
              effectivePercent: beneficiary.effectivePercent,
              pathDescription: beneficiary.pathDescription,
              attributableValue: financials.currentValue * factor,
              attributableEquity: financials.equity * factor,
              attributableDebt: financials.mortgageBalance * factor,
              attributableRent: financials.annualRent * factor,
              attributableNOI: financials.noi * factor,
              attributableCashflow: financials.cashflow * factor,
            };

            const existing = ownerMap.get(beneficiary.partyId);
            if (existing) {
              // Check if this property already exists for this owner (merge stakes)
              const existingProp = existing.properties.find(p => p.propertyId === property.id);
              if (existingProp) {
                existingProp.effectivePercent += beneficiary.effectivePercent;
                existingProp.attributableValue += propertyAttribution.attributableValue;
                existingProp.attributableEquity += propertyAttribution.attributableEquity;
                existingProp.attributableDebt += propertyAttribution.attributableDebt;
                existingProp.attributableRent += propertyAttribution.attributableRent;
                existingProp.attributableNOI += propertyAttribution.attributableNOI;
                existingProp.attributableCashflow += propertyAttribution.attributableCashflow;
                existingProp.pathDescription += ` + ${beneficiary.pathDescription}`;
              } else {
                existing.properties.push(propertyAttribution);
              }
            } else {
              ownerMap.set(beneficiary.partyId, {
                ownerId: beneficiary.partyId,
                ownerName: beneficiary.partyName,
                ownerType: beneficiary.partyType,
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
          }
        }
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
