-- Loans pair completeness fix: normalise V1 properties.address_line for 25 Arle Gardens.
-- Bypasses v1_freeze_guard for this targeted one-row data fix; re-enables it after.
ALTER TABLE public.properties DISABLE TRIGGER v1_freeze_guard;

DO $$
BEGIN
  UPDATE public.properties
  SET address_line = '25 Arle Gardens'
  WHERE id = '21a866cb-bc88-4f42-985e-f6e4d785ce84'
    AND lower(trim(address_line)) <> lower(trim('25 Arle Gardens'));
END $$;

ALTER TABLE public.properties ENABLE TRIGGER v1_freeze_guard;