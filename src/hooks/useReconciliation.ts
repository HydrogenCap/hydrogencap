/**
 * Reconciliation data hooks — import, auto-match, confirm, reject, exclude, summary.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { parseStatement, computeTransactionHash } from '@/lib/statementParser';
import { findMatches, type MatchCandidate } from '@/lib/reconciliationEngine';
import type { RentScheduleItem } from './useRentCollection';

type BankTransactionRow = Database['public']['Tables']['bank_transactions']['Row'];
type BankTransactionInsert = Database['public']['Tables']['bank_transactions']['Insert'];
type BankTransactionUpdate = Database['public']['Tables']['bank_transactions']['Update'];
type RentPaymentInsert = Database['public']['Tables']['rent_payments']['Insert'];
type RentScheduleRow = Database['public']['Tables']['rent_schedule']['Row'];

type ReconciliationStatus = 'unmatched' | 'suggested' | 'matched' | 'excluded' | 'non_rent';
type SummaryBucketKey = keyof ReconciliationSummary;

type RelatedTenant = {
  first_name: string | null;
  last_name: string | null;
  tenant_type: string | null;
  company_name?: string | null;
};

type ScheduleItemWithRelations = RentScheduleRow & {
  agreement?: { tenant?: RelatedTenant | null } | null;
  tenancy?: { tenant?: RelatedTenant | null } | null;
};

type EnrichedScheduleItem = RentScheduleItem & {
  tenant_name?: string;
  payment_reference?: string | null;
};

export type ReconciliationTransaction = BankTransactionRow;

export interface ReconciliationSummary {
  unmatched: { count: number; total: number };
  suggested: { count: number; total: number };
  matched: { count: number; total: number };
  excluded: { count: number; total: number };
  non_rent: { count: number; total: number };
}

// ─── Import Bank Statement ───────────────────────────────────────────

export function useImportStatement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      csvText,
      bankAccountId,
    }: {
      csvText: string;
      bankAccountId: string;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const result = parseStatement(csvText);
      if (result.transactions.length === 0) {
        throw new Error('No valid transactions found in file');
      }

      const batchId = crypto.randomUUID();
      let imported = 0;
      let skipped = 0;

      for (const txn of result.transactions) {
        const hash = await computeTransactionHash(txn.date, txn.amount, txn.description);

        // Check for existing (dedup)
        const { data: existing } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('import_hash', hash)
          .eq('bank_account_id', bankAccountId)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const payload: BankTransactionInsert = {
          org_id: orgId,
          bank_account_id: bankAccountId,
          transaction_date: txn.date,
          description: txn.description,
          amount: txn.amount,
          balance_after: txn.balance,
          reference: txn.reference,
          transaction_type: txn.type || 'unknown',
          import_batch_id: batchId,
          import_hash: hash,
          status: 'unmatched',
        };

        const { error } = await supabase.from('bank_transactions').insert(payload);

        if (!error) imported++;
      }

      return {
        imported,
        skipped,
        total: result.transactions.length,
        format: result.detectedFormat,
        warnings: result.warnings,
        batchId,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['bank_transactions'] });
      toast({
        title: `${result.imported} transactions imported`,
        description: result.skipped > 0
          ? `${result.skipped} duplicates skipped. Format: ${result.format}`
          : `Format detected: ${result.format}`,
      });
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });
}

// ─── Fetch Unmatched Transactions ────────────────────────────────────

export function useUnmatchedTransactions(bankAccountId?: string) {
  return useQuery({
    queryKey: ['bank_transactions', 'unmatched', bankAccountId],
    queryFn: async () => {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .gt('amount', 0)
        .order('transaction_date', { ascending: false });

      // Filter by status - use 'or' filter for multiple statuses
      query = query.or('status.eq.unmatched,status.eq.suggested');


      if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Fetch All Transactions (for history) ────────────────────────────

export function useMatchedTransactions(bankAccountId?: string) {
  return useQuery({
    queryKey: ['bank_transactions', 'matched', bankAccountId],
    queryFn: async () => {
      const query = supabase
        .from('bank_transactions')
        .select('*')
        .eq('is_reconciled', true)
        .order('transaction_date', { ascending: false })
        .limit(100);

      if (bankAccountId) {
        query.eq('bank_account_id', bankAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ReconciliationTransaction[];
    },
  });
}

// ─── Run Auto-Match ──────────────────────────────────────────────────

export function useRunAutoMatch() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bankAccountId?: string) => {
      // Fetch unmatched transactions
      let txnQuery = supabase
        .from('bank_transactions')
        .select('*')
        .eq('is_reconciled', false)
        .gt('amount', 0);

      if (bankAccountId) txnQuery = txnQuery.eq('bank_account_id', bankAccountId);
      const { data: txns, error: txnErr } = await txnQuery;
      if (txnErr) throw txnErr;

      // Fetch open rent schedule items with tenant names
      const SCHEDULE_SELECT = `
        *,
        agreement:tenancy_agreements(
          tenant:tenants_v2(first_name, last_name, tenant_type)
        ),
        tenancy:tenancies(
          tenant:tenants(first_name, last_name, tenant_type, company_name)
        )
      `;

      const { data: schedItems, error: schedErr } = await supabase
        .from('rent_schedule')
        .select(SCHEDULE_SELECT)
        .in('status', ['due', 'overdue', 'partial', 'upcoming']);

      if (schedErr) throw schedErr;

      // Enrich schedule items with tenant names
      const enriched: EnrichedScheduleItem[] = ((schedItems || []) as ScheduleItemWithRelations[]).map((item) => {
        let tenant_name = '';
        if (item.agreement?.tenant) {
          const t = item.agreement.tenant;
          tenant_name = `${t.first_name} ${t.last_name}`;
        } else if (item.tenancy?.tenant) {
          const t = item.tenancy.tenant;
          tenant_name = t.tenant_type === 'company'
            ? (t.company_name || `${t.first_name} ${t.last_name}`)
            : `${t.first_name} ${t.last_name}`;
        }
        return { ...item, tenant_name, agreement: undefined, tenancy: undefined };
      });

      // Run matching engine
      const bankTxns = ((txns || []) as ReconciliationTransaction[]).map((t) => ({
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        reference: t.reference,
        status: t.status || 'unmatched',
      }));

      const matches = findMatches(bankTxns, enriched);

      // Update suggested matches in DB
      let suggested = 0;
      for (const match of matches) {
        const updatePayload: BankTransactionUpdate = {
          status: 'suggested',
          matched_schedule_id: match.scheduleId,
        };
        const { error } = await supabase
          .from('bank_transactions')
          .update(updatePayload)
          .eq('id', match.transactionId);

        if (!error) suggested++;
      }

      return { totalUnmatched: txns?.length || 0, suggested, matches };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['bank_transactions'] });
      toast({
        title: `${result.suggested} matches suggested`,
        description: `${result.totalUnmatched - result.suggested} transactions remain unmatched`,
      });
    },
    onError: (e: Error) => toast({ title: 'Auto-match failed', description: e.message, variant: 'destructive' }),
  });
}

// ─── Confirm Match ───────────────────────────────────────────────────

export function useConfirmMatch() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      transactionId,
      scheduleId,
    }: {
      transactionId: string;
      scheduleId: string;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization');
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Get the transaction
      const { data: txn, error: txnErr } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('id', transactionId)
        .single();
      if (txnErr || !txn) throw txnErr || new Error('Transaction not found');

      // 2. Get the schedule item
      const { data: sched, error: schedErr } = await supabase
        .from('rent_schedule')
        .select('tenancy_id, agreement_id, rent_amount, additional_charges, amount_paid')
        .eq('id', scheduleId)
        .single();
      if (schedErr || !sched) throw schedErr || new Error('Schedule item not found');

      // 3. Record a rent_payment
      const paymentPayload: RentPaymentInsert = {
        org_id: orgId,
        tenancy_id: sched.tenancy_id,
        agreement_id: sched.agreement_id,
        rent_schedule_id: scheduleId,
        amount: txn.amount,
        payment_date: txn.transaction_date,
        payment_method: 'bank_transfer',
        is_reconciled: true,
        recorded_by: user?.id || null,
        notes: 'Auto-reconciled from bank statement',
      };

      const { data: payment, error: payErr } = await supabase
        .from('rent_payments')
        .insert(paymentPayload)
        .select()
        .single();
      if (payErr) throw payErr;

      // 4. Update the bank transaction status
      const transactionUpdate: BankTransactionUpdate = {
        status: 'matched',
        matched_schedule_id: scheduleId,
        matched_payment_id: payment.id,
        matched_at: new Date().toISOString(),
        matched_by: user?.id || null,
      };

      await supabase
        .from('bank_transactions')
        .update(transactionUpdate)
        .eq('id', transactionId);

      // 5. Update rent_schedule status
      const totalPaid = (sched.amount_paid || 0) + txn.amount;
      const expected = sched.rent_amount + (sched.additional_charges || 0);
      const newStatus = totalPaid >= expected ? 'paid' : 'partial';

      await supabase.rpc('update_rent_schedule_item_status', {
        p_id: scheduleId,
        p_status: newStatus,
        p_amount_paid: totalPaid,
      });

      return { paymentId: payment.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_transactions'] });
      qc.invalidateQueries({ queryKey: ['rent_schedule'] });
      qc.invalidateQueries({ queryKey: ['rent_payments'] });
      toast({ title: 'Match confirmed & payment recorded' });
    },
    onError: (e: Error) => toast({ title: 'Failed to confirm', description: e.message, variant: 'destructive' }),
  });
}

// ─── Bulk Confirm ────────────────────────────────────────────────────

export function useBulkConfirmMatches() {
  const qc = useQueryClient();
  const confirmMatch = useConfirmMatch();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (matches: { transactionId: string; scheduleId: string }[]) => {
      let success = 0;
      let failed = 0;

      for (const match of matches) {
        try {
          await confirmMatch.mutateAsync(match);
          success++;
        } catch {
          failed++;
        }
      }
      return { success, failed };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['bank_transactions'] });
      qc.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({
        title: `${result.success} matches confirmed`,
        description: result.failed > 0 ? `${result.failed} failed` : undefined,
      });
    },
  });
}

// ─── Reject Match / Exclude Transaction ──────────────────────────────

export function useRejectMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const updatePayload: BankTransactionUpdate = {
        status: 'unmatched',
        matched_schedule_id: null,
      };

      await supabase
        .from('bank_transactions')
        .update(updatePayload)
        .eq('id', transactionId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_transactions'] }),
  });
}

export function useExcludeTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: 'excluded' | 'non_rent' }) => {
      const updatePayload: BankTransactionUpdate = { status: reason };

      await supabase
        .from('bank_transactions')
        .update(updatePayload)
        .eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_transactions'] }),
  });
}

// ─── Reconciliation Summary ──────────────────────────────────────────

export function useReconciliationSummary(bankAccountId?: string) {
  return useQuery({
    queryKey: ['reconciliation_summary', bankAccountId],
    queryFn: async () => {
      let query = supabase
        .from('bank_transactions')
        .select('status, amount')
        .gt('amount', 0);

      if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      const summary: ReconciliationSummary = {
        unmatched: { count: 0, total: 0 },
        suggested: { count: 0, total: 0 },
        matched: { count: 0, total: 0 },
        excluded: { count: 0, total: 0 },
        non_rent: { count: 0, total: 0 },
      };

      for (const item of items) {
        const status = item.status as ReconciliationStatus;
        const bucket = summary[status as SummaryBucketKey];
        if (bucket) {
          bucket.count++;
          bucket.total += item.amount;
        }
      }

      return summary;
    },
  });
}

// ─── Reconciled Schedule IDs (for rent collection badges) ────────────

export function useReconciledScheduleIds() {
  return useQuery({
    queryKey: ['reconciled_schedule_ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('matched_schedule_id')
        .eq('status', 'matched')
        .not('matched_schedule_id', 'is', null);
      if (error) throw error;
      return new Set((data || []).map((row) => row.matched_schedule_id).filter(Boolean));
    },
    staleTime: 60_000,
  });
}
