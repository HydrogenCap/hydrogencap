-- Global search function for TenureIQ spotlight search (Cmd+K)
-- Searches across properties, tenants, entities, contractors, and investors

CREATE OR REPLACE FUNCTION public.global_search(search_query text, p_org_id uuid)
RETURNS TABLE(
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text;
BEGIN
  q := '%' || lower(search_query) || '%';

  RETURN QUERY

  -- Properties
  SELECT
    'property'::text AS result_type,
    p.id AS result_id,
    p.address_line_1 AS title,
    COALESCE(p.city || ' ' || p.postcode, p.postcode, p.city, '') AS subtitle,
    '/properties-v2/' || p.id::text AS url
  FROM properties_v2 p
  WHERE p.org_id = p_org_id
    AND (
      lower(p.address_line_1) LIKE q
      OR lower(COALESCE(p.address_line_2, '')) LIKE q
      OR lower(COALESCE(p.postcode, '')) LIKE q
      OR lower(COALESCE(p.city, '')) LIKE q
    )

  UNION ALL

  -- Tenants
  SELECT
    'tenant'::text,
    t.id,
    t.first_name || ' ' || t.last_name,
    COALESCE(t.email, ''),
    '/tenants-v2/' || t.id::text
  FROM tenants_v2 t
  WHERE t.org_id = p_org_id
    AND (
      lower(t.first_name || ' ' || t.last_name) LIKE q
      OR lower(COALESCE(t.email, '')) LIKE q
      OR lower(t.first_name) LIKE q
      OR lower(t.last_name) LIKE q
    )

  UNION ALL

  -- Legal Entities
  SELECT
    'entity'::text,
    e.id,
    e.entity_name,
    COALESCE(e.company_number, e.entity_type::text, ''),
    '/entities/' || e.id::text
  FROM legal_entities e
  WHERE e.org_id = p_org_id
    AND (
      lower(e.entity_name) LIKE q
      OR lower(COALESCE(e.company_number, '')) LIKE q
    )

  UNION ALL

  -- Contractors
  SELECT
    'contractor'::text,
    c.id,
    c.name,
    COALESCE(c.company_name, ''),
    '/contractors/' || c.id::text
  FROM contractors c
  WHERE c.org_id = p_org_id
    AND (
      lower(c.name) LIKE q
      OR lower(COALESCE(c.company_name, '')) LIKE q
    )

  UNION ALL

  -- Investors
  SELECT
    'investor'::text,
    i.id,
    i.investor_name,
    COALESCE(i.email, ''),
    '/investors/' || i.id::text
  FROM investors i
  WHERE i.org_id = p_org_id
    AND (
      lower(i.investor_name) LIKE q
      OR lower(COALESCE(i.email, '')) LIKE q
    )

  LIMIT 50;
END;
$$;

-- Grant execute to authenticated users (RLS bypass via SECURITY DEFINER is intentional;
-- the function itself filters by org_id which is validated at the application layer)
GRANT EXECUTE ON FUNCTION public.global_search(text, uuid) TO authenticated;
