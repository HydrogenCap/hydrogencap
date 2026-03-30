-- Add missing indexes on FK columns added in recent migrations
-- These were added without corresponding indexes, causing full table scans
-- on RLS policy lookups and join queries.

-- properties_v2 legal ownership FKs (added in 20260329010232 without indexes)
CREATE INDEX IF NOT EXISTS idx_properties_v2_legal_owner_company
  ON public.properties_v2(legal_owner_company_id)
  WHERE legal_owner_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_v2_legal_owner_party
  ON public.properties_v2(legal_owner_party_id)
  WHERE legal_owner_party_id IS NOT NULL;

-- ownership_links subject_id: polymorphic FK used in batch .in() queries
-- from useOwnershipLinks hook
CREATE INDEX IF NOT EXISTS idx_ownership_links_subject_id
  ON public.ownership_links(subject_id);

-- scheduled_email_runs org_id: used in RLS policy predicate
CREATE INDEX IF NOT EXISTS idx_scheduled_email_runs_org_id
  ON public.scheduled_email_runs(org_id);
