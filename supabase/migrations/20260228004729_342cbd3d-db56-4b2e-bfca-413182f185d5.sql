
-- Add missing columns to share_classes_v2
ALTER TABLE share_classes_v2
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS total_authorised INTEGER,
  ADD COLUMN IF NOT EXISTS dividend_rights BOOLEAN NOT NULL DEFAULT true;

-- Backfill org_id from legal_entities
UPDATE share_classes_v2 sc
SET org_id = le.org_id
FROM legal_entities le
WHERE sc.entity_id = le.id
  AND sc.org_id IS NULL;

-- Migrate V1 share_classes data into share_classes_v2
INSERT INTO share_classes_v2 (entity_id, org_id, class_name, nominal_value, currency, issued_shares, is_primary)
SELECT
  le.id AS entity_id,
  le.org_id,
  sc.name AS class_name,
  COALESCE(sc.nominal_value, 1.00),
  COALESCE(sc.currency, 'GBP'),
  sc.issued_shares,
  COALESCE(sc.is_primary, true)
FROM share_classes sc
JOIN companies c ON sc.company_id = c.id
JOIN legal_entities le ON le.company_number = c.company_number AND le.org_id = c.org_id
WHERE NOT EXISTS (
  SELECT 1 FROM share_classes_v2 sc2
  WHERE sc2.entity_id = le.id AND lower(sc2.class_name) = lower(sc.name)
);

-- Backfill entity_shareholders.share_class_id where missing
UPDATE entity_shareholders es
SET share_class_id = sc2.id
FROM share_classes_v2 sc2
WHERE sc2.entity_id = es.entity_id
  AND lower(sc2.class_name) = lower(es.share_class)
  AND es.share_class_id IS NULL;
