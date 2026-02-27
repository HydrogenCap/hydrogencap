
-- 1a. Add shareholder_entity_id FK to entity_shareholders
ALTER TABLE entity_shareholders
  ADD COLUMN IF NOT EXISTS shareholder_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entity_shareholders_shareholder_entity
  ON entity_shareholders(shareholder_entity_id);

-- Backfill: match shareholder_name to existing legal_entities
UPDATE entity_shareholders es
SET shareholder_entity_id = le.id
FROM legal_entities le
WHERE es.shareholder_entity_id IS NULL
  AND le.org_id = (
    SELECT org_id FROM legal_entities WHERE id = es.entity_id
  )
  AND (
    LOWER(TRIM(es.shareholder_name)) = LOWER(TRIM(le.entity_name))
    OR LOWER(TRIM(es.shareholder_name)) = LOWER(TRIM(le.entity_name)) || ' ltd'
    OR LOWER(TRIM(es.shareholder_name)) || ' ltd' = LOWER(TRIM(le.entity_name))
    OR LOWER(TRIM(es.shareholder_name)) || ' limited' = LOWER(TRIM(le.entity_name))
    OR REPLACE(LOWER(TRIM(es.shareholder_name)), ' limited', ' ltd') = LOWER(TRIM(le.entity_name))
    OR LOWER(TRIM(es.shareholder_name)) = REPLACE(LOWER(TRIM(le.entity_name)), ' limited', ' ltd')
  );

-- 1b. Add is_group_parent to legal_entities
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS is_group_parent BOOLEAN DEFAULT false;

-- Only one entity per org can be the group parent
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_group_parent
  ON legal_entities(org_id) WHERE is_group_parent = true;

-- 1c. Add shareholder_type to entity_shareholders
ALTER TABLE entity_shareholders
  ADD COLUMN IF NOT EXISTS shareholder_type TEXT DEFAULT 'individual';

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_shareholder_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.shareholder_type NOT IN ('individual', 'entity') THEN
    RAISE EXCEPTION 'Invalid shareholder_type: %. Must be individual or entity.', NEW.shareholder_type;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_validate_shareholder_type ON entity_shareholders;
CREATE TRIGGER trg_validate_shareholder_type
  BEFORE INSERT OR UPDATE ON entity_shareholders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_shareholder_type();

-- Backfill: any shareholder with a matched entity_id is type 'entity'
UPDATE entity_shareholders
SET shareholder_type = 'entity'
WHERE shareholder_entity_id IS NOT NULL;
