
-- Section 4.2: Maintenance & Contractor Jobs Repoint (V1 → V2)

-- 1a. Add V2 FK columns to maintenance_requests
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS property_v2_id UUID REFERENCES properties_v2(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_v2_id UUID REFERENCES rooms_v2(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_v2_id UUID REFERENCES tenants_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maint_req_property_v2 ON maintenance_requests(property_v2_id);
CREATE INDEX IF NOT EXISTS idx_maint_req_room_v2 ON maintenance_requests(room_v2_id);
CREATE INDEX IF NOT EXISTS idx_maint_req_tenant_v2 ON maintenance_requests(tenant_v2_id);

-- Add V2 property FK to contractor_jobs
ALTER TABLE contractor_jobs
  ADD COLUMN IF NOT EXISTS property_v2_id UUID REFERENCES properties_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_jobs_property_v2 ON contractor_jobs(property_v2_id);

-- Make V1 property_id nullable for both tables (new records can use V2 only)
ALTER TABLE maintenance_requests ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE contractor_jobs ALTER COLUMN property_id DROP NOT NULL;

-- 1b. Backfill via property matching

-- Build V1→V2 property mapping
CREATE TEMP TABLE property_v1_v2_map AS
SELECT DISTINCT ON (p1.id)
  p1.id AS v1_property_id,
  p2.id AS v2_property_id
FROM properties p1
JOIN properties_v2 p2
  ON LOWER(TRIM(p1.postcode)) = LOWER(TRIM(p2.postcode))
  AND (
    LOWER(TRIM(p1.address_line)) LIKE '%' || LOWER(TRIM(SPLIT_PART(p2.address_line_1, ',', 1))) || '%'
    OR LOWER(TRIM(p2.address_line_1)) LIKE '%' || LOWER(TRIM(SPLIT_PART(p1.address_line, ',', 1))) || '%'
  )
ORDER BY p1.id, p2.created_at DESC;

-- Build V1→V2 room mapping
CREATE TEMP TABLE room_v1_v2_map AS
SELECT DISTINCT ON (r1.id)
  r1.id AS v1_room_id,
  r2.id AS v2_room_id
FROM rooms r1
JOIN property_v1_v2_map pm ON pm.v1_property_id = r1.property_id
JOIN rooms_v2 r2
  ON r2.property_id = pm.v2_property_id
  AND LOWER(TRIM(r1.room_name)) = LOWER(TRIM(r2.room_name))
ORDER BY r1.id, r2.created_at DESC;

-- Build V1→V2 tenant mapping
CREATE TEMP TABLE tenant_v1_v2_map AS
SELECT DISTINCT ON (t1.id)
  t1.id AS v1_tenant_id,
  t2.id AS v2_tenant_id
FROM tenants t1
JOIN tenants_v2 t2
  ON t1.org_id = t2.org_id
  AND LOWER(TRIM(t1.first_name)) = LOWER(TRIM(t2.first_name))
  AND LOWER(TRIM(t1.last_name)) = LOWER(TRIM(t2.last_name))
ORDER BY t1.id, t2.created_at DESC;

-- Backfill maintenance_requests
UPDATE maintenance_requests mr
SET property_v2_id = pm.v2_property_id
FROM property_v1_v2_map pm
WHERE mr.property_id = pm.v1_property_id AND mr.property_v2_id IS NULL;

UPDATE maintenance_requests mr
SET room_v2_id = rm.v2_room_id
FROM room_v1_v2_map rm
WHERE mr.room_id = rm.v1_room_id AND mr.room_v2_id IS NULL;

UPDATE maintenance_requests mr
SET tenant_v2_id = tm.v2_tenant_id
FROM tenant_v1_v2_map tm
WHERE mr.tenant_id = tm.v1_tenant_id AND mr.tenant_v2_id IS NULL;

-- Backfill contractor_jobs
UPDATE contractor_jobs cj
SET property_v2_id = pm.v2_property_id
FROM property_v1_v2_map pm
WHERE cj.property_id = pm.v1_property_id AND cj.property_v2_id IS NULL;

DROP TABLE property_v1_v2_map;
DROP TABLE room_v1_v2_map;
DROP TABLE tenant_v1_v2_map;
