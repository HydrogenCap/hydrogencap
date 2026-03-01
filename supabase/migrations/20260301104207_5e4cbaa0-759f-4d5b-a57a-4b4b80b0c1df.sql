
-- Fix: Add org membership checks to document SECURITY DEFINER functions
-- This prevents users from operating on documents outside their organization

CREATE OR REPLACE FUNCTION public.soft_delete_document(p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_doc_org_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  -- Verify user has access to the document's org
  SELECT org_id INTO v_doc_org_id FROM documents WHERE id = p_document_id;
  
  IF v_doc_org_id IS NULL OR NOT public.user_has_org_access(v_doc_org_id) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE documents
  SET deleted_at = now(),
      deleted_by = v_user_id,
      updated_at = now()
  WHERE id = p_document_id
  AND deleted_at IS NULL;
  
  IF FOUND THEN
    INSERT INTO document_activity (document_id, action, performed_by)
    VALUES (p_document_id, 'deleted', v_user_id);
  END IF;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_document(p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_doc_org_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  -- Verify user has access to the document's org
  SELECT org_id INTO v_doc_org_id FROM documents WHERE id = p_document_id;
  
  IF v_doc_org_id IS NULL OR NOT public.user_has_org_access(v_doc_org_id) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE documents
  SET deleted_at = NULL,
      deleted_by = NULL,
      updated_at = now()
  WHERE id = p_document_id
  AND deleted_at IS NOT NULL;
  
  IF FOUND THEN
    INSERT INTO document_activity (document_id, action, performed_by)
    VALUES (p_document_id, 'restored', v_user_id);
  END IF;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_document_view(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_org_id UUID;
BEGIN
  -- Verify user has access to the document's org
  SELECT org_id INTO v_doc_org_id FROM documents WHERE id = p_document_id;
  
  IF v_doc_org_id IS NULL OR NOT public.user_has_org_access(v_doc_org_id) THEN
    RETURN;
  END IF;

  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'viewed', auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_document_download(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_org_id UUID;
BEGIN
  -- Verify user has access to the document's org
  SELECT org_id INTO v_doc_org_id FROM documents WHERE id = p_document_id;
  
  IF v_doc_org_id IS NULL OR NOT public.user_has_org_access(v_doc_org_id) THEN
    RETURN;
  END IF;

  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'downloaded', auth.uid());
END;
$function$;
