-- =============================================
-- NEW OWNERSHIP & SHAREHOLDING SCHEMA
-- =============================================

-- 1. PARTIES - Unified entity (individuals, companies, trusts)
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_type TEXT NOT NULL CHECK (party_type IN ('INDIVIDUAL', 'COMPANY', 'TRUST')),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  company_number TEXT, -- For UK companies, nullable for individuals
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique company number per org (if provided)
CREATE UNIQUE INDEX parties_company_number_org_idx ON public.parties(org_id, company_number) WHERE company_number IS NOT NULL;

-- 2. COMPANIES - Company-specific details
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  company_number TEXT,
  jurisdiction TEXT DEFAULT 'UK',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DORMANT', 'SOLD', 'CLOSED')),
  company_type TEXT NOT NULL DEFAULT 'SPV' CHECK (company_type IN ('HOLDCO', 'SPV', 'OPCO', 'OTHER')),
  -- Companies House data
  ch_registered_address TEXT,
  ch_incorporation_date DATE,
  ch_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX companies_company_number_org_idx ON public.companies(org_id, company_number) WHERE company_number IS NOT NULL;

-- 3. SHARE CLASSES - Types of shares in a company
CREATE TABLE public.share_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Ordinary',
  currency TEXT DEFAULT 'GBP',
  is_primary BOOLEAN DEFAULT true,
  issued_shares INTEGER NOT NULL DEFAULT 100,
  nominal_value DECIMAL(10,4) DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 4. SHAREHOLDINGS - Who holds what shares
CREATE TABLE public.shareholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES public.share_classes(id) ON DELETE CASCADE,
  shareholder_party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  shares_held INTEGER NOT NULL,
  ownership_source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (ownership_source IN ('MANUAL', 'COMPANIES_HOUSE', 'IMPORT')),
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL means current
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique active shareholding per party/share class
CREATE UNIQUE INDEX shareholdings_active_unique_idx 
ON public.shareholdings(company_id, share_class_id, shareholder_party_id) 
WHERE effective_to IS NULL;

-- 5. GROUPS - Beneficial groupings (e.g., "Hydrogen Capital")
CREATE TABLE public.ownership_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. GROUP MEMBERS - Which parties belong to a group
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.ownership_groups(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'KEY_ENTITY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, party_id)
);

-- 7. COMPANY METRIC SNAPSHOTS - Historical valuations
CREATE TABLE public.company_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL,
  valuation DECIMAL(14,2),
  debt DECIMAL(14,2),
  equity DECIMAL(14,2),
  cashflow_monthly DECIMAL(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, as_of_date)
);

-- 8. LINK PROPERTIES TO COMPANIES
-- Add company_id to property_legal_ownership for SPV ownership
ALTER TABLE public.property_legal_ownership 
ADD COLUMN owning_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Parties policies
CREATE POLICY "Users can view parties in their org" ON public.parties FOR SELECT USING (user_has_org_access(org_id));
CREATE POLICY "Users can insert parties in their org" ON public.parties FOR INSERT WITH CHECK (user_has_org_access(org_id));
CREATE POLICY "Users can update parties in their org" ON public.parties FOR UPDATE USING (user_has_org_access(org_id));
CREATE POLICY "Users can delete parties in their org" ON public.parties FOR DELETE USING (user_has_org_access(org_id));

-- Companies policies
CREATE POLICY "Users can view companies in their org" ON public.companies FOR SELECT USING (user_has_org_access(org_id));
CREATE POLICY "Users can insert companies in their org" ON public.companies FOR INSERT WITH CHECK (user_has_org_access(org_id));
CREATE POLICY "Users can update companies in their org" ON public.companies FOR UPDATE USING (user_has_org_access(org_id));
CREATE POLICY "Users can delete companies in their org" ON public.companies FOR DELETE USING (user_has_org_access(org_id));

-- Share classes policies (via company org)
CREATE POLICY "Users can view share classes in their org" ON public.share_classes FOR SELECT 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = share_classes.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can insert share classes in their org" ON public.share_classes FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = share_classes.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can update share classes in their org" ON public.share_classes FOR UPDATE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = share_classes.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can delete share classes in their org" ON public.share_classes FOR DELETE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = share_classes.company_id AND user_has_org_access(c.org_id)));

-- Shareholdings policies (via company org)
CREATE POLICY "Users can view shareholdings in their org" ON public.shareholdings FOR SELECT 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = shareholdings.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can insert shareholdings in their org" ON public.shareholdings FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = shareholdings.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can update shareholdings in their org" ON public.shareholdings FOR UPDATE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = shareholdings.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can delete shareholdings in their org" ON public.shareholdings FOR DELETE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = shareholdings.company_id AND user_has_org_access(c.org_id)));

-- Ownership groups policies
CREATE POLICY "Users can view groups in their org" ON public.ownership_groups FOR SELECT USING (user_has_org_access(org_id));
CREATE POLICY "Users can insert groups in their org" ON public.ownership_groups FOR INSERT WITH CHECK (user_has_org_access(org_id));
CREATE POLICY "Users can update groups in their org" ON public.ownership_groups FOR UPDATE USING (user_has_org_access(org_id));
CREATE POLICY "Users can delete groups in their org" ON public.ownership_groups FOR DELETE USING (user_has_org_access(org_id));

-- Group members policies (via group org)
CREATE POLICY "Users can view group members in their org" ON public.group_members FOR SELECT 
USING (EXISTS (SELECT 1 FROM ownership_groups g WHERE g.id = group_members.group_id AND user_has_org_access(g.org_id)));
CREATE POLICY "Users can insert group members in their org" ON public.group_members FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM ownership_groups g WHERE g.id = group_members.group_id AND user_has_org_access(g.org_id)));
CREATE POLICY "Users can update group members in their org" ON public.group_members FOR UPDATE 
USING (EXISTS (SELECT 1 FROM ownership_groups g WHERE g.id = group_members.group_id AND user_has_org_access(g.org_id)));
CREATE POLICY "Users can delete group members in their org" ON public.group_members FOR DELETE 
USING (EXISTS (SELECT 1 FROM ownership_groups g WHERE g.id = group_members.group_id AND user_has_org_access(g.org_id)));

-- Company metric snapshots policies (via company org)
CREATE POLICY "Users can view snapshots in their org" ON public.company_metric_snapshots FOR SELECT 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_metric_snapshots.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can insert snapshots in their org" ON public.company_metric_snapshots FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_metric_snapshots.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can update snapshots in their org" ON public.company_metric_snapshots FOR UPDATE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_metric_snapshots.company_id AND user_has_org_access(c.org_id)));
CREATE POLICY "Users can delete snapshots in their org" ON public.company_metric_snapshots FOR DELETE 
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_metric_snapshots.company_id AND user_has_org_access(c.org_id)));

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_share_classes_updated_at BEFORE UPDATE ON public.share_classes 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_shareholdings_updated_at BEFORE UPDATE ON public.shareholdings 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_ownership_groups_updated_at BEFORE UPDATE ON public.ownership_groups 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX parties_org_id_idx ON public.parties(org_id);
CREATE INDEX parties_party_type_idx ON public.parties(party_type);
CREATE INDEX companies_org_id_idx ON public.companies(org_id);
CREATE INDEX companies_company_type_idx ON public.companies(company_type);
CREATE INDEX shareholdings_company_idx ON public.shareholdings(company_id);
CREATE INDEX shareholdings_shareholder_idx ON public.shareholdings(shareholder_party_id);
CREATE INDEX company_snapshots_date_idx ON public.company_metric_snapshots(as_of_date);