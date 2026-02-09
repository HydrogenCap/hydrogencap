
-- Add company tenant support columns to tenants table
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS tenant_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS company_registered_address text,
  ADD COLUMN IF NOT EXISTS company_contact_name text,
  ADD COLUMN IF NOT EXISTS company_contact_email text,
  ADD COLUMN IF NOT EXISTS company_contact_phone text,
  ADD COLUMN IF NOT EXISTS company_contact_role text,
  ADD COLUMN IF NOT EXISTS trading_name text,
  ADD COLUMN IF NOT EXISTS vat_registered boolean,
  ADD COLUMN IF NOT EXISTS vat_number text;

-- Make first_name and last_name nullable (they were NOT NULL before)
ALTER TABLE public.tenants ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.tenants ALTER COLUMN last_name DROP NOT NULL;

-- Add validation trigger instead of CHECK constraint (per guidelines)
CREATE OR REPLACE FUNCTION public.validate_tenant_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_type = 'individual' AND NEW.first_name IS NULL THEN
    RAISE EXCEPTION 'Individual tenants must have a first_name';
  END IF;
  IF NEW.tenant_type = 'company' AND NEW.company_name IS NULL THEN
    RAISE EXCEPTION 'Company tenants must have a company_name';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_tenant_type
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tenant_type();
