
-- ===== Section 2.3: Work Orders =====

-- 1a. work_orders table
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  wo_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity_id UUID NOT NULL REFERENCES public.legal_entities(id),
  property_id UUID REFERENCES public.properties_v2(id),
  room_id UUID REFERENCES public.rooms_v2(id),
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  estimated_cost NUMERIC(12,2),
  approved_budget NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'draft',
  raised_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  maintenance_request_id UUID REFERENCES public.maintenance_requests(id),
  target_start_date DATE,
  target_completion_date DATE,
  actual_start_date DATE,
  actual_completion_date DATE,
  invoice_reference TEXT,
  invoice_amount NUMERIC(12,2),
  invoice_date DATE,
  payment_status TEXT DEFAULT 'unpaid',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for category
CREATE OR REPLACE FUNCTION public.validate_work_order()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('compliance','reactive','planned','improvement','refurbishment','void_works','emergency','general') THEN
    RAISE EXCEPTION 'Invalid work order category: %', NEW.category;
  END IF;
  IF NEW.priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid work order priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('draft','submitted','approved','rejected','in_progress','completed','invoiced','closed','cancelled') THEN
    RAISE EXCEPTION 'Invalid work order status: %', NEW.status;
  END IF;
  IF NEW.payment_status IS NOT NULL AND NEW.payment_status NOT IN ('unpaid','invoiced','approved','paid') THEN
    RAISE EXCEPTION 'Invalid payment status: %', NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_work_order_trigger
  BEFORE INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_work_order();

-- Indexes
CREATE UNIQUE INDEX idx_work_orders_wo_number ON public.work_orders(org_id, wo_number);
CREATE INDEX idx_work_orders_org ON public.work_orders(org_id);
CREATE INDEX idx_work_orders_entity ON public.work_orders(entity_id);
CREATE INDEX idx_work_orders_property ON public.work_orders(property_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);

-- RLS
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_org" ON public.work_orders
  FOR ALL USING (org_id = (SELECT public.get_user_org_id()));

-- updated_at trigger
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1b. Add work_order_id to contractor_jobs
ALTER TABLE public.contractor_jobs
  ADD COLUMN work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL;
CREATE INDEX idx_contractor_jobs_wo ON public.contractor_jobs(work_order_id);

-- 1c. work_order_costs table
CREATE TABLE public.work_order_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'labour',
  amount NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) DEFAULT 0,
  contractor_job_id UUID REFERENCES public.contractor_jobs(id),
  invoice_reference TEXT,
  receipt_url TEXT,
  is_estimated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for cost category
CREATE OR REPLACE FUNCTION public.validate_work_order_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('labour','materials','plant_hire','subcontractor','fees','other') THEN
    RAISE EXCEPTION 'Invalid cost category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_work_order_cost_trigger
  BEFORE INSERT OR UPDATE ON public.work_order_costs
  FOR EACH ROW EXECUTE FUNCTION public.validate_work_order_cost();

CREATE INDEX idx_wo_costs_wo ON public.work_order_costs(work_order_id);
CREATE INDEX idx_wo_costs_job ON public.work_order_costs(contractor_job_id);

ALTER TABLE public.work_order_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo_costs_org" ON public.work_order_costs
  FOR ALL USING (org_id = (SELECT public.get_user_org_id()));

-- 1d. WO number generator
CREATE OR REPLACE FUNCTION public.generate_wo_number(p_org_id UUID, p_entity_id UUID)
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(entity_name, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_prefix
  FROM public.legal_entities
  WHERE id = p_entity_id;

  v_prefix := COALESCE(v_prefix, 'GEN');

  SELECT COALESCE(MAX(
    CAST(REGEXP_REPLACE(wo_number, '.*-', '') AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM public.work_orders
  WHERE org_id = p_org_id;

  RETURN 'WO-' || v_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
