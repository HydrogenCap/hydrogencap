import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';

export interface InsuranceTrackerPolicy {
  id: string;
  property_id: string;
  org_id: string | null;
  policy_type: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  premium_annual: number | null;
  premium_frequency: string | null;
  excess_amount: number | null;
  cover_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean | null;
  document_url: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  property?: {
    id: string;
    address_line: string;
    postcode: string;
  };
}

export interface InsuranceClaim {
  id: string;
  policy_id: string;
  org_id: string;
  property_id: string | null;
  claim_reference: string | null;
  claim_date: string;
  description: string;
  amount_claimed: number | null;
  amount_settled: number | null;
  status: string;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  policy?: {
    insurer_name: string | null;
    policy_number: string | null;
    policy_type: string | null;
  };
  property?: {
    address_line: string;
    postcode: string;
  };
}

export const TRACKER_POLICY_TYPES = [
  { value: 'buildings', label: 'Buildings' },
  { value: 'contents', label: 'Contents' },
  { value: 'landlord_liability', label: 'Landlord Liability' },
  { value: 'rent_guarantee', label: 'Rent Guarantee' },
  { value: 'legal_expenses', label: 'Legal Expenses' },
  { value: 'combined', label: 'Combined' },
  { value: 'other', label: 'Other' },
];

export const CLAIM_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'settled', label: 'Settled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const POLICY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

// --- Policy hooks ---

export function useInsurancePolicies(filters?: {
  propertyId?: string;
  status?: string;
  policyType?: string;
  insurer?: string;
}) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-tracker-policies', orgId, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('insurance_policies')
        .select(`
          *,
          property:properties(id, address_line, postcode)
        `)
        .eq('org_id', orgId!)
        .order('end_date', { ascending: true });

      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.policyType) query = query.eq('policy_type', filters.policyType);
      if (filters?.insurer) query = query.eq('insurer_name', filters.insurer);

      const { data, error } = await query;
      if (error) throw error;
      return data as InsuranceTrackerPolicy[];
    },
    enabled: !!orgId,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (policy: {
      property_id: string;
      policy_type?: string;
      insurer_name?: string;
      policy_number?: string;
      premium_annual?: number;
      premium_frequency?: string;
      excess_amount?: number;
      cover_amount?: number;
      start_date?: string;
      end_date?: string;
      auto_renew?: boolean;
      document_url?: string;
      notes?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('insurance_policies')
        .insert({
          org_id: orgId,
          ...policy,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-policies'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-coverage-gaps'] });
      toast({ title: 'Insurance policy created' });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await (supabase as any)
        .from('insurance_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-policies'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-coverage-gaps'] });
      toast({ title: 'Policy updated' });
    },
  });
}

// --- Claims hooks ---

export function useInsuranceClaims(filters?: { policyId?: string; status?: string }) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-claims', orgId, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('insurance_claims')
        .select(`
          *,
          policy:insurance_policies(insurer_name, policy_number, policy_type),
          property:properties(address_line, postcode)
        `)
        .eq('org_id', orgId!)
        .order('claim_date', { ascending: false });

      if (filters?.policyId) query = query.eq('policy_id', filters.policyId);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as InsuranceClaim[];
    },
    enabled: !!orgId,
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (claim: {
      policy_id: string;
      property_id?: string;
      claim_reference?: string;
      claim_date: string;
      description: string;
      amount_claimed?: number;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('insurance_claims')
        .insert({
          org_id: orgId,
          ...claim,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-stats'] });
      toast({ title: 'Claim submitted' });
    },
  });
}

export function useUpdateClaim() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await (supabase as any)
        .from('insurance_claims')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-tracker-stats'] });
      toast({ title: 'Claim updated' });
    },
  });
}

// --- Analytics hooks ---

export function useInsuranceStats() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-tracker-stats', orgId],
    queryFn: async () => {
      const [policiesRes, claimsRes] = await Promise.all([
        (supabase as any)
          .from('insurance_policies')
          .select('id, premium_annual, status, end_date')
          .eq('org_id', orgId!),
        (supabase as any)
          .from('insurance_claims')
          .select('id, status')
          .eq('org_id', orgId!),
      ]);

      if (policiesRes.error) throw policiesRes.error;
      if (claimsRes.error) throw claimsRes.error;

      const policies = policiesRes.data as Array<{
        id: string;
        premium_annual: number | null;
        status: string | null;
        end_date: string | null;
      }>;
      const claims = claimsRes.data as Array<{ id: string; status: string }>;

      const activePolicies = policies.filter(p => p.status === 'active' || !p.status);
      const totalAnnualPremiums = activePolicies.reduce(
        (sum, p) => sum + (Number(p.premium_annual) || 0),
        0
      );

      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringIn30 = policies.filter(p => {
        if (!p.end_date) return false;
        const end = new Date(p.end_date);
        return end >= now && end <= thirtyDays && p.status !== 'cancelled';
      });

      const openClaims = claims.filter(c =>
        ['submitted', 'under_review', 'approved'].includes(c.status)
      );

      return {
        totalAnnualPremiums,
        activePoliciesCount: activePolicies.length,
        expiringIn30Count: expiringIn30.length,
        openClaimsCount: openClaims.length,
      };
    },
    enabled: !!orgId,
  });
}

export function useExpiringPolicies(days: number = 30) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-expiring', orgId, days],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data, error } = await (supabase as any)
        .from('insurance_policies')
        .select(`
          *,
          property:properties(id, address_line, postcode)
        `)
        .eq('org_id', orgId!)
        .neq('status', 'cancelled')
        .lte('end_date', futureDate.toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: true });

      if (error) throw error;
      return data as InsuranceTrackerPolicy[];
    },
    enabled: !!orgId,
  });
}

export function useCoverageGaps() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-coverage-gaps', orgId],
    queryFn: async () => {
      const [propertiesRes, policiesRes] = await Promise.all([
        (supabase as any)
          .from('properties')
          .select('id, address_line, postcode')
          .eq('org_id', orgId!),
        (supabase as any)
          .from('insurance_policies')
          .select('property_id, policy_type, status')
          .eq('org_id', orgId!)
          .in('status', ['active']),
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (policiesRes.error) throw policiesRes.error;

      const properties = propertiesRes.data as Array<{
        id: string;
        address_line: string;
        postcode: string;
      }>;
      const policies = policiesRes.data as Array<{
        property_id: string;
        policy_type: string | null;
        status: string;
      }>;

      const requiredTypes = ['buildings', 'landlord_liability'];
      const allTypes = TRACKER_POLICY_TYPES.map(t => t.value);

      return properties.map(property => {
        const propertyPolicies = policies.filter(p => p.property_id === property.id);
        const coveredTypes = propertyPolicies.map(p => p.policy_type).filter(Boolean) as string[];
        const missingRequired = requiredTypes.filter(t => !coveredTypes.includes(t));
        const coverage: Record<string, boolean> = {};
        for (const type of allTypes) {
          coverage[type] = coveredTypes.includes(type);
        }

        return {
          ...property,
          coverage,
          missingRequired,
          hasGaps: missingRequired.length > 0,
        };
      });
    },
    enabled: !!orgId,
  });
}
