
-- Companies House cache table
CREATE TABLE public.companies_house_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  company_number text NOT NULL,
  data_type text NOT NULL,
  response_data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(entity_id, data_type)
);

CREATE INDEX idx_ch_cache_entity ON public.companies_house_cache(entity_id);
CREATE INDEX idx_ch_cache_company ON public.companies_house_cache(company_number);
CREATE INDEX idx_ch_cache_expires ON public.companies_house_cache(expires_at);

-- Validation trigger for data_type
CREATE OR REPLACE FUNCTION public.validate_ch_cache_data_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.data_type NOT IN ('profile', 'officers', 'filing_history', 'registered_office') THEN
    RAISE EXCEPTION 'Invalid data_type: %', NEW.data_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_ch_cache_data_type_trigger
  BEFORE INSERT OR UPDATE ON public.companies_house_cache
  FOR EACH ROW EXECUTE FUNCTION public.validate_ch_cache_data_type();

-- Companies House sync log table
CREATE TABLE public.companies_house_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  company_number text NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL,
  changes_detected jsonb,
  error_message text,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ch_sync_entity ON public.companies_house_sync_log(entity_id);
CREATE INDEX idx_ch_sync_date ON public.companies_house_sync_log(synced_at);

-- Validation triggers for sync_log
CREATE OR REPLACE FUNCTION public.validate_ch_sync_log()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.sync_type NOT IN ('manual', 'auto', 'verification') THEN
    RAISE EXCEPTION 'Invalid sync_type: %', NEW.sync_type;
  END IF;
  IF NEW.status NOT IN ('success', 'failed', 'not_found', 'rate_limited') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_ch_sync_log_trigger
  BEFORE INSERT OR UPDATE ON public.companies_house_sync_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_ch_sync_log();

-- RLS policies
ALTER TABLE public.companies_house_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies_house_sync_log ENABLE ROW LEVEL SECURITY;

-- Cache: org-scoped access via entity
CREATE POLICY "Users can view CH cache for their org entities"
  ON public.companies_house_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_cache.entity_id
  ));

CREATE POLICY "Users can insert CH cache for their org entities"
  ON public.companies_house_cache FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_cache.entity_id
  ));

CREATE POLICY "Users can update CH cache for their org entities"
  ON public.companies_house_cache FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_cache.entity_id
  ));

CREATE POLICY "Users can delete CH cache for their org entities"
  ON public.companies_house_cache FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_cache.entity_id
  ));

-- Sync log: org-scoped access via entity
CREATE POLICY "Users can view CH sync log for their org entities"
  ON public.companies_house_sync_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_sync_log.entity_id
  ));

CREATE POLICY "Users can insert CH sync log for their org entities"
  ON public.companies_house_sync_log FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.legal_entities le
    JOIN public.memberships m ON m.org_id = le.org_id AND m.user_id = auth.uid()
    WHERE le.id = companies_house_sync_log.entity_id
  ));

-- Entity verification status view
CREATE OR REPLACE VIEW public.entity_verification_status AS
SELECT
  le.id AS entity_id,
  le.entity_name,
  le.entity_type,
  le.company_number,
  le.org_id,
  le.status AS local_status,
  le.incorporation_date AS local_incorporation_date,
  le.registered_address AS local_registered_address,
  chc.response_data->>'company_name' AS ch_company_name,
  chc.response_data->>'company_status' AS ch_company_status,
  chc.response_data->>'date_of_creation' AS ch_incorporation_date,
  chc.response_data->'registered_office_address'->>'address_line_1' AS ch_address_line_1,
  chc.response_data->'registered_office_address'->>'postal_code' AS ch_postcode,
  chc.response_data->'accounts'->>'next_due' AS ch_accounts_next_due,
  chc.response_data->'confirmation_statement'->>'next_due' AS ch_confirmation_next_due,
  chc.response_data->>'has_charges' AS ch_has_charges,
  chc.fetched_at AS last_synced,
  CASE
    WHEN chc.response_data IS NULL THEN 'not_synced'
    WHEN le.company_number IS NULL THEN 'no_company_number'
    WHEN chc.response_data->>'company_status' = 'dissolved' AND le.status != 'dissolved' THEN 'status_mismatch'
    WHEN chc.response_data->>'company_status' != 'active' AND le.status = 'active' THEN 'status_mismatch'
    ELSE 'verified'
  END AS verification_status,
  CASE
    WHEN chc.response_data->'accounts'->>'next_due' IS NOT NULL
      AND (chc.response_data->'accounts'->>'next_due')::date < current_date
    THEN 'overdue'
    WHEN chc.response_data->'accounts'->>'next_due' IS NOT NULL
      AND (chc.response_data->'accounts'->>'next_due')::date < current_date + interval '30 days'
    THEN 'due_soon'
    ELSE 'ok'
  END AS accounts_filing_status,
  CASE
    WHEN chc.response_data->'confirmation_statement'->>'next_due' IS NOT NULL
      AND (chc.response_data->'confirmation_statement'->>'next_due')::date < current_date
    THEN 'overdue'
    WHEN chc.response_data->'confirmation_statement'->>'next_due' IS NOT NULL
      AND (chc.response_data->'confirmation_statement'->>'next_due')::date < current_date + interval '30 days'
    THEN 'due_soon'
    ELSE 'ok'
  END AS confirmation_filing_status
FROM public.legal_entities le
LEFT JOIN public.companies_house_cache chc
  ON chc.entity_id = le.id AND chc.data_type = 'profile'
WHERE le.entity_type = 'spv';
