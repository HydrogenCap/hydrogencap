import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
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

// Finance fields to validate (from loans table)
export const FINANCE_FIELDS = [
  { key: 'lender', label: 'Lender Name', type: 'text' },
  { key: 'current_mortgage_balance_gbp', label: 'Current Balance', type: 'currency' },
  { key: 'interest_rate_percent', label: 'Interest Rate', type: 'percent' },
  { key: 'capital_or_interest', label: 'Repayment Type', type: 'select', options: ['interest', 'capital'] },
  { key: 'fixed_or_variable', label: 'Fixed or Variable', type: 'select', options: ['fixed', 'variable', 'tracker'] },
  { key: 'fixed_rate_expires', label: 'Product End Date', type: 'date' },
  { key: 'mortgage_payment_gbp', label: 'Monthly Payment', type: 'currency' },
  { key: 'loan_start_date', label: 'Loan Start Date', type: 'date' },
] as const;

// Insurance fields to validate (from insurance_policies table)
export const INSURANCE_FIELDS = [
  { key: 'insurer_name', label: 'Insurer Name', type: 'text' },
  { key: 'policy_number', label: 'Policy Number', type: 'text' },
  { key: 'renewal_date', label: 'Renewal Date', type: 'date' },
  { key: 'cover_type', label: 'Cover Type', type: 'select', options: ['Buildings', 'Landlord', 'HMO', 'Contents', 'Other'] },
  { key: 'premium_gbp', label: 'Premium', type: 'currency' },
  { key: 'excess_gbp', label: 'Excess', type: 'currency' },
] as const;

// Check if a field value is considered "missing"
export function isMissing(value: any, fieldKey: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  
  // 0 is missing for monetary/rate fields (except interest_rate where 0% could be valid but unlikely)
  const zeroIsMissing = [
    'current_mortgage_balance_gbp',
    'mortgage_payment_gbp',
    'premium_gbp',
    'excess_gbp',
    'interest_rate_percent',
  ];
  if (zeroIsMissing.includes(fieldKey) && value === 0) return true;
  
  return false;
}

export interface PropertyMissingInfo {
  property: PropertyWithFinancials;
  insurance: InsurancePolicy | null;
  missingFinanceFields: string[];
  missingInsuranceFields: string[];
  totalMissing: number;
  status: 'complete' | 'missing_finance' | 'missing_insurance' | 'missing_both';
  renewingSoon: boolean;
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

  const data = useMemo(() => {
    if (!properties) return [];

    const insuranceMap = new Map<string, InsurancePolicy>();
    insurancePolicies?.forEach(p => insuranceMap.set(p.property_id, p));

    return properties.map((property): PropertyMissingInfo => {
      const loan = property.loans?.[0];
      const insurance = insuranceMap.get(property.id) || null;

      // Check finance fields
      const missingFinanceFields: string[] = [];
      if (loan) {
        FINANCE_FIELDS.forEach(field => {
          const value = loan[field.key as keyof typeof loan];
          if (isMissing(value, field.key)) {
            missingFinanceFields.push(field.key);
          }
        });
      } else {
        // No loan record = all finance fields missing
        missingFinanceFields.push(...FINANCE_FIELDS.map(f => f.key));
      }

      // Check insurance fields
      const missingInsuranceFields: string[] = [];
      INSURANCE_FIELDS.forEach(field => {
        const value = insurance?.[field.key as keyof InsurancePolicy];
        if (isMissing(value, field.key)) {
          missingInsuranceFields.push(field.key);
        }
      });

      const totalMissing = missingFinanceFields.length + missingInsuranceFields.length;

      // Determine status
      let status: PropertyMissingInfo['status'] = 'complete';
      if (missingFinanceFields.length > 0 && missingInsuranceFields.length > 0) {
        status = 'missing_both';
      } else if (missingFinanceFields.length > 0) {
        status = 'missing_finance';
      } else if (missingInsuranceFields.length > 0) {
        status = 'missing_insurance';
      }

      // Check if insurance renewal is within 60 days
      let renewingSoon = false;
      if (insurance?.renewal_date) {
        const renewalDate = new Date(insurance.renewal_date);
        const now = new Date();
        const diffDays = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        renewingSoon = diffDays >= 0 && diffDays <= 60;
      }

      return {
        property,
        insurance,
        missingFinanceFields,
        missingInsuranceFields,
        totalMissing,
        status,
        renewingSoon,
      };
    });
  }, [properties, insurancePolicies]);

  // Summary stats
  const stats = useMemo(() => {
    const propertiesWithFinanceMissing = data.filter(d => d.missingFinanceFields.length > 0).length;
    const propertiesWithInsuranceMissing = data.filter(d => d.missingInsuranceFields.length > 0).length;
    const totalMissingFields = data.reduce((sum, d) => sum + d.totalMissing, 0);
    return { propertiesWithFinanceMissing, propertiesWithInsuranceMissing, totalMissingFields };
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
    isLoading: propertiesLoading || insuranceLoading,
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
      const label = FINANCE_FIELDS.find(f => f.key === field)?.label || field;
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
  }

  navigator.clipboard.writeText(lines.join('\n'));
  toast.success('Copied to clipboard');
}
