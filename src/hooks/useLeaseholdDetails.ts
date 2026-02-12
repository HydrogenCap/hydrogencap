import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export interface LeaseholdDetails {
  id: string;
  property_id: string;
  org_id: string;
  ground_rent_annual: number | null;
  ground_rent_review_date: string | null;
  ground_rent_escalation: string | null;
  service_charge_annual: number | null;
  service_charge_review_date: string | null;
  managing_agent: string | null;
  managing_agent_phone: string | null;
  managing_agent_email: string | null;
  lease_start_date: string | null;
  original_term_years: number | null;
  next_review_date: string | null;
  section_20_notices_pending: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeaseholdDetails(propertyId?: string) {
  return useQuery({
    queryKey: ['leasehold-details', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from('leasehold_details')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data as LeaseholdDetails | null;
    },
    enabled: !!propertyId,
  });
}

export function useUpsertLeaseholdDetails() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (details: {
      propertyId: string;
      groundRentAnnual?: number;
      groundRentReviewDate?: string;
      groundRentEscalation?: string;
      serviceChargeAnnual?: number;
      serviceChargeReviewDate?: string;
      managingAgent?: string;
      managingAgentPhone?: string;
      managingAgentEmail?: string;
      leaseStartDate?: string;
      originalTermYears?: number;
      nextReviewDate?: string;
      section20NoticesPending?: boolean;
      notes?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('leasehold_details')
        .upsert({
          property_id: details.propertyId,
          org_id: orgId,
          ground_rent_annual: details.groundRentAnnual ?? null,
          ground_rent_review_date: details.groundRentReviewDate ?? null,
          ground_rent_escalation: details.groundRentEscalation ?? null,
          service_charge_annual: details.serviceChargeAnnual ?? null,
          service_charge_review_date: details.serviceChargeReviewDate ?? null,
          managing_agent: details.managingAgent ?? null,
          managing_agent_phone: details.managingAgentPhone ?? null,
          managing_agent_email: details.managingAgentEmail ?? null,
          lease_start_date: details.leaseStartDate ?? null,
          original_term_years: details.originalTermYears ?? null,
          next_review_date: details.nextReviewDate ?? null,
          section_20_notices_pending: details.section20NoticesPending ?? false,
          notes: details.notes ?? null,
        }, { onConflict: 'property_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leasehold-details', data.property_id] });
      toast({ title: 'Leasehold details saved' });
    },
  });
}
