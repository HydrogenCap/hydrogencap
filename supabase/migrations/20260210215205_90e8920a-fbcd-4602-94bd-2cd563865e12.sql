-- #16: Audit log triggers for destructive actions
-- Log property deletions
CREATE OR REPLACE FUNCTION public.audit_property_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO activity_log (org_id, property_id, entry_type, title, body, metadata)
  VALUES (
    OLD.org_id,
    OLD.id,
    'property_deleted',
    'Property deleted',
    'Property "' || COALESCE(OLD.address_line, 'Unknown') || '" was permanently deleted.',
    jsonb_build_object('address', OLD.address_line, 'postcode', OLD.postcode, 'deleted_by', auth.uid())
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_property_delete_trigger
  BEFORE DELETE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_property_delete();

-- Log tenant deletions
CREATE OR REPLACE FUNCTION public.audit_tenant_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO activity_log (org_id, entry_type, title, body, metadata)
  VALUES (
    OLD.org_id,
    'tenant_deleted',
    'Tenant deleted',
    'Tenant "' || COALESCE(OLD.first_name || ' ' || OLD.last_name, OLD.company_name, 'Unknown') || '" was deleted.',
    jsonb_build_object('tenant_type', OLD.tenant_type, 'name', COALESCE(OLD.first_name || ' ' || OLD.last_name, OLD.company_name), 'deleted_by', auth.uid())
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_tenant_delete_trigger
  BEFORE DELETE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_tenant_delete();

-- Log shareholder access revocations
CREATE OR REPLACE FUNCTION public.audit_shareholder_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    INSERT INTO activity_log (org_id, entry_type, title, body, metadata)
    VALUES (
      NEW.org_id,
      'shareholder_revoked',
      'Shareholder access revoked',
      'Shareholder access was revoked for user.',
      jsonb_build_object('user_id', NEW.user_id, 'revoked_by', auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_shareholder_revoke_trigger
  AFTER UPDATE ON public.shareholder_access
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_shareholder_revoke();

-- Log compliance item deletions
CREATE OR REPLACE FUNCTION public.audit_compliance_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO activity_log (org_id, property_id, entry_type, title, body, metadata)
  VALUES (
    OLD.org_id,
    OLD.property_id,
    'compliance_deleted',
    'Compliance item deleted',
    'Compliance item "' || OLD.compliance_type || '" was deleted.',
    jsonb_build_object('compliance_type', OLD.compliance_type, 'expiry_date', OLD.expiry_date, 'deleted_by', auth.uid())
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_compliance_delete_trigger
  BEFORE DELETE ON public.compliance_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_compliance_delete();