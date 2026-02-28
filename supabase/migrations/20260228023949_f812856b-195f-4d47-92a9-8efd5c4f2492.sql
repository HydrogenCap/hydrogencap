-- =============================================
-- V5: Composite indexes for high-frequency query patterns
-- =============================================

-- ─── Properties ───
CREATE INDEX IF NOT EXISTS idx_properties_org_lifecycle
  ON public.properties (org_id, lifecycle_type);

CREATE INDEX IF NOT EXISTS idx_properties_org_postcode_area
  ON public.properties (org_id, postcode_area);

-- ─── Compliance Items ───
CREATE INDEX IF NOT EXISTS idx_compliance_items_org_expiry
  ON public.compliance_items (org_id, expiry_date);

CREATE INDEX IF NOT EXISTS idx_compliance_items_property_type
  ON public.compliance_items (property_id, compliance_type);

-- ─── Rent Schedule ───
CREATE INDEX IF NOT EXISTS idx_rent_schedule_status_due
  ON public.rent_schedule (status, due_date);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_tenancy_due
  ON public.rent_schedule (tenancy_id, due_date DESC);

-- ─── Rent Payments ───
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenancy_date
  ON public.rent_payments (tenancy_id, payment_date DESC);

-- ─── Tenancies ───
CREATE INDEX IF NOT EXISTS idx_tenancies_property_status
  ON public.tenancies (property_id, status);

CREATE INDEX IF NOT EXISTS idx_tenancies_org_status
  ON public.tenancies (org_id, status);

-- ─── Documents ───
CREATE INDEX IF NOT EXISTS idx_documents_org_property
  ON public.documents (org_id, property_id);

CREATE INDEX IF NOT EXISTS idx_documents_org_extraction
  ON public.documents (org_id, extraction_status);

-- ─── Activity Log ───
CREATE INDEX IF NOT EXISTS idx_activity_log_org_property_date
  ON public.activity_log (org_id, property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_org_type
  ON public.activity_log (org_id, entry_type, created_at DESC);

-- ─── Maintenance Requests ───
CREATE INDEX IF NOT EXISTS idx_maintenance_property_status
  ON public.maintenance_requests (property_id, status);

-- ─── Loans ───
CREATE INDEX IF NOT EXISTS idx_loans_property
  ON public.loans (property_id);

-- ─── Contractor Jobs (compliance jobs) ───
CREATE INDEX IF NOT EXISTS idx_contractor_jobs_org_status
  ON public.contractor_jobs (org_id, status)
  WHERE status IN ('draft', 'requested', 'quoted', 'booked');

-- ─── Partial indexes for common filters ───
CREATE INDEX IF NOT EXISTS idx_tenancies_active
  ON public.tenancies (property_id, org_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rent_schedule_overdue
  ON public.rent_schedule (tenancy_id, due_date)
  WHERE status = 'overdue';

CREATE INDEX IF NOT EXISTS idx_compliance_docs_current
  ON public.compliance_documents (compliance_item_id)
  WHERE is_current = true;

-- Update query planner statistics
ANALYZE public.properties;
ANALYZE public.compliance_items;
ANALYZE public.rent_schedule;
ANALYZE public.rent_payments;
ANALYZE public.tenancies;
ANALYZE public.documents;
ANALYZE public.activity_log;
ANALYZE public.maintenance_requests;
ANALYZE public.loans;
ANALYZE public.contractor_jobs;
ANALYZE public.compliance_documents;