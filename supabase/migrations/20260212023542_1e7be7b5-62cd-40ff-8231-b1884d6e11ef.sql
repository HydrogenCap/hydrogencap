-- RPC to update a single rent_schedule row's status (avoids text→enum mismatch from JS client)
CREATE OR REPLACE FUNCTION public.update_rent_schedule_item_status(
  p_id uuid,
  p_status text,
  p_amount_paid numeric DEFAULT NULL,
  p_amount_outstanding numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE rent_schedule
  SET
    status = p_status::rent_status,
    amount_paid = COALESCE(p_amount_paid, amount_paid),
    amount_outstanding = COALESCE(p_amount_outstanding, amount_outstanding),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- RPC to bulk update rent_schedule statuses (for write-off etc.)
CREATE OR REPLACE FUNCTION public.bulk_update_rent_schedule_status(
  p_ids uuid[],
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE rent_schedule
  SET
    status = p_status::rent_status,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = ANY(p_ids);
END;
$$;

-- RPC to insert a rent_schedule row with proper enum casting
CREATE OR REPLACE FUNCTION public.insert_rent_schedule_item(
  p_org_id uuid,
  p_tenancy_id uuid,
  p_due_date date,
  p_period_start date,
  p_period_end date,
  p_rent_amount numeric,
  p_additional_charges numeric DEFAULT 0,
  p_amount_paid numeric DEFAULT 0,
  p_amount_outstanding numeric DEFAULT NULL,
  p_status text DEFAULT 'upcoming',
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO rent_schedule (
    org_id, tenancy_id, due_date, period_start, period_end,
    rent_amount, additional_charges, amount_paid, amount_outstanding,
    status, payment_reference, notes
  )
  VALUES (
    p_org_id, p_tenancy_id, p_due_date, p_period_start, p_period_end,
    p_rent_amount, p_additional_charges, p_amount_paid,
    COALESCE(p_amount_outstanding, p_rent_amount + p_additional_charges),
    p_status::rent_status, p_payment_reference, p_notes
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;