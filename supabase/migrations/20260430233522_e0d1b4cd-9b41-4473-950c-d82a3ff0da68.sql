
BEGIN;

-- =====================================================================
-- Class-B §7 cosmetic-bucket re-point: 6 FKs, zero rows, zero RLS impact
-- Mirror of Prompt #28 pattern, applied to the 6 cosmetic FKs from §7.
-- All from-tables verified 0 populated rows on 2026-05-01.
-- All from-tables verified 0 RLS policies referencing `properties`.
-- =====================================================================

-- ---------- 1. capex_projects.property_id (CASCADE) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.capex_projects
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'capex_projects.property_id preflight failed: % orphan rows (expected 0 — cosmetic bucket)', orphan_count;
  END IF;
END $$;

ALTER TABLE public.capex_projects DROP CONSTRAINT IF EXISTS capex_projects_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capex_projects_property_id_fkey') THEN
    ALTER TABLE public.capex_projects
      ADD CONSTRAINT capex_projects_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------- 2. comparable_sales.source_property_id (CASCADE) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.comparable_sales
  WHERE source_property_id IS NOT NULL
    AND source_property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'comparable_sales.source_property_id preflight failed: % orphan rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.comparable_sales DROP CONSTRAINT IF EXISTS comparable_sales_source_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comparable_sales_source_property_id_fkey') THEN
    ALTER TABLE public.comparable_sales
      ADD CONSTRAINT comparable_sales_source_property_id_fkey
      FOREIGN KEY (source_property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------- 3. document_summaries.property_id (NO ACTION) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.document_summaries
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'document_summaries.property_id preflight failed: % orphan rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.document_summaries DROP CONSTRAINT IF EXISTS document_summaries_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_summaries_property_id_fkey') THEN
    ALTER TABLE public.document_summaries
      ADD CONSTRAINT document_summaries_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE NO ACTION;
  END IF;
END $$;

-- ---------- 4. inbound_emails.matched_property_id (NO ACTION) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.inbound_emails
  WHERE matched_property_id IS NOT NULL
    AND matched_property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'inbound_emails.matched_property_id preflight failed: % orphan rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.inbound_emails DROP CONSTRAINT IF EXISTS inbound_emails_matched_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_emails_matched_property_id_fkey') THEN
    ALTER TABLE public.inbound_emails
      ADD CONSTRAINT inbound_emails_matched_property_id_fkey
      FOREIGN KEY (matched_property_id) REFERENCES public.properties_v2(id) ON DELETE NO ACTION;
  END IF;
END $$;

-- ---------- 5. leasehold_details.property_id (CASCADE) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.leasehold_details
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'leasehold_details.property_id preflight failed: % orphan rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.leasehold_details DROP CONSTRAINT IF EXISTS leasehold_details_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leasehold_details_property_id_fkey') THEN
    ALTER TABLE public.leasehold_details
      ADD CONSTRAINT leasehold_details_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------- 6. void_periods.property_id (CASCADE) ----------
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.void_periods
  WHERE property_id IS NOT NULL
    AND property_id NOT IN (SELECT id FROM public.properties_v2);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'void_periods.property_id preflight failed: % orphan rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.void_periods DROP CONSTRAINT IF EXISTS void_periods_property_id_fkey;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'void_periods_property_id_fkey') THEN
    ALTER TABLE public.void_periods
      ADD CONSTRAINT void_periods_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
