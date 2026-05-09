ALTER TABLE public.compliance_requirements_v2
  ADD COLUMN IF NOT EXISTS responsible_party text;

COMMENT ON COLUMN public.compliance_requirements_v2.responsible_party IS
  'Person/role responsible for keeping this compliance item current. Migrated from V1 compliance_items.responsible_party in §0b Ship C2 (2026-05-08).';

WITH v1_to_v2_type AS (
  SELECT * FROM (VALUES
    ('Buildings Insurance Schedule',          'buildings_insurance'),
    ('Electrical Safety Certificate (EICR)',  'eicr'),
    ('Emergency Lighting Certificate',        'emergency_lighting_cert'),
    ('EPC',                                   'epc'),
    ('Fire Alarm Certificate',                'fire_alarm_cert'),
    ('Fire Risk Assessment (FRA)',            'fire_risk_assessment'),
    ('Gas Safety Certificate (CP12)',         'gas_safety_certificate'),
    ('HMO Licence',                           'hmo_licence'),
    ('Legionella Risk Assessment',            'legionella_risk_assessment'),
    ('PAT Testing',                           'pat_testing')
  ) AS m(v1_type, v2_type)
)
UPDATE public.compliance_requirements_v2 cr
   SET responsible_party = src.responsible_party
  FROM (
    SELECT ci.property_id, m.v2_type AS document_type, ci.responsible_party
      FROM public.compliance_items ci
      JOIN v1_to_v2_type m ON m.v1_type = ci.compliance_type
     WHERE ci.responsible_party IS NOT NULL
       AND ci.responsible_party <> ''
  ) src
 WHERE cr.property_id    = src.property_id
   AND cr.document_type  = src.document_type
   AND cr.responsible_party IS NULL;

-- CREATE OR REPLACE VIEW requires new columns to be appended at the end —
-- inserting `responsible_party` mid-list raised 42P16. Append it instead.
CREATE OR REPLACE VIEW public.compliance_matrix_v2 AS
SELECT cr.id AS requirement_id,
    cr.org_id,
    cr.property_id,
    (p.address_line_1 || ', '::text) || p.postcode AS property_address,
    p.property_type,
    le.entity_name,
    cr.document_type,
    cr.is_required,
    cr.override_reason,
    cr.review_frequency_months,
    cr.lead_time_days,
    cd.id AS document_id,
    cd.issue_date,
    cd.expiry_date,
    cd.issuer_name,
    cd.certificate_number,
    cd.file_url,
    cd.ai_extracted,
    cd.cost,
    cd.notes AS document_notes,
        CASE
            WHEN cr.is_required = false THEN 'not_required'::text
            WHEN cd.id IS NULL THEN 'missing'::text
            WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date < CURRENT_DATE THEN 'expired'::text
            WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date <= (CURRENT_DATE + '30 days'::interval) THEN 'critical'::text
            WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date <= (CURRENT_DATE + '90 days'::interval) THEN 'expiring_soon'::text
            ELSE 'valid'::text
        END AS calculated_status,
        CASE
            WHEN cr.is_required = false THEN NULL::integer
            WHEN cd.id IS NULL THEN NULL::integer
            WHEN cd.expiry_date IS NULL THEN NULL::integer
            ELSE cd.expiry_date - CURRENT_DATE
        END AS days_remaining,
        CASE
            WHEN cr.is_required = false THEN 9999
            WHEN cd.id IS NULL THEN '-1'::integer
            WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date < CURRENT_DATE THEN - (CURRENT_DATE - cd.expiry_date)
            WHEN cd.expiry_date IS NOT NULL THEN cd.expiry_date - CURRENT_DATE
            ELSE 9998
        END AS urgency_score,
    cr.responsible_party
   FROM public.compliance_requirements_v2 cr
     JOIN public.properties_v2 p ON p.id = cr.property_id
     LEFT JOIN public.legal_entities le ON le.id = p.entity_id
     LEFT JOIN public.compliance_documents_v2 cd
            ON cd.property_id = cr.property_id
           AND cd.document_type = cr.document_type
           AND cd.is_current = true
  ORDER BY (
        CASE
            WHEN cr.is_required = false THEN 9999
            WHEN cd.id IS NULL THEN '-1'::integer
            WHEN cd.expiry_date IS NOT NULL AND cd.expiry_date < CURRENT_DATE THEN - (CURRENT_DATE - cd.expiry_date)
            WHEN cd.expiry_date IS NOT NULL THEN cd.expiry_date - CURRENT_DATE
            ELSE 9998
        END);