CREATE OR REPLACE FUNCTION public.auto_waive_smoke_co_on_fire_alarm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.document_type = 'fire_alarm_cert' AND NEW.file_name IS NOT NULL AND NEW.property_id IS NOT NULL THEN
    UPDATE public.compliance_requirements_v2
    SET is_required = false,
        override_reason = 'Covered by Fire Alarm Certificate',
        updated_at = now()
    WHERE property_id = NEW.property_id
      AND document_type = 'smoke_co_alarm_cert'
      AND is_required = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_waive_smoke_co ON public.compliance_documents_v2;
CREATE TRIGGER trg_auto_waive_smoke_co
AFTER INSERT OR UPDATE OF file_name, document_type ON public.compliance_documents_v2
FOR EACH ROW
EXECUTE FUNCTION public.auto_waive_smoke_co_on_fire_alarm();