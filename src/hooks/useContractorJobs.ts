 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface ContractorJob {
   id: string;
   org_id: string;
   property_id: string;
   compliance_item_id: string | null;
   contractor_id: string | null;
   job_type: string;
   description: string | null;
   status: 'draft' | 'requested' | 'quoted' | 'accepted' | 'booked' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
   requested_at: string | null;
   quoted_at: string | null;
   accepted_at: string | null;
   booked_date: string | null;
   booked_time_slot: string | null;
   completed_at: string | null;
   quoted_amount_gbp: number | null;
   final_amount_gbp: number | null;
   payment_status: 'unpaid' | 'invoiced' | 'paid';
   invoice_reference: string | null;
   request_message: string | null;
   contractor_notes: string | null;
   internal_notes: string | null;
   created_at: string;
   updated_at: string;
   contractor?: {
     id: string;
     name: string;
     company_name: string | null;
     email: string | null;
     phone: string | null;
   };
   property?: {
     id: string;
     address_line: string;
     postcode: string;
   };
   compliance_item?: {
     id: string;
     compliance_type: string;
     expiry_date: string | null;
   };
 }
 
 export interface MatchingContractor {
   contractor_id: string;
   name: string;
   company_name: string | null;
   email: string | null;
   phone: string | null;
   average_rating: number;
   total_jobs: number;
   typical_cost: number | null;
   match_score: number;
 }
 
 export function useContractorJobs(filters?: {
   status?: string[];
   propertyId?: string;
   contractorId?: string;
 }) {
   return useQuery({
     queryKey: ['contractor-jobs', filters],
     queryFn: async () => {
       let query = supabase
         .from('contractor_jobs')
         .select(`
           *,
           contractor:contractors(id, name, company_name, email, phone),
           property:properties(id, address_line, postcode),
           compliance_item:compliance_items(id, compliance_type, expiry_date)
         `)
         .order('created_at', { ascending: false });
 
       if (filters?.status?.length) {
         query = query.in('status', filters.status);
       }
       if (filters?.propertyId) {
         query = query.eq('property_id', filters.propertyId);
       }
       if (filters?.contractorId) {
         query = query.eq('contractor_id', filters.contractorId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as ContractorJob[];
     },
   });
 }
 
 export function useContractorJob(jobId: string | undefined) {
   return useQuery({
     queryKey: ['contractor-job', jobId],
     queryFn: async () => {
       if (!jobId) return null;
 
       const { data, error } = await supabase
         .from('contractor_jobs')
         .select(`
           *,
           contractor:contractors(*),
           property:properties(id, address_line, postcode),
           compliance_item:compliance_items(id, compliance_type, expiry_date)
         `)
         .eq('id', jobId)
         .single();
 
       if (error) throw error;
       return data as ContractorJob;
     },
     enabled: !!jobId,
   });
 }
 
 export function useJobsCalendar(startDate: Date, endDate: Date) {
   return useQuery({
     queryKey: ['contractor-jobs-calendar', startDate.toISOString(), endDate.toISOString()],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('contractor_jobs')
         .select(`
           id,
           job_type,
           status,
           booked_date,
           booked_time_slot,
           contractor:contractors(name),
           property:properties(address_line)
         `)
         .gte('booked_date', startDate.toISOString().split('T')[0])
         .lte('booked_date', endDate.toISOString().split('T')[0])
         .not('booked_date', 'is', null);
 
       if (error) throw error;
       return data;
     },
   });
 }
 
 export function useMatchingContractors(complianceType: string, postcode: string) {
   return useQuery({
     queryKey: ['matching-contractors', complianceType, postcode],
     queryFn: async () => {
       const { data: membership } = await supabase
         .from('memberships')
         .select('org_id')
         .limit(1)
         .single();
 
       if (!membership) return [];
 
       const { data, error } = await supabase
         .rpc('find_matching_contractors', {
           p_org_id: membership.org_id,
           p_compliance_type: complianceType,
           p_postcode: postcode,
         });
 
       if (error) throw error;
       return data as MatchingContractor[];
     },
     enabled: !!complianceType && !!postcode,
   });
 }
 
 export function useCreateJob() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (job: {
       propertyId: string;
       complianceItemId?: string;
       contractorId?: string;
       jobType: string;
       description?: string;
       requestMessage?: string;
     }) => {
       const { data: membership } = await supabase
         .from('memberships')
         .select('org_id')
         .limit(1)
         .single();
 
       const { data: { user } } = await supabase.auth.getUser();
 
       const { data, error } = await supabase
         .from('contractor_jobs')
         .insert({
           org_id: membership!.org_id,
           property_id: job.propertyId,
           compliance_item_id: job.complianceItemId || null,
           contractor_id: job.contractorId || null,
           job_type: job.jobType,
           description: job.description || null,
           request_message: job.requestMessage || null,
           status: 'draft',
           created_by: user?.id,
         })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       toast({ title: 'Job created' });
     },
   });
 }
 
 export function useUpdateJob() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<ContractorJob> & { id: string }) => {
       const { data, error } = await supabase
         .from('contractor_jobs')
         .update({ ...updates, updated_at: new Date().toISOString() })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       queryClient.invalidateQueries({ queryKey: ['contractor-job', data.id] });
       toast({ title: 'Job updated' });
     },
   });
 }
 
 export function useSendJobRequest() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ jobId, customMessage }: { jobId: string; customMessage?: string }) => {
       const { data, error } = await supabase.functions.invoke('send-job-request', {
         body: { jobId, customMessage },
       });
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       toast({
         title: 'Request sent',
         description: `Job request sent to ${data.sentTo}`,
       });
     },
     onError: (error: any) => {
       toast({
         title: 'Failed to send',
         description: error.message,
         variant: 'destructive',
       });
     },
   });
 }
 
 export function useBookJob() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({
       jobId,
       bookedDate,
       bookedTimeSlot,
       quotedAmount,
     }: {
       jobId: string;
       bookedDate: string;
       bookedTimeSlot?: string;
       quotedAmount?: number;
     }) => {
       const { error } = await supabase
         .from('contractor_jobs')
         .update({
           status: 'booked',
           booked_date: bookedDate,
           booked_time_slot: bookedTimeSlot || null,
           quoted_amount_gbp: quotedAmount || null,
           accepted_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
         })
         .eq('id', jobId);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       toast({ title: 'Job booked' });
     },
   });
 }
 
 export function useCompleteJob() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({
       jobId,
       finalAmount,
       notes,
     }: {
       jobId: string;
       finalAmount?: number;
       notes?: string;
     }) => {
       const { error } = await supabase
         .from('contractor_jobs')
         .update({
           status: 'completed',
           completed_at: new Date().toISOString(),
           final_amount_gbp: finalAmount || null,
           contractor_notes: notes || null,
           updated_at: new Date().toISOString(),
         })
         .eq('id', jobId);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       toast({ title: 'Job marked as completed' });
     },
   });
 }