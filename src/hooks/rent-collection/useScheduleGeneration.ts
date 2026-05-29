import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { type RentStatus } from './types';

// ─── Generate Schedule from V2 Agreement ───

export function useGenerateScheduleFromAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agreementId,
      months = 12,
    }: {
      agreementId: string;
      months?: number;
    }) => {
      const { data: agreement, error: agError } = await supabaseAny
        .from('tenancy_agreements')
        .select('id, org_id, rent_amount_pcm, start_date, initial_end_date, rent_frequency, status')
        .eq('id', agreementId)
        .single();

      if (agError || !agreement) throw agError || new Error('Agreement not found');

      // Look up V1 tenancy_id for backward compat
      const { data: existingSchedule } = await supabaseAny
        .from('rent_schedule')
        .select('tenancy_id')
        .eq('agreement_id', agreementId)
        .limit(1);

      const tenancyId = existingSchedule?.[0]?.tenancy_id;

      if (tenancyId) {
        const { data: count, error } = await supabase.rpc('generate_rent_schedule', {
          p_tenancy_id: tenancyId,
          p_months: months,
          p_agreement_id: agreementId,
        });
        if (error) throw error;
        return { count: count || 0 };
      }

      // No V1 tenancy — generate manually
      const orgId = agreement.org_id;
      const startDate = new Date(agreement.start_date);
      const rentPCM = agreement.rent_amount_pcm;
      let count = 0;

      const { data: lastEntry } = await supabaseAny
        .from('rent_schedule')
        .select('period_end')
        .eq('agreement_id', agreementId)
        .order('period_end', { ascending: false })
        .limit(1);

      let nextStart = lastEntry?.[0]
        ? new Date(new Date(lastEntry[0].period_end).getTime() + 86400000)
        : startDate;

      for (let i = 0; i < months; i++) {
        const periodStart = new Date(nextStart);
        const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        const dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

        if (agreement.initial_end_date && dueDate > new Date(agreement.initial_end_date)) break;

        const prefix = 'HYD';
        const letters = Array.from({ length: 3 }, () =>
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join('');
        const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');

        if (!tenancyId) throw new Error('Cannot generate rent schedule: tenancy ID is required');

        const { error } = await supabase.from('rent_schedule').insert({
          org_id: orgId,
          tenancy_id: tenancyId,
          agreement_id: agreementId,
          due_date: dueDate.toISOString().split('T')[0],
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          rent_amount: rentPCM,
          additional_charges: 0,
          amount_paid: 0,
          amount_outstanding: rentPCM,
          status: 'upcoming' as RentStatus,
          payment_reference: `${prefix}-${letters}${numbers}`,
        });

        if (!error) count++;
        nextStart = new Date(periodEnd.getTime() + 86400000);
      }

      return { count };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast.success(`${result.count} schedule entries generated`);
    },
    onError: (error) => {
      toast.error('Failed to generate schedule', { description: error.message });
    },
  });
}
