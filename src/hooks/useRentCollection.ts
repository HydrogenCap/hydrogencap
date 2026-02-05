 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export type RentStatus = 'upcoming' | 'due' | 'paid' | 'partial' | 'overdue';
 
 export interface RentScheduleItem {
   id: string;
   org_id: string;
   tenancy_id: string;
   due_date: string;
   period_start: string;
   period_end: string;
   rent_amount: number;
   additional_charges: number;
   amount_paid: number;
   amount_outstanding: number;
   status: RentStatus;
   reminder_sent_at: string | null;
   warning_sent_at: string | null;
   notes: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface RentScheduleWithDetails extends RentScheduleItem {
   tenancy: {
     id: string;
     tenant: {
       id: string;
       first_name: string;
       last_name: string;
     };
     room: {
       room_name: string;
     };
     property: {
       id: string;
       address_line: string;
       postcode: string | null;
     };
   };
 }
 
 export interface RentPayment {
   id: string;
   org_id: string;
   tenancy_id: string;
   rent_schedule_id: string | null;
   amount: number;
   payment_date: string;
   payment_method: string | null;
   reference: string | null;
   is_reconciled: boolean;
   notes: string | null;
   recorded_by: string | null;
   created_at: string;
 }
 
 async function getUserOrgId(): Promise<string | null> {
   const { data, error } = await supabase
     .from('memberships')
     .select('org_id')
     .limit(1)
     .maybeSingle();
   if (error || !data) return null;
   return data.org_id;
 }
 
 export function useRentSchedule(filters?: { 
   month?: string; // YYYY-MM format
   status?: RentStatus;
   tenancyId?: string;
 }) {
   return useQuery({
     queryKey: ['rent_schedule', filters],
     queryFn: async () => {
       let query = supabase
         .from('rent_schedule')
         .select(`
           *,
           tenancy:tenancies(
             id,
             tenant:tenants(id, first_name, last_name),
             room:rooms(room_name),
             property:properties(id, address_line, postcode)
           )
         `)
         .order('due_date', { ascending: true });
 
       if (filters?.month) {
         const startDate = `${filters.month}-01`;
         const endDate = new Date(parseInt(filters.month.split('-')[0]), parseInt(filters.month.split('-')[1]), 0);
         query = query
           .gte('due_date', startDate)
           .lte('due_date', endDate.toISOString().split('T')[0]);
       }
 
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
 
       if (filters?.tenancyId) {
         query = query.eq('tenancy_id', filters.tenancyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as RentScheduleWithDetails[];
     },
   });
 }
 
 export function useArrears() {
   return useQuery({
     queryKey: ['rent_schedule', 'arrears'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('rent_schedule')
         .select(`
           *,
           tenancy:tenancies(
             id,
             tenant:tenants(id, first_name, last_name, email, phone),
             room:rooms(room_name),
             property:properties(id, address_line, postcode)
           )
         `)
         .in('status', ['overdue', 'partial'])
         .order('due_date', { ascending: true });
 
       if (error) throw error;
       
       // Calculate days overdue
       const today = new Date();
       return (data as RentScheduleWithDetails[]).map(item => ({
         ...item,
         days_overdue: Math.floor((today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)),
       }));
     },
   });
 }
 
 export function useRentPayments(tenancyId?: string) {
   return useQuery({
     queryKey: ['rent_payments', tenancyId],
     queryFn: async () => {
       let query = supabase
         .from('rent_payments')
         .select('*')
         .order('payment_date', { ascending: false });
 
       if (tenancyId) {
         query = query.eq('tenancy_id', tenancyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as RentPayment[];
     },
   });
 }
 
 export function useRecordPayment() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (payment: Omit<RentPayment, 'id' | 'org_id' | 'created_at' | 'is_reconciled' | 'recorded_by'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data: { user } } = await supabase.auth.getUser();
 
       const { data, error } = await supabase
         .from('rent_payments')
         .insert({ 
           ...payment, 
           org_id: orgId,
           recorded_by: user?.id || null 
         })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
       queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
       toast({ title: 'Payment recorded' });
     },
     onError: (error) => {
       toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useRentSummary(month?: string) {
   const { data: schedule } = useRentSchedule({ month });
 
   if (!schedule) return null;
 
   const totalExpected = schedule.reduce((sum, item) => sum + item.rent_amount + item.additional_charges, 0);
   const totalReceived = schedule.reduce((sum, item) => sum + item.amount_paid, 0);
   const totalOutstanding = schedule.reduce((sum, item) => sum + item.amount_outstanding, 0);
   const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
 
   return {
     totalExpected,
     totalReceived,
     totalOutstanding,
     collectionRate,
     paid: schedule.filter(s => s.status === 'paid').length,
     partial: schedule.filter(s => s.status === 'partial').length,
     overdue: schedule.filter(s => s.status === 'overdue').length,
     upcoming: schedule.filter(s => s.status === 'upcoming').length,
     due: schedule.filter(s => s.status === 'due').length,
   };
 }