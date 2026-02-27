-- Add entity_id column (nullable — existing connections won't have it yet)
ALTER TABLE freeagent_connections
  ADD COLUMN entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;

-- Create index for lookup by entity_id
CREATE INDEX idx_freeagent_connections_entity_id ON freeagent_connections(entity_id);

-- Backfill: match existing connections to legal_entities by company_number
UPDATE freeagent_connections fc
SET entity_id = le.id
FROM companies c
JOIN legal_entities le ON le.company_number = c.company_number AND le.org_id = c.org_id
WHERE fc.company_id = c.id
  AND fc.entity_id IS NULL;