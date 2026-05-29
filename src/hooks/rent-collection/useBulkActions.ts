import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from '../useUserOrg';
import { logError } from '@/lib/errorLogger';
import { toast } from 'sonner';
import { type RentScheduleWithDetails } from './types';
import { getErrorMessage, normalizeRentItem } from './internal';

export function useBulkMarkPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      paymentMethod,
      paymentDate,
      notes,
      onProgress,
    }: {
      items: RentScheduleWithDetails[];
      paymentMethod: string;
      paymentDate: 'due_date' | string;
      notes: string;
      onProgress?: (count: number) => void;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const display = normalizeRentItem(item);
        try {
          const actualPaymentDate = paymentDate === 'due_date'
            ? item.due_date
            : paymentDate;

          const { error: payError } = await supabaseAny
            .from('rent_payments')
            .insert({
              org_id: orgId,
              tenancy_id: item.tenancy_id,
              rent_schedule_id: item.id,
              amount: item.amount_outstanding,
              payment_date: actualPaymentDate,
              payment_method: paymentMethod,
              reference: null,
              notes,
              recorded_by: user?.id || null,
              agreement_id: item.agreement_id || null,
            });

          if (payError) throw payError;

          const { error: schedError } = await supabase.rpc('update_rent_schedule_item_status', {
            p_id: item.id,
            p_status: 'paid',
            p_amount_paid: item.rent_amount + (item.additional_charges || 0),
          });

          if (schedError) throw schedError;

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${display.propertyAddress}: ${getErrorMessage(error)}`);
        }
        onProgress?.(i + 1);
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });

      if (results.failed === 0) {
        toast.success(`${results.success} payments recorded`);
      } else {
        toast.error(`${results.success} succeeded, ${results.failed} failed`, { description: results.errors.slice(0, 3).join('\n') });
      }
    },
    onError: (error) => {
      toast.error('Bulk payment failed', { description: error.message });
    },
  });
}

export function useBulkWriteOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      reason,
    }: {
      items: RentScheduleWithDetails[];
      reason?: string;
    }) => {
      const ids = items.map(item => item.id);
      const { error } = await supabase.rpc('bulk_update_rent_schedule_status', {
        p_ids: ids,
        p_status: 'bad_debt',
        p_notes: reason ? `Bad debt write-off: ${reason}` : 'Bulk write-off as bad debt',
      });

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success(`${result.count} items written off`);
    },
    onError: (error) => {
      toast.error('Write-off failed', { description: error.message });
    },
  });
}

export function useBulkAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      note,
      mode,
    }: {
      items: RentScheduleWithDetails[];
      note: string;
      mode: 'append' | 'replace';
    }) => {
      const today = new Date().toLocaleDateString('en-GB');
      let count = 0;

      for (const item of items) {
        let newNotes: string;
        if (mode === 'replace') {
          newNotes = note;
        } else {
          const separator = `\n--- ${today} ---\n`;
          newNotes = item.notes
            ? `${item.notes}${separator}${note}`
            : note;
        }

        const { error } = await supabaseAny
          .from('rent_schedule')
          .update({ notes: newNotes })
          .eq('id', item.id);

        if (!error) count++;
      }

      return { count };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success(`Note added to ${result.count} items`);
    },
    onError: (error) => {
      toast.error('Failed to add notes', { description: error.message });
    },
  });
}

export function useBulkSendReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      reminderType,
      customMessage,
    }: {
      items: RentScheduleWithDetails[];
      reminderType: string;
      customMessage?: string;
    }) => {
      const results = { sent: 0, skipped: 0, failed: 0 };

      for (const item of items) {
        const display = normalizeRentItem(item);
        const email = display.tenantEmail;
        if (!email) {
          results.skipped++;
          continue;
        }

        try {
          const { error } = await supabase.functions.invoke('send-rent-reminder', {
            body: {
              rentScheduleId: item.id,
              tenancyId: item.tenancy_id,
              reminderType,
              customMessage,
            },
          });
          if (error) throw error;
          results.sent++;
        } catch (err) {
          console.error('Failed to send reminder:', err);
          logError({ source: 'useRentCollection.sendRentReminder', message: 'send-rent-reminder edge function failed', severity: 'error', error: err });
          results.failed++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['payment_reminders'] });

      const parts = [];
      if (results.sent > 0) parts.push(`${results.sent} sent`);
      if (results.skipped > 0) parts.push(`${results.skipped} skipped (no email)`);
      if (results.failed > 0) parts.push(`${results.failed} failed`);

      const toastFn = results.failed > 0 ? toast.error : toast;
      toastFn('Reminders processed', { description: parts.join(', ') });
    },
    onError: (error) => {
      toast.error('Failed to send reminders', { description: error.message });
    },
  });
}
