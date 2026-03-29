-- Migration 3: ownership_links FK constraint + validation trigger

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

DROP TRIGGER IF EXISTS trg_validate_ownership_links_subject ON public.ownership_links;
CREATE TRIGGER trg_validate_ownership_links_subject
  BEFORE INSERT OR UPDATE ON public.ownership_links
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ownership_links_subject_id();