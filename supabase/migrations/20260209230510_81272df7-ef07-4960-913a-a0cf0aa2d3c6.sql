CREATE OR REPLACE FUNCTION public.generate_rent_schedule(p_tenancy_id uuid, p_months integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenancy RECORD;
  v_due_date date;
  v_period_start date;
  v_period_end date;
  v_count integer := 0;
  i integer;
BEGIN
  SELECT * INTO v_tenancy FROM public.tenancies WHERE id = p_tenancy_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found';
  END IF;
  
  FOR i IN 0..(p_months - 1) LOOP
    v_period_start := v_tenancy.start_date + (i || ' months')::interval;
    v_period_end := v_period_start + '1 month'::interval - '1 day'::interval;
    v_due_date := make_date(
      EXTRACT(YEAR FROM v_period_start)::integer,
      EXTRACT(MONTH FROM v_period_start)::integer,
      LEAST(v_tenancy.rent_due_day, EXTRACT(DAY FROM (v_period_end + '1 day'::interval - '1 month'::interval))::integer)
    );
    
    IF v_tenancy.end_date IS NOT NULL AND v_due_date > v_tenancy.end_date THEN
      EXIT;
    END IF;
    
    INSERT INTO public.rent_schedule (org_id, tenancy_id, due_date, period_start, period_end, rent_amount, status)
    VALUES (
      v_tenancy.org_id,
      p_tenancy_id,
      v_due_date,
      v_period_start,
      v_period_end,
      v_tenancy.rent_amount_pcm,
      (CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'overdue'
        WHEN v_due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END)::rent_status
    )
    ON CONFLICT DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;