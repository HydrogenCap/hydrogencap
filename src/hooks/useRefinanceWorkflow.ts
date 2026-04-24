import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';
import { useAllLoanFacilities, type LoanFacilityWithDetails } from './useLoanFacilities';
import { useMemo } from 'react';

export interface MortgageApplication {
  id: string;
  org_id: string;
  property_id: string;
  existing_loan_id: string | null;
  status: string;
  lender_name: string | null;
  product_name: string | null;
  product_rate: number | null;
  product_type: string | null;
  product_term_months: number | null;
  erc_end_date: string | null;
  arrangement_fee: number;
  valuation_fee: number;
  legal_fee: number;
  loan_amount: number | null;
  property_value: number | null;
  ltv: number | null;
  broker_name: string | null;
  broker_company: string | null;
  broker_fee: number;
  dip_submitted_at: string | null;
  dip_approved_at: string | null;
  full_app_submitted_at: string | null;
  valuation_date: string | null;
  offer_date: string | null;
  completion_target: string | null;
  completed_at: string | null;
  current_rate: number | null;
  current_payment: number | null;
  new_payment: number | null;
  monthly_saving: number | null;
  total_cost_of_switch: number | null;
  notes: string | null;
  created_at: string;
}

export interface MortgageApplicationWithProperty extends MortgageApplication {
  property_address: string;
}

export const APPLICATION_STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'dip_submitted', label: 'DIP Submitted' },
  { value: 'dip_approved', label: 'DIP Approved' },
  { value: 'full_app', label: 'Full Application' },
  { value: 'valuation_instructed', label: 'Valuation Instructed' },
  { value: 'valuation_received', label: 'Valuation Received' },
  { value: 'offer_issued', label: 'Offer Issued' },
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'legal_instructed', label: 'Legal Instructed' },
  { value: 'completed', label: 'Completed' },
  { value: 'withdrawn', label: 'Withdrawn' },
] as const;

export const PIPELINE_STAGES = [
  { value: 'dip_submitted', label: 'DIP', dateField: 'dip_submitted_at' },
  { value: 'full_app', label: 'Full App', dateField: 'full_app_submitted_at' },
  { value: 'valuation_instructed', label: 'Valuation', dateField: 'valuation_date' },
  { value: 'offer_issued', label: 'Offer', dateField: 'offer_date' },
  { value: 'legal_instructed', label: 'Legal', dateField: 'completion_target' },
  { value: 'completed', label: 'Complete', dateField: 'completed_at' },
] as const;

export const STAGE_DOCUMENTS: Record<string, string[]> = {
  dip_submitted: ['Proof of identity', 'Proof of address', 'Bank statements (3 months)', 'SA302 / Tax returns'],
  full_app: ['Full bank statements (6 months)', 'Mortgage statement', 'Property schedule', 'Business plan'],
  valuation_instructed: ['Access arrangements', 'Tenancy agreements', 'EPC certificate'],
  offer_issued: ['Review offer terms', 'Confirm product selection'],
  legal_instructed: ['Title deeds', 'Existing mortgage redemption statement', 'Buildings insurance'],
  completed: ['Completion statement', 'Updated Land Registry'],
};

export function useMortgageApplications(propertyId?: string) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['mortgage_applications', orgId, propertyId],
    enabled: !!orgId,
    queryFn: async () => {
      let query = supabaseAny
        .from('mortgage_applications')
        .select('*, properties_v2!inner(address_line_1, postcode)')
        .eq('org_id', orgId!);

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((d: any) => ({
        ...d,
        property_address: `${d.properties_v2?.address_line_1}, ${d.properties_v2?.postcode}`,
        properties_v2: undefined,
      })) as MortgageApplicationWithProperty[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      app: Omit<MortgageApplication, 'id' | 'org_id' | 'created_at'>
    ) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('mortgage_applications')
        .insert({ ...app, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as MortgageApplication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mortgage_applications'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create application');
    },
  });
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<MortgageApplication> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('mortgage_applications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as MortgageApplication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mortgage_applications'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update application');
    },
  });
}

export function useRateExpiries() {
  const { data: facilities = [] } = useAllLoanFacilities();

  return useMemo(() => {
    const active = facilities.filter((f) => f.status === 'active');
    const now = Date.now();

    return active
      .map((f) => {
        const expiryMs = f.rate_expiry_date
          ? new Date(f.rate_expiry_date).getTime()
          : null;
        const daysToExpiry =
          expiryMs != null ? Math.ceil((expiryMs - now) / 86_400_000) : null;

        let severity: 'green' | 'amber' | 'red' | 'black';
        if (daysToExpiry == null) {
          severity = 'green';
        } else if (daysToExpiry <= 0) {
          severity = 'black';
        } else if (daysToExpiry <= 90) {
          severity = 'red';
        } else if (daysToExpiry <= 180) {
          severity = 'amber';
        } else {
          severity = 'green';
        }

        const svrPaymentIncrease =
          f.revert_rate != null && f.current_balance > 0
            ? (f.current_balance * (f.revert_rate - f.interest_rate)) / 100 / 12
            : null;

        return { ...f, daysToExpiry, severity, svrPaymentIncrease };
      })
      .sort((a, b) => {
        const order = { black: 0, red: 1, amber: 2, green: 3 };
        if (order[a.severity] !== order[b.severity])
          return order[a.severity] - order[b.severity];
        return (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999);
      });
  }, [facilities]);
}

export interface ComparisonProduct {
  id: string;
  lender: string;
  rate: number;
  termMonths: number;
  arrangementFee: number;
  valuationFee: number;
  legalFee: number;
  brokerFee: number;
}

export interface ComparisonResult extends ComparisonProduct {
  monthlyPayment: number;
  monthlySaving: number;
  totalFees: number;
  breakevenMonth: number;
  totalSavingOverTerm: number;
  effectiveRate: number;
}

export function useRefinanceComparison(
  currentBalance: number,
  currentRate: number,
  currentMonthlyPayment: number,
  products: ComparisonProduct[]
) {
  return useMemo(() => {
    if (!currentBalance || !currentRate || products.length === 0) return [];

    return products.map((p): ComparisonResult => {
      const monthlyRate = p.rate / 100 / 12;
      const monthlyPayment =
        monthlyRate > 0
          ? (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -p.termMonths))
          : currentBalance / p.termMonths;

      const monthlySaving = currentMonthlyPayment - monthlyPayment;
      const totalFees =
        p.arrangementFee + p.valuationFee + p.legalFee + p.brokerFee;
      const breakevenMonth =
        monthlySaving > 0 ? Math.ceil(totalFees / monthlySaving) : Infinity;
      const totalSavingOverTerm = monthlySaving * p.termMonths - totalFees;
      const totalCostOverTerm = monthlyPayment * p.termMonths + totalFees;
      const effectiveRate =
        currentBalance > 0
          ? ((totalCostOverTerm / p.termMonths / currentBalance) * 12 * 100)
          : p.rate;

      return {
        ...p,
        monthlyPayment,
        monthlySaving,
        totalFees,
        breakevenMonth,
        totalSavingOverTerm,
        effectiveRate,
      };
    });
  }, [currentBalance, currentRate, currentMonthlyPayment, products]);
}

export interface StressTestResult {
  rateIncreaseBps: number;
  newRate: number;
  newMonthlyPayment: number;
  monthlyIncrease: number;
  annualIncrease: number;
  newICR: number | null;
}

export function useLoanStressTest(
  facility: LoanFacilityWithDetails | null,
  rateIncreaseBps: number,
  annualRent?: number
) {
  return useMemo((): StressTestResult | null => {
    if (!facility) return null;

    const currentRate = facility.interest_rate;
    const newRate = currentRate + rateIncreaseBps / 100;
    const balance = facility.current_balance;
    const currentPayment = facility.monthly_payment || 0;

    const monthlyRate = newRate / 100 / 12;
    let newMonthlyPayment: number;

    if (facility.interest_only || facility.repayment_type === 'interest_only') {
      newMonthlyPayment = (balance * newRate) / 100 / 12;
    } else {
      const termRemaining = Math.max(
        1,
        Math.ceil(
          (new Date(facility.term_end_date).getTime() - Date.now()) /
            (30 * 86_400_000)
        )
      );
      newMonthlyPayment =
        monthlyRate > 0
          ? (balance * monthlyRate) /
            (1 - Math.pow(1 + monthlyRate, -termRemaining))
          : balance / termRemaining;
    }

    const monthlyIncrease = newMonthlyPayment - currentPayment;
    const annualIncrease = monthlyIncrease * 12;
    const newICR =
      annualRent && newMonthlyPayment > 0
        ? (annualRent / 12 / newMonthlyPayment) * 100
        : null;

    return {
      rateIncreaseBps,
      newRate,
      newMonthlyPayment,
      monthlyIncrease,
      annualIncrease,
      newICR,
    };
  }, [facility, rateIncreaseBps, annualRent]);
}

export function usePortfolioStressTest(rateIncreaseBps: number) {
  const { data: facilities = [] } = useAllLoanFacilities();

  return useMemo(() => {
    const active = facilities.filter((f) => f.status === 'active');
    const currentTotal = active.reduce(
      (s, f) => s + (f.monthly_payment || 0),
      0
    );

    let newTotal = 0;
    for (const f of active) {
      const newRate = f.interest_rate + rateIncreaseBps / 100;
      const balance = f.current_balance;

      if (f.rate_type === 'fixed') {
        newTotal += f.monthly_payment || 0;
        continue;
      }

      if (f.interest_only || f.repayment_type === 'interest_only') {
        newTotal += (balance * newRate) / 100 / 12;
      } else {
        const monthlyRate = newRate / 100 / 12;
        const termRemaining = Math.max(
          1,
          Math.ceil(
            (new Date(f.term_end_date).getTime() - Date.now()) /
              (30 * 86_400_000)
          )
        );
        newTotal +=
          monthlyRate > 0
            ? (balance * monthlyRate) /
              (1 - Math.pow(1 + monthlyRate, -termRemaining))
            : balance / termRemaining;
      }
    }

    return {
      currentMonthly: currentTotal,
      newMonthly: newTotal,
      monthlyIncrease: newTotal - currentTotal,
      annualIncrease: (newTotal - currentTotal) * 12,
      facilityCount: active.length,
      fixedCount: active.filter((f) => f.rate_type === 'fixed').length,
      variableCount: active.filter((f) => f.rate_type !== 'fixed').length,
    };
  }, [facilities, rateIncreaseBps]);
}
