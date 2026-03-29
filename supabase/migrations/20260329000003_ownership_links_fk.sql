-- Referential integrity for ownership_links.subject_id (polymorphic FK)
-- Since subject_id is polymorphic (COMPANY or PROPERTY), a direct FK is not
-- possible. We add a CHECK on subject_type and a trigger to validate existence.

-- 1. Ensure subject_type is constrained to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ownership_links'
      AND constraint_name = 'ownership_links_subject_type_check'
  ) THEN
    ALTER TABLE public.ownership_links
      ADD CONSTRAINT ownership_links_subject_type_check
      CHECK (subject_type IN ('COMPANY', 'PROPERTY'));
  END IF;
END $$;

-- 2. Trigger function to validate subject_id exists in the correct table
CREATE OR REPLACE FUNCTION public.validate_ownership_links_subject_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subject_type = 'COMPANY' THEN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'ownership_links: subject_id % does not exist in companies table', NEW.subject_id;
    END IF;
  ELSIF NEW.subject_type = 'PROPERTY' THEN
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'ownership_links: subject_id % does not exist in properties table', NEW.subject_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_validate_ownership_links_subject ON public.ownership_links;
CREATE TRIGGER trg_validate_ownership_links_subject
  BEFORE INSERT OR UPDATE ON public.ownership_links
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ownership_links_subject_id();
