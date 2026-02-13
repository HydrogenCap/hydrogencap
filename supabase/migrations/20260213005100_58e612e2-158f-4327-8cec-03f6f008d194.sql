
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

    v_actual_start := v_period_start;
    v_actual_end := v_period_end;

    IF v_tenancy.start_date > v_period_start THEN
      v_actual_start := v_tenancy.start_date;
    END IF;

    IF v_tenancy.end_date IS NOT NULL AND v_tenancy.end_date < v_period_end THEN
      v_actual_end := v_tenancy.end_date;
    END IF;

    v_full_days := (v_period_end - v_period_start) + 1;
    v_actual_days := (v_actual_end - v_actual_start) + 1;

    IF v_actual_days < v_full_days AND v_full_days > 0 THEN
      v_rent_amount := ROUND((v_tenancy.rent_amount_pcm * v_actual_days::numeric / v_full_days::numeric), 2);
    ELSE
      v_rent_amount := v_tenancy.rent_amount_pcm;
    END IF;
    
    -- Removed amount_outstanding from INSERT since it's a generated column
    INSERT INTO public.rent_schedule (org_id, tenancy_id, due_date, period_start, period_end, rent_amount, status)
    VALUES (
      v_tenancy.org_id,
      p_tenancy_id,
      v_due_date,
      v_actual_start,
      v_actual_end,
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

-- Also fix insert_rent_schedule_item RPC which also sets amount_outstanding
CREATE OR REPLACE FUNCTION public.insert_rent_schedule_item(p_org_id uuid, p_tenancy_id uuid, p_due_date date, p_period_start date, p_period_end date, p_rent_amount numeric, p_additional_charges numeric DEFAULT 0, p_amount_paid numeric DEFAULT 0, p_amount_outstanding numeric DEFAULT NULL::numeric, p_status text DEFAULT 'upcoming'::text, p_payment_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO rent_schedule (
    org_id, tenancy_id, due_date, period_start, period_end,
    rent_amount, additional_charges, amount_paid,
    status, payment_reference, notes
  )
  VALUES (
    p_org_id, p_tenancy_id, p_due_date, p_period_start, p_period_end,
    p_rent_amount, p_additional_charges, p_amount_paid,
    p_status::rent_status, p_payment_reference, p_notes
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;
