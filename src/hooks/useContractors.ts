 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface Contractor {
   id: string;
   org_id: string;
   name: string;
   company_name: string | null;
   email: string | null;
   phone: string | null;
   website: string | null;
   compliance_types: string[];
   service_areas: string[] | null;
   notes: string | null;
   is_preferred: boolean;
   is_active: boolean;
   average_rating: number;
   total_jobs: number;
   avg_response_hours: number | null;
   hourly_rate_gbp: number | null;
   call_out_fee_gbp: number | null;
   typical_costs: Record<string, number>;
   availability_notes: string | null;
   last_used_at: string | null;
 }
 
 export interface ContractorReview {
   id: string;
   contractor_id: string;
   job_id: string | null;
   rating: number;
   review_text: string | null;
   punctuality_rating: number | null;
   quality_rating: number | null;
   value_rating: number | null;
   communication_rating: number | null;
   created_at: string;
   reviewed_by: string | null;
 }
 
 export function useContractors(filters?: {
   complianceType?: string;
   isActive?: boolean;
   isPreferred?: boolean;
 }) {
   return useQuery({
     queryKey: ['contractors', filters],
     queryFn: async () => {
       let query = supabase
         .from('contractors')
         .select('*')
         .order('is_preferred', { ascending: false })
         .order('average_rating', { ascending: false, nullsFirst: false })
         .order('name');
 
       if (filters?.complianceType) {
         query = query.contains('compliance_types', [filters.complianceType]);
       }
       if (filters?.isActive !== undefined) {
         query = query.eq('is_active', filters.isActive);
       }
       if (filters?.isPreferred !== undefined) {
         query = query.eq('is_preferred', filters.isPreferred);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Contractor[];
     },
   });
 }
 
 export function useContractor(contractorId: string | undefined) {
   return useQuery({
     queryKey: ['contractor', contractorId],
     queryFn: async () => {
       if (!contractorId) return null;
 
       const { data, error } = await supabase
         .from('contractors')
         .select('*')
         .eq('id', contractorId)
         .single();
 
       if (error) throw error;
       return data as Contractor;
     },
     enabled: !!contractorId,
   });
 }
 
 export function useContractorReviews(contractorId: string | undefined) {
   return useQuery({
     queryKey: ['contractor-reviews', contractorId],
     queryFn: async () => {
       if (!contractorId) return [];
 
       const { data, error } = await supabase
         .from('contractor_reviews')
         .select('*')
         .eq('contractor_id', contractorId)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
       return data as ContractorReview[];
     },
     enabled: !!contractorId,
   });
 }
 
 export function useContractorJobHistory(contractorId: string | undefined) {
   return useQuery({
     queryKey: ['contractor-job-history', contractorId],
     queryFn: async () => {
       if (!contractorId) return [];
 
       const { data, error } = await supabase
         .from('contractor_jobs')
         .select(`
           id,
           job_type,
           status,
           booked_date,
           completed_at,
           final_amount_gbp,
           property:properties(address_line)
         `)
         .eq('contractor_id', contractorId)
         .in('status', ['completed', 'verified'])
         .order('completed_at', { ascending: false })
         .limit(20);
 
       if (error) throw error;
       return data;
     },
     enabled: !!contractorId,
   });
 }
 
 export function useCreateContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (contractor: Omit<Contractor, 'id' | 'org_id' | 'average_rating' | 'total_jobs' | 'last_used_at'>) => {
       const { data: membership } = await supabase
         .from('memberships')
         .select('org_id')
         .limit(1)
         .single();
 
       const { data, error } = await supabase
         .from('contractors')
         .insert({ ...contractor, org_id: membership!.org_id })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       toast({ title: 'Contractor added' });
     },
   });
 }
 
 export function useUpdateContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Contractor> & { id: string }) => {
       const { data, error } = await supabase
         .from('contractors')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       queryClient.invalidateQueries({ queryKey: ['contractor', data.id] });
       toast({ title: 'Contractor updated' });
     },
   });
 }
 
 export function useAddContractorReview() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (review: {
       contractorId: string;
       jobId?: string;
       rating: number;
       reviewText?: string;
       punctualityRating?: number;
       qualityRating?: number;
       valueRating?: number;
       communicationRating?: number;
     }) => {
       const { data: membership } = await supabase
         .from('memberships')
         .select('org_id')
         .limit(1)
         .single();
 
       const { data: { user } } = await supabase.auth.getUser();
 
       const { data, error } = await supabase
         .from('contractor_reviews')
         .insert({
           org_id: membership!.org_id,
           contractor_id: review.contractorId,
           job_id: review.jobId || null,
           rating: review.rating,
           review_text: review.reviewText || null,
           punctuality_rating: review.punctualityRating || null,
           quality_rating: review.qualityRating || null,
           value_rating: review.valueRating || null,
           communication_rating: review.communicationRating || null,
           reviewed_by: user?.id,
         })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       queryClient.invalidateQueries({ queryKey: ['contractor-reviews', data.contractor_id] });
       toast({ title: 'Review added' });
     },
   });
 }
 
 export function useDeleteContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('contractors')
         .delete()
         .eq('id', id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractors'] });
       toast({ title: 'Contractor removed' });
     },
   });
 }