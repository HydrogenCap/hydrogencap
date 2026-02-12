
CREATE OR REPLACE FUNCTION public.update_rent_schedule_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_paid numeric;
  v_schedule RECORD;
BEGIN
  IF NEW.rent_schedule_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.rent_payments
    WHERE rent_schedule_id = NEW.rent_schedule_id;
    
    SELECT * INTO v_schedule FROM public.rent_schedule WHERE id = NEW.rent_schedule_id;
    
    UPDATE public.rent_schedule
    SET 
      amount_paid = v_total_paid,
      status = (CASE
        WHEN v_total_paid >= (v_schedule.rent_amount + COALESCE(v_schedule.additional_charges, 0)) THEN 'paid'
        WHEN v_total_paid > 0 THEN 'partial'
        WHEN v_schedule.due_date < CURRENT_DATE THEN 'overdue'
        WHEN v_schedule.due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END)::rent_status,
      updated_at = now()
    WHERE id = NEW.rent_schedule_id;
  END IF;
  
  RETURN NEW;
END;
$function$;
