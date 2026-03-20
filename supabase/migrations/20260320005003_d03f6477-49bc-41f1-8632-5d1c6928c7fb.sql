-- Fix 2: Separate mortgage interest from capital repayment in tax year summary
-- For interest-only loans, the full payment IS interest.
-- For repayment loans, estimate interest = balance * (annual_rate / 100 / 12).

CREATE OR REPLACE FUNCTION public.generate_tax_year_summary(
  target_entity_id uuid,
  target_tax_year text,
  target_org_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_start date;
  year_end date;
  start_year integer;
  summary_id uuid;
BEGIN
  start_year := split_part(target_tax_year, '/', 1)::integer;
  year_start := (start_year || '-04-06')::date;
  year_end := ((start_year + 1) || '-04-05')::date;

  INSERT INTO public.tax_year_summaries (
    org_id, entity_id, tax_year, tax_year_start, tax_year_end,
    total_rental_income, total_other_income,
    total_mortgage_interest, total_repairs_maintenance,
    total_insurance, total_management_fees,
    total_professional_fees, total_utilities,
    total_council_tax, total_licensing,
    total_other_expenses, finance_costs
  )
  SELECT
    target_org_id,
    target_entity_id,
    target_tax_year,
    year_start,
    year_end,
    coalesce(sum(fs.gross_rent_received), 0),
    coalesce(sum(fs.other_income), 0),
    -- Calculate interest-only portion of mortgage payments
    coalesce(sum(
      CASE
        -- Interest-only loans: full payment is interest
        WHEN lf.repayment_type = 'interest_only' THEN fs.mortgage_payments
        -- Repayment loans: estimate interest = balance * monthly rate
        WHEN lf.repayment_type = 'repayment' AND lf.current_balance > 0 AND lf.interest_rate > 0
          THEN LEAST(
            fs.mortgage_payments,
            round((lf.current_balance * (lf.interest_rate / 100.0 / 12.0))::numeric, 2)
          )
        -- No loan data matched: conservatively use full payment (backwards compatible)
        ELSE fs.mortgage_payments
      END
    ), 0),
    coalesce(sum(fs.maintenance_costs), 0),
    coalesce(sum(fs.insurance_costs), 0),
    coalesce(sum(fs.management_fees), 0),
    coalesce(sum(fs.professional_fees), 0),
    coalesce(sum(fs.utilities), 0),
    coalesce(sum(fs.council_tax), 0),
    coalesce(sum(fs.licensing_costs), 0),
    coalesce(sum(fs.other_costs), 0),
    -- finance_costs = total mortgage payments (interest + capital)
    coalesce(sum(fs.mortgage_payments), 0)
  FROM public.financial_snapshots fs
  LEFT JOIN public.loan_facilities lf
    ON lf.property_id = fs.property_id
    AND lf.entity_id = target_entity_id
    AND lf.status = 'active'
  WHERE fs.entity_id = target_entity_id
    AND fs.snapshot_month >= year_start::text
    AND fs.snapshot_month <= year_end::text
  ON CONFLICT (entity_id, tax_year) DO UPDATE SET
    total_rental_income = excluded.total_rental_income,
    total_other_income = excluded.total_other_income,
    total_mortgage_interest = excluded.total_mortgage_interest,
    total_repairs_maintenance = excluded.total_repairs_maintenance,
    total_insurance = excluded.total_insurance,
    total_management_fees = excluded.total_management_fees,
    total_professional_fees = excluded.total_professional_fees,
    total_utilities = excluded.total_utilities,
    total_council_tax = excluded.total_council_tax,
    total_licensing = excluded.total_licensing,
    total_other_expenses = excluded.total_other_expenses,
    finance_costs = excluded.finance_costs,
    updated_at = now()
  RETURNING id INTO summary_id;

  RETURN summary_id;
END;
$function$;

-- Fix Xero seed mapping: rename misleading account name
UPDATE public.accounting_mappings
SET account_name = 'Finance Costs - Mortgage Payments'
WHERE hydrogencap_category = 'mortgage_payments'
  AND account_name = 'Finance Costs - Mortgage Interest'
  AND accounting_system = 'xero';
