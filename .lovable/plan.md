# AA0: V1→V2 Final Hook Cleanup (Schema First, Then All Hooks)

## Priority: CRITICAL — 17 hooks still query the V1 `properties` table. Every property added via V2, the wizard, or CSV import is invisible to these features. Fix the schema gaps first, then migrate everything at once.

## Problem

6 hooks are blocked because `properties_v2` is missing columns that the V1 `properties` table has. These hooks read/write geocode fields, beneficial ownership overrides, identity fields, and other columns that were never carried across to V2.

## Phase 1: Add Missing Columns to properties_v2

Before touching any hooks, add the missing columns to `properties_v2` so all 17 hooks can migrate cleanly.

### Step 1: Create a migration adding the missing columns

Run a SQL migration that adds every column currently referenced by the 6 blocked hooks but missing from `properties_v2`. The exact columns will depend on what the blocked hooks read/write, but based on the V1 schema, the likely missing columns are:

**Geocoding fields** (used by `useGeocoding.ts`):
```sql
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS geocode_source TEXT; -- 'google' | 'manual' | 'postcode'
```

**Beneficial ownership override fields** (used by `useBeneficialGroups.ts`):
```sql
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS beneficial_owner_override TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS beneficial_owner_override_reason TEXT;
```

**Identity / core fields** (used by `useCoreIdentity.ts`, `usePassportPageData.ts`, `useMissingInfo.ts`):
```sql
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS title_number TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS land_registry_title TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS construction_year INTEGER;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS construction_type TEXT; -- 'traditional' | 'timber_frame' | 'steel_frame' | 'concrete' | 'other'
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS flood_risk_zone TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS council_tax_band TEXT; -- 'A' through 'H'
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS local_authority TEXT;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT false;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS article_4_direction BOOLEAN DEFAULT false;
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS planning_use_class TEXT; -- 'C3' | 'C4' | 'sui_generis'
```

**Go-live / onboarding fields** (used by `useGoLiveChecklist.ts`):
```sql
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS go_live_status TEXT DEFAULT 'draft'; -- 'draft' | 'ready' | 'live'
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

**IMPORTANT**: Before running this migration, check the actual `properties_v2` schema in `src/integrations/supabase/types.ts` (search for `properties_v2` in the Row type). Only add columns that are genuinely missing. Some of these may already exist under different names.

Also check the V1 `properties` table definition in the same file to see exactly which columns the blocked hooks are trying to read. The migration must cover every column those 6 hooks reference.

### Step 2: Backfill data from V1 to V2

After adding the columns, copy existing data from the V1 `properties` table into the new V2 columns for any properties that exist in both tables (matched by address or a mapping table if one exists):

```sql
-- Backfill geocoding data
UPDATE properties_v2 pv2
SET 
  latitude = p.latitude,
  longitude = p.longitude
FROM properties p
WHERE pv2.org_id = p.org_id
  AND pv2.postcode = p.postcode
  AND pv2.address_line_1 = p.address_line
  AND p.latitude IS NOT NULL
  AND pv2.latitude IS NULL;

-- Backfill identity fields
UPDATE properties_v2 pv2
SET
  title_number = p.title_number,
  construction_year = p.construction_year,
  council_tax_band = p.council_tax_band,
  local_authority = p.local_authority
FROM properties p
WHERE pv2.org_id = p.org_id
  AND pv2.postcode = p.postcode
  AND pv2.address_line_1 = p.address_line
  AND pv2.title_number IS NULL;
```

Adjust the column names based on what actually exists in the V1 table. The key is to not lose data that users already entered via V1.

### Step 3: Update RLS policies

Ensure the new columns are covered by existing RLS policies. Since they're on the same `properties_v2` table, the existing org_id-based policies should already cover them. No new policies needed unless the columns have special access requirements.

---

## Phase 2: Migrate All 17 Hooks

Now that `properties_v2` has all the required columns, migrate every hook.

### Field Name Mapping (reference for all hooks)

| V1 field (`properties`) | V2 field (`properties_v2`) | Notes |
|------------------------|---------------------------|-------|
| `address_line` | `address_line_1` | |
| `address_line2` | `address_line_2` | |
| `town_city` | `city` | |
| `area_name` | `county` | |
| `beds` | `total_lettable_rooms` | |
| `current_value_gbp` | `current_valuation` | |
| `purchase_price_gbp` | `purchase_price` | |
| `ownership_entity` | `entity_id` → join `legal_entities` | FK not text |
| `lifecycle_type` | `lifecycle_stage` | |
| `property_type` | `property_type` | Different enum values |
| `latitude` | `latitude` | Same (after Phase 1) |
| `longitude` | `longitude` | Same (after Phase 1) |
| `title_number` | `title_number` | Same (after Phase 1) |
| `council_tax_band` | `council_tax_band` | Same (after Phase 1) |
| `lender` | Via `loan_facilities.lender_id` → `lenders` | Normalised |
| `current_mortgage_balance_gbp` | Via `loan_facilities.current_balance` | Separate table |
| `interest_rate_percent` | Via `loan_facilities.interest_rate` | Separate table |
| `fixed_rate_expires` | Via `loan_facilities.rate_expiry_date` | Separate table |
| `annual_rent_gbp` | Calculated: `sum(rooms_v2.current_rent_pcm) * 12` | Derived |
| `epc_rating` | Via `compliance_documents_v2` where type = 'epc' | Moved |

### Hook-by-hook migration

For every hook listed below, apply these changes:

1. Change `.from('properties')` → `.from('properties_v2')`
2. Update all field names per the mapping table above
3. Update any TypeScript interfaces to use V2 field names
4. Update any `.select()` strings to use V2 column names and V2 join tables

**Group A — Simple table + field swaps (11 hooks):**

1. **`useCompanyProperties.ts`** — Change `from('properties')` → `from('properties_v2')`, change `ownership_entity` → `entity_id`, update select fields
2. **`useGeocoding.ts`** — Change table, change `address_line` → `address_line_1`. Read/write `latitude`, `longitude` (now on V2 after Phase 1)
3. **`useBulkPropertyUpdate.ts`** — Change table, update all field names in the update payload
4. **`useBatchRenameDocuments.ts`** — Change table, change `address_line` → `address_line_1`
5. **`usePropertyPhotosV2.ts`** — Change table, change `address_line` → `address_line_1` (ironic this already says "V2" but queries V1)
6. **`useDocumentVault.ts`** — Change table, update property name field in select
7. **`useBatchImport.ts`** — Change insert target to `properties_v2`, map all CSV field names to V2 columns, create `legal_entities` record if entity name provided
8. **`useOwnershipLinks.ts`** — Change table, update field references
9. **`useOwnershipData.ts`** — Change table, update field references
10. **`useComplianceRequirements.ts`** — Change table, update joins to use `compliance_requirements_v2` and `compliance_documents_v2`
11. **`useComplianceIntake.ts`** — Change table, update property lookup

**Group B — Complex rewrites requiring join changes (6 hooks):**

12. **`useBeneficialGroups.ts`** — Change table, use `beneficial_owner_override` from V2 (now available after Phase 1), update entity resolution from text to FK join
13. **`useCompanyLookthrough.ts`** — Change from text match (`ownership_entity = companyName`) to FK join (`entity_id = entityId`), include `legal_entities` in select
14. **`useCoreIdentity.ts`** — Change table, use V2 identity columns (title_number, construction_year, etc. — now available after Phase 1)
15. **`useGoLiveChecklist.ts`** — Change table, use V2 go_live_status field (now available after Phase 1), update all checklist field references
16. **`usePassportPageData.ts`** — Change table, update all completeness checks to V2 field names (e.g., `beds` → `total_lettable_rooms`, `epc_rating` → check compliance_documents_v2)
17. **`useMissingInfo.ts`** — Change table, update all missing field detection to V2 field names and V2 related tables

### Components that import from useProperties.ts

After migrating the hooks, also check for components that import `PropertyWithFinancials` type or `useProperties` hook directly:

- Dashboard widgets (`AreaExposureChart`, `BeneficialOwnerWidget`, `ComplianceAlertsWidget`, `DataQualityWidget`, `LenderExposureChart`, `PortfolioHealthWidget`, `ThisMonthWidget`)
- These should already have been migrated by batch Y5, but verify they no longer import from `useProperties.ts`

If any still do, update them to use `usePropertiesV2` or the relevant V2 hook.

### Final verification

After all changes, search the entire `src/` directory:

```bash
grep -rn "from('properties')" src/ --include="*.ts" --include="*.tsx" | grep -v "properties_v2"
grep -rn 'from("properties")' src/ --include="*.ts" --include="*.tsx" | grep -v "properties_v2"
```

Both should return **zero results**. The only remaining reference to the V1 `properties` table should be in `useProperties.ts` itself, which can be deprecated with a comment at the top:

```typescript
/**
 * @deprecated — V1 hook. All consumers should use usePropertiesV2 instead.
 * Kept temporarily for reference. Will be removed in a future cleanup.
 */
```

## Do NOT

- Do NOT delete the V1 `properties` table from the database — edge functions still reference it and will be migrated separately
- Do NOT delete `useProperties.ts` — deprecate it with a comment only
- Do NOT change any edge functions in this prompt — those are server-side and will be migrated in a separate batch
- Do NOT change RLS policies unless the new columns specifically need different access rules
- Do NOT change any page layouts or UI components — only the data layer (hooks)

## Acceptance Criteria

- All missing columns added to `properties_v2` via migration
- Existing V1 data backfilled into the new V2 columns
- All 17 hooks query `properties_v2` instead of `properties`
- All field references use V2 names
- `useProperties.ts` marked as deprecated
- Ownership flowchart, document vault, geocoding, batch import, go-live checklist, missing info, passport, company lookthrough, beneficial groups — all display V2 property data
- `grep` for V1 properties references returns zero results in hooks directory
- App compiles and runs without TypeScript errors
- Properties created via V2/wizard are visible in all features
