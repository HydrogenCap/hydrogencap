-- Update the generate_rent_schedule DB function to support pro-rata
CREATE OR REPLACE FUNCTION public.generate_rent_schedule(p_tenancy_id uuid, p_months integer DEFAULT 12)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenancy RECORD;
  v_due_date date;
  v_period_start date;
  v_period_end date;
  v_actual_start date;
  v_actual_end date;
  v_full_days integer;
  v_actual_days integer;
  v_rent_amount numeric;
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

    -- Pro-rata: adjust actual period boundaries
    v_actual_start := v_period_start;
    v_actual_end := v_period_end;

    -- First period: if tenancy starts after period start
    IF v_tenancy.start_date > v_period_start THEN
      v_actual_start := v_tenancy.start_date;
    END IF;

    -- Last period: if tenancy ends before period end
    IF v_tenancy.end_date IS NOT NULL AND v_tenancy.end_date < v_period_end THEN
      v_actual_end := v_tenancy.end_date;
    END IF;

    -- Calculate pro-rata amount
    v_full_days := (v_period_end - v_period_start) + 1;
    v_actual_days := (v_actual_end - v_actual_start) + 1;

    IF v_actual_days < v_full_days AND v_full_days > 0 THEN
      v_rent_amount := ROUND((v_tenancy.rent_amount_pcm * v_actual_days::numeric / v_full_days::numeric), 2);
    ELSE
      v_rent_amount := v_tenancy.rent_amount_pcm;
    END IF;
    
    INSERT INTO public.rent_schedule (org_id, tenancy_id, due_date, period_start, period_end, rent_amount, amount_outstanding, status)
    VALUES (
      v_tenancy.org_id,
      p_tenancy_id,
      v_due_date,
      v_actual_start,
      v_actual_end,
      v_rent_amount,
      v_rent_amount,
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
$function$;