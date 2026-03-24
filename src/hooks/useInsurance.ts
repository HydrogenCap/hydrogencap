 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { fetchUserOrgId, useUserOrg } from './useUserOrg';
 
 export interface InsurancePolicy {
   id: string;
   property_id: string;
   insurer_name: string;
   policy_number: string | null;
   policy_type: string | null;
   start_date: string | null;
   renewal_date: string;
   cover_type: string | null;
   premium_gbp: number;
   excess_gbp: number | null;
   payment_frequency: string | null;
   auto_renew: boolean | null;
   buildings_cover_gbp: number | null;
   contents_cover_gbp: number | null;
   status: string | null;
   notes: string | null;
   created_at: string;
   updated_at: string;
   // Joined
   property?: {
     address_line: string;
     postcode: string;
   };
 }
 
 export const POLICY_TYPES = [
   { value: 'buildings', label: 'Buildings Only' },
   { value: 'contents', label: 'Contents Only' },
   { value: 'buildings_contents', label: 'Buildings & Contents' },
   { value: 'landlord', label: 'Landlord Insurance' },
   { value: 'rent_guarantee', label: 'Rent Guarantee' },
   { value: 'legal_expenses', label: 'Legal Expenses' },
   { value: 'hmo_specialist', label: 'HMO Specialist' },
   { value: 'other', label: 'Other' },
 ];
 
 // Get all policies
export function useInsurancePolicies(filters?: {
  propertyId?: string;
  status?: string;
}) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['insurance-policies', orgId, filters],
    queryFn: async () => {
      let query = supabase
        .from('insurance_policies')
        .select(`
           *,
           property:properties(address_line, postcode)
         `)
        .eq('org_id', orgId!)
        .order('renewal_date', { ascending: true });
 
       if (filters?.propertyId) {
         query = query.eq('property_id', filters.propertyId);
       }
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as InsurancePolicy[];
     },
     enabled: !!orgId,
   });
 }

 // Get insurance totals
 export function useInsuranceTotals() {
   const { data: orgId } = useUserOrg();

   return useQuery({
     queryKey: ['insurance-totals', orgId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('insurance_policies')
         .select('premium_gbp, status')
         .eq('org_id', orgId!)
         .or('status.eq.active,status.is.null');
 
       if (error) throw error;
 
       const totalAnnual = data.reduce((sum, p) => sum + (Number(p.premium_gbp) || 0), 0);
 
       return {
         total_annual: totalAnnual,
         total_monthly: Math.round(totalAnnual / 12),
         policy_count: data.length,
       };
     },
     enabled: !!orgId,
   });
 }

 // Get single policy
 export function useInsurancePolicy(policyId: string | undefined) {
   const { data: orgId } = useUserOrg();

   return useQuery({
     queryKey: ['insurance-policy', orgId, policyId],
     queryFn: async () => {
       if (!policyId || !orgId) return null;

       const { data, error } = await supabase
         .from('insurance_policies')
         .select(`
           *,
           property:properties(address_line, postcode)
         `)
         .eq('org_id', orgId)
         .eq('id', policyId)
         .single();
 
       if (error) throw error;
       return data as InsurancePolicy;
     },
     enabled: !!policyId && !!orgId,
   });
 }
 
 // Create policy
 export function useCreateInsurancePolicy() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (policy: {
       propertyId: string;
       insurerName: string;
       policyNumber?: string;
       policyType?: string;
       coverType?: string;
       startDate?: string;
       renewalDate: string;
       premiumGbp: number;
       excessGbp?: number;
       paymentFrequency?: string;
       autoRenew?: boolean;
       buildingsCoverGbp?: number;
       contentsCoverGbp?: number;
       notes?: string;
     }) => {
        const orgId = await fetchUserOrgId();
        const { data, error } = await supabase
          .from('insurance_policies')
          .insert({
            org_id: orgId,
            property_id: policy.propertyId,
            insurer_name: policy.insurerName,
            policy_number: policy.policyNumber || null,
            policy_type: policy.policyType || 'landlord',
            cover_type: policy.coverType || null,
            start_date: policy.startDate || null,
            renewal_date: policy.renewalDate,
            premium_gbp: policy.premiumGbp,
            excess_gbp: policy.excessGbp || null,
            payment_frequency: policy.paymentFrequency || 'annual',
            auto_renew: policy.autoRenew || false,
            buildings_cover_gbp: policy.buildingsCoverGbp || null,
            contents_cover_gbp: policy.contentsCoverGbp || null,
            notes: policy.notes || null,
            status: 'active',
          })
          .select()
          .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
       queryClient.invalidateQueries({ queryKey: ['insurance-totals'] });
       toast({ title: 'Insurance policy added' });
     },
   });
 }
 
 // Update policy
 export function useUpdateInsurancePolicy() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<InsurancePolicy> & { id: string }) => {
       const { data, error } = await supabase
         .from('insurance_policies')
         .update({ ...updates, updated_at: new Date().toISOString() })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
       queryClient.invalidateQueries({ queryKey: ['insurance-policy', data.id] });
       queryClient.invalidateQueries({ queryKey: ['insurance-totals'] });
       toast({ title: 'Policy updated' });
     },
   });
 }
 
 // Delete policy
 export function useDeleteInsurancePolicy() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (policyId: string) => {
       const { error } = await supabase
         .from('insurance_policies')
         .delete()
         .eq('id', policyId);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
       queryClient.invalidateQueries({ queryKey: ['insurance-totals'] });
       toast({ title: 'Policy deleted' });
     },
   });
 }
