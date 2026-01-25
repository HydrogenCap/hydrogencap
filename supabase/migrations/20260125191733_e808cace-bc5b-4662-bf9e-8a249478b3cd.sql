-- Migration: Convert ownership_entities and entity_shareholdings to new model
-- This migrates existing data while preserving relationships

-- Step 1: Create parties from ownership_entities
INSERT INTO public.parties (id, org_id, party_type, display_name, legal_name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  oe.org_id,
  CASE 
    WHEN oe.entity_type = 'COMPANY' THEN 'COMPANY'
    WHEN oe.entity_type = 'TRUST' THEN 'TRUST'
    ELSE 'INDIVIDUAL'
  END,
  oe.name,
  CASE WHEN oe.entity_type = 'COMPANY' THEN oe.name ELSE NULL END,
  oe.created_at,
  oe.updated_at
FROM public.ownership_entities oe
WHERE NOT EXISTS (
  SELECT 1 FROM public.parties p 
  WHERE p.display_name = oe.name AND p.org_id = oe.org_id
);

-- Step 2: Create companies for COMPANY-type entities
-- First, we need a mapping table to track old entity_id to new party_id
CREATE TEMP TABLE entity_party_mapping AS
SELECT 
  oe.id as old_entity_id,
  oe.org_id,
  oe.name,
  oe.entity_type,
  p.id as new_party_id
FROM public.ownership_entities oe
JOIN public.parties p ON p.display_name = oe.name AND p.org_id = oe.org_id;

-- Create companies for COMPANY-type parties that don't already exist
INSERT INTO public.companies (id, org_id, party_id, legal_name, company_type, status, jurisdiction)
SELECT 
  gen_random_uuid(),
  epm.org_id,
  epm.new_party_id,
  epm.name,
  'SPV',  -- Default to SPV, can be updated later
  'ACTIVE',
  'UK'
FROM entity_party_mapping epm
WHERE epm.entity_type = 'COMPANY'
AND NOT EXISTS (
  SELECT 1 FROM public.companies c 
  WHERE c.party_id = epm.new_party_id
);

-- Step 3: Create share_classes for newly created companies
INSERT INTO public.share_classes (id, company_id, name, issued_shares, is_primary, currency)
SELECT 
  gen_random_uuid(),
  c.id,
  'Ordinary',
  100,  -- Default to 100 shares, will be adjusted by shareholdings
  true,
  'GBP'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.share_classes sc WHERE sc.company_id = c.id
);

-- Step 4: Create mapping for companies to their share classes
CREATE TEMP TABLE company_share_class_mapping AS
SELECT 
  c.id as company_id,
  c.party_id,
  sc.id as share_class_id,
  sc.issued_shares
FROM public.companies c
JOIN public.share_classes sc ON sc.company_id = c.id AND sc.is_primary = true;

-- Step 5: Convert entity_shareholdings to shareholdings
-- Map old parent_entity to company, and old shareholder_entity to party
INSERT INTO public.shareholdings (
  id, company_id, share_class_id, shareholder_party_id, 
  shares_held, ownership_source, effective_from, effective_to, notes
)
SELECT 
  gen_random_uuid(),
  cscm.company_id,
  cscm.share_class_id,
  shareholder_mapping.new_party_id,
  -- Convert percentage to shares (assuming 100 issued shares)
  ROUND(es.shareholder_percent)::integer,
  'IMPORT',
  es.start_date,
  es.end_date,
  es.notes
FROM public.entity_shareholdings es
-- Map parent entity to company
JOIN entity_party_mapping parent_mapping ON parent_mapping.old_entity_id = es.parent_entity_id
JOIN company_share_class_mapping cscm ON cscm.party_id = parent_mapping.new_party_id
-- Map shareholder entity to party
JOIN entity_party_mapping shareholder_mapping ON shareholder_mapping.old_entity_id = es.shareholder_entity_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.shareholdings s 
  WHERE s.company_id = cscm.company_id 
  AND s.shareholder_party_id = shareholder_mapping.new_party_id
);

-- Clean up temp tables
DROP TABLE IF EXISTS entity_party_mapping;
DROP TABLE IF EXISTS company_share_class_mapping;