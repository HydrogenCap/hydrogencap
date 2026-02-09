 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 
 export type MaintenanceUrgency = 'emergency' | 'urgent' | 'normal' | 'low';
 export type MaintenanceStatus = 'new' | 'acknowledged' | 'scheduled' | 'in_progress' | 'completed' | 'closed';
 export type MaintenanceCategory = 'plumbing' | 'electrical' | 'heating' | 'appliance' | 'damp_mould' | 'structural' | 'security' | 'cleaning' | 'garden' | 'other';
 export type UpdateCreatorType = 'manager' | 'tenant' | 'contractor' | 'system';
 
 export interface MaintenanceRequest {
   id: string;
   org_id: string;
   property_id: string;
   room_id: string | null;
   tenant_id: string | null;
   category: MaintenanceCategory;
   title: string;
   description: string;
   location_in_property: string | null;
   urgency: MaintenanceUrgency;
   photos: string[] | null;
   status: MaintenanceStatus;
   contractor_job_id: string | null;
   scheduled_date: string | null;
   completed_at: string | null;
   tenant_rating: number | null;
   tenant_feedback: string | null;
   internal_notes: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface MaintenanceRequestWithDetails extends MaintenanceRequest {
   property: {
     id: string;
     address_line: string;
     postcode: string | null;
   };
   room?: {
     id: string;
     room_name: string;
   } | null;
   tenant?: {
     id: string;
     first_name: string;
     last_name: string;
     email: string | null;
     phone: string | null;
   } | null;
   contractor_job?: {
     id: string;
     status: string;
     contractor_id: string | null;
   } | null;
 }
 
 export interface MaintenanceUpdate {
   id: string;
   request_id: string;
   update_type: string;
   message: string;
   new_status: MaintenanceStatus | null;
   visible_to_tenant: boolean;
   photos: string[] | null;
   created_by: string | null;
   created_by_type: UpdateCreatorType;
   created_at: string;
 }
 
// getUserOrgId replaced by shared import
 
 export function useMaintenanceRequests(filters?: { 
   status?: MaintenanceStatus;
   urgency?: MaintenanceUrgency;
   propertyId?: string;
 }) {
   return useQuery({
     queryKey: ['maintenance_requests', filters],
     queryFn: async () => {
       let query = supabase
         .from('maintenance_requests')
         .select(`
           *,
           property:properties(id, address_line, postcode),
           room:rooms(id, room_name),
           tenant:tenants(id, first_name, last_name, email, phone),
           contractor_job:contractor_jobs(id, status, contractor_id)
         `)
         .order('created_at', { ascending: false });
 
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
       if (filters?.urgency) {
         query = query.eq('urgency', filters.urgency);
       }
       if (filters?.propertyId) {
         query = query.eq('property_id', filters.propertyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as MaintenanceRequestWithDetails[];
     },
   });
 }
 
 export function useOpenMaintenanceRequests() {
   return useQuery({
     queryKey: ['maintenance_requests', 'open'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('maintenance_requests')
         .select(`
           *,
           property:properties(id, address_line, postcode),
           room:rooms(id, room_name),
           tenant:tenants(id, first_name, last_name)
         `)
         .not('status', 'in', '("completed","closed")')
         .order('urgency', { ascending: true })
         .order('created_at', { ascending: true });
 
       if (error) throw error;
       return data as MaintenanceRequestWithDetails[];
     },
   });
 }
 
 export function useMaintenanceRequest(requestId: string) {
   return useQuery({
     queryKey: ['maintenance_requests', requestId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('maintenance_requests')
         .select(`
           *,
           property:properties(id, address_line, postcode),
           room:rooms(id, room_name),
           tenant:tenants(id, first_name, last_name, email, phone),
           contractor_job:contractor_jobs(id, status, contractor_id)
         `)
         .eq('id', requestId)
         .single();
       if (error) throw error;
       return data as MaintenanceRequestWithDetails;
     },
     enabled: !!requestId,
   });
 }
 
 export function useMaintenanceUpdates(requestId: string) {
   return useQuery({
     queryKey: ['maintenance_updates', requestId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('maintenance_updates')
         .select('*')
         .eq('request_id', requestId)
         .order('created_at', { ascending: true });
       if (error) throw error;
       return data as MaintenanceUpdate[];
     },
     enabled: !!requestId,
   });
 }
 
 export function useCreateMaintenanceRequest() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (request: Omit<MaintenanceRequest, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'status' | 'contractor_job_id' | 'completed_at' | 'tenant_rating' | 'tenant_feedback'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data, error } = await supabase
         .from('maintenance_requests')
         .insert({ ...request, org_id: orgId, status: 'new' })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
       toast({ title: 'Maintenance request created' });
     },
     onError: (error) => {
       toast({ title: 'Failed to create request', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useUpdateMaintenanceRequest() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<MaintenanceRequest> & { id: string }) => {
       const { data, error } = await supabase
         .from('maintenance_requests')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
       toast({ title: 'Request updated' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update request', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useAddMaintenanceUpdate() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (update: Omit<MaintenanceUpdate, 'id' | 'created_at' | 'created_by'> & { updateStatus?: boolean }) => {
       const { data: { user } } = await supabase.auth.getUser();
 
       // Insert update
       const { data, error } = await supabase
         .from('maintenance_updates')
         .insert({
           request_id: update.request_id,
           update_type: update.update_type,
           message: update.message,
           new_status: update.new_status,
           visible_to_tenant: update.visible_to_tenant,
           photos: update.photos,
           created_by: user?.id || null,
           created_by_type: update.created_by_type,
         })
         .select()
         .single();
 
       if (error) throw error;
 
       // Update request status if provided
       if (update.new_status && update.updateStatus !== false) {
         await supabase
           .from('maintenance_requests')
           .update({ 
             status: update.new_status,
             completed_at: update.new_status === 'completed' ? new Date().toISOString() : null,
           })
           .eq('id', update.request_id);
       }
 
       return data;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['maintenance_updates', variables.request_id] });
       queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
     },
   });
 }
 
 export function useCreateJobFromRequest() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ requestId, description }: { requestId: string; description?: string }) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       // Get request details
       const { data: request, error: requestError } = await supabase
         .from('maintenance_requests')
         .select('*, property:properties(address_line)')
         .eq('id', requestId)
         .single();
 
       if (requestError) throw requestError;
 
       // Create contractor job
       const { data: job, error: jobError } = await supabase
         .from('contractor_jobs')
         .insert({
           org_id: orgId,
           property_id: request.property_id,
           job_type: request.category,
           description: description || `${request.title}: ${request.description}`,
           status: 'draft',
           source: 'maintenance_request',
           priority: request.urgency === 'emergency' ? 'urgent' : request.urgency,
         })
         .select()
         .single();
 
       if (jobError) throw jobError;
 
       // Link job to request
       await supabase
         .from('maintenance_requests')
         .update({ contractor_job_id: job.id })
         .eq('id', requestId);
 
       return job;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
       queryClient.invalidateQueries({ queryKey: ['contractor_jobs'] });
       toast({ title: 'Job created from maintenance request' });
     },
     onError: (error) => {
       toast({ title: 'Failed to create job', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useMaintenanceStats() {
   const { data: requests } = useMaintenanceRequests();
 
   if (!requests) return null;
 
   return {
     total: requests.length,
     new: requests.filter(r => r.status === 'new').length,
     inProgress: requests.filter(r => ['acknowledged', 'scheduled', 'in_progress'].includes(r.status)).length,
     completed: requests.filter(r => r.status === 'completed').length,
     emergency: requests.filter(r => r.urgency === 'emergency' && !['completed', 'closed'].includes(r.status)).length,
     urgent: requests.filter(r => r.urgency === 'urgent' && !['completed', 'closed'].includes(r.status)).length,
   };
 }