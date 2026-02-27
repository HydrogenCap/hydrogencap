import { useMemo } from 'react';
import { useDashboardPropertiesV2 } from '@/hooks/useDashboardDataV2';
import type { PropertyWithFinancials } from '@/hooks/useProperties';
import { usePropertyPassports, calculatePassportCompleteness, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useComplianceMatrix } from '@/hooks/useComplianceV2';
import { useTenancyComplianceStats, type TenancyComplianceItemWithDetails } from '@/hooks/useTenancyCompliance';
import { useInsurancePolicies, type InsurancePolicy } from '@/hooks/useInsurance';
import { useDashboardTenanciesV2 } from '@/hooks/useDashboardDataV2';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
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
  complianceMatrix: ComplianceMatrixRow[],
  tenancyComplianceOverdue: TenancyComplianceItemWithDetails[] = [],
  insurancePolicies: InsurancePolicy[] = [],
  tenancies: any[] = []
): RiskItem[] {
  const riskItems: RiskItem[] = [];
  const currentYear = new Date().getFullYear();

  // Build compliance matrix lookup by property
  const complianceByProperty = new Map<string, ComplianceMatrixRow[]>();
  for (const row of complianceMatrix) {
    const existing = complianceByProperty.get(row.property_id) || [];
    existing.push(row);
    complianceByProperty.set(row.property_id, existing);
  }

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
    const annualCashflowAfterDebt = rent !== null
      ? (rent - totalCosts - (mortgagePaymentResult.effective || 0) * 12)
      : null;

    // V2 property detail URL
    const propertyUrl = `/properties-v2/${property.id}`;

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
        targetUrl: propertyUrl,
      });
    } else if (ltvStatus === 'warning') {
      riskItems.push({
        id: `ltv-${property.id}`,
        propertyId: property.id,
        address: property.address_line,
        type: 'ltv',
        severity: 'warning',
        message: `LTV at ${formatPercent(ltv)} (>75%)`,
        targetUrl: propertyUrl,
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
        targetUrl: propertyUrl,
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
          targetUrl: propertyUrl,
        });
      } else if (status === 'critical') {
        riskItems.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'rate_expiry',
          severity: 'critical',
          message: `Fixed rate expires in ${days} days`,
          targetUrl: propertyUrl,
        });
      } else if (status === 'warning') {
        riskItems.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'rate_expiry',
          severity: 'warning',
          message: `Fixed rate expires in ${days} days`,
          targetUrl: propertyUrl,
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
        targetUrl: propertyUrl,
      });
    }

    // ========== COMPLIANCE-BASED RISKS (V2 matrix) ==========
    const propertyCompliance = complianceByProperty.get(property.id) || [];

    // HMO licence risks
    if (property.is_hmo_licensed) {
      const hmoRow = propertyCompliance.find(r => r.document_type === 'hmo_licence' && r.is_required);

      if (!hmoRow || hmoRow.calculated_status === 'missing') {
        riskItems.push({
          id: `hmo-missing-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'critical',
          message: 'HMO licence required but missing',
          targetUrl: propertyUrl,
        });
      } else if (hmoRow.calculated_status === 'expired') {
        riskItems.push({
          id: `hmo-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'critical',
          message: 'HMO licence has expired',
          targetUrl: propertyUrl,
        });
      } else if ((hmoRow.calculated_status === 'expiring_soon' || hmoRow.calculated_status === 'critical') && hmoRow.days_remaining !== null) {
        riskItems.push({
          id: `hmo-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'warning',
          message: `HMO licence expires in ${hmoRow.days_remaining} days`,
          targetUrl: propertyUrl,
        });
      }
    }

    // ========== INSURANCE GAP ANALYSIS ==========
    // Check V2 compliance matrix for buildings insurance
    const insuranceRow = propertyCompliance.find(r => r.document_type === 'buildings_insurance' && r.is_required);
    if (insuranceRow) {
      if (insuranceRow.calculated_status === 'missing') {
        riskItems.push({
          id: `insurance-missing-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'insurance',
          severity: 'critical',
          message: 'No buildings insurance on record',
          targetUrl: propertyUrl,
        });
      } else if (insuranceRow.calculated_status === 'expired') {
        riskItems.push({
          id: `insurance-expired-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'insurance',
          severity: 'critical',
          message: 'Buildings insurance has expired',
          targetUrl: propertyUrl,
        });
      } else if (insuranceRow.calculated_status === 'critical' && insuranceRow.days_remaining !== null) {
        riskItems.push({
          id: `insurance-expiring-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'insurance',
          severity: 'warning',
          message: `Buildings insurance renews in ${insuranceRow.days_remaining} days`,
          targetUrl: propertyUrl,
        });
      }
    }

    // ========== PROPERTY DATA COMPLETENESS ==========
    if (passport) {
      const completeness = calculatePassportCompleteness(passport);
      if (completeness.criticalMissing.length > 0) {
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
          targetUrl: `${propertyUrl}?tab=operations`,
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

  // ========== LEASE EXPIRY RISKS (V2 tenancies) ==========
  if (tenancies && tenancies.length > 0) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    const ninetyDays = new Date(now.getTime() + 90 * 86400000);

    for (const tenancy of tenancies) {
      if (tenancy.status !== 'active' && tenancy.status !== 'notice_period' && tenancy.status !== 'notice_served') continue;
      const endDate = tenancy.end_date ? new Date(tenancy.end_date) : null;
      if (!endDate) continue;

      const tenantName = tenancy.tenant
        ? `${tenancy.tenant.first_name} ${tenancy.tenant.last_name}`.trim()
        : 'Unknown tenant';
      const roomName = tenancy.room?.room_name || '';
      const address = tenancy.property?.address_line || 'Unknown';
      const propertyId = tenancy.property_id || tenancy.property?.id || '';

      if (endDate < now) {
        riskItems.push({
          id: `lease-expired-${tenancy.id}`,
          propertyId,
          address,
          type: 'lease_expiry',
          severity: 'critical',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expired on ${endDate.toLocaleDateString('en-GB')}. Needs renewal or end of tenancy.`,
          targetUrl: `/tenants/${tenancy.tenant?.id || tenancy.tenant_id}`,
        });
      } else if (endDate <= thirtyDays) {
        riskItems.push({
          id: `lease-critical-${tenancy.id}`,
          propertyId,
          address,
          type: 'lease_expiry',
          severity: 'critical',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expires in ${Math.ceil((endDate.getTime() - now.getTime()) / 86400000)} days (${endDate.toLocaleDateString('en-GB')}).`,
          targetUrl: `/tenants/${tenancy.tenant?.id || tenancy.tenant_id}`,
        });
      } else if (endDate <= ninetyDays) {
        riskItems.push({
          id: `lease-warning-${tenancy.id}`,
          propertyId,
          address,
          type: 'lease_expiry',
          severity: 'warning',
          message: `Tenancy for ${tenantName}${roomName ? ` (${roomName})` : ''} expires on ${endDate.toLocaleDateString('en-GB')} (${Math.ceil((endDate.getTime() - now.getTime()) / 86400000)} days).`,
          targetUrl: `/tenants/${tenancy.tenant?.id || tenancy.tenant_id}`,
        });
      }
    }
  }

  return riskItems;
}

/**
 * Hook to fetch and calculate all portfolio risks.
 * Uses V2 data sources (properties_v2, compliance_matrix_v2, tenancy_agreements).
 * Returns the same data for both Dashboard and Actions pages.
 */
export function usePortfolioRisks() {
  const { data: properties, isLoading: propertiesLoading } = useDashboardPropertiesV2();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();
  const { data: complianceMatrix, isLoading: complianceLoading } = useComplianceMatrix();
  const { data: tenancyStats, isLoading: tenancyComplianceLoading } = useTenancyComplianceStats();
  const { data: insurancePolicies, isLoading: insuranceLoading } = useInsurancePolicies();
  const { data: allTenancies, isLoading: tenanciesLoading } = useDashboardTenanciesV2();

  // Create a map of passports by property_id for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Calculate risks
  const risks = useMemo(() => {
    if (!properties) return [];
    return calculatePortfolioRisks(
      properties,
      passportMap,
      complianceMatrix || [],
      tenancyStats?.overdueItems || [],
      insurancePolicies || [],
      allTenancies || []
    );
  }, [properties, passportMap, complianceMatrix, tenancyStats?.overdueItems, insurancePolicies, allTenancies]);

  const criticalCount = useMemo(() => risks.filter(r => r.severity === 'critical').length, [risks]);
  const warningCount = useMemo(() => risks.filter(r => r.severity === 'warning').length, [risks]);

  return {
    risks,
    criticalCount,
    warningCount,
    totalCount: risks.length,
    isLoading: propertiesLoading || passportsLoading || complianceLoading || tenancyComplianceLoading || insuranceLoading || tenanciesLoading,
    passportMap,
  };
}
