 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 
 export type RentStatus = 'upcoming' | 'due' | 'paid' | 'partial' | 'overdue' | 'bad_debt';
 
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
 
// getUserOrgId replaced by shared import
 
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
 
export function useRentScheduleItem(id: string) {
  return useQuery({
    queryKey: ['rent_schedule', id],
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
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as RentScheduleWithDetails;
    },
    enabled: !!id,
  });
}

export function useUpdateRentScheduleStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RentStatus }) => {
      const updates: Record<string, any> = { status };
      if (status === 'paid') {
        updates.amount_outstanding = 0;
        // We'd also need to set amount_paid = rent_amount, but we need the current values
      }
      const { data, error } = await supabase
        .from('rent_schedule')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Status updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePaymentReminders(rentScheduleId: string) {
  return useQuery({
    queryKey: ['payment_reminders', rentScheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_reminders')
        .select('*')
        .eq('rent_schedule_id', rentScheduleId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!rentScheduleId,
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      rentScheduleId: string;
      tenancyId: string;
      reminderType: string;
      customMessage?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-rent-reminder', {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment_reminders'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Reminder sent', description: `Sent to ${data.sentTo}` });
    },
    onError: (error) => {
      toast({ title: 'Failed to send reminder', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRentSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rent_schedule').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Payment deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDuplicateRentSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: RentScheduleWithDetails) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      // Generate new payment reference
      const prefix = 'HYD';
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      ).join('');
      const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');

      const { data, error } = await supabase
        .from('rent_schedule')
        .insert({
          org_id: orgId,
          tenancy_id: item.tenancy_id,
          due_date: item.due_date,
          period_start: item.period_start,
          period_end: item.period_end,
          rent_amount: item.rent_amount,
          additional_charges: item.additional_charges,
          amount_paid: 0,
          amount_outstanding: item.rent_amount + item.additional_charges,
          status: 'upcoming',
          payment_reference: `${prefix}-${letters}${numbers}`,
          notes: item.notes ? `Copy of: ${item.notes}` : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Payment duplicated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to duplicate', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRentScheduleNotes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, notes, tags }: { id: string; notes?: string; tags?: string[] }) => {
      const updates: Record<string, any> = {};
      if (notes !== undefined) updates.notes = notes;
      if (tags !== undefined) updates.tags = tags;

      const { data, error } = await supabase
        .from('rent_schedule')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
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
    bad_debt: schedule.filter(s => s.status === 'bad_debt').length,
  };
}