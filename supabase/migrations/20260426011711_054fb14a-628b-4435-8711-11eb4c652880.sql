-- RLS audit cleanup — Sections C.1 (documentation) and C.2 (role tightening)
-- See docs/release/rls-audit-2026-04-26.md

-- (a) Section C.2: Restrict service-only policies to service_role
ALTER POLICY "System can insert into audit_log"
  ON public.audit_log TO service_role;

ALTER POLICY "Service can insert email runs"
  ON public.scheduled_email_runs TO service_role;

ALTER POLICY "Service can update email runs"
  ON public.scheduled_email_runs TO service_role;

-- (b) Section C.1: Document intentional public-read / public-write policies
COMMENT ON POLICY "Authenticated read" ON public.ai_extraction_templates
  IS 'INTENTIONAL PUBLIC READ: shared AI extraction templates are non-sensitive reference data needed by all orgs during document processing.';

COMMENT ON POLICY "Authenticated users can read certificate type mappings" ON public.certificate_type_mappings
  IS 'INTENTIONAL PUBLIC READ: certificate type lookup table is non-sensitive reference data used by every org for compliance classification.';

COMMENT ON POLICY "Anyone authenticated can read templates" ON public.compliance_templates
  IS 'INTENTIONAL PUBLIC READ: UK compliance requirement templates (gas, EICR, EPC, etc.) are shared reference data used across all orgs.';

COMMENT ON POLICY "Authenticated users can read financial_categories" ON public.financial_categories
  IS 'INTENTIONAL PUBLIC READ: financial chart-of-accounts categories are non-sensitive reference data used by every org.';

COMMENT ON POLICY "Anyone can submit demo requests" ON public.demo_requests
  IS 'INTENTIONAL PUBLIC WRITE: marketing site lead-capture form must accept submissions from unauthenticated visitors. Reads remain restricted to admins via a separate policy.';
