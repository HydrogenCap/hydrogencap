-- P1 data/auth hardening migration. Companion to the edge-function and
-- client-side fixes in the same batch.
--
--   1. rate_limits: add org_id so shared-org abuse doesn't bypass the limit
--   2. compliance_tasks: partial unique index so concurrent
--      auto-compliance-pipeline runs can't insert duplicate open tasks for
--      the same (property_id, document_type)
--   3. document_summaries: add error_message column (edge functions write
--      into it on failure; column was missing so errors weren't persisted)

-- =============================================================================
-- 1. rate_limits — add org_id + composite index for the new per-org check.
-- =============================================================================

ALTER TABLE public.rate_limits
  ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_rate_limits_org_function_time
  ON public.rate_limits (org_id, function_name, created_at DESC)
  WHERE org_id IS NOT NULL;

-- =============================================================================
-- 2. compliance_tasks — prevent duplicate OPEN tasks per (property, doc_type).
-- =============================================================================
--
-- The auto-compliance-pipeline checks for an existing open task before
-- inserting, but that check is NOT atomic — two concurrent runs can both pass
-- it and both insert. This partial unique index makes the second insert fail
-- with 23505, which the edge function now treats as "already created".
--
-- Before creating it, collapse any duplicates that already exist so the index
-- build doesn't error on legacy data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_tasks'
  ) THEN
    -- Delete duplicates, keeping the most recently updated one per group.
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY property_id, document_type
               ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
             ) AS rn
      FROM public.compliance_tasks
      WHERE status IN (
        'open', 'in_progress', 'waiting', 'pending',
        'contractor_assigned', 'contractor_requested', 'awaiting_upload'
      )
    )
    DELETE FROM public.compliance_tasks
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_tasks_open_unique
      ON public.compliance_tasks (property_id, document_type)
      WHERE status IN (
        'open', 'in_progress', 'waiting', 'pending',
        'contractor_assigned', 'contractor_requested', 'awaiting_upload'
      );
  END IF;
END $$;

-- =============================================================================
-- 3. document_summaries — error_message column for failed-run diagnostics.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_summaries'
  ) THEN
    ALTER TABLE public.document_summaries
      ADD COLUMN IF NOT EXISTS error_message TEXT;
  END IF;
END $$;
