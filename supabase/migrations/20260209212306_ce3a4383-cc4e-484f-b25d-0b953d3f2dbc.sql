-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

-- Create tenancy_compliance_items table
CREATE TABLE public.tenancy_compliance_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  item_type text NOT NULL,
  label text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_applicable boolean NOT NULL DEFAULT true,
  completed_date date,
  completed_by text,
  document_url text,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenancy_compliance_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-based via memberships)
CREATE POLICY "Users can view tenancy compliance items in their org"
  ON public.tenancy_compliance_items FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert tenancy compliance items in their org"
  ON public.tenancy_compliance_items FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update tenancy compliance items in their org"
  ON public.tenancy_compliance_items FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete tenancy compliance items in their org"
  ON public.tenancy_compliance_items FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_tenancy_compliance_items_updated_at
  BEFORE UPDATE ON public.tenancy_compliance_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_tenancy_compliance_tenancy_id ON public.tenancy_compliance_items(tenancy_id);
CREATE INDEX idx_tenancy_compliance_org_id ON public.tenancy_compliance_items(org_id);

-- Auto-generation function (SECURITY DEFINER to access other tables)
CREATE OR REPLACE FUNCTION public.generate_tenancy_compliance_items(tenancy_row tenancies)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_type text;
  v_has_gas boolean;
  v_deposit_amount numeric;
  v_start_date date;
  v_org_id uuid;
  v_tenancy_id uuid;
BEGIN
  v_tenancy_id := tenancy_row.id;
  v_org_id := tenancy_row.org_id;
  v_start_date := tenancy_row.start_date;
  v_deposit_amount := tenancy_row.deposit_amount;

  -- Look up tenant type
  SELECT tenant_type INTO v_tenant_type
  FROM tenants WHERE id = tenancy_row.tenant_id;

  -- Look up property gas status
  SELECT has_gas INTO v_has_gas
  FROM properties WHERE id = tenancy_row.property_id;

  -- Items for ALL tenancies
  INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
  VALUES
    (v_tenancy_id, v_org_id, 'tenancy_agreement_signed', 'Tenancy agreement signed by all parties', v_start_date, NULL),
    (v_tenancy_id, v_org_id, 'epc_to_tenant', 'EPC provided to tenant', v_start_date, 'Must be provided before tenancy begins'),
    (v_tenancy_id, v_org_id, 'inventory_completed', 'Inventory / schedule of condition completed', v_start_date, NULL),
    (v_tenancy_id, v_org_id, 'standing_order_setup', 'Payment method confirmed', v_start_date + interval '7 days', NULL),
    (v_tenancy_id, v_org_id, 'smoke_co_alarms', 'Smoke and CO alarms tested and confirmed working', v_start_date, NULL);

  -- Gas cert — conditional on has_gas
  IF v_has_gas IS NOT FALSE THEN
    INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
    VALUES (v_tenancy_id, v_org_id, 'gas_cert_to_tenant', 'Gas Safety Certificate provided to tenant', v_start_date, NULL);
  ELSE
    INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes, is_applicable)
    VALUES (v_tenancy_id, v_org_id, 'gas_cert_to_tenant', 'Gas Safety Certificate provided to tenant', v_start_date, 'No gas supply at property', false);
  END IF;

  -- Individual tenant items
  IF v_tenant_type = 'individual' THEN
    INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
    VALUES
      (v_tenancy_id, v_org_id, 'right_to_rent', 'Right to Rent check completed', v_start_date, 'Immigration Act 2014 — must be checked before occupation'),
      (v_tenancy_id, v_org_id, 'how_to_rent', 'How to Rent guide provided', v_start_date, 'Required for valid Section 21 notice');

    -- Deposit items for individuals (only if deposit > 0)
    IF COALESCE(v_deposit_amount, 0) > 0 THEN
      INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
      VALUES
        (v_tenancy_id, v_org_id, 'deposit_protection', 'Deposit protected with approved scheme', v_start_date + interval '30 days', NULL),
        (v_tenancy_id, v_org_id, 'deposit_prescribed_info', 'Deposit prescribed information served', v_start_date + interval '30 days', 'Must include scheme details, landlord contact, dispute resolution info');
    END IF;
  END IF;

  -- Company tenant items
  IF v_tenant_type = 'company' THEN
    INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
    VALUES
      (v_tenancy_id, v_org_id, 'company_verification', 'Company verification completed (Companies House check)', v_start_date, 'Verify company is active and not dissolved'),
      (v_tenancy_id, v_org_id, 'authorised_signatory', 'Authorised signatory confirmed', v_start_date, 'Confirm the person signing has authority to bind the company');

    -- Right to rent note — not applicable for company lets
    INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes, is_required, is_applicable)
    VALUES (v_tenancy_id, v_org_id, 'right_to_rent_note', 'Right to Rent — company let exemption noted', v_start_date,
      'Right to Rent does not apply to company lets. If the company sub-lets to individuals, the company is responsible for Right to Rent checks on those occupiers.',
      false, false);

    -- Deposit for company tenants (only if deposit > 0)
    IF COALESCE(v_deposit_amount, 0) > 0 THEN
      INSERT INTO tenancy_compliance_items (tenancy_id, org_id, item_type, label, due_date, notes)
      VALUES (v_tenancy_id, v_org_id, 'deposit_protection_company', 'Deposit protected (if applicable)', v_start_date + interval '30 days',
        'Review whether this is an AST or company let — deposit protection is mandatory for ASTs only');
    END IF;
  END IF;
END;
$$;

-- Trigger to auto-generate on tenancy insert
CREATE OR REPLACE FUNCTION public.trigger_generate_tenancy_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM generate_tenancy_compliance_items(NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_tenancy_compliance_after_insert
  AFTER INSERT ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_tenancy_compliance();

-- Backfill existing active tenancies
DO $$
DECLARE
  t tenancies%ROWTYPE;
BEGIN
  FOR t IN SELECT * FROM tenancies WHERE status = 'active'
  LOOP
    PERFORM generate_tenancy_compliance_items(t);
  END LOOP;
END;
$$;
