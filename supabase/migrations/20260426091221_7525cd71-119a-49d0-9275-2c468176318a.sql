
-- RRB Readiness View — SECURITY INVOKER so caller's RLS applies.
-- HMO note: no dedicated HMO licence table exists; HMO data lives on properties_v2
-- (is_hmo_licensed, hmo_licence_number). Non-HMO properties get full hmo_score (N/A).
CREATE OR REPLACE VIEW public.rrb_readiness_v
WITH (security_invoker = true)
AS
WITH active_tenancies AS (
  SELECT ta.property_id, ta.org_id, ta.id AS agreement_id,
         ta.deposit_scheme, ta.deposit_reference,
         ta.is_periodic, ta.break_clause_date, ta.tenancy_type
  FROM public.tenancy_agreements ta
  WHERE LOWER(ta.status) IN ('active', 'live', 'current')
),
tenancy_terms AS (
  SELECT property_id, COUNT(*) AS total,
    SUM(CASE
      WHEN COALESCE(is_periodic,false)=true THEN 1
      WHEN break_clause_date IS NOT NULL THEN 1
      WHEN LOWER(COALESCE(tenancy_type,'')) NOT LIKE '%fixed%' THEN 1
      ELSE 0 END) AS passing
  FROM active_tenancies GROUP BY property_id
),
deposit_check AS (
  SELECT property_id,
    BOOL_AND(deposit_scheme IS NOT NULL AND deposit_reference IS NOT NULL) AS all_protected,
    COUNT(*) AS total
  FROM active_tenancies GROUP BY property_id
),
rent_history AS (
  SELECT at.property_id,
    BOOL_OR(EXISTS (
      SELECT 1 FROM public.rent_schedule r2
      WHERE r2.tenancy_id = r1.tenancy_id
        AND r2.id <> r1.id
        AND r2.rent_amount <> r1.rent_amount
        AND ABS(r2.due_date - r1.due_date) < 365
    )) AS double_increase,
    MIN(r1.due_date) AS earliest,
    MAX(r1.due_date) AS latest
  FROM public.rent_schedule r1
  JOIN active_tenancies at ON at.agreement_id = r1.agreement_id
  GROUP BY at.property_id
),
compliance_check AS (
  SELECT ci.property_id,
    BOOL_OR(LOWER(ci.compliance_type) LIKE '%gas%' AND (ci.expiry_date IS NULL OR ci.expiry_date >= CURRENT_DATE)) AS gas_ok,
    BOOL_OR((LOWER(ci.compliance_type) LIKE '%eicr%' OR LOWER(ci.compliance_type) LIKE '%electric%') AND (ci.expiry_date IS NULL OR ci.expiry_date >= CURRENT_DATE)) AS eicr_ok,
    BOOL_OR(LOWER(ci.compliance_type) LIKE '%epc%' AND (ci.expiry_date IS NULL OR ci.expiry_date >= CURRENT_DATE)) AS epc_ok,
    BOOL_OR((LOWER(ci.compliance_type) LIKE '%fire%' OR LOWER(ci.compliance_type) LIKE '%alarm%') AND (ci.expiry_date IS NULL OR ci.expiry_date >= CURRENT_DATE)) AS fire_ok
  FROM public.compliance_items ci GROUP BY ci.property_id
),
scored AS (
  SELECT
    p.id AS property_id, p.org_id,
    COALESCE(CASE WHEN tt.total > 0 THEN ROUND((tt.passing::numeric / tt.total) * 20)::int ELSE 20 END, 20) AS tenancy_score,
    COALESCE(CASE WHEN dc.total > 0 AND dc.all_protected THEN 20
                  WHEN dc.total > 0 AND NOT dc.all_protected THEN 0
                  ELSE 20 END, 20) AS deposit_score,
    COALESCE(CASE WHEN rh.double_increase THEN 0
                  WHEN rh.earliest IS NULL OR (rh.latest - rh.earliest) < 365 THEN 10
                  ELSE 20 END, 10) AS rent_score,
    (CASE WHEN COALESCE(cc.gas_ok,false) THEN 5 ELSE 0 END
     + CASE WHEN COALESCE(cc.eicr_ok,false) THEN 5 ELSE 0 END
     + CASE WHEN COALESCE(cc.epc_ok,false) THEN 5 ELSE 0 END
     + CASE WHEN COALESCE(cc.fire_ok,false) THEN 5 ELSE 0 END) AS compliance_score,
    CASE WHEN LOWER(p.property_type) NOT LIKE '%hmo%' THEN 20
         WHEN COALESCE(p.is_hmo_licensed,false) AND p.hmo_licence_number IS NOT NULL THEN 20
         ELSE 0 END AS hmo_score,
    (CASE WHEN dc.total > 0 AND NOT dc.all_protected THEN 1 ELSE 0 END
     + CASE WHEN NOT COALESCE(cc.gas_ok,false) THEN 1 ELSE 0 END
     + CASE WHEN NOT COALESCE(cc.eicr_ok,false) THEN 1 ELSE 0 END
     + CASE WHEN NOT COALESCE(cc.epc_ok,false) THEN 1 ELSE 0 END
     + CASE WHEN NOT COALESCE(cc.fire_ok,false) THEN 1 ELSE 0 END
     + CASE WHEN LOWER(p.property_type) LIKE '%hmo%' AND NOT (COALESCE(p.is_hmo_licensed,false) AND p.hmo_licence_number IS NOT NULL) THEN 1 ELSE 0 END
    ) AS missing_data_count
  FROM public.properties_v2 p
  LEFT JOIN tenancy_terms tt ON tt.property_id = p.id
  LEFT JOIN deposit_check dc ON dc.property_id = p.id
  LEFT JOIN rent_history rh ON rh.property_id = p.id
  LEFT JOIN compliance_check cc ON cc.property_id = p.id
)
SELECT property_id, org_id, tenancy_score, deposit_score, rent_score, compliance_score, hmo_score,
       (tenancy_score + deposit_score + rent_score + compliance_score + hmo_score) AS total_score,
       missing_data_count, now() AS last_calculated
FROM scored;

GRANT SELECT ON public.rrb_readiness_v TO authenticated;
