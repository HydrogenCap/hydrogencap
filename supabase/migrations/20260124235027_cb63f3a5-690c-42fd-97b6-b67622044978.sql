-- @allow-v1-refs: pre-cutover historical migration referencing §0a V1 tables (loans/tenancies/costs/income); baked-in DB history, not new code.
-- =============================================
-- PORTFOLIO DASHBOARD - COMPLETE DATABASE SCHEMA
-- =============================================

-- Create app_role enum for future multi-user support
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'viewer');

-- =============================================
-- ORGANIZATIONS TABLE
-- =============================================
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES TABLE (user metadata)
-- =============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MEMBERSHIPS TABLE (user-org relationship)
-- =============================================
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, org_id)
);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROPERTIES TABLE
-- =============================================
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    address_line TEXT NOT NULL,
    area_name TEXT,
    postcode TEXT,
    postcode_area TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    ownership_entity TEXT,
    ownership_percent DECIMAL(5, 2) DEFAULT 100,
    property_type TEXT,
    beds INTEGER,
    purchase_price_gbp DECIMAL(12, 2),
    original_purchase_date DATE,
    current_value_gbp DECIMAL(12, 2),
    epc_rating TEXT CHECK (epc_rating IN ('A', 'B', 'C', 'D', 'E', 'F', 'G') OR epc_rating IS NULL),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- =============================================
-- LOANS TABLE
-- =============================================
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    lender TEXT,
    interest_rate_percent DECIMAL(5, 3),
    fixed_or_variable TEXT CHECK (fixed_or_variable IN ('fixed', 'variable') OR fixed_or_variable IS NULL),
    mortgage_type TEXT,
    capital_or_interest TEXT CHECK (capital_or_interest IN ('capital', 'interest') OR capital_or_interest IS NULL),
    fixed_rate_expires DATE,
    reversion_rate_percent DECIMAL(5, 3),
    refinance_target_date DATE,
    broker_name TEXT,
    broker_contact TEXT,
    current_mortgage_balance_gbp DECIMAL(12, 2),
    mortgage_payment_gbp DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INCOME TABLE (annual rent by year)
-- =============================================
CREATE TABLE public.income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    annual_rent_gbp DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(property_id, year)
);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- =============================================
-- COSTS TABLE (annual costs by year)
-- =============================================
CREATE TABLE public.costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    management_gbp DECIMAL(10, 2) DEFAULT 0,
    bills_gbp DECIMAL(10, 2) DEFAULT 0,
    insurance_gbp DECIMAL(10, 2) DEFAULT 0,
    maintenance_gbp DECIMAL(10, 2) DEFAULT 0,
    compliance_gbp DECIMAL(10, 2) DEFAULT 0,
    other_gbp DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(property_id, year)
);

ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENTS TABLE (with AI metadata)
-- =============================================
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    doc_type TEXT,
    file_url TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    final_file_name TEXT,
    expiry_date DATE,
    extracted_issue_date DATE,
    extracted_reference_number TEXT,
    extracted_address_text TEXT,
    extracted_epc_rating TEXT,
    ai_suggested_doc_type TEXT,
    ai_doc_type_confidence DECIMAL(5, 4),
    ai_suggested_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    ai_property_confidence DECIMAL(5, 4),
    extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'review_needed')),
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'rejected')),
    renamed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHOTOS TABLE
-- =============================================
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    is_cover BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ACTIVITY LOG TABLE
-- =============================================
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('valuation', 'rate', 'rent', 'works', 'refinance', 'document', 'note', 'system')),
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTION: Check org membership
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_org_access(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.memberships
        WHERE user_id = auth.uid()
        AND org_id = check_org_id
    )
$$;

-- Helper to get user's org_id (for single-user, returns first org)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT org_id
    FROM public.memberships
    WHERE user_id = auth.uid()
    LIMIT 1
$$;

-- =============================================
-- RLS POLICIES: Organizations
-- =============================================
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (public.user_has_org_access(id));

CREATE POLICY "Users can update their organizations"
ON public.organizations FOR UPDATE
USING (public.user_has_org_access(id));

-- =============================================
-- RLS POLICIES: Profiles
-- =============================================
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: Memberships
-- =============================================
CREATE POLICY "Users can view own memberships"
ON public.memberships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memberships"
ON public.memberships FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: Properties
-- =============================================
CREATE POLICY "Users can view properties in their org"
ON public.properties FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert properties in their org"
ON public.properties FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update properties in their org"
ON public.properties FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete properties in their org"
ON public.properties FOR DELETE
USING (public.user_has_org_access(org_id));

-- =============================================
-- RLS POLICIES: Loans
-- =============================================
CREATE POLICY "Users can view loans for their properties"
ON public.loans FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can insert loans for their properties"
ON public.loans FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can update loans for their properties"
ON public.loans FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can delete loans for their properties"
ON public.loans FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

-- =============================================
-- RLS POLICIES: Income
-- =============================================
CREATE POLICY "Users can view income for their properties"
ON public.income FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can insert income for their properties"
ON public.income FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can update income for their properties"
ON public.income FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can delete income for their properties"
ON public.income FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

-- =============================================
-- RLS POLICIES: Costs
-- =============================================
CREATE POLICY "Users can view costs for their properties"
ON public.costs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can insert costs for their properties"
ON public.costs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can update costs for their properties"
ON public.costs FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can delete costs for their properties"
ON public.costs FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

-- =============================================
-- RLS POLICIES: Documents
-- =============================================
CREATE POLICY "Users can view documents in their org"
ON public.documents FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert documents in their org"
ON public.documents FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update documents in their org"
ON public.documents FOR UPDATE
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete documents in their org"
ON public.documents FOR DELETE
USING (public.user_has_org_access(org_id));

-- =============================================
-- RLS POLICIES: Photos
-- =============================================
CREATE POLICY "Users can view photos for their properties"
ON public.photos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can insert photos for their properties"
ON public.photos FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can update photos for their properties"
ON public.photos FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

CREATE POLICY "Users can delete photos for their properties"
ON public.photos FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = property_id
        AND public.user_has_org_access(p.org_id)
    )
);

-- =============================================
-- RLS POLICIES: Activity Log
-- =============================================
CREATE POLICY "Users can view activity in their org"
ON public.activity_log FOR SELECT
USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert activity in their org"
ON public.activity_log FOR INSERT
WITH CHECK (public.user_has_org_access(org_id));

-- =============================================
-- TRIGGER: Auto-update updated_at timestamps
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_properties_updated_at
    BEFORE UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_loans_updated_at
    BEFORE UPDATE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_income_updated_at
    BEFORE UPDATE ON public.income
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_costs_updated_at
    BEFORE UPDATE ON public.costs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER: Auto-create org + membership on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create a default organization for the user
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Portfolio')
    RETURNING id INTO new_org_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    -- Create membership with owner role
    INSERT INTO public.memberships (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STORAGE: Create buckets for documents and photos
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true);

-- Storage policies for documents bucket (private)
CREATE POLICY "Users can view their org documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
);

-- Storage policies for photos bucket (public read)
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_properties_org_id ON public.properties(org_id);
CREATE INDEX idx_properties_postcode_area ON public.properties(postcode_area);
CREATE INDEX idx_properties_area_name ON public.properties(area_name);
CREATE INDEX idx_loans_property_id ON public.loans(property_id);
CREATE INDEX idx_loans_fixed_rate_expires ON public.loans(fixed_rate_expires);
CREATE INDEX idx_income_property_year ON public.income(property_id, year);
CREATE INDEX idx_costs_property_year ON public.costs(property_id, year);
CREATE INDEX idx_documents_org_id ON public.documents(org_id);
CREATE INDEX idx_documents_property_id ON public.documents(property_id);
CREATE INDEX idx_documents_extraction_status ON public.documents(extraction_status);
CREATE INDEX idx_documents_review_status ON public.documents(review_status);
CREATE INDEX idx_photos_property_id ON public.photos(property_id);
CREATE INDEX idx_activity_log_org_id ON public.activity_log(org_id);
CREATE INDEX idx_activity_log_property_id ON public.activity_log(property_id);
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_org_id ON public.memberships(org_id);