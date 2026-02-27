import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export interface BankTransaction {
  id: string;
  org_id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  amount: number;
  transaction_type: string;
  balance_after: number | null;
  import_batch_id: string | null;
  import_source: string;
  is_duplicate: boolean;
  is_reconciled: boolean;
  category: string | null;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  org_id: string;
  bank_account_id: string;
  file_name: string;
  row_count: number;
  imported_count: number;
  duplicate_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  status: string;
  error_message: string | null;
  imported_by: string | null;
  imported_at: string;
}

export function useUnreconciledTransactions(bankAccountId?: string) {
  return useQuery({
    queryKey: ['bank_transactions', 'unreconciled', bankAccountId],
    queryFn: async () => {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .eq('is_reconciled', false)
        .eq('is_duplicate', false)
        .eq('transaction_type', 'credit')
        .order('transaction_date', { ascending: false });

      if (bankAccountId) {
        query = query.eq('bank_account_id', bankAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BankTransaction[];
    },
  });
}

export function useBankTransactions(filters?: { bankAccountId?: string; batchId?: string }) {
  return useQuery({
    queryKey: ['bank_transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (filters?.bankAccountId) query = query.eq('bank_account_id', filters.bankAccountId);
      if (filters?.batchId) query = query.eq('import_batch_id', filters.batchId);

      const { data, error } = await query;
      if (error) throw error;
      return data as BankTransaction[];
    },
  });
}

export function useImportBatches(bankAccountId?: string) {
  return useQuery({
    queryKey: ['import_batches', bankAccountId],
    queryFn: async () => {
      let query = supabase
        .from('import_batches')
        .select('*')
        .order('imported_at', { ascending: false });

      if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

      const { data, error } = await query;
      if (error) throw error;
      return data as ImportBatch[];
    },
  });
}

export function useImportBankTransactions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bankAccountId,
      fileName,
      transactions,
    }: {
      bankAccountId: string;
      fileName: string;
      transactions: Array<{
        transaction_date: string;
        description: string;
        reference?: string;
        amount: number;
        transaction_type: 'credit' | 'debit';
        balance_after?: number;
        is_duplicate?: boolean;
      }>;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      // Check for duplicates
      const { data: existing } = await supabase
        .from('bank_transactions')
        .select('transaction_date, amount, description')
        .eq('bank_account_id', bankAccountId);

      const existingSet = new Set(
        (existing || []).map(e => `${e.transaction_date}|${e.amount}|${e.description}`)
      );

      let duplicateCount = 0;
      const processedTxns = transactions.map(t => {
        const key = `${t.transaction_date}|${t.amount}|${t.description}`;
        const isDuplicate = existingSet.has(key) || (t.is_duplicate ?? false);
        if (isDuplicate) duplicateCount++;
        return { ...t, is_duplicate: isDuplicate };
      });

      const dates = processedTxns.map(t => t.transaction_date).sort();

      // Create batch
      const { data: batch, error: batchError } = await supabase
        .from('import_batches')
        .insert({
          org_id: orgId,
          bank_account_id: bankAccountId,
          file_name: fileName,
          row_count: transactions.length,
          imported_count: transactions.length - duplicateCount,
          duplicate_count: duplicateCount,
          date_range_start: dates[0] || null,
          date_range_end: dates[dates.length - 1] || null,
          status: 'completed',
          imported_by: user?.id || null,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Insert transactions
      const txnRows = processedTxns.map(t => ({
        org_id: orgId,
        bank_account_id: bankAccountId,
        transaction_date: t.transaction_date,
        description: t.description,
        reference: t.reference || null,
        amount: t.amount,
        transaction_type: t.transaction_type,
        balance_after: t.balance_after ?? null,
        import_batch_id: batch.id,
        import_source: 'csv',
        is_duplicate: t.is_duplicate,
      }));

      // Insert in chunks of 100
      for (let i = 0; i < txnRows.length; i += 100) {
        const chunk = txnRows.slice(i, i + 100);
        const { error } = await supabase.from('bank_transactions').insert(chunk);
        if (error) throw error;
      }

      return { batch, importedCount: transactions.length - duplicateCount, duplicateCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['import_batches'] });
      toast({
        title: 'Import complete',
        description: `${data.importedCount} transactions imported, ${data.duplicateCount} duplicates skipped`,
      });
    },
    onError: (error) => {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      transactionId,
      rentScheduleId,
      amount,
      paymentDate,
      tenancyId,
      confidence,
    }: {
      transactionId: string;
      rentScheduleId: string;
      amount: number;
      paymentDate: string;
      tenancyId: string;
      confidence: number;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      // Create rent payment linked to bank transaction
      const { error: paymentError } = await supabase
        .from('rent_payments')
        .insert({
          org_id: orgId,
          tenancy_id: tenancyId,
          rent_schedule_id: rentScheduleId,
          amount,
          payment_date: paymentDate,
          payment_method: 'bank_transfer',
          bank_transaction_id: transactionId,
          reconciliation_method: confidence >= 0.85 ? 'auto_matched' : 'manual',
          match_confidence: confidence,
          recorded_by: user?.id || null,
        });

      if (paymentError) throw paymentError;

      // Mark transaction as reconciled
      const { error: txnError } = await supabase
        .from('bank_transactions')
        .update({ is_reconciled: true })
        .eq('id', transactionId);

      if (txnError) throw txnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
      toast({ title: 'Transaction reconciled' });
    },
    onError: (error) => {
      toast({ title: 'Reconciliation failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkReconcile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (
      matches: Array<{
        transactionId: string;
        rentScheduleId: string;
        amount: number;
        paymentDate: string;
        tenancyId: string;
        confidence: number;
      }>
    ) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      for (const match of matches) {
        await supabase.from('rent_payments').insert({
          org_id: orgId,
          tenancy_id: match.tenancyId,
          rent_schedule_id: match.rentScheduleId,
          amount: match.amount,
          payment_date: match.paymentDate,
          payment_method: 'bank_transfer',
          bank_transaction_id: match.transactionId,
          reconciliation_method: 'auto_matched',
          match_confidence: match.confidence,
          recorded_by: user?.id || null,
        });

        await supabase
          .from('bank_transactions')
          .update({ is_reconciled: true })
          .eq('id', match.transactionId);
      }

      return matches.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['bank_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
      toast({ title: `${count} transactions reconciled` });
    },
    onError: (error) => {
      toast({ title: 'Bulk reconciliation failed', description: error.message, variant: 'destructive' });
    },
  });
}
