-- N4: Prevent duplicate is_current=true compliance documents per property/type
CREATE UNIQUE INDEX compliance_docs_v2_one_current 
ON public.compliance_documents_v2 (property_id, document_type) 
WHERE is_current = true;