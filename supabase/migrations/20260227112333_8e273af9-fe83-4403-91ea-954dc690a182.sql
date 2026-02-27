
-- Make the entity_verification_status view use SECURITY INVOKER (default for new views, but be explicit)
CREATE OR REPLACE VIEW public.entity_verification_status
WITH (security_invoker = true) AS
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
  ON chc.entity_id = le.id AND chc.data_type = 'profile';
