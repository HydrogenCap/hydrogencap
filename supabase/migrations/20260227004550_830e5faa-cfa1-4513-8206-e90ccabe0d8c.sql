
-- Fix migrate_compliance_to_v2: remove ::text casts on date columns
CREATE OR REPLACE FUNCTION public.migrate_compliance_to_v2(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  migrated_count integer := 0;
  skipped_count integer := 0;
  rec record;
  v2_property_id uuid;
  doc_url text;
  doc_filename text;
BEGIN
  FOR rec IN
    SELECT ci.*, p.address_line AS prop_address, p.postcode AS prop_postcode
    FROM public.compliance_items ci
    JOIN public.properties p ON p.id = ci.property_id
    WHERE ci.org_id = p_org_id AND ci.issue_date IS NOT NULL
  LOOP
    SELECT pv.id INTO v2_property_id FROM public.properties_v2 pv
    WHERE pv.address_line_1 = rec.prop_address AND pv.postcode = rec.prop_postcode AND pv.org_id = p_org_id LIMIT 1;

    IF v2_property_id IS NULL THEN skipped_count := skipped_count + 1; CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.compliance_documents_v2 cd
      WHERE cd.property_id = v2_property_id AND cd.document_type = rec.compliance_type AND cd.issue_date = rec.issue_date) THEN
      skipped_count := skipped_count + 1; CONTINUE;
    END IF;

    SELECT cd.file_url, cd.original_file_name INTO doc_url, doc_filename
    FROM public.compliance_documents cd
    WHERE cd.compliance_item_id = rec.id AND cd.is_current = true LIMIT 1;

    INSERT INTO public.compliance_documents_v2 (
      property_id, document_type, issue_date, expiry_date, status, file_url, file_name, is_current, org_id, notes
    ) VALUES (
      v2_property_id, rec.compliance_type, rec.issue_date, rec.expiry_date,
      CASE WHEN rec.expiry_date IS NOT NULL AND rec.expiry_date < current_date THEN 'expired' ELSE 'valid' END,
      doc_url, doc_filename,
      CASE WHEN rec.expiry_date IS NULL OR rec.expiry_date >= current_date THEN true ELSE false END,
      rec.org_id,
      concat_ws(E'\n', rec.notes,
        CASE WHEN rec.responsible_party IS NOT NULL THEN 'Responsible: ' || rec.responsible_party END,
        'Migrated from V1 compliance_items on ' || now()::date
      )
    );
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', migrated_count, 'skipped', skipped_count, 'table', 'compliance_items → compliance_documents_v2');
END;
$function$;
