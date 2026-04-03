-- Work order lifecycle: approval workflow, material tracking, warranty management

-- ─── Approval columns on work_orders ────────────────────────────────

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_threshold NUMERIC DEFAULT 500,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected'));

-- approved_by and approved_at already exist on work_orders

-- ─── Work Order Materials ───────────────────────────────────────────

CREATE TABLE public.work_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier TEXT,
  receipt_url TEXT,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org work order materials"
  ON public.work_order_materials FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create work order materials for own org"
  ON public.work_order_materials FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org work order materials"
  ON public.work_order_materials FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org work order materials"
  ON public.work_order_materials FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_work_order_materials_wo ON public.work_order_materials(work_order_id);
CREATE INDEX idx_work_order_materials_org ON public.work_order_materials(org_id);

-- ─── Work Order Warranties ──────────────────────────────────────────

CREATE TABLE public.work_order_warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties_v2(id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  description TEXT NOT NULL,
  warranty_provider TEXT,
  warranty_start DATE NOT NULL,
  warranty_end DATE NOT NULL,
  terms TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org work order warranties"
  ON public.work_order_warranties FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create work order warranties for own org"
  ON public.work_order_warranties FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org work order warranties"
  ON public.work_order_warranties FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org work order warranties"
  ON public.work_order_warranties FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_work_order_warranties_wo ON public.work_order_warranties(work_order_id);
CREATE INDEX idx_work_order_warranties_org ON public.work_order_warranties(org_id);
CREATE INDEX idx_work_order_warranties_property ON public.work_order_warranties(property_id);
CREATE INDEX idx_work_order_warranties_expiry ON public.work_order_warranties(warranty_end);
