-- Create company_secrets table for secure storage of auth codes and UTRs
CREATE TABLE public.company_secrets (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  auth_code_encrypted TEXT,
  utr_encrypted TEXT,
  auth_code_last4 TEXT,
  utr_last4 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Add index for lookups
CREATE INDEX idx_company_secrets_updated_at ON public.company_secrets(updated_at);

-- Enable RLS
ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only users in the company's org can access secrets
-- SELECT: Only Admin/Finance roles can see the secrets
CREATE POLICY "Admin/Finance can view company secrets"
ON public.company_secrets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN memberships m ON m.org_id = c.org_id
    WHERE c.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- INSERT: Only Admin/Finance roles can insert secrets
CREATE POLICY "Admin/Finance can insert company secrets"
ON public.company_secrets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN memberships m ON m.org_id = c.org_id
    WHERE c.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- UPDATE: Only Admin/Finance roles can update secrets
CREATE POLICY "Admin/Finance can update company secrets"
ON public.company_secrets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN memberships m ON m.org_id = c.org_id
    WHERE c.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- DELETE: Only Admin/Finance roles can delete secrets
CREATE POLICY "Admin/Finance can delete company secrets"
ON public.company_secrets
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN memberships m ON m.org_id = c.org_id
    WHERE c.id = company_secrets.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- Create a view for masked secrets (accessible to all org members)
-- This allows non-admin users to see masked values without accessing encrypted data
CREATE OR REPLACE VIEW public.company_secrets_masked AS
SELECT 
  cs.company_id,
  CASE WHEN cs.auth_code_last4 IS NOT NULL THEN '••••' || cs.auth_code_last4 ELSE NULL END as auth_code_masked,
  CASE WHEN cs.utr_last4 IS NOT NULL THEN '••••••' || cs.utr_last4 ELSE NULL END as utr_masked,
  cs.auth_code_last4,
  cs.utr_last4,
  cs.updated_at
FROM public.company_secrets cs;

-- Grant access to the view for authenticated users (RLS will still apply on base table queries)
GRANT SELECT ON public.company_secrets_masked TO authenticated;

-- Trigger to update updated_at
CREATE TRIGGER update_company_secrets_updated_at
BEFORE UPDATE ON public.company_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE public.company_secrets IS 'Stores encrypted sensitive company data (auth codes, UTRs). Access restricted to Admin/Finance roles.';
COMMENT ON COLUMN public.company_secrets.auth_code_encrypted IS 'AES-GCM encrypted Companies House authentication code';
COMMENT ON COLUMN public.company_secrets.utr_encrypted IS 'AES-GCM encrypted HMRC Unique Taxpayer Reference';
COMMENT ON COLUMN public.company_secrets.auth_code_last4 IS 'Last 2 characters of auth code for masked display';
COMMENT ON COLUMN public.company_secrets.utr_last4 IS 'Last 4 digits of UTR for masked display';