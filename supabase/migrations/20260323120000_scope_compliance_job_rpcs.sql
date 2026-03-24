CREATE OR REPLACE FUNCTION public.create_jobs_for_expiring_compliance(p_org_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_compliance RECORD;
  v_job_id UUID;
  v_property RECORD;
  v_days_until INTEGER;
  v_priority TEXT;
BEGIN
  FOR v_compliance IN
    SELECT 
      ci.id,
      ci.property_id,
      ci.org_id,
      ci.compliance_type,
      ci.expiry_date,
      ci.responsible_party
    FROM compliance_items ci
    WHERE ci.expiry_date IS NOT NULL
      AND ci.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
      AND ci.expiry_date > CURRENT_DATE
      AND (ci.auto_job_created = false OR ci.auto_job_created IS NULL)
      AND ci.is_manually_excluded = false
      AND (p_org_ids IS NULL OR ci.org_id = ANY(p_org_ids))
      AND NOT EXISTS (
        SELECT 1 FROM contractor_jobs cj
        WHERE cj.compliance_item_id = ci.id
          AND cj.status NOT IN ('completed', 'verified', 'cancelled')
      )
  LOOP
    SELECT address_line, postcode INTO v_property
    FROM properties
    WHERE id = v_compliance.property_id;

    v_days_until := v_compliance.expiry_date - CURRENT_DATE;

    IF v_days_until <= 14 THEN
      v_priority := 'urgent';
    ELSIF v_days_until <= 30 THEN
      v_priority := 'high';
    ELSIF v_days_until <= 60 THEN
      v_priority := 'normal';
    ELSE
      v_priority := 'low';
    END IF;

    INSERT INTO contractor_jobs (
      org_id,
      property_id,
      compliance_item_id,
      job_type,
      description,
      status,
      source,
      auto_created_at,
      priority
    )
    VALUES (
      v_compliance.org_id,
      v_compliance.property_id,
      v_compliance.id,
      v_compliance.compliance_type,
      'Auto-created: ' || v_compliance.compliance_type || ' expires ' ||
        to_char(v_compliance.expiry_date, 'DD Mon YYYY') || ' at ' ||
        COALESCE(v_property.address_line, 'Unknown'),
      'draft',
      'auto_compliance',
      now(),
      v_priority
    )
    RETURNING id INTO v_job_id;

    UPDATE compliance_items
    SET auto_job_created = true, auto_job_id = v_job_id
    WHERE id = v_compliance.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_job_priorities(p_org_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE contractor_jobs cj
  SET priority = CASE
    WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
    WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
    WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
    ELSE 'low'
  END
  FROM compliance_items ci
  WHERE cj.compliance_item_id = ci.id
    AND cj.status NOT IN ('completed', 'verified', 'cancelled')
    AND ci.expiry_date IS NOT NULL
    AND (p_org_ids IS NULL OR cj.org_id = ANY(p_org_ids))
    AND cj.priority IS DISTINCT FROM CASE
      WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
      WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
      WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
      ELSE 'low'
    END;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_renewed_compliance_jobs(p_org_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  UPDATE contractor_jobs cj
  SET 
    status = 'cancelled',
    internal_notes = COALESCE(cj.internal_notes || E'\n', '') || 'Auto-cancelled: compliance certificate was renewed.',
    updated_at = now()
  FROM compliance_items ci
  WHERE cj.compliance_item_id = ci.id
    AND cj.source = 'auto_compliance'
    AND cj.status NOT IN ('completed', 'verified', 'cancelled')
    AND ci.expiry_date IS NOT NULL
    AND ci.expiry_date > (now() + interval '60 days')
    AND (p_org_ids IS NULL OR cj.org_id = ANY(p_org_ids));

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;
