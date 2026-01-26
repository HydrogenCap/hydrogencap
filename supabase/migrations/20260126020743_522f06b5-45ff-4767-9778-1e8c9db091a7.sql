-- Compliance Items table
CREATE TABLE public.compliance_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  compliance_type TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  reminder_days INTEGER[] DEFAULT ARRAY[90, 60, 30, 0],
  responsible_party TEXT DEFAULT 'COHO',
  notes TEXT,
  is_coho_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Compliance Documents table
CREATE TABLE public.compliance_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compliance_item_id UUID NOT NULL REFERENCES public.compliance_items(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  is_current BOOLEAN DEFAULT true,
  version_number INTEGER DEFAULT 1,
  archived_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for compliance_items
CREATE POLICY "Users can view compliance items in their org"
ON public.compliance_items
FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert compliance items in their org"
ON public.compliance_items
FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update compliance items in their org"
ON public.compliance_items
FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete compliance items in their org"
ON public.compliance_items
FOR DELETE
USING (public.user_has_org_access(org_id));

-- RLS policies for compliance_documents (via compliance_items org check)
CREATE POLICY "Users can view compliance documents in their org"
ON public.compliance_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_items ci
    WHERE ci.id = compliance_item_id
    AND public.user_has_org_access(ci.org_id)
  )
);

CREATE POLICY "Users can insert compliance documents in their org"
ON public.compliance_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_items ci
    WHERE ci.id = compliance_item_id
    AND public.user_has_org_access(ci.org_id)
  )
);

CREATE POLICY "Users can update compliance documents in their org"
ON public.compliance_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_items ci
    WHERE ci.id = compliance_item_id
    AND public.user_has_org_access(ci.org_id)
  )
);

CREATE POLICY "Users can delete compliance documents in their org"
ON public.compliance_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_items ci
    WHERE ci.id = compliance_item_id
    AND public.user_has_org_access(ci.org_id)
  )
);

-- Indexes for performance
CREATE INDEX idx_compliance_items_property_id ON public.compliance_items(property_id);
CREATE INDEX idx_compliance_items_org_id ON public.compliance_items(org_id);
CREATE INDEX idx_compliance_items_expiry_date ON public.compliance_items(expiry_date);
CREATE INDEX idx_compliance_documents_item_id ON public.compliance_documents(compliance_item_id);
CREATE INDEX idx_compliance_documents_is_current ON public.compliance_documents(is_current) WHERE is_current = true;

-- Triggers for updated_at
CREATE TRIGGER update_compliance_items_updated_at
BEFORE UPDATE ON public.compliance_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for compliance documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('compliance', 'compliance', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for compliance bucket
CREATE POLICY "Users can view compliance files in their org"
ON storage.objects FOR SELECT
USING (bucket_id = 'compliance' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload compliance files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'compliance' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update compliance files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'compliance' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete compliance files"
ON storage.objects FOR DELETE
USING (bucket_id = 'compliance' AND auth.uid() IS NOT NULL);