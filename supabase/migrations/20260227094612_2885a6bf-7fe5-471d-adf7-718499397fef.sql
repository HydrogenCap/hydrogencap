CREATE OR REPLACE VIEW public.portfolio_monthly_summary AS
SELECT 
  org_id,
  snapshot_month,
  count(DISTINCT property_id) AS property_count,
  sum(gross_rent_due) AS total_rent_due,
  sum(gross_rent_received) AS total_rent_received,
  sum(void_loss) AS total_void_loss,
  sum(total_costs) AS total_costs,
  sum(mortgage_payments) AS total_mortgage_payments,
  sum(net_operating_income) AS total_noi,
  sum(net_cash_flow) AS total_cash_flow,
  CASE
    WHEN sum(gross_rent_due) > 0 THEN round(sum(gross_rent_received) / sum(gross_rent_due) * 100, 2)
    ELSE 0
  END AS portfolio_collection_rate,
  round(avg(occupancy_rate), 2) AS avg_occupancy_rate,
  -- Balance sheet aggregates
  sum(valuation_at_snapshot) AS total_valuation,
  sum(debt_at_snapshot) AS total_debt,
  sum(equity_at_snapshot) AS total_equity,
  CASE
    WHEN sum(valuation_at_snapshot) > 0 THEN round(sum(debt_at_snapshot) / sum(valuation_at_snapshot) * 100, 2)
    ELSE NULL
  END AS portfolio_ltv
FROM financial_snapshots fs
GROUP BY org_id, snapshot_month
ORDER BY snapshot_month DESC;