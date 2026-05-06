CREATE OR REPLACE FUNCTION public.v1_freeze_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v2_target text;
BEGIN
  v2_target := CASE TG_TABLE_NAME
    WHEN 'properties' THEN 'properties_v2'
    WHEN 'rooms'      THEN 'rooms_v2'
    WHEN 'tenants'    THEN 'tenants_v2'
    WHEN 'loans'      THEN 'loan_facilities'
    WHEN 'costs'      THEN 'property_cost_budgets_v2'
    WHEN 'tenancies'  THEN 'tenancy_agreements'
    ELSE TG_TABLE_NAME || '_v2'
  END;
  RAISE EXCEPTION 'V1 table % is frozen — write to % instead', TG_TABLE_NAME, v2_target
    USING ERRCODE = 'check_violation';
END;
$function$;