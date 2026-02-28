-- P0-04: Fix audit_log RLS — scope to organisation

-- Step 1: Add org_id column
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(org_id);

-- Step 2: Replace overly permissive RLS policies
DROP POLICY IF EXISTS "Org members can read audit_log" ON public.audit_log;

CREATE POLICY "Org members can read own audit_log"
  ON public.audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT m.org_id FROM public.memberships m WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert into audit_log" ON public.audit_log;

CREATE POLICY "System can insert into audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- Step 3: Update the audit trigger function to capture org_id
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _old_values jsonb;
  _new_values jsonb;
  _changed_fields text[];
  _record_id uuid;
BEGIN
  -- Try to extract org_id from the record
  IF TG_OP = 'DELETE' THEN
    _old_values := to_jsonb(OLD);
    _new_values := NULL;
    _record_id := OLD.id;
    IF _old_values ? 'org_id' THEN
      _org_id := (_old_values->>'org_id')::uuid;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    _new_values := to_jsonb(NEW);
    _old_values := NULL;
    _record_id := NEW.id;
    IF _new_values ? 'org_id' THEN
      _org_id := (_new_values->>'org_id')::uuid;
    END IF;
  ELSE -- UPDATE
    _old_values := to_jsonb(OLD);
    _new_values := to_jsonb(NEW);
    _record_id := NEW.id;
    IF _new_values ? 'org_id' THEN
      _org_id := (_new_values->>'org_id')::uuid;
    END IF;

    -- Skip if no actual data changed (ignoring updated_at)
    IF (_old_values - 'updated_at') = (_new_values - 'updated_at') THEN
      RETURN NEW;
    END IF;

    -- Build list of changed field names
    _changed_fields := array[]::text[];
    SELECT array_agg(key) INTO _changed_fields
    FROM jsonb_each(_new_values) n
    WHERE n.value IS DISTINCT FROM (_old_values->n.key);
  END IF;

  -- If org_id not on the record, try to resolve from the acting user's membership
  IF _org_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT m.org_id INTO _org_id
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
    LIMIT 1;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_fields, changed_by, org_id)
  VALUES (TG_TABLE_NAME, _record_id, TG_OP, _old_values, _new_values, _changed_fields, auth.uid(), _org_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;