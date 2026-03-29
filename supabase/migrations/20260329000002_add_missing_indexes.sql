-- Performance: Add missing indexes identified in audit

-- rent_schedule: missing org_id index causes full table scan on RLS predicate
CREATE INDEX IF NOT EXISTS idx_rent_schedule_org_id
  ON public.rent_schedule(org_id);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_org_due_date
  ON public.rent_schedule(org_id, due_date);

-- compliance_items: composite index for expiry calendar queries
-- (existing separate single-column indexes can't satisfy ORDER BY in a single scan)
CREATE INDEX IF NOT EXISTS idx_compliance_items_org_expiry_sorted
  ON public.compliance_items(org_id, expiry_date ASC NULLS LAST);

-- compliance_items: composite index for compliance_type filter in hot path
CREATE INDEX IF NOT EXISTS idx_compliance_items_org_type
  ON public.compliance_items(org_id, compliance_type);

-- entity_shareholders: partial index for ownership chain traversal
-- (complements existing full index; partial avoids indexing NULL rows)
CREATE INDEX IF NOT EXISTS idx_entity_shareholders_shareholder_entity_partial
  ON public.entity_shareholders(shareholder_entity_id)
  WHERE shareholder_entity_id IS NOT NULL;

-- activity_log: composite index for property timeline queries (org + date desc)
CREATE INDEX IF NOT EXISTS idx_activity_log_org_created_desc
  ON public.activity_log(org_id, created_at DESC);
