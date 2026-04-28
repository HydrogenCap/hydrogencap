-- Stage A V1 Freeze: add BEFORE INSERT/UPDATE/DELETE triggers on V1 tables
-- (properties, rooms, tenants) that have V2 replacements.
-- Reads remain permitted. Backfill (Stage B) and drop (Stage C) come later.
-- Skipped: loans, income, costs, tenancies (no V2 replacement yet).

CREATE OR REPLACE FUNCTION public.v1_freeze_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v2_name text;
BEGIN
  v2_name := TG_TABLE_NAME || '_v2';
  RAISE EXCEPTION 'V1 table % is frozen — write to % instead', TG_TABLE_NAME, v2_name
    USING ERRCODE = 'check_violation';
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['properties', 'rooms', 'tenants']
  LOOP
    -- Only attach if the table still exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS v1_freeze_guard ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard()',
        tbl
      );
    END IF;
  END LOOP;
END;
$$;