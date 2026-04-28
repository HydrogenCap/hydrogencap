-- 1) Create the missing global_search RPC used by useGlobalSearch.
-- Returns up to 8 matches per type across properties_v2, tenants_v2, legal_entities, contractors, investors,
-- scoped to the caller's org (must equal p_org_id and pass user_has_org_access).
CREATE OR REPLACE FUNCTION public.global_search(
  search_query TEXT,
  p_org_id UUID
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  title TEXT,
  subtitle TEXT,
  url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q TEXT := '%' || lower(coalesce(search_query, '')) || '%';
BEGIN
  -- Reject if caller has no access to this org (defence-in-depth on top of RLS)
  IF NOT public.user_has_org_access(p_org_id) THEN
    RETURN;
  END IF;

  IF coalesce(trim(search_query), '') = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Properties
  SELECT
    'property'::TEXT,
    p.id,
    p.address_line_1::TEXT,
    coalesce(p.postcode, '')::TEXT,
    ('/properties-v2/' || p.id::text)::TEXT
  FROM public.properties_v2 p
  WHERE p.org_id = p_org_id
    AND (lower(coalesce(p.address_line_1, '')) LIKE q
         OR lower(coalesce(p.postcode, '')) LIKE q)
  ORDER BY p.address_line_1
  LIMIT 8;

  RETURN QUERY
  -- Tenants
  SELECT
    'tenant'::TEXT,
    t.id,
    trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, ''))::TEXT,
    ''::TEXT,
    ('/tenants-v2/' || t.id::text)::TEXT
  FROM public.tenants_v2 t
  WHERE t.org_id = p_org_id
    AND (lower(coalesce(t.first_name, '')) LIKE q
         OR lower(coalesce(t.last_name, '')) LIKE q
         OR lower(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) LIKE q)
  ORDER BY t.last_name NULLS LAST, t.first_name NULLS LAST
  LIMIT 8;

  RETURN QUERY
  -- Legal entities
  SELECT
    'entity'::TEXT,
    e.id,
    coalesce(e.entity_name, 'Unnamed entity')::TEXT,
    ''::TEXT,
    ('/entities/' || e.id::text)::TEXT
  FROM public.legal_entities e
  WHERE e.org_id = p_org_id
    AND lower(coalesce(e.entity_name, '')) LIKE q
  ORDER BY e.entity_name
  LIMIT 8;

  RETURN QUERY
  -- Contractors
  SELECT
    'contractor'::TEXT,
    c.id,
    coalesce(c.name, c.company_name, 'Unnamed contractor')::TEXT,
    coalesce(c.company_name, '')::TEXT,
    ('/contractors')::TEXT
  FROM public.contractors c
  WHERE c.org_id = p_org_id
    AND (lower(coalesce(c.name, '')) LIKE q
         OR lower(coalesce(c.company_name, '')) LIKE q)
  ORDER BY c.name NULLS LAST
  LIMIT 8;

  RETURN QUERY
  -- Investors
  SELECT
    'investor'::TEXT,
    i.id,
    coalesce(i.company_name, 'Unnamed investor')::TEXT,
    ''::TEXT,
    ('/investors/' || i.id::text)::TEXT
  FROM public.investors i
  WHERE i.org_id = p_org_id
    AND lower(coalesce(i.company_name, '')) LIKE q
  ORDER BY i.company_name
  LIMIT 8;
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(TEXT, UUID) TO authenticated;

-- 2) Backfill mojibake in documents.original_file_name (UTF-8 bytes for "–"/"—" mis-decoded as Windows-1252).
-- Only the canonical 3-byte sequence "ÔÇô" (en dash) and "ÔÇö" (em dash) seen in test rows.
UPDATE public.documents
SET original_file_name = regexp_replace(
  regexp_replace(original_file_name, 'ÔÇô', '–', 'g'),
  'ÔÇö', '—', 'g'
)
WHERE original_file_name LIKE '%ÔÇ%';