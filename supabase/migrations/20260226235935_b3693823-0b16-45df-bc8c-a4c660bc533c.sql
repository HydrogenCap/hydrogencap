
-- Audit Log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  session_id text,
  context text
);

CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON public.audit_log(changed_at);
CREATE INDEX idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_table_date ON public.audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_log_changed_at_brin ON public.audit_log USING brin(changed_at);

-- RLS: read-only for users, append-only for system
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read audit_log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert into audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE policies. Audit log is append-only.

-- Generic audit trigger function (simplified version for reliability)
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger AS $$
DECLARE
  old_json jsonb;
  new_json jsonb;
  changed text[];
  col text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    new_json := new_json - 'created_at' - 'updated_at';

    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_fields, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', null, new_json, null, auth.uid());

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);

    old_json := old_json - 'updated_at';
    new_json := new_json - 'updated_at';

    -- Only log if actual data changed
    IF old_json = new_json THEN
      RETURN NEW;
    END IF;

    -- Build list of changed field names
    changed := array[]::text[];
    FOR col IN SELECT jsonb_object_keys(new_json)
    LOOP
      IF old_json->col IS DISTINCT FROM new_json->col THEN
        changed := changed || col;
      END IF;
    END LOOP;

    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_fields, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed, auth.uid());

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    old_json := old_json - 'created_at' - 'updated_at';

    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, changed_fields, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_json, null, null, auth.uid());

    RETURN OLD;
  END IF;

  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Attach triggers to V2 core tables

-- Legal Entities
CREATE TRIGGER audit_legal_entities
AFTER INSERT OR UPDATE OR DELETE ON public.legal_entities
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_entity_directors
AFTER INSERT OR UPDATE OR DELETE ON public.entity_directors
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_entity_shareholders
AFTER INSERT OR UPDATE OR DELETE ON public.entity_shareholders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Properties V2
CREATE TRIGGER audit_properties_v2
AFTER INSERT OR UPDATE OR DELETE ON public.properties_v2
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Rooms V2
CREATE TRIGGER audit_rooms_v2
AFTER INSERT OR UPDATE OR DELETE ON public.rooms_v2
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Tenancy Agreements
CREATE TRIGGER audit_tenancy_agreements
AFTER INSERT OR UPDATE OR DELETE ON public.tenancy_agreements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Lending
CREATE TRIGGER audit_lenders
AFTER INSERT OR UPDATE OR DELETE ON public.lenders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_loan_facilities
AFTER INSERT OR UPDATE OR DELETE ON public.loan_facilities
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Compliance V2
CREATE TRIGGER audit_compliance_documents_v2
AFTER INSERT OR UPDATE OR DELETE ON public.compliance_documents_v2
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_compliance_requirements_v2
AFTER INSERT OR UPDATE OR DELETE ON public.compliance_requirements_v2
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Financial
CREATE TRIGGER audit_financial_snapshots
AFTER INSERT OR UPDATE OR DELETE ON public.financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Contractors
CREATE TRIGGER audit_contractors
AFTER INSERT OR UPDATE OR DELETE ON public.contractors
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Contractor Jobs
CREATE TRIGGER audit_contractor_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.contractor_jobs
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
