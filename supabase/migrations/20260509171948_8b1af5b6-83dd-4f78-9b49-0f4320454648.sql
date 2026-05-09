CREATE TABLE public.v1_freeze_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  query_fragment text,
  db_session_user text NOT NULL,
  attempted_op text NOT NULL CHECK (attempted_op IN ('insert','update','delete')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  error_code text
);

CREATE INDEX idx_v1_freeze_violations_table_time
  ON public.v1_freeze_violations (table_name, attempted_at DESC);

ALTER TABLE public.v1_freeze_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role reads v1_freeze_violations"
  ON public.v1_freeze_violations
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role writes v1_freeze_violations"
  ON public.v1_freeze_violations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.v1_freeze_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  BEGIN
    INSERT INTO public.v1_freeze_violations
      (table_name, query_fragment, db_session_user, attempted_op, error_code)
    VALUES (
      TG_TABLE_NAME,
      left(coalesce(current_query(), ''), 1024),
      session_user,
      lower(TG_OP),
      '23514'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RAISE EXCEPTION 'V1 table % is frozen — write to % instead', TG_TABLE_NAME, v2_target
    USING ERRCODE = 'check_violation';
END;
$function$;