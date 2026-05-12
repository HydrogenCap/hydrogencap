-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.

-- Part 1a: Add agreement_id to rent_schedule and rent_payments
ALTER TABLE rent_schedule
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES tenancy_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rent_schedule_agreement ON rent_schedule(agreement_id);

ALTER TABLE rent_payments
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES tenancy_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rent_payments_agreement ON rent_payments(agreement_id);

-- Part 1b: Backfill agreement_id from V1 tenancy matching
CREATE TEMP TABLE tenancy_v1_v2_map AS
SELECT DISTINCT ON (t1.id)
  t1.id AS v1_tenancy_id,
  ta.id AS v2_agreement_id
FROM tenancies t1
JOIN tenants t1_tenant ON t1_tenant.id = t1.tenant_id
JOIN rooms t1_room ON t1_room.id = t1.room_id
JOIN properties t1_prop ON t1_prop.id = t1.property_id
JOIN tenancy_agreements ta ON ta.org_id = t1.org_id
JOIN tenants_v2 t2_tenant ON t2_tenant.id = ta.tenant_id
JOIN rooms_v2 t2_room ON t2_room.id = ta.room_id
JOIN properties_v2 t2_prop ON t2_prop.id = ta.property_id
WHERE
  LOWER(TRIM(t1_tenant.first_name)) = LOWER(TRIM(t2_tenant.first_name))
  AND LOWER(TRIM(t1_tenant.last_name)) = LOWER(TRIM(t2_tenant.last_name))
  AND LOWER(TRIM(t1_room.room_name)) = LOWER(TRIM(t2_room.room_name))
  AND LOWER(TRIM(t1_prop.postcode)) = LOWER(TRIM(t2_prop.postcode))
  AND t1.start_date = ta.start_date
ORDER BY t1.id, ta.created_at DESC;

UPDATE rent_schedule rs
SET agreement_id = m.v2_agreement_id
FROM tenancy_v1_v2_map m
WHERE rs.tenancy_id = m.v1_tenancy_id
  AND rs.agreement_id IS NULL;

UPDATE rent_payments rp
SET agreement_id = m.v2_agreement_id
FROM tenancy_v1_v2_map m
WHERE rp.tenancy_id = m.v1_tenancy_id
  AND rp.agreement_id IS NULL;

DROP TABLE tenancy_v1_v2_map;

-- Part 1c: Update generate_rent_schedule to accept agreement_id
CREATE OR REPLACE FUNCTION public.generate_rent_schedule(
  p_tenancy_id UUID,
  p_months INTEGER DEFAULT 12,
  p_agreement_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  v_agreement_id uuid;
  i integer;
BEGIN
  SELECT * INTO v_tenancy FROM public.tenancies WHERE id = p_tenancy_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found';
  END IF;

  -- Resolve agreement_id
  v_agreement_id := COALESCE(p_agreement_id,
    (SELECT agreement_id FROM rent_schedule
     WHERE tenancy_id = p_tenancy_id AND agreement_id IS NOT NULL
     LIMIT 1)
  );

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

    INSERT INTO public.rent_schedule (org_id, tenancy_id, agreement_id, due_date, period_start, period_end, rent_amount, status)
    VALUES (
      v_tenancy.org_id,
      p_tenancy_id,
      v_agreement_id,
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

-- Update insert_rent_schedule_item to accept agreement_id
CREATE OR REPLACE FUNCTION public.insert_rent_schedule_item(
  p_org_id UUID,
  p_tenancy_id UUID,
  p_due_date DATE,
  p_period_start DATE,
  p_period_end DATE,
  p_rent_amount NUMERIC,
  p_additional_charges NUMERIC DEFAULT 0,
  p_amount_paid NUMERIC DEFAULT 0,
  p_amount_outstanding NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT 'upcoming',
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_agreement_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO rent_schedule (
    org_id, tenancy_id, due_date, period_start, period_end,
    rent_amount, additional_charges, amount_paid,
    status, payment_reference, notes, agreement_id
  )
  VALUES (
    p_org_id, p_tenancy_id, p_due_date, p_period_start, p_period_end,
    p_rent_amount, p_additional_charges, p_amount_paid,
    p_status::rent_status, p_payment_reference, p_notes, p_agreement_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
