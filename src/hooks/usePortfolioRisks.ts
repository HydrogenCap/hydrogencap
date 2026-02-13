import { useMemo } from 'react';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { usePropertyPassports, calculatePassportCompleteness, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useAllCompliance } from '@/hooks/useCompliance';
import { useTenancyComplianceStats, type TenancyComplianceItemWithDetails } from '@/hooks/useTenancyCompliance';
import { useInsurancePolicies, type InsurancePolicy } from '@/hooks/useInsurance';
import { useTenancies, type TenancyWithDetails } from '@/hooks/useTenancies';
import {
  calculateLTV,
  getLTVStatus,
  getEPCStatus,
  getExpiryStatus,
  daysUntil,
  formatPercent,
  getEffectiveCosts,
  calculateMonthlyMortgagePayment,
  formatGBP,
} from '@/lib/calculations';

export type RiskType = 'ltv' | 'epc' | 'rate_expiry' | 'negative_cashflow' | 'hmo_licence' | 'operational_data' | 'tenancy_compliance' | 'insurance' | 'leasehold' | 'lease_expiry';

export interface RiskItem {
  id: string;
  propertyId: string;
  address: string;
  type: RiskType;
  severity: 'critical' | 'warning';
  message: string;
  /** The URL to navigate to for resolving this issue */
  targetUrl: string;
}

export const riskTypeLabels: Record<RiskType, string> = {
  ltv: 'LTV Risk',
  epc: 'EPC Risk',
  rate_expiry: 'Rate Expiry',
  negative_cashflow: 'Negative Cashflow',
  hmo_licence: 'HMO Licence',
  operational_data: 'Missing Data',
  tenancy_compliance: 'Tenancy Compliance',
  insurance: 'Insurance',
  leasehold: 'Leasehold',
  lease_expiry: 'Lease Expiry',
};

/**
 * Calculate all portfolio risks for core rental properties.
 * This is the single source of truth for risk calculations used by both
 * Dashboard and Actions pages.
 */
export function calculatePortfolioRisks(
  properties: PropertyWithFinancials[],
  passportMap: Map<string, PropertyPassport>,
  complianceByPropertyMap: Map<string, any[]>,
  tenancyComplianceOverdue: TenancyComplianceItemWithDetails[] = [],
  insurancePolicies: InsurancePolicy[] = [],
  tenancies: TenancyWithDetails[] = []
): RiskItem[] {
  const riskItems: RiskItem[] = [];
  const currentYear = new Date().getFullYear();

  // Only process core rental properties
  const coreRentalProperties = properties.filter(p => p.lifecycle_type === 'core_rental');

  coreRentalProperties.forEach(property => {
    const loan = property.loans?.[0];
    const income = property.income?.find(i => i.year === currentYear);
    const costs = property.costs?.find(c => c.year === currentYear);
    const passport = passportMap.get(property.id);

    const value = property.current_value_gbp ? Number(property.current_value_gbp) : null;
    const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
    const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;

    // Use effective costs (auto-calculated with manual overrides)
    const effectiveCostsRisk = getEffectiveCosts(rent, value, costs);
    const totalCosts = effectiveCostsRisk.total;

    // Calculate effective monthly mortgage payment
    // Use stored mortgage_payment_gbp as fallback when auto-calc fails
    const storedPaymentRisk = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
    const paymentOverrideRisk = loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : storedPaymentRisk;

    const mortgagePaymentResult = calculateMonthlyMortgagePayment({
      balance: mortgage,
      interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
      termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
      isInterestOnly: loan?.capital_or_interest === 'interest',
      paymentOverride: paymentOverrideRisk,
    });

    const ltv = calculateLTV(mortgage, value);
    // Calculate annual cashflow after debt for risk assessment
    const annualCashflowAfterDebt = rent !== null
      ? (rent - totalCosts - (mortgagePaymentResult.effective || 0) * 12)
      : null;

    // LTV risks
    const ltvStatus = getLTVStatus(ltv);
    if (ltvStatus === 'danger') {
      riskItems.push({
        id: `ltv-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'ltv',
        severity: 'critical',
        message: `LTV at ${formatPercent(ltv)} (>85%)`,
        targetUrl: `/properties/${property.id}/edit`,
      });
    } else if (ltvStatus === 'warning') {
      riskItems.push({
        id: `ltv-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'ltv',
        severity: 'warning',
        message: `LTV at ${formatPercent(ltv)} (>75%)`,
        targetUrl: `/properties/${property.id}/edit`,
      });
    }

    // EPC risks (only if EPC is required)
    const epcRequired = property.epc_required !== false;
    const epcStatus = getEPCStatus(property.epc_rating, epcRequired);
    if (epcStatus === 'warning') {
      riskItems.push({
        id: `epc-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'epc',
        severity: 'warning',
        message: `EPC rating ${property.epc_rating} (below C)`,
        targetUrl: `/properties/${property.id}`,
      });
    }

    // Rate expiry risks
    if (loan?.fixed_rate_expires) {
      const days = daysUntil(loan.fixed_rate_expires);
      const status = getExpiryStatus(loan.fixed_rate_expires);

      if (status === 'expired') {
        riskItems.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'rate_expiry',
          severity: 'critical',
          message: 'Fixed rate has expired',
          targetUrl: `/properties/${property.id}/edit`,
        });
      } else if (status === 'critical') {
        riskItems.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'rate_expiry',
          severity: 'critical',
          message: `Fixed rate expires in ${days} days`,
          targetUrl: `/properties/${property.id}/edit`,
        });
      } else if (status === 'warning') {
        riskItems.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'rate_expiry',
          severity: 'warning',
          message: `Fixed rate expires in ${days} days`,
          targetUrl: `/properties/${property.id}/edit`,
        });
      }
    }

    // Negative cashflow (after debt)
    if (annualCashflowAfterDebt !== null && annualCashflowAfterDebt < 0) {
      riskItems.push({
        id: `cashflow-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'negative_cashflow',
        severity: 'warning',
        message: `Negative cashflow: ${formatGBP(annualCashflowAfterDebt)}/year`,
        targetUrl: `/properties/${property.id}/edit`,
      });
    }

    // ========== COMPLIANCE-BASED RISKS ==========

    // HMO licence risks - use compliance_items as source of truth
    if (property.is_hmo_licensed) {
      const propertyComplianceItems = complianceByPropertyMap.get(property.id) || [];
      const hmoItem = propertyComplianceItems.find((item: any) =>
        item.compliance_type.toLowerCase().replace(/\s+/g, '_') === 'hmo_licence' ||
        item.compliance_type === 'HMO Licence'
      );

      if (!hmoItem || !hmoItem.expiry_date) {
        // HMO required but no compliance item recorded
        riskItems.push({
          id: `hmo-missing-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'critical',
          message: 'HMO licence required but missing',
          targetUrl: `/properties/${property.id}?tab=compliance`,
        });
      } else {
        // Check expiry status
        const expiry = new Date(hmoItem.expiry_date);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry <= 0) {
          riskItems.push({
            id: `hmo-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'hmo_licence',
            severity: 'critical',
            message: 'HMO licence has expired',
            targetUrl: `/properties/${property.id}?tab=compliance`,
          });
        } else if (daysUntilExpiry <= 60) {
          riskItems.push({
            id: `hmo-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'hmo_licence',
            severity: 'warning',
            message: `HMO licence expires in ${daysUntilExpiry} days`,
            targetUrl: `/properties/${property.id}?tab=compliance`,
          });
        }
      }
    }

    // ========== INSURANCE GAP ANALYSIS ==========
    const propertyInsurance = insurancePolicies.filter(p => p.property_id === property.id);
    if (propertyInsurance.length === 0) {
      riskItems.push({
        id: `insurance-missing-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'insurance',
        severity: 'critical',
        message: 'No insurance policy on record',
        targetUrl: `/properties/${property.id}?tab=compliance`,
      });
    } else {
      const now = new Date();
      propertyInsurance.forEach(policy => {
        if (policy.renewal_date) {
          const renewalDate = new Date(policy.renewal_date);
          const daysToRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysToRenewal <= 0) {
            riskItems.push({
              id: `insurance-expired-${policy.id}`,
              propertyId: property.id,
              address: property.address_line,
              type: 'insurance',
              severity: 'critical',
              message: `Insurance policy expired (${policy.insurer_name})`,
              targetUrl: `/properties/${property.id}?tab=compliance`,
            });
          } else if (daysToRenewal <= 30) {
            riskItems.push({
              id: `insurance-expiring-${policy.id}`,
              propertyId: property.id,
              address: property.address_line,
              type: 'insurance',
              severity: 'warning',
              message: `Insurance renews in ${daysToRenewal} days (${policy.insurer_name})`,
              targetUrl: `/properties/${property.id}?tab=compliance`,
            });
          }
        }
      });
    }

    // ========== LEASEHOLD RISKS ==========
    if ((property.tenure === 'Leasehold' || property.tenure === 'Share of Freehold') && property.lease_years_remaining) {
      if (property.lease_years_remaining < 60) {
        riskItems.push({
          id: `lease-critical-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'leasehold',
          severity: 'critical',
          message: `Lease ${property.lease_years_remaining} yrs — below 60yr mortgage threshold`,
          targetUrl: `/properties/${property.id}`,
        });
      } else if (property.lease_years_remaining < 80) {
        riskItems.push({
          id: `lease-warning-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'leasehold',
          severity: 'warning',
          message: `Lease ${property.lease_years_remaining} yrs — approaching 80yr marriage value threshold`,
          targetUrl: `/properties/${property.id}`,
        });
      }
    }

    // ========== PROPERTY DATA COMPLETENESS ==========
    
    // Check core property fields (in properties table, edited via Property Edit page)
    const missingPropertyFields: string[] = [];
    if (!property.tenure) missingPropertyFields.push('Tenure');
    if (property.beds === null || property.beds === undefined) missingPropertyFields.push('Bedrooms');
    if (property.bathrooms === null || property.bathrooms === undefined) missingPropertyFields.push('Bathrooms');
    
    if (missingPropertyFields.length > 0) {
      riskItems.push({
        id: `property-data-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'operational_data',
        severity: 'warning',
        message: `Missing: ${missingPropertyFields.join(', ')}`,
        targetUrl: `/properties/${property.id}/edit`,
      });
    }

    // Operational data risks (from passport - now only operational fields)
    if (passport) {
      const completeness = calculatePassportCompleteness(passport);
      if (completeness.criticalMissing.length > 0) {
        // Only show top 2 missing items in risk message
        const missingItems = completeness.criticalMissing.slice(0, 2).join(', ');
        const moreCount = completeness.criticalMissing.length > 2
          ? ` +${completeness.criticalMissing.length - 2} more`
          : '';
        riskItems.push({
          id: `ops-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'operational_data',
          severity: 'warning',
          message: `Missing: ${missingItems}${moreCount}`,
          targetUrl: `/properties/${property.id}?tab=operations`,
        });
      }
    }
  });

  // ========== TENANCY COMPLIANCE RISKS ==========
  tenancyComplianceOverdue.forEach(item => {
    const tenant = item.tenancy?.tenant;
    const tenantName = tenant?.tenant_type === 'company'
      ? tenant.company_name || 'Unknown company'
      : `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim() || 'Unknown tenant';

    const message = tenant?.tenant_type === 'company'
      ? `${item.label} overdue for ${tenantName}`
      : `${item.label} overdue for ${tenantName} — Section 21 invalid`;

    riskItems.push({
      id: `tenancy-compliance-${item.id}`,
      propertyId: item.tenancy?.property_id || '',
      address: item.tenancy?.property?.address_line || 'Unknown',
      type: 'tenancy_compliance',
      severity: 'critical',
      message,
      targetUrl: `/tenants/${item.tenancy?.tenant_id}`,
    });
  });

  // ========== LEASE EXPIRY RISKS ==========
  if (tenancies && tenancies.length > 0) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    const ninetyDays = new Date(now.getTime() + 90 * 86400000);

    for (const tenancy of tenancies) {
      if (tenancy.status !== 'active' && tenancy.status !== 'notice') continue;
      if (!tenancy.end_date) continue;

      const endDate = new Date(tenancy.end_date);
      const tenantName = `${tenancy.tenant.first_name} ${tenancy.tenant.last_name}`;
      const roomName = tenancy.room?.room_name || '';
      const address = tenancy.property.address_line;

      if (endDate < now) {
        riskItems.push({
          id: `lease-expired-${tenancy.id}`,
          propertyId: tenancy.property.id,
          address,
          type: 'lease_expiry',
          severity: 'critical',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expired on ${endDate.toLocaleDateString('en-GB')}. Needs renewal or end of tenancy.`,
          targetUrl: `/tenants/${tenancy.tenant.id}`,
        });
      } else if (endDate <= thirtyDays) {
        riskItems.push({
          id: `lease-critical-${tenancy.id}`,
          propertyId: tenancy.property.id,
          address,
          type: 'lease_expiry',
          severity: 'critical',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expires in ${Math.ceil((endDate.getTime() - now.getTime()) / 86400000)} days (${endDate.toLocaleDateString('en-GB')}).`,
          targetUrl: `/tenants/${tenancy.tenant.id}`,
        });
      } else if (endDate <= ninetyDays) {
        riskItems.push({
          id: `lease-warning-${tenancy.id}`,
          propertyId: tenancy.property.id,
          address,
          type: 'lease_expiry',
          severity: 'warning',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expires on ${endDate.toLocaleDateString('en-GB')} (${Math.ceil((endDate.getTime() - now.getTime()) / 86400000)} days).`,
          targetUrl: `/tenants/${tenancy.tenant.id}`,
        });
      }
    }
  }

  return riskItems;
}

/**
 * Hook to fetch and calculate all portfolio risks.
 * Returns the same data for both Dashboard and Actions pages.
 */
export function usePortfolioRisks() {
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();
  const { data: allComplianceItems, isLoading: complianceLoading } = useAllCompliance();
  const { data: tenancyStats, isLoading: tenancyComplianceLoading } = useTenancyComplianceStats();
  const { data: insurancePolicies, isLoading: insuranceLoading } = useInsurancePolicies();
  const { data: allTenancies, isLoading: tenanciesLoading } = useTenancies();

  // Create a map of passports by property_id for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Create a map of compliance items by property_id
  const complianceByPropertyMap = useMemo(() => {
    const map = new Map<string, typeof allComplianceItems>();
    allComplianceItems?.forEach(item => {
      const existing = map.get(item.property_id) || [];
      existing.push(item);
      map.set(item.property_id, existing);
    });
    return map;
  }, [allComplianceItems]);

  // Calculate risks
  const risks = useMemo(() => {
    if (!properties) return [];
    return calculatePortfolioRisks(
      properties,
      passportMap,
      complianceByPropertyMap,
      tenancyStats?.overdueItems || [],
      insurancePolicies || [],
      allTenancies || []
    );
  }, [properties, passportMap, complianceByPropertyMap, tenancyStats?.overdueItems, insurancePolicies, allTenancies]);

  const criticalCount = useMemo(() => risks.filter(r => r.severity === 'critical').length, [risks]);
  const warningCount = useMemo(() => risks.filter(r => r.severity === 'warning').length, [risks]);

  return {
    risks,
    criticalCount,
    warningCount,
    totalCount: risks.length,
    isLoading: propertiesLoading || passportsLoading || complianceLoading || tenancyComplianceLoading || insuranceLoading || tenanciesLoading,
    passportMap,
    complianceByPropertyMap,
  };
}
