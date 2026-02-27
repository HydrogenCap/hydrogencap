
-- ========================================
-- Phase 2.1: Bank Reconciliation Tables
-- ========================================

-- 1. Bank Accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  sort_code text,
  account_number text,
  account_type text NOT NULL DEFAULT 'current',
  currency text DEFAULT 'GBP',
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bank_accounts_entity ON public.bank_accounts(entity_id);
CREATE INDEX idx_bank_accounts_org ON public.bank_accounts(org_id);

-- 2. Import Batches (must exist before bank_transactions references it)
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  date_range_start date,
  date_range_end date,
  status text DEFAULT 'completed',
  error_message text,
  imported_by uuid,
  imported_at timestamptz DEFAULT now()
);

-- 3. Bank Transactions
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  transaction_date date NOT NULL,
  description text NOT NULL,
  reference text,
  amount numeric(10,2) NOT NULL,
  transaction_type text NOT NULL,
  balance_after numeric(12,2),
  import_batch_id uuid REFERENCES public.import_batches(id),
  import_source text DEFAULT 'csv',
  is_duplicate boolean DEFAULT false,
  is_reconciled boolean DEFAULT false,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bank_txn_account ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_txn_date ON public.bank_transactions(transaction_date);
CREATE INDEX idx_bank_txn_batch ON public.bank_transactions(import_batch_id);
CREATE INDEX idx_bank_txn_amount ON public.bank_transactions(amount);
CREATE INDEX idx_bank_txn_org ON public.bank_transactions(org_id);
CREATE INDEX idx_bank_txn_reconciled ON public.bank_transactions(is_reconciled) WHERE is_reconciled = false;

-- 4. Add bank_transaction_id to rent_payments for reconciliation link
ALTER TABLE public.rent_payments ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL;
ALTER TABLE public.rent_payments ADD COLUMN IF NOT EXISTS reconciliation_method text DEFAULT 'manual';
ALTER TABLE public.rent_payments ADD COLUMN IF NOT EXISTS match_confidence numeric(3,2);

-- 5. RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access org bank accounts" ON public.bank_accounts FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users access org bank transactions" ON public.bank_transactions FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users access org import batches" ON public.import_batches FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- 6. Audit triggers
CREATE TRIGGER audit_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 7. Updated_at triggers
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
