import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from '../useUserOrg';
import { toast } from 'sonner';
import {
  RENT_SCHEDULE_SELECT,
  type RentStatus,
  type RentScheduleWithDetails,
  type RentPayment,
  type RentScheduleNotesUpdate,
} from './types';

export function useRentSchedule(filters?: {
  month?: string;
  status?: RentStatus;
  tenancyId?: string;
  agreementId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page;
  const pageSize = filters?.pageSize ?? 50;

  return useQuery({
    queryKey: ['rent_schedule', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT, { count: 'exact' })
        .order('due_date', { ascending: true });

      if (filters?.month) {
        const startDate = `${filters.month}-01`;
        const endDate = new Date(parseInt(filters.month.split('-')[0]), parseInt(filters.month.split('-')[1]), 0);
        query = query
          .gte('due_date', startDate)
          .lte('due_date', endDate.toISOString().split('T')[0]);
      }
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.tenancyId) query = query.eq('tenancy_id', filters.tenancyId);
      if (filters?.agreementId) query = query.eq('agreement_id', filters.agreementId);

      if (page) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const items = (data ?? []) as RentScheduleWithDetails[];
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

export function useArrears() {
  return useQuery({
    queryKey: ['rent_schedule', 'arrears'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT)
        .in('status', ['overdue', 'partial'])
        .order('due_date', { ascending: true });

      if (error) throw error;

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
      let query = supabaseAny
        .from('rent_payments')
        .select('id, org_id, tenancy_id, agreement_id, rent_schedule_id, amount, payment_date, payment_method, reference, is_reconciled, notes, recorded_by, created_at')
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
  return useMutation({
    mutationFn: async (payment: Omit<RentPayment, 'id' | 'org_id' | 'created_at' | 'is_reconciled' | 'recorded_by'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabaseAny
        .from('rent_payments')
        .insert({
          ...payment,
          org_id: orgId,
          recorded_by: user?.id || null,
          agreement_id: payment.agreement_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success('Payment recorded');
    },
    onError: (error) => {
      toast.error('Failed to record payment', { description: error.message });
    },
  });
}

export function useRentScheduleItem(id: string) {
  return useQuery({
    queryKey: ['rent_schedule', id],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT)
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
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RentStatus }) => {
      const { error } = await supabase.rpc('update_rent_schedule_item_status', {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
      return { id, status };
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['rent_schedule', newData.id] });
      const previous = queryClient.getQueryData<RentScheduleWithDetails>(['rent_schedule', newData.id]);
      if (previous) {
        queryClient.setQueryData(['rent_schedule', newData.id], { ...previous, status: newData.status });
      }
      return { previous };
    },
    onError: (_err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['rent_schedule', newData.id], context.previous);
      }
      toast.error('Failed to update status', { description: _err.message });
    },
    // Success toast belongs in onSuccess — the previous onSettled implementation
    // fired "Status updated" even on error, showing both a destructive error
    // toast and a success toast for the same failed update.
    onSuccess: () => {
      toast.success('Status updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
    },
  });
}

export function usePaymentReminders(rentScheduleId: string) {
  return useQuery({
    queryKey: ['payment_reminders', rentScheduleId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('payment_reminders')
        .select('id, rent_schedule_id, reminder_type, sent_at, sent_via, status, recipient_email, recipient_name, error_message, resend_id, tenancy_id, org_id, created_at')
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
      toast.success('Reminder sent', { description: `Sent to ${data.sentTo}` });
    },
    onError: (error) => {
      toast.error('Failed to send reminder', { description: error.message });
    },
  });
}

export function useDeleteRentSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rent_schedule').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success('Payment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete', { description: error.message });
    },
  });
}

export function useDuplicateRentSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: RentScheduleWithDetails) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const prefix = 'HYD';
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      ).join('');
      const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');

      const { data: newId, error } = await supabase.rpc('insert_rent_schedule_item', {
        p_org_id: orgId,
        p_tenancy_id: item.tenancy_id,
        p_due_date: item.due_date,
        p_period_start: item.period_start,
        p_period_end: item.period_end,
        p_rent_amount: item.rent_amount,
        p_additional_charges: item.additional_charges,
        p_amount_paid: 0,
        p_amount_outstanding: item.rent_amount + item.additional_charges,
        p_status: 'upcoming',
        p_payment_reference: `${prefix}-${letters}${numbers}`,
        p_notes: item.notes ? `Copy of: ${item.notes}` : null,
        p_agreement_id: item.agreement_id || undefined,
      });

      if (error) throw error;
      return { id: newId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success('Payment duplicated');
    },
    onError: (error) => {
      toast.error('Failed to duplicate', { description: error.message });
    },
  });
}

export function useUpdateRentScheduleNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes, tags }: { id: string; notes?: string; tags?: string[] }) => {
      const updates: RentScheduleNotesUpdate = {};
      if (notes !== undefined) updates.notes = notes;
      if (tags !== undefined) updates.tags = tags;

      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['rent_schedule', newData.id] });
      const previous = queryClient.getQueryData<RentScheduleWithDetails>(['rent_schedule', newData.id]);
      if (previous) {
        queryClient.setQueryData(['rent_schedule', newData.id], { ...previous, ...newData });
      }
      return { previous };
    },
    onError: (_err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['rent_schedule', newData.id], context.previous);
      }
      toast.error('Failed to update', { description: _err.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success('Updated');
    },
  });
}
