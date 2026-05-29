import { useQuery } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { type RentStatus, type LedgerEntry } from './types';

export function useTenancyLedger(params: string | { tenancyId?: string; agreementId?: string } | undefined) {
  // Support both old string signature and new object signature
  const tenancyId = typeof params === 'string' ? params : params?.tenancyId;
  const agreementId = typeof params === 'string' ? undefined : params?.agreementId;
  const enabled = !!(tenancyId || agreementId);

  return useQuery({
    queryKey: ['tenancy_ledger', tenancyId, agreementId],
    queryFn: async () => {
      // Build schedule query
      let schedQuery = supabaseAny
        .from('rent_schedule')
        .select('*')
        .order('due_date', { ascending: true });

      if (agreementId) {
        schedQuery = schedQuery.eq('agreement_id', agreementId);
      } else if (tenancyId) {
        schedQuery = schedQuery.eq('tenancy_id', tenancyId);
      }

      // Build payments query
      let payQuery = supabaseAny
        .from('rent_payments')
        .select('*')
        .order('payment_date', { ascending: true });

      if (agreementId) {
        payQuery = payQuery.eq('agreement_id', agreementId);
      } else if (tenancyId) {
        payQuery = payQuery.eq('tenancy_id', tenancyId);
      }

      const [schedRes, payRes] = await Promise.all([schedQuery, payQuery]);

      if (schedRes.error) throw schedRes.error;
      if (payRes.error) throw payRes.error;

      const today = new Date().toISOString().split('T')[0];
      const entries: LedgerEntry[] = [];

      for (const item of schedRes.data || []) {
        const periodStart = new Date(item.period_start);
        const periodEnd = new Date(item.period_end);
        entries.push({
          id: item.id,
          date: item.due_date,
          type: 'rent',
          description: `Rent (${periodStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${periodEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`,
          status: item.status as RentStatus,
          amount: item.rent_amount + (item.additional_charges || 0),
          running_balance: 0,
          rent_schedule_id: item.id,
          payment_id: null,
          is_future: item.due_date > today,
        });
      }

      for (const payment of payRes.data || []) {
        entries.push({
          id: payment.id,
          date: payment.payment_date,
          type: 'payment',
          description: payment.reference ? `Payment (${payment.reference})` : 'Payment',
          status: 'payment',
          amount: -payment.amount,
          running_balance: 0,
          rent_schedule_id: payment.rent_schedule_id,
          payment_id: payment.id,
          is_future: false,
        });
      }

      entries.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.type === 'rent' && b.type === 'payment') return -1;
        if (a.type === 'payment' && b.type === 'rent') return 1;
        return 0;
      });

      let balance = 0;
      for (const entry of entries) {
        if (!entry.is_future) {
          balance += entry.amount;
          entry.running_balance = balance;
        }
      }

      return entries.reverse();
    },
    enabled,
  });
}

// ─── Paid On Time Stats ───

export function usePaidOnTimeStats(params: string | { tenancyId?: string; agreementId?: string } | undefined) {
  // Support both old string signature and new object signature
  const tenancyId = typeof params === 'string' ? params : params?.tenancyId;
  const agreementId = typeof params === 'string' ? undefined : params?.agreementId;
  const enabled = !!(tenancyId || agreementId);

  return useQuery({
    queryKey: ['paid_on_time', tenancyId, agreementId],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      const filterCol = agreementId ? 'agreement_id' : 'tenancy_id';
      const filterVal = agreementId || tenancyId!;

      const [paidRes, allPastRes, paymentsRes] = await Promise.all([
        supabase.from('rent_schedule').select('id, due_date')
          .eq(filterCol, filterVal).lte('due_date', todayStr).eq('status', 'paid'),
        supabase.from('rent_schedule').select('id')
          .eq(filterCol, filterVal).lte('due_date', todayStr).neq('status', 'upcoming'),
        supabase.from('rent_payments').select('rent_schedule_id, payment_date')
          .eq(filterCol, filterVal),
      ]);

      const paidItems = paidRes.data || [];
      const totalPast = allPastRes.data?.length || 0;

      const paymentMap = new Map<string, string>();
      for (const p of paymentsRes.data || []) {
        if (p.rent_schedule_id && !paymentMap.has(p.rent_schedule_id)) {
          paymentMap.set(p.rent_schedule_id, p.payment_date);
        }
      }

      let totalDaysLate = 0;
      let lateCount = 0;
      for (const item of paidItems) {
        const paymentDate = paymentMap.get(item.id);
        if (paymentDate && paymentDate > item.due_date) {
          const daysLate = Math.floor(
            (new Date(paymentDate).getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDaysLate += daysLate;
          lateCount++;
        }
      }

      return {
        percentOnTime: totalPast > 0 ? Math.round((paidItems.length / totalPast) * 100) : 0,
        avgDaysLate: lateCount > 0 ? Math.round(totalDaysLate / lateCount * 10) / 10 : 0,
        totalPast,
      };
    },
    enabled,
  });
}
