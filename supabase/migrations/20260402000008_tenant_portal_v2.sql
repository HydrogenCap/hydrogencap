-- Tenant Portal V2: Add enhanced fields for maintenance requests
-- Adds: urgency, location_in_property, availability, reference_number, tenant_user_id

-- Add new columns to maintenance_requests for V2 tenant portal
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS urgency text CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  ADD COLUMN IF NOT EXISTS location_in_property text,
  ADD COLUMN IF NOT EXISTS availability jsonb,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS tenant_user_id uuid REFERENCES auth.users(id);

-- Backfill reference_number for existing rows that don't have one
UPDATE maintenance_requests
SET reference_number = 'MR-' || substr(id::text, 1, 8)
WHERE reference_number IS NULL;

-- Set default for new rows
ALTER TABLE maintenance_requests
  ALTER COLUMN reference_number SET DEFAULT 'MR-' || substr(gen_random_uuid()::text, 1, 8);

-- Backfill urgency from priority for existing rows
UPDATE maintenance_requests
SET urgency = CASE
  WHEN priority = 'emergency' THEN 'emergency'
  WHEN priority = 'urgent' THEN 'high'
  WHEN priority = 'medium' THEN 'medium'
  WHEN priority = 'low' THEN 'low'
  ELSE 'medium'
END
WHERE urgency IS NULL;

-- Add "certificates" permission to tenant_portal_access
ALTER TABLE tenant_portal_access
  ADD COLUMN IF NOT EXISTS can_view_certificates boolean NOT NULL DEFAULT true;

-- RLS: Allow tenants to view compliance items for their property
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'tenant_view_compliance_items'
      AND tablename = 'compliance_items'
  ) THEN
    CREATE POLICY tenant_view_compliance_items ON compliance_items
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM tenant_portal_access tpa
          JOIN tenancies t ON t.id = tpa.tenancy_id
          WHERE tpa.user_id = auth.uid()
            AND tpa.revoked_at IS NULL
            AND tpa.can_view_certificates = true
            AND t.property_id = compliance_items.property_id
        )
      );
  END IF;
END $$;

-- RLS: Allow tenants to view compliance documents for their property's compliance items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'tenant_view_compliance_documents'
      AND tablename = 'compliance_documents'
  ) THEN
    CREATE POLICY tenant_view_compliance_documents ON compliance_documents
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM compliance_items ci
          JOIN tenancies t ON t.property_id = ci.property_id
          JOIN tenant_portal_access tpa ON tpa.tenancy_id = t.id
          WHERE ci.id = compliance_documents.compliance_item_id
            AND tpa.user_id = auth.uid()
            AND tpa.revoked_at IS NULL
            AND tpa.can_view_certificates = true
        )
      );
  END IF;
END $$;

-- Create index for tenant portal queries
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant_user_id
  ON maintenance_requests(tenant_user_id);

CREATE INDEX IF NOT EXISTS idx_compliance_items_property_type
  ON compliance_items(property_id, compliance_type);
