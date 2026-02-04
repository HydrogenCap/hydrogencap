-- Phase 2: Partner Ready - Shareholder Portal & Document Sharing

-- Table for shareholder portal invitations
CREATE TABLE public.shareholder_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT shareholder_invites_email_org_unique UNIQUE (email, org_id)
);

-- Table for active shareholder portal access
CREATE TABLE public.shareholder_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invite_id UUID REFERENCES public.shareholder_invites(id) ON DELETE SET NULL,
  access_level TEXT NOT NULL DEFAULT 'read_only' CHECK (access_level IN ('read_only', 'limited')),
  can_view_financials BOOLEAN NOT NULL DEFAULT true,
  can_view_compliance BOOLEAN NOT NULL DEFAULT true,
  can_view_documents BOOLEAN NOT NULL DEFAULT false,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT shareholder_access_user_org_unique UNIQUE (user_id, org_id)
);

-- Table for secure document sharing links
CREATE TABLE public.document_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  compliance_document_id UUID REFERENCES public.compliance_documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Must link to either a document or compliance_document
  CONSTRAINT document_share_links_one_document CHECK (
    (document_id IS NOT NULL AND compliance_document_id IS NULL) OR
    (document_id IS NULL AND compliance_document_id IS NOT NULL)
  )
);

-- Enable RLS on all tables
ALTER TABLE public.shareholder_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholder_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shareholder_invites
CREATE POLICY "Admins can manage shareholder invites"
ON public.shareholder_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_invites.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

-- RLS Policies for shareholder_access
CREATE POLICY "Admins can manage shareholder access"
ON public.shareholder_access
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_access.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Shareholders can view their own access"
ON public.shareholder_access
FOR SELECT
USING (user_id = auth.uid());

-- RLS Policies for document_share_links
CREATE POLICY "Users can manage share links in their org"
ON public.document_share_links
FOR ALL
USING (user_has_org_access(org_id));

-- Indexes for performance
CREATE INDEX idx_shareholder_invites_token ON public.shareholder_invites(token) WHERE revoked_at IS NULL;
CREATE INDEX idx_shareholder_invites_email ON public.shareholder_invites(email, org_id);
CREATE INDEX idx_shareholder_access_user ON public.shareholder_access(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_document_share_links_token ON public.document_share_links(token) WHERE is_active = true;

-- Function to check if user has shareholder access
CREATE OR REPLACE FUNCTION public.user_has_shareholder_access(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM shareholder_access sa
    WHERE sa.org_id = check_org_id
    AND sa.user_id = auth.uid()
    AND sa.revoked_at IS NULL
  );
END;
$$;