-- Referencing records
CREATE TABLE tenant_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  letting_id uuid, -- links to lettings pipeline item
  tenant_id uuid,
  applicant_name text NOT NULL,
  applicant_email text,
  applicant_phone text,
  -- Credit check
  credit_check_status text DEFAULT 'pending' CHECK (credit_check_status IN ('pending', 'passed', 'failed', 'conditional')),
  credit_check_date date,
  credit_score int,
  -- Employment reference
  employer_name text,
  employer_contact text,
  employment_status text CHECK (employment_status IN ('employed', 'self_employed', 'retired', 'student', 'unemployed', 'other')),
  annual_income numeric,
  employer_ref_status text DEFAULT 'pending' CHECK (employer_ref_status IN ('pending', 'received', 'satisfactory', 'unsatisfactory')),
  -- Landlord reference
  previous_landlord_name text,
  previous_landlord_contact text,
  landlord_ref_status text DEFAULT 'pending' CHECK (landlord_ref_status IN ('pending', 'received', 'satisfactory', 'unsatisfactory')),
  -- Right to rent
  right_to_rent_checked boolean DEFAULT false,
  right_to_rent_doc_type text,
  right_to_rent_expiry date,
  -- Guarantor
  guarantor_required boolean DEFAULT false,
  guarantor_name text,
  guarantor_contact text,
  guarantor_status text DEFAULT 'not_required' CHECK (guarantor_status IN ('not_required', 'pending', 'confirmed', 'refused')),
  -- Overall
  overall_status text DEFAULT 'in_progress' CHECK (overall_status IN ('in_progress', 'approved', 'rejected', 'conditional')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Move-in checklists
CREATE TABLE move_in_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  tenant_id uuid,
  letting_id uuid,
  -- Items (each boolean tracks completion)
  deposit_protected boolean DEFAULT false,
  deposit_protection_ref text,
  deposit_prescribed_info_served boolean DEFAULT false,
  standing_order_confirmed boolean DEFAULT false,
  keys_handed_over boolean DEFAULT false,
  keys_count int,
  meter_readings_recorded boolean DEFAULT false,
  gas_reading text,
  electric_reading text,
  water_reading text,
  council_tax_notified boolean DEFAULT false,
  utilities_transferred boolean DEFAULT false,
  inventory_completed boolean DEFAULT false,
  inventory_signed boolean DEFAULT false,
  how_to_rent_provided boolean DEFAULT false,
  gas_cert_provided boolean DEFAULT false,
  eicr_provided boolean DEFAULT false,
  epc_provided boolean DEFAULT false,
  welcome_pack_sent boolean DEFAULT false,
  emergency_contacts_collected boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Viewing schedule
CREATE TABLE property_viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  letting_id uuid,
  applicant_name text NOT NULL,
  applicant_email text,
  applicant_phone text,
  viewing_date date NOT NULL,
  viewing_time time NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'attended', 'no_show', 'cancelled')),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenancy agreement drafts
CREATE TABLE tenancy_agreement_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  letting_id uuid,
  property_id uuid NOT NULL,
  tenant_names text NOT NULL,
  tenant_address text,
  landlord_name text NOT NULL,
  landlord_address text,
  property_address text NOT NULL,
  property_description text,
  rent_amount numeric NOT NULL,
  payment_frequency text DEFAULT 'monthly',
  payment_day int,
  deposit_amount numeric,
  tenancy_start_date date NOT NULL,
  tenancy_end_date date,
  break_clause_months int,
  special_conditions text,
  agreement_html text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent_for_signing', 'signed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_in_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_agreement_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org refs" ON tenant_references FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org checklists" ON move_in_checklists FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org viewings" ON property_viewings FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org agreement drafts" ON tenancy_agreement_drafts FOR ALL USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
