import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { usePropertyPassports, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { toast } from 'sonner';

// Insurance policy type (from new table)
export interface InsurancePolicy {
  id: string;
  property_id: string;
  insurer_name: string | null;
  policy_number: string | null;
  renewal_date: string | null;
  cover_type: string | null;
  premium_gbp: number | null;
  excess_gbp: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Field definition type
export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'percent' | 'date' | 'select' | 'number' | 'boolean';
  options?: readonly string[];
}

/**
 * CHANGE 1: Finance Fields
 * - Removed mortgage_payment_gbp from required list (now auto-calculated)
 * - Required fields: lender, current_balance, interest_rate, repayment_type, fixed_or_variable, product_end_date, loan_start_date
 */
export const FINANCE_FIELDS: FieldDefinition[] = [
  { key: 'lender', label: 'Lender Name', type: 'text' },
  { key: 'current_mortgage_balance_gbp', label: 'Current Balance', type: 'currency' },
  { key: 'interest_rate_percent', label: 'Interest Rate', type: 'percent' },
  { key: 'capital_or_interest', label: 'Repayment Type', type: 'select', options: ['interest', 'capital'] },
  { key: 'fixed_or_variable', label: 'Fixed or Variable', type: 'select', options: ['fixed', 'variable', 'tracker'] },
  { key: 'fixed_rate_expires', label: 'Product End Date', type: 'date' },
  { key: 'loan_start_date', label: 'Loan Start Date', type: 'date' },
];

// Term years field (optional - only needed for repayment mortgages)
export const TERM_YEARS_FIELD: FieldDefinition = {
  key: 'term_years',
  label: 'Term (Years)',
  type: 'number',
};

/**
 * CHANGE 2: Insurance Fields
 * - Removed premium_gbp, excess_gbp, cover_type from required list
 * - Required fields: insurer_name, policy_number, renewal_date
 */
export const INSURANCE_FIELDS: FieldDefinition[] = [
  { key: 'insurer_name', label: 'Insurer Name', type: 'text' },
  { key: 'policy_number', label: 'Policy Number', type: 'text' },
  { key: 'renewal_date', label: 'Renewal Date', type: 'date' },
];

/**
 * CHANGE 3: Passport Fields - Removed duplicates
 * 
 * DATA SOURCES (Developer Reference):
 * - address_line, postcode, beds, bathrooms, property_type, tenure, epc_rating, title_number → properties table
 * - lender, balance, rate, etc. → loans table
 * - insurer_name, policy_number, etc. → insurance_policies table
 * 
 * Property Passport stores ONLY unique fields not available elsewhere:
 * - Utility meter locations/numbers
 * - Keysafe codes
 * - Construction details (built year, construction type, storeys)
 * - HMO specific data
 * - Management company info
 * - Parking/access details
 * 
 * REMOVED from Passport (duplicates):
 * - bedrooms, bathrooms → Already in properties.beds, properties.bathrooms
 * - owner_tenure → Already in properties.tenure
 * - land_registry_title_number → Already in properties.title_number
 * - postcode → Already in properties.postcode
 */
export const PASSPORT_FIELDS: FieldDefinition[] = [
  // Critical utility fields (unique to passport)
  { key: 'keysafe_code', label: 'Keysafe Code', type: 'text' },
  { key: 'electric_meter_location', label: 'Electric Meter Location', type: 'text' },
  { key: 'electric_meter_number', label: 'Electric Meter Number', type: 'text' },
  { key: 'gas_meter_location', label: 'Gas Meter Location', type: 'text' },
  { key: 'gas_meter_number', label: 'Gas Meter Number', type: 'text' },
  { key: 'water_meter_location', label: 'Water Meter Location', type: 'text' },
  { key: 'water_meter_number', label: 'Water Meter Number', type: 'text' },
  { key: 'water_stop_tap_location', label: 'Stop Tap Location', type: 'text' },
  // Room counts - only unique ones not in properties table
  { key: 'kitchens', label: 'Kitchens', type: 'number' },
  { key: 'ensuites', label: 'Ensuites', type: 'number' },
  { key: 'living_rooms_communal', label: 'Living Rooms', type: 'number' },
  { key: 'wc_cloakroom', label: 'WC/Cloakroom', type: 'number' },
  // Construction (unique to passport)
  { key: 'built_in_year', label: 'Built In Year', type: 'number' },
  { key: 'construction_type', label: 'Construction Type', type: 'select', options: ['Brick', 'Stone', 'Timber Frame', 'Concrete', 'Steel Frame', 'Other'] },
  { key: 'number_of_storeys', label: 'Number of Storeys', type: 'number' },
  // Location/Admin (unique to passport - local_authority_text is passport-specific)
  { key: 'local_authority_text', label: 'Local Authority', type: 'text' },
  { key: 'council_tax_band', label: 'Council Tax Band', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  { key: 'occupation_status', label: 'Occupation Status', type: 'select', options: ['Let', 'Vacant', 'Owner-occupied', 'Development'] },
  // Parking & Access (unique to passport)
  { key: 'parking', label: 'Parking', type: 'select', options: ['None', 'On-street', 'Driveway', 'Garage', 'Allocated space', 'Multiple'] },
  { key: 'has_loft_access', label: 'Loft Access', type: 'boolean' },
  { key: 'basement', label: 'Basement', type: 'boolean' },
  // HMO (unique to passport)
  { key: 'hmo_licence_required', label: 'HMO Licence Required', type: 'boolean' },
  { key: 'hmo_licence_number', label: 'HMO Licence Number', type: 'text' },
  { key: 'hmo_licence_expiry', label: 'HMO Licence Expiry', type: 'date' },
  { key: 'hmo_bed_spaces', label: 'HMO Bed Spaces', type: 'number' },
  // Management (unique to passport)
  { key: 'management_company_text', label: 'Management Company', type: 'text' },
  { key: 'property_management_fee_percent', label: 'Management Fee %', type: 'percent' },
];

// Critical passport fields that should always be filled
export const CRITICAL_PASSPORT_FIELDS = [
  'keysafe_code',
  'electric_meter_location',
  'electric_meter_number',
  'gas_meter_location',
  'gas_meter_number',
  'water_meter_location',
  'water_meter_number',
  'water_stop_tap_location',
];

// Check if a field value is considered "missing"
export function isMissing(value: any, fieldKey: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  
  // 0 is missing for monetary/rate fields
  const zeroIsMissing = [
    'current_mortgage_balance_gbp',
    'interest_rate_percent',
    'property_management_fee_percent',
  ];
  if (zeroIsMissing.includes(fieldKey) && value === 0) return true;
  
  return false;
}

/**
 * Calculate monthly payment for a mortgage
 * Returns null if calculation is not possible
 */
export interface MonthlyPaymentResult {
  amount: number | null;
  source: 'calculated' | 'override' | 'stored';
  canCalculate: boolean;
  missingReason?: string;
}

export function calculateMonthlyPayment(
  balance: number | null | undefined,
  rate: number | null | undefined,
  repaymentType: string | null | undefined,
  termYears: number | null | undefined,
  storedPayment: number | null | undefined,
  paymentSource: string | null | undefined
): MonthlyPaymentResult {
  // If user has set an override, use that
  if (paymentSource === 'manual' && storedPayment && storedPayment > 0) {
    return { amount: storedPayment, source: 'override', canCalculate: true };
  }

  // Check if we have the minimum required inputs
  if (!balance || balance <= 0 || !rate || rate <= 0) {
    return { 
      amount: null, 
      source: 'calculated', 
      canCalculate: false,
      missingReason: 'Balance and interest rate required'
    };
  }

  const monthlyRate = (rate / 100) / 12;

  // Interest-only calculation
  if (repaymentType === 'interest') {
    const payment = balance * monthlyRate;
    return { amount: Math.round(payment * 100) / 100, source: 'calculated', canCalculate: true };
  }

  // Capital & Interest (Repayment) calculation
  if (repaymentType === 'capital') {
    if (!termYears || termYears <= 0) {
      return { 
        amount: null, 
        source: 'calculated', 
        canCalculate: false,
        missingReason: 'Term (years) required for repayment mortgages'
      };
    }

    const n = termYears * 12;
    const payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return { amount: Math.round(payment * 100) / 100, source: 'calculated', canCalculate: true };
  }

  // Unknown repayment type
  return { 
    amount: null, 
    source: 'calculated', 
    canCalculate: false,
    missingReason: 'Repayment type required'
  };
}

export interface PropertyMissingInfo {
  property: PropertyWithFinancials;
  insurance: InsurancePolicy | null;
  passport: PropertyPassport | null;
  missingFinanceFields: string[];
  missingInsuranceFields: string[];
  missingPassportFields: string[];
  missingCriticalPassportFields: string[];
  totalMissing: number;
  status: 'complete' | 'missing_finance' | 'missing_insurance' | 'missing_passport' | 'missing_multiple';
  renewingSoon: boolean;
  hmoLicenceExpiringSoon: boolean;
  // New: computed monthly payment info
  monthlyPayment: MonthlyPaymentResult;
  needsTermYears: boolean;
}

// Fetch insurance policies
export function useInsurancePolicies() {
  return useQuery({
    queryKey: ['insurance_policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_policies')
        .select('*');
      if (error) throw error;
      return data as InsurancePolicy[];
    },
  });
}

// Upsert insurance policy
export function useUpsertInsurancePolicy() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (policy: Partial<InsurancePolicy> & { property_id: string }) => {
      const { data, error } = await supabase
        .from('insurance_policies')
        .upsert(policy, { onConflict: 'property_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance_policies'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Main hook for missing info data
export function useMissingInfo() {
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const { data: insurancePolicies, isLoading: insuranceLoading } = useInsurancePolicies();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();

  const data = useMemo(() => {
    if (!properties) return [];

    const insuranceMap = new Map<string, InsurancePolicy>();
    insurancePolicies?.forEach(p => insuranceMap.set(p.property_id, p));

    const passportMap = new Map<string, PropertyPassport>();
    passports?.forEach(p => passportMap.set(p.property_id, p));

    return properties.map((property): PropertyMissingInfo => {
      const loan = property.loans?.[0];
      const insurance = insuranceMap.get(property.id) || null;
      const passport = passportMap.get(property.id) || null;

      // Calculate monthly payment
      const monthlyPayment = calculateMonthlyPayment(
        loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null,
        loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
        loan?.capital_or_interest,
        loan?.term_years,
        loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null,
        loan?.payment_source
      );

      // Check if term_years is needed but missing (for repayment mortgages)
      const needsTermYears = loan?.capital_or_interest === 'capital' && !loan?.term_years;

      // Check finance fields (excluding monthly_payment - it's auto-calculated)
      const missingFinanceFields: string[] = [];
      if (loan) {
        FINANCE_FIELDS.forEach(field => {
          const value = loan[field.key as keyof typeof loan];
          if (isMissing(value, field.key)) {
            missingFinanceFields.push(field.key);
          }
        });
        // Add term_years to missing if needed for repayment calculation
        if (needsTermYears) {
          missingFinanceFields.push('term_years');
        }
      } else {
        // No loan record = all finance fields missing
        missingFinanceFields.push(...FINANCE_FIELDS.map(f => f.key));
      }

      // Check insurance fields (updated list - no premium/excess/cover_type)
      const missingInsuranceFields: string[] = [];
      INSURANCE_FIELDS.forEach(field => {
        const value = insurance?.[field.key as keyof InsurancePolicy];
        if (isMissing(value, field.key)) {
          missingInsuranceFields.push(field.key);
        }
      });

      // Check passport fields (updated list - no duplicates)
      const missingPassportFields: string[] = [];
      const missingCriticalPassportFields: string[] = [];
      PASSPORT_FIELDS.forEach(field => {
        // Skip HMO fields if HMO licence is not required
        if (field.key.startsWith('hmo_') && field.key !== 'hmo_licence_required') {
          if (!passport?.hmo_licence_required) return;
        }
        
        const value = passport?.[field.key as keyof PropertyPassport];
        if (isMissing(value, field.key)) {
          missingPassportFields.push(field.key);
          if (CRITICAL_PASSPORT_FIELDS.includes(field.key)) {
            missingCriticalPassportFields.push(field.key);
          }
        }
      });

      const totalMissing = missingFinanceFields.length + missingInsuranceFields.length + missingPassportFields.length;

      // Determine status
      const hasMissingFinance = missingFinanceFields.length > 0;
      const hasMissingInsurance = missingInsuranceFields.length > 0;
      const hasMissingPassport = missingPassportFields.length > 0;
      
      const missingCount = [hasMissingFinance, hasMissingInsurance, hasMissingPassport].filter(Boolean).length;
      
      let status: PropertyMissingInfo['status'] = 'complete';
      if (missingCount >= 2) {
        status = 'missing_multiple';
      } else if (hasMissingFinance) {
        status = 'missing_finance';
      } else if (hasMissingInsurance) {
        status = 'missing_insurance';
      } else if (hasMissingPassport) {
        status = 'missing_passport';
      }

      // Check if insurance renewal is within 60 days
      let renewingSoon = false;
      if (insurance?.renewal_date) {
        const renewalDate = new Date(insurance.renewal_date);
        const now = new Date();
        const diffDays = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        renewingSoon = diffDays >= 0 && diffDays <= 60;
      }

      // Check if HMO licence is expiring soon
      let hmoLicenceExpiringSoon = false;
      if (passport?.hmo_licence_required && passport?.hmo_licence_expiry) {
        const expiryDate = new Date(passport.hmo_licence_expiry);
        const now = new Date();
        const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        hmoLicenceExpiringSoon = diffDays >= 0 && diffDays <= 60;
      }

      return {
        property,
        insurance,
        passport,
        missingFinanceFields,
        missingInsuranceFields,
        missingPassportFields,
        missingCriticalPassportFields,
        totalMissing,
        status,
        renewingSoon,
        hmoLicenceExpiringSoon,
        monthlyPayment,
        needsTermYears,
      };
    });
  }, [properties, insurancePolicies, passports]);

  // Summary stats
  const stats = useMemo(() => {
    const propertiesWithFinanceMissing = data.filter(d => d.missingFinanceFields.length > 0).length;
    const propertiesWithInsuranceMissing = data.filter(d => d.missingInsuranceFields.length > 0).length;
    const propertiesWithPassportMissing = data.filter(d => d.missingPassportFields.length > 0).length;
    const propertiesWithCriticalPassportMissing = data.filter(d => d.missingCriticalPassportFields.length > 0).length;
    const totalMissingFields = data.reduce((sum, d) => sum + d.totalMissing, 0);
    return { 
      propertiesWithFinanceMissing, 
      propertiesWithInsuranceMissing, 
      propertiesWithPassportMissing,
      propertiesWithCriticalPassportMissing,
      totalMissingFields 
    };
  }, [data]);

  // Get unique lenders and insurers for filters
  const lenders = useMemo(() => {
    const set = new Set<string>();
    properties?.forEach(p => {
      const lender = p.loans?.[0]?.lender;
      if (lender) set.add(lender);
    });
    return Array.from(set).sort();
  }, [properties]);

  const insurers = useMemo(() => {
    const set = new Set<string>();
    insurancePolicies?.forEach(p => {
      if (p.insurer_name) set.add(p.insurer_name);
    });
    return Array.from(set).sort();
  }, [insurancePolicies]);

  return {
    data,
    stats,
    lenders,
    insurers,
    isLoading: propertiesLoading || insuranceLoading || passportsLoading,
  };
}

// Export CSV of missing fields
export function exportMissingInfoCSV(data: PropertyMissingInfo[]) {
  const rows: string[] = [];
  rows.push('property_id,address,postcode,category,field_name,current_value');

  data.forEach(item => {
    const address = item.property.address_line.replace(/,/g, ';');
    const postcode = item.property.postcode || '';

    item.missingFinanceFields.forEach(field => {
      const loan = item.property.loans?.[0];
      const currentValue = loan ? String(loan[field as keyof typeof loan] ?? '') : '';
      rows.push(`${item.property.id},"${address}",${postcode},finance,${field},"${currentValue}"`);
    });

    item.missingInsuranceFields.forEach(field => {
      const currentValue = item.insurance ? String(item.insurance[field as keyof InsurancePolicy] ?? '') : '';
      rows.push(`${item.property.id},"${address}",${postcode},insurance,${field},"${currentValue}"`);
    });

    item.missingPassportFields.forEach(field => {
      const currentValue = item.passport ? String(item.passport[field as keyof PropertyPassport] ?? '') : '';
      rows.push(`${item.property.id},"${address}",${postcode},passport,${field},"${currentValue}"`);
    });
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `missing-info-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported successfully');
}

// Copy missing fields to clipboard
export function copyMissingToClipboard(item: PropertyMissingInfo) {
  const lines: string[] = [];
  lines.push(`Property: ${item.property.address_line}`);
  if (item.property.postcode) lines.push(`Postcode: ${item.property.postcode}`);
  lines.push('');

  if (item.missingFinanceFields.length > 0) {
    lines.push('Missing Finance:');
    item.missingFinanceFields.forEach(field => {
      const label = FINANCE_FIELDS.find(f => f.key === field)?.label || 
                   (field === 'term_years' ? 'Term (Years)' : field);
      lines.push(`  • ${label}`);
    });
    lines.push('');
  }

  if (item.missingInsuranceFields.length > 0) {
    lines.push('Missing Insurance:');
    item.missingInsuranceFields.forEach(field => {
      const label = INSURANCE_FIELDS.find(f => f.key === field)?.label || field;
      lines.push(`  • ${label}`);
    });
    lines.push('');
  }

  if (item.missingPassportFields.length > 0) {
    lines.push('Missing Passport:');
    item.missingPassportFields.forEach(field => {
      const label = PASSPORT_FIELDS.find(f => f.key === field)?.label || field;
      lines.push(`  • ${label}`);
    });
  }

  navigator.clipboard.writeText(lines.join('\n'));
  toast.success('Copied to clipboard');
}
