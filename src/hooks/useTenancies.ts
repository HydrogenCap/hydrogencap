 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 
 export type TenancyStatus = 'pending' | 'active' | 'notice' | 'ended';
 
export type PaymentMethod = 'bank_transfer' | 'standing_order' | 'direct_debit' | 'cash' | 'cheque';

export interface Tenancy {
  id: string;
  org_id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount_pcm: number;
  rent_due_day: number;
  deposit_amount: number | null;
  deposit_scheme: string | null;
  deposit_reference: string | null;
  deposit_protected_date: string | null;
  tenancy_agreement_url: string | null;
  status: TenancyStatus;
  notice_date: string | null;
  notice_period_weeks: number;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
 
 export interface TenancyWithDetails extends Tenancy {
   tenant: {
     id: string;
     first_name: string;
     last_name: string;
     email: string | null;
     phone: string | null;
   };
   room: {
     id: string;
     room_name: string;
     room_type: string;
   };
   property: {
     id: string;
     address_line: string;
     postcode: string | null;
   };
 }
 
// getUserOrgId replaced by shared import
 
 export function useTenancies(filters?: { status?: TenancyStatus; tenantId?: string; propertyId?: string }) {
   return useQuery({
     queryKey: ['tenancies', filters],
     queryFn: async () => {
       let query = (supabase as any)
         .from('tenancies')
         .select(`
           *,
           tenant:tenants(id, first_name, last_name, email, phone),
           room:rooms(id, room_name, room_type),
           property:properties(id, address_line, postcode)
         `)
         .order('start_date', { ascending: false });
 
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
       if (filters?.tenantId) {
         query = query.eq('tenant_id', filters.tenantId);
       }
       if (filters?.propertyId) {
         query = query.eq('property_id', filters.propertyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as TenancyWithDetails[];
     },
   });
 }
 
 export function useTenancy(tenancyId: string) {
   return useQuery({
     queryKey: ['tenancies', tenancyId],
     queryFn: async () => {
       const { data, error } = await (supabase as any)
         .from('tenancies')
         .select(`
           *,
           tenant:tenants(id, first_name, last_name, email, phone),
           room:rooms(id, room_name, room_type),
           property:properties(id, address_line, postcode)
         `)
         .eq('id', tenancyId)
         .single();
       if (error) throw error;
       return data as TenancyWithDetails;
     },
     enabled: !!tenancyId,
   });
 }
 
 export function useCreateTenancy() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (tenancy: Omit<Tenancy, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data, error } = await (supabase as any)
         .from('tenancies')
         .insert({ ...tenancy, org_id: orgId })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tenancies'] });
       queryClient.invalidateQueries({ queryKey: ['rooms'] });
       queryClient.invalidateQueries({ queryKey: ['tenants'] });
       queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
       toast({ title: 'Tenancy created', description: 'Rent schedule has been generated.' });
     },
     onError: (error) => {
       toast({ title: 'Failed to create tenancy', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useUpdateTenancy() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Tenancy> & { id: string }) => {
       const { data, error } = await (supabase as any)
         .from('tenancies')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['tenancies'] });
       queryClient.invalidateQueries({ queryKey: ['rooms'] });
       queryClient.invalidateQueries({ queryKey: ['tenants'] });
       // Rent schedule is derived from tenancy state (amount, end date, status),
       // so any tenancy update must also invalidate it — otherwise the rent
       // collection UI shows stale entries after editing a tenancy.
       queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
       queryClient.invalidateQueries({ queryKey: ['rent-schedule'] });
       toast({ title: 'Tenancy updated' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update tenancy', description: error.message, variant: 'destructive' });
     },
   });
 }

 export function useActivateTenancy() {
   const updateTenancy = useUpdateTenancy();
 
   return useMutation({
     mutationFn: async (tenancyId: string) => {
       return updateTenancy.mutateAsync({ id: tenancyId, status: 'active' });
     },
   });
 }
 
 export function useEndTenancy() {
   const updateTenancy = useUpdateTenancy();
 
   return useMutation({
     mutationFn: async ({ tenancyId, endDate }: { tenancyId: string; endDate: string }) => {
       return updateTenancy.mutateAsync({ 
         id: tenancyId, 
         status: 'ended',
         end_date: endDate 
       });
     },
   });
 }
 
 export function useGiveNotice() {
   const updateTenancy = useUpdateTenancy();
 
   return useMutation({
     mutationFn: async ({ tenancyId, noticeDate, endDate }: { tenancyId: string; noticeDate: string; endDate: string }) => {
       return updateTenancy.mutateAsync({ 
         id: tenancyId, 
         status: 'notice',
         notice_date: noticeDate,
         end_date: endDate
       });
     },
   });
 }