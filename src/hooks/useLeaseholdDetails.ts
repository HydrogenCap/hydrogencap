import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { toast } from "sonner";

export interface LeaseholdDetails {
  id: string;
  property_id: string;
  org_id: string;
  ground_rent_annual: number | null;
  ground_rent_review_date: string | null;
  ground_rent_escalation: string | null;
  ground_rent_escalation_detail: string | null;
  service_charge_annual: number | null;
  service_charge_review_date: string | null;
  managing_agent: string | null;
  managing_agent_phone: string | null;
  managing_agent_email: string | null;
  lease_start_date: string | null;
  original_term_years: number | null;
  original_lease_years: number | null;
  remaining_years: number | null;
  ground_rent: number | null;
  ground_rent_frequency: string | null;
  service_charge: number | null;
  service_charge_frequency: string | null;
  management_company: string | null;
  freeholder_name: string | null;
  freeholder_contact: string | null;
  lease_extension_eligible: boolean | null;
  estimated_extension_cost: number | null;
  next_review_date: string | null;
  section_20_notices_pending: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeaseholdDetails(propertyId?: string) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['leasehold-details', orgId, propertyId],
    queryFn: async () => {
      if (!propertyId || !orgId) return null;
      const { data, error } = await supabaseAny
        .from('leasehold_details')
        .select('*')
        .eq('org_id', orgId)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data as LeaseholdDetails | null;
    },
    enabled: !!propertyId && !!orgId,
  });
}

export function useUpdateLeaseholdDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (details: {
      propertyId: string;
      groundRentAnnual?: number;
      groundRentReviewDate?: string;
      groundRentEscalation?: string;
      groundRentEscalationDetail?: string;
      serviceChargeAnnual?: number;
      serviceChargeReviewDate?: string;
      managingAgent?: string;
      managingAgentPhone?: string;
      managingAgentEmail?: string;
      leaseStartDate?: string;
      originalTermYears?: number;
      originalLeaseYears?: number;
      remainingYears?: number;
      groundRent?: number;
      groundRentFrequency?: string;
      serviceCharge?: number;
      serviceChargeFrequency?: string;
      managementCompany?: string;
      freeholderName?: string;
      freeholderContact?: string;
      leaseExtensionEligible?: boolean;
      estimatedExtensionCost?: number;
      nextReviewDate?: string;
      section20NoticesPending?: boolean;
      notes?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('leasehold_details')
        .upsert({
          property_id: details.propertyId,
          org_id: orgId,
          ground_rent_annual: details.groundRentAnnual ?? null,
          ground_rent_review_date: details.groundRentReviewDate ?? null,
          ground_rent_escalation: details.groundRentEscalation ?? null,
          ground_rent_escalation_detail: details.groundRentEscalationDetail ?? null,
          service_charge_annual: details.serviceChargeAnnual ?? null,
          service_charge_review_date: details.serviceChargeReviewDate ?? null,
          managing_agent: details.managingAgent ?? null,
          managing_agent_phone: details.managingAgentPhone ?? null,
          managing_agent_email: details.managingAgentEmail ?? null,
          lease_start_date: details.leaseStartDate ?? null,
          original_term_years: details.originalTermYears ?? null,
          original_lease_years: details.originalLeaseYears ?? null,
          remaining_years: details.remainingYears ?? null,
          ground_rent: details.groundRent ?? null,
          ground_rent_frequency: details.groundRentFrequency ?? null,
          service_charge: details.serviceCharge ?? null,
          service_charge_frequency: details.serviceChargeFrequency ?? null,
          management_company: details.managementCompany ?? null,
          freeholder_name: details.freeholderName ?? null,
          freeholder_contact: details.freeholderContact ?? null,
          lease_extension_eligible: details.leaseExtensionEligible ?? null,
          estimated_extension_cost: details.estimatedExtensionCost ?? null,
          next_review_date: details.nextReviewDate ?? null,
          section_20_notices_pending: details.section20NoticesPending ?? false,
          notes: details.notes ?? null,
        }, { onConflict: 'property_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['leasehold-details'] });
      toast.success('Leasehold details saved');
    },
  });
}

// Keep old name as alias for backwards compatibility with existing code
export const useUpsertLeaseholdDetails = useUpdateLeaseholdDetails;

export interface LeaseholdAlert {
  propertyId: string;
  addressLine1: string;
  city: string;
  remainingYears: number | null;
  leaseYearsRemaining: number | null;
  groundRentReviewDate: string | null;
  groundRentEscalation: string | null;
  alertType: 'short_lease' | 'ground_rent_review';
}

export function useLeaseholdAlerts() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['leasehold-alerts', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // Fetch all leasehold details for the org
      const { data: leaseholds, error: lError } = await supabaseAny
        .from('leasehold_details')
        .select('*')
        .eq('org_id', orgId);

      if (lError) throw lError;

      // Fetch all properties to get addresses and lease_years_remaining
      const { data: properties, error: pError } = await supabaseAny
        .from('properties_v2')
        .select('id, address_line_1, city, org_id')
        .eq('org_id', orgId);

      if (pError) throw pError;

      // Also check V1 properties for lease_years_remaining
      const { data: v1Props, error: v1Error } = await supabaseAny
        .from('properties')
        .select('id, lease_years_remaining')
        .eq('org_id', orgId);

      if (v1Error) throw v1Error;

      type PropertyV2Row = { id: string; address_line_1: string; city: string; org_id: string };
      type V1PropertyRow = { id: string; lease_years_remaining: number | null };
      const propMap = new Map(((properties ?? []) as PropertyV2Row[]).map((p) => [p.id, p]));
      const v1Map = new Map(((v1Props ?? []) as V1PropertyRow[]).map((p) => [p.id, p.lease_years_remaining]));

      const alerts: LeaseholdAlert[] = [];
      const now = new Date();
      const twelveMonths = new Date(now);
      twelveMonths.setMonth(twelveMonths.getMonth() + 12);

      for (const ld of (leaseholds ?? [])) {
        const prop = propMap.get(ld.property_id);
        if (!prop) continue;

        const remainingYears = ld.remaining_years ?? v1Map.get(ld.property_id) ?? null;

        // Short lease alert (below 80 years)
        if (remainingYears !== null && remainingYears < 80) {
          alerts.push({
            propertyId: ld.property_id,
            addressLine1: prop.address_line_1,
            city: prop.city,
            remainingYears,
            leaseYearsRemaining: remainingYears,
            groundRentReviewDate: ld.ground_rent_review_date,
            groundRentEscalation: ld.ground_rent_escalation,
            alertType: 'short_lease',
          });
        }

        // Ground rent review in next 12 months
        if (ld.ground_rent_review_date) {
          const reviewDate = new Date(ld.ground_rent_review_date);
          if (reviewDate >= now && reviewDate <= twelveMonths) {
            alerts.push({
              propertyId: ld.property_id,
              addressLine1: prop.address_line_1,
              city: prop.city,
              remainingYears,
              leaseYearsRemaining: remainingYears,
              groundRentReviewDate: ld.ground_rent_review_date,
              groundRentEscalation: ld.ground_rent_escalation,
              alertType: 'ground_rent_review',
            });
          }
        }
      }

      return alerts;
    },
    enabled: !!orgId,
  });
}
