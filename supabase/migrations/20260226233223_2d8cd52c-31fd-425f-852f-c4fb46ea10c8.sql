
-- Fix security definer views by recreating as security invoker
DROP VIEW IF EXISTS public.portfolio_debt_summary;
DROP VIEW IF EXISTS public.loan_alerts;

CREATE VIEW public.portfolio_debt_summary
WITH (security_invoker = true) AS
SELECT
  l.id AS lender_id,
  l.org_id,
  l.lender_name,
  l.lender_type,
  count(lf.id) AS facility_count,
  COALESCE(sum(lf.current_balance), 0) AS total_exposure,
  COALESCE(sum(lf.monthly_payment), 0) AS total_monthly_payments,
  COALESCE(avg(lf.interest_rate), 0) AS avg_interest_rate,
  count(lf.id) FILTER (WHERE lf.rate_type = 'fixed') AS fixed_count,
  count(lf.id) FILTER (WHERE lf.rate_type IN ('variable', 'tracker', 'discount')) AS variable_count,
  COALESCE(sum(lf.current_balance) FILTER (WHERE lf.rate_type = 'fixed'), 0) AS fixed_balance,
  COALESCE(sum(lf.current_balance) FILTER (WHERE lf.rate_type IN ('variable', 'tracker', 'discount')), 0) AS variable_balance,
  min(lf.term_end_date) FILTER (WHERE lf.status = 'active') AS nearest_term_end,
  min(lf.rate_expiry_date) FILTER (WHERE lf.status = 'active' AND lf.rate_expiry_date > current_date) AS nearest_rate_expiry
FROM public.lenders l
LEFT JOIN public.loan_facilities lf ON lf.lender_id = l.id AND lf.status = 'active'
GROUP BY l.id, l.org_id, l.lender_name, l.lender_type;

CREATE VIEW public.loan_alerts
WITH (security_invoker = true) AS
SELECT
  lf.id AS loan_id,
  lf.org_id,
  lf.property_id,
  p.address_line_1 || ', ' || p.postcode AS property_address,
  l.lender_name,
  lf.facility_type,
  lf.current_balance,
  lf.interest_rate,
  lf.rate_type,
  lf.rate_expiry_date,
  lf.revert_rate,
  lf.term_end_date,
  lf.early_repayment_charge_until,
  lf.current_ltv,
  lf.covenant_ltv_max,
  lf.covenant_icr_min,
  CASE
    WHEN lf.rate_expiry_date IS NOT NULL AND lf.rate_expiry_date <= current_date THEN 'rate_expired'
    WHEN lf.rate_expiry_date IS NOT NULL AND lf.rate_expiry_date <= current_date + interval '90 days' THEN 'rate_expiring_soon'
    ELSE NULL
  END AS rate_alert,
  CASE
    WHEN lf.term_end_date <= current_date THEN 'term_expired'
    WHEN lf.term_end_date <= current_date + interval '6 months' THEN 'term_ending_soon'
    WHEN lf.term_end_date <= current_date + interval '12 months' THEN 'term_ending_within_year'
    ELSE NULL
  END AS term_alert,
  CASE
    WHEN lf.early_repayment_charge_until IS NULL THEN 'no_erc'
    WHEN lf.early_repayment_charge_until <= current_date THEN 'erc_expired'
    WHEN lf.early_repayment_charge_until <= current_date + interval '3 months' THEN 'erc_ending_soon'
    ELSE 'erc_active'
  END AS erc_alert,
  CASE
    WHEN lf.covenant_ltv_max IS NOT NULL AND lf.current_ltv IS NOT NULL THEN
      CASE
        WHEN lf.current_ltv >= lf.covenant_ltv_max THEN 'covenant_breach'
        WHEN lf.current_ltv >= lf.covenant_ltv_max * 0.9 THEN 'covenant_warning'
        ELSE 'covenant_ok'
      END
    ELSE NULL
  END AS ltv_covenant_alert,
  CASE WHEN lf.rate_expiry_date IS NOT NULL THEN lf.rate_expiry_date - current_date ELSE NULL END AS days_to_rate_expiry,
  lf.term_end_date - current_date AS days_to_term_end,
  CASE WHEN lf.early_repayment_charge_until IS NOT NULL THEN lf.early_repayment_charge_until - current_date ELSE NULL END AS days_to_erc_end
FROM public.loan_facilities lf
JOIN public.properties_v2 p ON p.id = lf.property_id
JOIN public.lenders l ON l.id = lf.lender_id
WHERE lf.status = 'active';
