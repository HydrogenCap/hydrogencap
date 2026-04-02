CREATE TABLE communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid,
  tenant_id uuid,
  contractor_id uuid,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'letter', 'in_person', 'portal', 'whatsapp', 'other')),
  subject text,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]', -- [{name, url, type}]
  sent_by uuid, -- user who sent/logged it
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  -- Legal evidence fields
  proof_of_service text, -- 'email_receipt', 'signed_for', 'witness', 'portal_read_receipt'
  witness_name text,
  reference_number text,
  -- Linking
  related_to_type text CHECK (related_to_type IN ('maintenance_request', 'rent_arrears', 'tenancy', 'inspection', 'compliance', 'possession', 'general')),
  related_to_id uuid,
  -- Immutability
  is_locked boolean NOT NULL DEFAULT true, -- cannot be edited once created
  created_at timestamptz NOT NULL DEFAULT now()
);

-- IMPORTANT: No UPDATE policy — communications are immutable
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view communications" ON communication_log FOR SELECT USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
CREATE POLICY "Org members can insert communications" ON communication_log FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
-- NO UPDATE OR DELETE POLICIES — immutable by design

CREATE INDEX idx_comms_org_property ON communication_log(org_id, property_id);
CREATE INDEX idx_comms_tenant ON communication_log(tenant_id);
CREATE INDEX idx_comms_sent_at ON communication_log(sent_at DESC);
CREATE INDEX idx_comms_related ON communication_log(related_to_type, related_to_id);
