 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export type JobStatus = 'draft' | 'requested' | 'quoted' | 'accepted' | 'booked' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
 export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
 export type JobSource = 'manual' | 'auto_compliance' | 'auto_rate_expiry';
 
export interface ContractorJob {
  id: string;
  org_id: string;
  property_id: string | null;
  property_v2_id: string | null;
  compliance_item_id: string | null;
  contractor_id: string | null;
  job_type: string;
  description: string | null;
  status: JobStatus;
  source: JobSource;
  priority: JobPriority;
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
  auto_created_at: string | null;
  // Certificate tracking
  certificate_received: boolean;
  certificate_received_at: string | null;
  certificate_document_id: string | null;
  certificate_reminder_sent_at: string | null;
  certificate_reminder_count: number;
  // Follow-up tracking
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_date: string | null;
  response_deadline: string | null;
  // Inbox email
  inbox_email: string | null;
  inbox_email_token: string | null;
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
  } | null;
  property_v2?: {
    id: string;
    address_line_1: string;
    city: string;
    postcode: string;
  } | null;
  compliance_item?: {
    id: string;
    compliance_type: string;
    expiry_date: string | null;
  };
}
 
 export const JOB_STATUSES: { value: JobStatus; label: string; color: string }[] = [
   { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
   { value: 'requested', label: 'Requested', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
   { value: 'quoted', label: 'Quoted', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
   { value: 'accepted', label: 'Accepted', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
   { value: 'booked', label: 'Booked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
   { value: 'in_progress', label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
   { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
   { value: 'verified', label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
   { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
 ];
 
 export const JOB_PRIORITIES: { value: JobPriority; label: string; color: string }[] = [
   { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
   { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
   { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
   { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
 ];
 
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
  status?: JobStatus[];
  priority?: JobPriority[];
  source?: JobSource[];
  propertyId?: string;
  contractorId?: string;
  hasContractor?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page;
  const pageSize = filters?.pageSize ?? 25;

  return useQuery({
    queryKey: ['contractor-jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('contractor_jobs')
        .select(`
          *,
          contractor:contractors(id, name, company_name, email, phone),
          property:properties(id, address_line, postcode),
          property_v2:properties_v2(id, address_line_1, city, postcode),
          compliance_item:compliance_items!contractor_jobs_compliance_item_id_fkey(id, compliance_type, expiry_date)
        `, { count: 'exact' })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters?.priority?.length) {
        query = query.in('priority', filters.priority);
      }
      if (filters?.source?.length) {
        query = query.in('source', filters.source);
      }
      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.contractorId) {
        query = query.eq('contractor_id', filters.contractorId);
      }
      if (filters?.hasContractor === true) {
        query = query.not('contractor_id', 'is', null);
      }
      if (filters?.hasContractor === false) {
        query = query.is('contractor_id', null);
      }

      if (page) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const items = (data ?? []) as ContractorJob[];
      const total = count ?? items.length;
      return {
        items,
        total,
        page: page ?? 1,
        pageSize: page ? pageSize : total || 1,
        totalPages: page ? Math.ceil(total / pageSize) : 1,
      };
    },
  });
}
 
 // Get job counts by status for dashboard widgets
 export function useJobCounts() {
   return useQuery({
     queryKey: ['job-counts'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('contractor_jobs')
         .select('status, priority, contractor_id')
         .not('status', 'in', '("completed","verified","cancelled")');
 
       if (error) throw error;
 
       const counts = {
         total: data.length,
         draft: data.filter(j => j.status === 'draft').length,
         needsContractor: data.filter(j => j.status === 'draft' && !j.contractor_id).length,
         awaitingResponse: data.filter(j => j.status === 'requested').length,
         booked: data.filter(j => j.status === 'booked').length,
         urgent: data.filter(j => j.priority === 'urgent').length,
         high: data.filter(j => j.priority === 'high').length,
       };
 
       return counts;
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
          property_v2:properties_v2(id, address_line_1, city, postcode),
          compliance_item:compliance_items!contractor_jobs_compliance_item_id_fkey(id, compliance_type, expiry_date)
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
      propertyId?: string;
      propertyV2Id?: string;
      complianceItemId?: string;
      contractorId?: string;
      jobType: string;
      description?: string;
      requestMessage?: string;
     priority?: JobPriority;
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
            property_id: job.propertyId || null,
            property_v2_id: job.propertyV2Id || null,
            compliance_item_id: job.complianceItemId || null,
            contractor_id: job.contractorId || null,
            job_type: job.jobType,
            description: job.description || null,
            request_message: job.requestMessage || null,
            status: 'draft',
           source: 'manual',
           priority: job.priority || 'normal',
            created_by: user?.id,
          })
          .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
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
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
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
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
       toast({
         title: 'Request sent',
         description: `Job request sent to ${data.sentTo}`,
       });
     },
     onError: (error) => {
        toast({
          title: 'Failed to send',
          description: error instanceof Error ? error.message : 'Failed to send job request',
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
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
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
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
       toast({ title: 'Job marked as completed' });
     },
   });
 }
 
 // Assign contractor to job
 export function useAssignContractor() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ jobId, contractorId }: { jobId: string; contractorId: string }) => {
       const { error } = await supabase
         .from('contractor_jobs')
         .update({ 
           contractor_id: contractorId,
           updated_at: new Date().toISOString(),
         })
         .eq('id', jobId);
 
       if (error) throw error;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       queryClient.invalidateQueries({ queryKey: ['contractor-job', variables.jobId] });
       queryClient.invalidateQueries({ queryKey: ['job-counts'] });
       toast({ title: 'Contractor assigned' });
     },
   });
 }
 
 // Cancel job
 export function useCancelJob() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ jobId, reason }: { jobId: string; reason?: string }) => {
       const { error } = await supabase
         .from('contractor_jobs')
         .update({
           status: 'cancelled',
           internal_notes: reason ? `Cancelled: ${reason}` : 'Cancelled by user',
           updated_at: new Date().toISOString(),
         })
         .eq('id', jobId);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       queryClient.invalidateQueries({ queryKey: ['job-counts'] });
       toast({ title: 'Job cancelled' });
     },
   });
 }
 
 // Run auto-job creation manually
 export function useRunAutoJobCreation() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async () => {
       const { data, error } = await supabase.functions.invoke('create-compliance-jobs');
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
       queryClient.invalidateQueries({ queryKey: ['job-counts'] });
       toast({
         title: 'Auto-job creation complete',
         description: `Created ${data.jobs_created} new jobs, updated ${data.priorities_updated} priorities`,
       });
     },
   });
 }
