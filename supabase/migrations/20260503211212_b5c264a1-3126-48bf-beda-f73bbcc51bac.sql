
DO $$
DECLARE old_id uuid;
BEGIN
  SELECT id INTO old_id FROM compliance_documents_v2 
  WHERE property_id='5b7144b3-9ee5-4372-8e50-85bd912cfd2f' AND document_type='pat_testing' AND is_current=true LIMIT 1;

  UPDATE compliance_documents_v2 SET is_current=false WHERE id=old_id;

  INSERT INTO compliance_documents_v2 (org_id, property_id, document_type, issue_date, expiry_date, issuer_name, file_url, file_name, status, is_current, supersedes_id, notes, uploaded_at)
  VALUES ('e74ae9f0-8f54-4eff-8732-e7568b3d2e52','5b7144b3-9ee5-4372-8e50-85bd912cfd2f','pat_testing','2025-11-24','2026-11-24','HR4 Tech','e74ae9f0-8f54-4eff-8732-e7568b3d2e52/11holmer_pat_20251124.pdf','PAT_Testing_results_1.pdf','valid', true, old_id, 'PAT Testing - 17 items tested, all Pass. Tester: SRF, UNI-T UT527 (calibrated 15 Jan 2025). 2x hardwired appliances (washing machine, tumble drier) noted as unable to test.', now());
END $$;
