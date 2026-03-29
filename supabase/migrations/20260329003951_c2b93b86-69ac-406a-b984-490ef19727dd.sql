-- Migration 2: Performance indexes

CREATE INDEX IF NOT EXISTS idx_rent_schedule_org_id
  ON public.rent_schedule(org_id);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_org_due_date
  ON public.rent_schedule(org_id, due_date);

CREATE INDEX IF NOT EXISTS idx_compliance_items_org_expiry_sorted
  ON public.compliance_items(org_id, expiry_date ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_compliance_items_org_type
  ON public.compliance_items(org_id, compliance_type);

CREATE INDEX IF NOT EXISTS idx_entity_shareholders_shareholder_entity_partial
  ON public.entity_shareholders(shareholder_entity_id)
  WHERE shareholder_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_org_created_desc
  ON public.activity_log(org_id, created_at DESC);