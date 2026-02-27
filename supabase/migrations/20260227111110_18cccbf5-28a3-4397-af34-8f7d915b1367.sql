
-- Phase 2.3: Maintenance & Works Orders
-- ======================================

-- 1. Drop existing empty maintenance_requests table and old enums
DROP TABLE IF EXISTS public.maintenance_requests CASCADE;
DROP TYPE IF EXISTS public.maintenance_category CASCADE;
DROP TYPE IF EXISTS public.maintenance_urgency CASCADE;
DROP TYPE IF EXISTS public.maintenance_status CASCADE;

-- 2. Create maintenance_requests table (enhanced spec)
CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES public.rooms(id),
  tenant_id uuid REFERENCES public.tenants(id),
  reported_by text NOT NULL DEFAULT 'operator',
  category text NOT NULL DEFAULT 'other',
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  location_detail text,
  photo_urls text[],
  reported_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'reported',
  is_emergency boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  linked_request_id uuid REFERENCES public.maintenance_requests(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for reported_by
CREATE OR REPLACE FUNCTION public.validate_maintenance_request()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reported_by NOT IN ('tenant', 'operator', 'contractor', 'inspector', 'agent') THEN
    RAISE EXCEPTION 'Invalid reported_by value: %', NEW.reported_by;
  END IF;
  IF NEW.category NOT IN (
    'plumbing','electrical','heating','structural','damp_mould','pest_control',
    'appliance','locks_security','windows_doors','flooring','painting_decorating',
    'garden_external','cleaning','fire_safety','furniture','communal_areas',
    'roof_guttering','drainage','other'
  ) THEN
    RAISE EXCEPTION 'Invalid category value: %', NEW.category;
  END IF;
  IF NEW.priority NOT IN ('emergency', 'urgent', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid priority value: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN (
    'reported','triaged','quoted','approved','scheduled','in_progress',
    'completed','verified','closed','cancelled','on_hold'
  ) THEN
    RAISE EXCEPTION 'Invalid status value: %', NEW.status;
  END IF;
  IF NEW.priority = 'emergency' THEN
    NEW.is_emergency := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_maintenance_request_trigger
  BEFORE INSERT OR UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_maintenance_request();

CREATE INDEX idx_maintenance_requests_org ON public.maintenance_requests(org_id);
CREATE INDEX idx_maintenance_requests_property ON public.maintenance_requests(property_id);
CREATE INDEX idx_maintenance_requests_room ON public.maintenance_requests(room_id);
CREATE INDEX idx_maintenance_requests_tenant ON public.maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_requests_status ON public.maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_priority ON public.maintenance_requests(priority);
CREATE INDEX idx_maintenance_requests_category ON public.maintenance_requests(category);
CREATE INDEX idx_maintenance_requests_reported_date ON public.maintenance_requests(reported_date);

-- 3. Create works_orders table
CREATE TABLE public.works_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  contractor_id uuid REFERENCES public.compliance_contractors_v2(id),
  contractor_name_override text,
  contractor_phone_override text,
  contractor_email_override text,
  order_number text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  quoted_amount numeric(10,2),
  approved_amount numeric(10,2),
  invoice_amount numeric(10,2),
  paid_amount numeric(10,2),
  quote_date date,
  approval_date date,
  scheduled_date date,
  scheduled_time_slot text,
  scheduled_time text,
  completion_date date,
  invoice_reference text,
  invoice_date date,
  paid_date date,
  payment_method text,
  tenant_access_required boolean DEFAULT true,
  tenant_notified boolean DEFAULT false,
  tenant_notification_date date,
  warranty_months integer,
  warranty_expiry date,
  completion_notes text,
  completion_photo_urls text[],
  before_photo_urls text[],
  after_photo_urls text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for works_orders
CREATE OR REPLACE FUNCTION public.validate_works_order()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN (
    'draft','sent_to_contractor','quote_received','approved','scheduled',
    'in_progress','completed','invoiced','paid','cancelled','disputed'
  ) THEN
    RAISE EXCEPTION 'Invalid works order status: %', NEW.status;
  END IF;
  IF NEW.scheduled_time_slot IS NOT NULL AND NEW.scheduled_time_slot NOT IN ('morning','afternoon','all_day','specific') THEN
    RAISE EXCEPTION 'Invalid time slot: %', NEW.scheduled_time_slot;
  END IF;
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('bank_transfer','card','cash','cheque','account') THEN
    RAISE EXCEPTION 'Invalid payment method: %', NEW.payment_method;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_works_order_trigger
  BEFORE INSERT OR UPDATE ON public.works_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_works_order();

CREATE INDEX idx_works_orders_org ON public.works_orders(org_id);
CREATE INDEX idx_works_orders_request ON public.works_orders(maintenance_request_id);
CREATE INDEX idx_works_orders_property ON public.works_orders(property_id);
CREATE INDEX idx_works_orders_contractor ON public.works_orders(contractor_id);
CREATE INDEX idx_works_orders_status ON public.works_orders(status);
CREATE INDEX idx_works_orders_scheduled ON public.works_orders(scheduled_date);

-- 4. Create maintenance_comments table
CREATE TABLE public.maintenance_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  maintenance_request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  author_type text NOT NULL DEFAULT 'operator',
  author_name text NOT NULL,
  comment text NOT NULL,
  photo_urls text[],
  is_internal boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_maintenance_comment()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.author_type NOT IN ('operator', 'tenant', 'contractor', 'system') THEN
    RAISE EXCEPTION 'Invalid author_type: %', NEW.author_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_maintenance_comment_trigger
  BEFORE INSERT OR UPDATE ON public.maintenance_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_maintenance_comment();

CREATE INDEX idx_maintenance_comments_request ON public.maintenance_comments(maintenance_request_id);

-- 5. RLS Policies
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_access" ON public.maintenance_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = maintenance_requests.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = maintenance_requests.org_id)
  );

CREATE POLICY "org_member_access" ON public.works_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = works_orders.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = works_orders.org_id)
  );

CREATE POLICY "org_member_access" ON public.maintenance_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = maintenance_comments.org_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND org_id = maintenance_comments.org_id)
  );

-- Tenant portal access to maintenance_requests
CREATE POLICY "tenant_portal_access" ON public.maintenance_requests
  FOR SELECT USING (
    public.user_has_tenant_access_by_tenant_id(tenant_id)
  );

CREATE POLICY "tenant_portal_insert" ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    public.user_has_tenant_access_by_tenant_id(tenant_id)
  );

-- Tenant portal read access to comments (non-internal only handled in app)
CREATE POLICY "tenant_portal_comments" ON public.maintenance_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_comments.maintenance_request_id
      AND public.user_has_tenant_access_by_tenant_id(mr.tenant_id)
    )
  );

-- 6. Audit triggers
CREATE TRIGGER audit_maintenance_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_works_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.works_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- updated_at triggers
CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_works_orders_updated_at
  BEFORE UPDATE ON public.works_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Works order number sequence
CREATE SEQUENCE IF NOT EXISTS public.works_order_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_works_order_number()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RETURN 'WO-' || extract(year FROM current_date)::text || '-' || lpad(nextval('public.works_order_seq')::text, 4, '0');
END;
$$;

-- 8. Views
CREATE OR REPLACE VIEW public.maintenance_overview AS
SELECT
  mr.id AS request_id,
  mr.org_id,
  mr.property_id,
  p.address_line || ', ' || p.postcode AS property_address,
  mr.room_id,
  r.room_name,
  mr.tenant_id,
  t.first_name || ' ' || t.last_name AS tenant_name,
  mr.category,
  mr.priority,
  mr.title,
  mr.description,
  mr.status,
  mr.is_emergency,
  mr.is_recurring,
  mr.reported_date,
  mr.reported_by,
  current_date - mr.reported_date AS days_open,
  wo.id AS works_order_id,
  wo.order_number,
  wo.contractor_id,
  COALESCE(cc.company_name, wo.contractor_name_override) AS contractor_name,
  wo.status AS works_order_status,
  wo.quoted_amount,
  wo.approved_amount,
  wo.invoice_amount,
  wo.scheduled_date,
  wo.completion_date,
  (SELECT count(*) FROM public.maintenance_comments mc WHERE mc.maintenance_request_id = mr.id) AS comment_count
FROM public.maintenance_requests mr
JOIN public.properties p ON p.id = mr.property_id
LEFT JOIN public.rooms r ON r.id = mr.room_id
LEFT JOIN public.tenants t ON t.id = mr.tenant_id
LEFT JOIN public.works_orders wo ON wo.maintenance_request_id = mr.id AND wo.status NOT IN ('cancelled')
LEFT JOIN public.compliance_contractors_v2 cc ON cc.id = wo.contractor_id
ORDER BY
  CASE mr.priority WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
  mr.reported_date ASC;

CREATE OR REPLACE VIEW public.maintenance_spend_by_property AS
SELECT
  wo.property_id,
  wo.org_id,
  p.address_line || ', ' || p.postcode AS property_address,
  count(wo.id) AS total_jobs,
  count(wo.id) FILTER (WHERE wo.status IN ('completed','paid')) AS completed_jobs,
  COALESCE(sum(wo.invoice_amount) FILTER (WHERE wo.status IN ('invoiced','paid')), 0) AS total_invoiced,
  COALESCE(sum(wo.paid_amount) FILTER (WHERE wo.status = 'paid'), 0) AS total_paid,
  COALESCE(avg(wo.invoice_amount) FILTER (WHERE wo.invoice_amount > 0), 0) AS avg_job_cost,
  COALESCE(avg(wo.completion_date - mr.reported_date) FILTER (WHERE wo.completion_date IS NOT NULL), 0) AS avg_days_to_complete
FROM public.works_orders wo
JOIN public.maintenance_requests mr ON mr.id = wo.maintenance_request_id
JOIN public.properties p ON p.id = wo.property_id
WHERE wo.status NOT IN ('cancelled', 'draft')
GROUP BY wo.property_id, wo.org_id, p.address_line, p.postcode
ORDER BY total_paid DESC;

CREATE OR REPLACE VIEW public.maintenance_spend_by_category AS
SELECT
  mr.org_id,
  mr.category,
  count(wo.id) AS job_count,
  COALESCE(sum(wo.invoice_amount) FILTER (WHERE wo.status IN ('invoiced','paid')), 0) AS total_spend,
  COALESCE(avg(wo.invoice_amount) FILTER (WHERE wo.invoice_amount > 0), 0) AS avg_cost,
  COALESCE(avg(wo.completion_date - mr.reported_date) FILTER (WHERE wo.completion_date IS NOT NULL), 0) AS avg_resolution_days
FROM public.maintenance_requests mr
LEFT JOIN public.works_orders wo ON wo.maintenance_request_id = mr.id AND wo.status NOT IN ('cancelled', 'draft')
GROUP BY mr.org_id, mr.category
ORDER BY total_spend DESC;

CREATE OR REPLACE VIEW public.contractor_maintenance_performance AS
SELECT
  cc.id AS contractor_id,
  cc.org_id,
  cc.company_name,
  cc.service_types,
  cc.rating,
  count(wo.id) AS total_jobs,
  count(wo.id) FILTER (WHERE wo.status IN ('completed','paid')) AS completed_jobs,
  COALESCE(sum(wo.paid_amount), 0) AS total_paid,
  COALESCE(avg(wo.invoice_amount) FILTER (WHERE wo.invoice_amount > 0), 0) AS avg_job_cost,
  COALESCE(avg(wo.completion_date - wo.scheduled_date) FILTER (WHERE wo.completion_date IS NOT NULL AND wo.scheduled_date IS NOT NULL), 0) AS avg_days_over_schedule,
  COALESCE(avg(wo.completion_date - mr.reported_date) FILTER (WHERE wo.completion_date IS NOT NULL), 0) AS avg_report_to_completion_days,
  count(wo.id) FILTER (WHERE wo.status = 'disputed') AS disputed_jobs
FROM public.compliance_contractors_v2 cc
LEFT JOIN public.works_orders wo ON wo.contractor_id = cc.id
LEFT JOIN public.maintenance_requests mr ON mr.id = wo.maintenance_request_id
GROUP BY cc.id, cc.org_id, cc.company_name, cc.service_types, cc.rating
ORDER BY completed_jobs DESC;

CREATE OR REPLACE VIEW public.recurring_issue_detection AS
SELECT
  mr.org_id,
  mr.property_id,
  p.address_line || ', ' || p.postcode AS property_address,
  mr.category,
  count(*) AS request_count,
  min(mr.reported_date) AS first_reported,
  max(mr.reported_date) AS last_reported,
  COALESCE(sum(wo.invoice_amount), 0) AS total_spend
FROM public.maintenance_requests mr
JOIN public.properties p ON p.id = mr.property_id
LEFT JOIN public.works_orders wo ON wo.maintenance_request_id = mr.id AND wo.status NOT IN ('cancelled')
WHERE mr.reported_date >= current_date - interval '12 months'
  AND mr.status NOT IN ('cancelled')
GROUP BY mr.org_id, mr.property_id, p.address_line, p.postcode, mr.category
HAVING count(*) >= 3
ORDER BY count(*) DESC;

-- 9. Storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('maintenance-photos', 'maintenance-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "org_members_upload_maintenance_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "org_members_view_maintenance_photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'maintenance-photos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "org_members_delete_maintenance_photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-photos'
  AND auth.uid() IS NOT NULL
);
