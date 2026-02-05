-- ============================================
-- ENHANCE DOCUMENTS TABLE FOR DOCUMENT MANAGEMENT
-- ============================================

-- Add new columns to existing documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS file_type TEXT, -- 'pdf', 'image', 'doc', 'spreadsheet', 'other'
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tenancy_id UUID REFERENCES public.tenancies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS compliance_item_id UUID REFERENCES public.compliance_items(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS contractor_job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS document_date DATE,
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visible_to_shareholders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visible_to_tenants BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES public.documents(id),
ADD COLUMN IF NOT EXISTS is_current_version BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS uploaded_by UUID,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Update display_name from original_file_name where null
UPDATE public.documents 
SET display_name = COALESCE(final_file_name, original_file_name)
WHERE display_name IS NULL;

-- Make display_name NOT NULL after backfill
ALTER TABLE public.documents 
ALTER COLUMN display_name SET DEFAULT '';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenancy ON public.documents(tenancy_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_compliance ON public.documents(compliance_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_job ON public.documents(contractor_job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category) WHERE deleted_at IS NULL;

-- ============================================
-- DOCUMENT CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  entity_type TEXT DEFAULT 'all',
  display_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- Enable RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view system categories and their org categories
CREATE POLICY "View system and org categories"
ON public.document_categories
FOR SELECT
USING (org_id IS NULL OR public.user_has_org_access(org_id));

-- Insert default system categories
INSERT INTO public.document_categories (org_id, name, slug, icon, entity_type, is_system, display_order) VALUES
(NULL, 'Legal Pack', 'legal-pack', 'Scale', 'property', true, 1),
(NULL, 'Title Deeds', 'title-deeds', 'FileText', 'property', true, 2),
(NULL, 'Mortgage', 'mortgage', 'Landmark', 'property', true, 3),
(NULL, 'Insurance', 'insurance', 'Shield', 'property', true, 4),
(NULL, 'Valuation', 'valuation', 'TrendingUp', 'property', true, 5),
(NULL, 'Survey', 'survey', 'ClipboardCheck', 'property', true, 6),
(NULL, 'Planning', 'planning', 'Map', 'property', true, 7),
(NULL, 'Building Control', 'building-control', 'HardHat', 'property', true, 8),
(NULL, 'EPC', 'epc', 'Zap', 'compliance', true, 9),
(NULL, 'Gas Safety', 'gas-safety', 'Flame', 'compliance', true, 10),
(NULL, 'EICR', 'eicr', 'Plug', 'compliance', true, 11),
(NULL, 'HMO Licence', 'hmo-licence', 'Award', 'compliance', true, 12),
(NULL, 'Fire Safety', 'fire-safety', 'AlertTriangle', 'compliance', true, 13),
(NULL, 'Tenancy Agreement', 'tenancy-agreement', 'FileSignature', 'tenant', true, 14),
(NULL, 'Inventory', 'inventory', 'List', 'tenant', true, 15),
(NULL, 'Reference', 'reference', 'UserCheck', 'tenant', true, 16),
(NULL, 'ID Document', 'id-document', 'CreditCard', 'tenant', true, 17),
(NULL, 'Company Accounts', 'company-accounts', 'Calculator', 'company', true, 18),
(NULL, 'Shareholder Agreement', 'shareholder-agreement', 'Users', 'company', true, 19),
(NULL, 'Board Minutes', 'board-minutes', 'FileText', 'company', true, 20),
(NULL, 'Invoice', 'invoice', 'Receipt', 'project', true, 21),
(NULL, 'Quote', 'quote', 'FileQuestion', 'project', true, 22),
(NULL, 'Photo', 'photo', 'Camera', 'all', true, 23),
(NULL, 'Other', 'other', 'File', 'all', true, 99)
ON CONFLICT (org_id, slug) DO NOTHING;

-- ============================================
-- DOCUMENT ACTIVITY LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('uploaded', 'viewed', 'downloaded', 'edited', 'deleted', 'restored', 'shared', 'version_created')),
  details JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_document_activity_doc ON public.document_activity(document_id);

-- Enable RLS
ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view activity for documents they can access
CREATE POLICY "View document activity"
ON public.document_activity
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id
    AND public.user_has_org_access(d.org_id)
  )
);

-- Allow inserting activity records
CREATE POLICY "Insert document activity"
ON public.document_activity
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id
    AND public.user_has_org_access(d.org_id)
  )
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Soft delete document
CREATE OR REPLACE FUNCTION public.soft_delete_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  UPDATE documents
  SET deleted_at = now(),
      deleted_by = v_user_id,
      updated_at = now()
  WHERE id = p_document_id
  AND deleted_at IS NULL;
  
  -- Log activity
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'deleted', v_user_id);
  
  RETURN FOUND;
END;
$$;

-- Restore deleted document
CREATE OR REPLACE FUNCTION public.restore_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  UPDATE documents
  SET deleted_at = NULL,
      deleted_by = NULL,
      updated_at = now()
  WHERE id = p_document_id
  AND deleted_at IS NOT NULL;
  
  -- Log activity
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'restored', v_user_id);
  
  RETURN FOUND;
END;
$$;

-- Log document view
CREATE OR REPLACE FUNCTION public.log_document_view(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'viewed', auth.uid());
END;
$$;

-- Log document download
CREATE OR REPLACE FUNCTION public.log_document_download(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'downloaded', auth.uid());
END;
$$;