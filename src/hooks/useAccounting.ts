import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

export const TRANSACTION_CATEGORIES = [
  'rental_income', 'service_charge_income', 'other_income',
  'mortgage_interest', 'mortgage_capital', 'insurance', 'repairs_maintenance',
  'management_fees', 'legal_professional', 'utilities', 'council_tax',
  'ground_rent', 'service_charge_expense', 'advertising', 'travel',
  'office_costs', 'capital_expenditure', 'other_expense',
  'deposit_in', 'deposit_out', 'transfer',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'rental_income', 'service_charge_income', 'other_income', 'deposit_in',
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'mortgage_interest', 'mortgage_capital', 'insurance', 'repairs_maintenance',
  'management_fees', 'legal_professional', 'utilities', 'council_tax',
  'ground_rent', 'service_charge_expense', 'advertising', 'travel',
  'office_costs', 'capital_expenditure', 'other_expense', 'deposit_out',
];

export const CATEGORY_LABEL_MAP: Record<TransactionCategory, string> = {
  rental_income: 'Rental Income',
  service_charge_income: 'Service Charge Income',
  other_income: 'Other Income',
  mortgage_interest: 'Mortgage Interest',
  mortgage_capital: 'Mortgage Capital',
  insurance: 'Insurance',
  repairs_maintenance: 'Repairs & Maintenance',
  management_fees: 'Management Fees',
  legal_professional: 'Legal & Professional',
  utilities: 'Utilities',
  council_tax: 'Council Tax',
  ground_rent: 'Ground Rent',
  service_charge_expense: 'Service Charge (Expense)',
  advertising: 'Advertising',
  travel: 'Travel',
  office_costs: 'Office Costs',
  capital_expenditure: 'Capital Expenditure',
  other_expense: 'Other Expense',
  deposit_in: 'Deposit In',
  deposit_out: 'Deposit Out',
  transfer: 'Transfer',
};

export interface FinancialTransaction {
  id: string;
  org_id: string;
  property_id: string | null;
  entity_id: string | null;
  date: string;
  description: string;
  category: TransactionCategory;
  amount: number;
  vat_amount: number;
  payment_method: string | null;
  reference: string | null;
  receipt_url: string | null;
  bank_statement_ref: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface BankStatementEntry {
  id: string;
  org_id: string;
  bank_account_name: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  matched_transaction_id: string | null;
  status: 'unmatched' | 'matched' | 'ignored';
  imported_at: string;
}

export interface TransactionFilters {
  propertyId?: string;
  entityId?: string;
  category?: TransactionCategory;
  dateFrom?: string;
  dateTo?: string;
  reconciled?: boolean;
}

export interface CreateTransactionInput {
  property_id?: string | null;
  entity_id?: string | null;
  date: string;
  description: string;
  category: TransactionCategory;
  amount: number;
  vat_amount?: number;
  payment_method?: string | null;
  reference?: string | null;
  receipt_url?: string | null;
  bank_statement_ref?: string | null;
  notes?: string | null;
}

export type ProfitAndLossPeriod = 'monthly' | 'quarterly' | 'annual';

export interface ProfitAndLossRow {
  category: TransactionCategory;
  label: string;
  amount: number;
}

export interface ProfitAndLossData {
  income: ProfitAndLossRow[];
  totalIncome: number;
  operatingExpenses: ProfitAndLossRow[];
  totalOperatingExpenses: number;
  netOperatingIncome: number;
  financeCosts: ProfitAndLossRow[];
  totalFinanceCosts: number;
  netProfit: number;
  periodLabel: string;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useTransactions(filters?: TransactionFilters) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['financial_transactions', org?.id, filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('financial_transactions')
        .select('*')
        .eq('org_id', org!.id)
        .order('date', { ascending: false });

      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('date', filters.dateTo);
      if (filters?.reconciled !== undefined) query = query.eq('reconciled', filters.reconciled);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinancialTransaction[];
    },
    enabled: !!org?.id,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('financial_transactions')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as FinancialTransaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success('Transaction created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('financial_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success('Transaction deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBulkImportTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CreateTransactionInput[]) => {
      const orgId = await fetchUserOrgId();
      const payload = rows.map(r => ({ ...r, org_id: orgId }));
      // Insert in chunks of 100
      let total = 0;
      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabaseAny
          .from('financial_transactions')
          .insert(chunk);
        if (error) throw error;
        total += chunk.length;
      }
      return total;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success(`${count} transactions imported`);
    },
    onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
  });
}

// ── Bank Statements ────────────────────────────────────────────────────

export function useBankStatements(statusFilter?: 'unmatched' | 'matched' | 'ignored') {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['bank_statement_entries', org?.id, statusFilter],
    queryFn: async () => {
      let query = supabaseAny
        .from('bank_statement_entries')
        .select('*')
        .eq('org_id', org!.id)
        .order('date', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BankStatementEntry[];
    },
    enabled: !!org?.id,
  });
}

export function useImportBankStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bankAccountName,
      entries,
    }: {
      bankAccountName: string;
      entries: Array<{ date: string; description: string; amount: number; balance?: number }>;
    }) => {
      const orgId = await fetchUserOrgId();
      const payload = entries.map(e => ({
        org_id: orgId,
        bank_account_name: bankAccountName,
        date: e.date,
        description: e.description,
        amount: e.amount,
        balance: e.balance ?? null,
        status: 'unmatched',
      }));
      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabaseAny
          .from('bank_statement_entries')
          .insert(chunk);
        if (error) throw error;
      }
      return payload.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['bank_statement_entries'] });
      toast.success(`${count} bank statement entries imported`);
    },
    onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
  });
}

export function useReconcileTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bankEntryId,
      transactionId,
    }: {
      bankEntryId: string;
      transactionId: string;
    }) => {
      // Link the bank entry to the transaction
      const { error: entryError } = await supabaseAny
        .from('bank_statement_entries')
        .update({ matched_transaction_id: transactionId, status: 'matched' })
        .eq('id', bankEntryId);
      if (entryError) throw entryError;

      // Mark the transaction as reconciled
      const { error: txnError } = await supabaseAny
        .from('financial_transactions')
        .update({ reconciled: true, reconciled_at: new Date().toISOString() })
        .eq('id', transactionId);
      if (txnError) throw txnError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_statement_entries'] });
      qc.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success('Transaction reconciled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnmatchBankEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bankEntryId: string) => {
      // Get current matched transaction
      const { data: entry, error: fetchError } = await supabaseAny
        .from('bank_statement_entries')
        .select('matched_transaction_id')
        .eq('id', bankEntryId)
        .single();
      if (fetchError) throw fetchError;

      // Unlink
      const { error: entryError } = await supabaseAny
        .from('bank_statement_entries')
        .update({ matched_transaction_id: null, status: 'unmatched' })
        .eq('id', bankEntryId);
      if (entryError) throw entryError;

      if (entry?.matched_transaction_id) {
        const { error: txnError } = await supabaseAny
          .from('financial_transactions')
          .update({ reconciled: false, reconciled_at: null })
          .eq('id', entry.matched_transaction_id);
        if (txnError) throw txnError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_statement_entries'] });
      qc.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success('Match removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useIgnoreBankEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bankEntryId: string) => {
      const { error } = await supabaseAny
        .from('bank_statement_entries')
        .update({ status: 'ignored' })
        .eq('id', bankEntryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_statement_entries'] });
      toast.success('Entry ignored');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── P&L ────────────────────────────────────────────────────────────────

const PL_INCOME_CATS: TransactionCategory[] = ['rental_income', 'service_charge_income', 'other_income'];
const PL_OPERATING_CATS: TransactionCategory[] = [
  'insurance', 'repairs_maintenance', 'management_fees', 'legal_professional',
  'utilities', 'council_tax', 'ground_rent', 'service_charge_expense',
  'advertising', 'travel', 'office_costs', 'other_expense',
];
const PL_FINANCE_CATS: TransactionCategory[] = ['mortgage_interest', 'mortgage_capital'];

function aggregateByCategory(
  transactions: FinancialTransaction[],
  categories: TransactionCategory[],
): ProfitAndLossRow[] {
  const map = new Map<TransactionCategory, number>();
  for (const cat of categories) map.set(cat, 0);
  for (const txn of transactions) {
    if (map.has(txn.category)) {
      map.set(txn.category, (map.get(txn.category) ?? 0) + Number(txn.amount));
    }
  }
  return categories
    .map(cat => ({ category: cat, label: CATEGORY_LABEL_MAP[cat], amount: map.get(cat) ?? 0 }))
    .filter(r => r.amount !== 0);
}

export function useProfitAndLoss(
  period: ProfitAndLossPeriod,
  dateFrom: string,
  dateTo: string,
  propertyId?: string,
  entityId?: string,
) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['profit_and_loss', org?.id, period, dateFrom, dateTo, propertyId, entityId],
    queryFn: async () => {
      let query = supabaseAny
        .from('financial_transactions')
        .select('*')
        .eq('org_id', org!.id)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date');

      if (propertyId) query = query.eq('property_id', propertyId);
      if (entityId) query = query.eq('entity_id', entityId);

      const { data, error } = await query;
      if (error) throw error;
      const txns = (data || []) as FinancialTransaction[];

      const income = aggregateByCategory(txns, PL_INCOME_CATS);
      const totalIncome = income.reduce((s, r) => s + r.amount, 0);

      const operatingExpenses = aggregateByCategory(txns, PL_OPERATING_CATS);
      const totalOperatingExpenses = Math.abs(operatingExpenses.reduce((s, r) => s + r.amount, 0));

      const netOperatingIncome = totalIncome - totalOperatingExpenses;

      const financeCosts = aggregateByCategory(txns, PL_FINANCE_CATS);
      const totalFinanceCosts = Math.abs(financeCosts.reduce((s, r) => s + r.amount, 0));

      const netProfit = netOperatingIncome - totalFinanceCosts;

      const periodLabel = `${format(new Date(dateFrom), 'dd MMM yyyy')} – ${format(new Date(dateTo), 'dd MMM yyyy')}`;

      return {
        income,
        totalIncome,
        operatingExpenses,
        totalOperatingExpenses,
        netOperatingIncome,
        financeCosts,
        totalFinanceCosts,
        netProfit,
        periodLabel,
      } as ProfitAndLossData;
    },
    enabled: !!org?.id && !!dateFrom && !!dateTo,
  });
}

// ── Export ──────────────────────────────────────────────────────────────

export type AccountingExportFormat = 'xero' | 'sage' | 'freeagent' | 'generic';

function escCsv(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function useExportAccounting() {
  return useMutation({
    mutationFn: async ({
      fmt,
      dateFrom,
      dateTo,
      orgId,
    }: {
      fmt: AccountingExportFormat;
      dateFrom: string;
      dateTo: string;
      orgId: string;
    }) => {
      const { data, error } = await supabaseAny
        .from('financial_transactions')
        .select('*')
        .eq('org_id', orgId)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date');
      if (error) throw error;

      const txns = (data || []) as FinancialTransaction[];
      let csv = '';

      switch (fmt) {
        case 'xero':
          csv = [
            ['*Date', '*Amount', '*AccountCode', 'Description', 'Reference', 'TaxType'].join(','),
            ...txns.map(t =>
              [
                escCsv(format(new Date(t.date), 'dd/MM/yyyy')),
                escCsv(t.amount),
                escCsv(t.category),
                escCsv(t.description),
                escCsv(t.reference),
                escCsv(t.vat_amount ? 'OUTPUT2' : 'NONE'),
              ].join(','),
            ),
          ].join('\n');
          break;
        case 'sage':
          csv = [
            ['Type', 'Date', 'Nominal', 'Reference', 'Details', 'Net', 'VAT', 'Tax Code'].join(','),
            ...txns.map(t =>
              [
                escCsv(t.amount >= 0 ? 'SI' : 'PI'),
                escCsv(format(new Date(t.date), 'dd/MM/yyyy')),
                escCsv(t.category),
                escCsv(t.reference),
                escCsv(t.description),
                escCsv(t.amount),
                escCsv(t.vat_amount),
                escCsv(t.vat_amount ? 'T1' : 'T0'),
              ].join(','),
            ),
          ].join('\n');
          break;
        case 'freeagent':
          csv = [
            ['Date', 'Amount', 'Description', 'Category'].join(','),
            ...txns.map(t =>
              [
                escCsv(format(new Date(t.date), 'dd/MM/yyyy')),
                escCsv(t.amount),
                escCsv(t.description),
                escCsv(CATEGORY_LABEL_MAP[t.category]),
              ].join(','),
            ),
          ].join('\n');
          break;
        default:
          csv = [
            ['Date', 'Description', 'Category', 'Amount', 'VAT', 'Reference', 'Reconciled'].join(','),
            ...txns.map(t =>
              [
                escCsv(t.date),
                escCsv(t.description),
                escCsv(CATEGORY_LABEL_MAP[t.category]),
                escCsv(t.amount),
                escCsv(t.vat_amount),
                escCsv(t.reference),
                escCsv(t.reconciled ? 'Yes' : 'No'),
              ].join(','),
            ),
          ].join('\n');
      }

      return { csv, count: txns.length };
    },
  });
}
