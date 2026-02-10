# HydrogenCap — Page Definitions & Data Architecture Fix

## Problem Summary

Several fields are **duplicated** across the `properties` and `property_passport` tables (e.g. `construction_type`, `town_city`, `year_built`/`built_in_year`, `title_number`/`land_registry_title_number`). The Passport page currently reads from `properties` and ignores the `property_passport` table entirely. This creates confusion about which table is the source of truth, risks data divergence, and means the Passport page is missing dozens of fields it should show.

This spec defines exactly what each page should display, which database table owns each field, and the migrations + code changes needed to clean this up.

---

## Page Definitions

### 1. Property Passport (`/passport`)

**Purpose:** The permanent, rarely-changing identity of each property. Think of this as the property's "birth certificate" — physical characteristics, legal identity, utility infrastructure, and accommodation layout. This data should only change if someone physically alters the building or a legal record is corrected.

**Navigation:** Admin section (sidebar)

**Data source:** `property_passport` table (joined to `properties` for address display only)

**Sections and fields to display:**

#### A. Identity & Location (read from `properties` — display only, not editable here)
- `address_line`, `address_line2`, `postcode`, `town_city`, `county`, `area_name`
- `uprn` (UPRN)
- `title_number` (via `property_title_numbers` join)
- `planning_authority`

#### B. Building Classification (read from `property_passport`)
- `construction_type` — e.g. Brick, Stone, Timber Frame
- `construction_date_band` — e.g. Pre-1919, 1919-1944, Post-2000
- `built_in_year` — specific year if known
- `number_of_storeys`
- `basement` (boolean)
- `parking` — e.g. On-street, Driveway, Garage
- `asset_agreement_category`
- `asset_performance_rating`

#### C. Listed & Heritage (read from `properties`)
- `listed_status` — Not listed / Grade I / Grade II / Grade II*
- `listing_number`
- `conservation_area` (boolean)
- `heritage_notes`

#### D. Access & Safety (read from `property_passport`)
- `keysafe_code`
- `loft_access` (text description)
- `has_loft_access` (boolean)
- `access_ramp` (boolean)
- `block_communal_entrance`

#### E. Utilities & Meters (read from `property_passport`)
- `water_stop_tap_location`
- `electric_meter_location`, `electric_meter_number`
- `gas_meter_location`, `gas_meter_number`
- `water_meter_location`, `water_meter_number`
- `has_gas_supply` (boolean)
- `communal_tv_supply` (boolean)
- Oil supply fields: `oil_supplier`, `oil_tank_location`, `oil_tank_capacity_litres`

#### F. Accommodation Schedule (read from `property_passport`)
- `kitchens`
- `bedrooms`
- `hmo_bed_spaces`
- `bathrooms`
- `ensuites`
- `wc_cloakroom`
- `living_rooms_communal`

#### G. HMO & Licensing (read from `property_passport`)
- `hmo_licence_required` (boolean)
- `hmo_licence` (boolean — has one)
- `hmo_licence_number`
- `hmo_licence_expiry`
- `local_authority` / `local_authority_id` / `local_authority_text`
- `council_tax_band`

#### H. Amenities & Storage (read from `property_passport`)
- `has_bin_store`, `has_cycle_store`, `has_guest_room`, `carport`

#### I. Management (read from `property_passport`)
- `management_company_id` / `management_company_text`
- `property_management_company` (legacy text)
- `property_management_fee_percent`

#### J. Links (read from `property_passport`)
- `photographs_link`
- `dropbox_link`

**Summary cards at top of page:**
- Total Properties
- Core Identity Complete (count where `construction_type` AND `built_in_year` AND `number_of_storeys` are filled on passport)
- Conservation Areas (count from `properties.conservation_area`)
- Listed Buildings (count from `properties.listed_status` != 'Not listed')

**Editing:** Inline row expansion editor (current `PassportRowEditor` pattern), but split into two save targets:
- Identity & Location fields → save to `properties` table
- Everything else → save to `property_passport` table (upsert — create passport row if it doesn't exist)

---

### 2. Properties (`/properties`)

**Purpose:** The operational, day-to-day view of the portfolio. Financial performance, mortgage details, rental income, ownership, and risk indicators. This is the page users look at daily.

**Navigation:** Portfolio section (sidebar)

**Data source:** `properties` table with joins to `loans`, `income`, `costs`, and `property_passport` (for Ops View columns)

**View presets (keep existing):**

#### Default (Sheet View)
Photo, Status, Address, Area, Ownership, Property Type, Beds, Value, Purchase Price, Purchase Date, Lender, Interest Rate, Fixed/Variable, Mortgage Type, Capital/Interest, Fixed Rate Expires, Insurance Expire, Mortgage Balance, Mortgage Payment, Rental Income, Bills & Management, Net Rent, Yield, LTV, Equity

#### Finance View
Photo, Status, Address, Area, Ownership, Beds, Value, Mortgage Balance, Mortgage Payment, Interest Rate, Fixed/Variable, Mortgage Type, Capital/Interest, Rental Income, Bills & Management, Net Rent, Yield, LTV, Equity

#### Risk View
Photo, Status, Address, Area, Lender, LTV, Fixed Rate Expires, Insurance Expire, EPC, Monthly Cashflow, Net Rent, Risk Status

#### Ops View (pulls from `property_passport` join)
Photo, Status, Address, Area, Keysafe Code, Water Stop Tap, Electric Meter, Gas Meter, Water Meter, Construction Date Band, HMO Licence #, HMO Licence Expiry, Management Company

**Key database links:**
- `properties.legal_owner_company_id` → `companies.id` (ownership)
- `properties.legal_owner_party_id` → `parties.id` (individual ownership)
- `loans.property_id` → `properties.id`
- `income.property_id` → `properties.id`
- `costs.property_id` → `properties.id`
- `property_passport.property_id` → `properties.id` (for Ops View)

**No changes needed to this page** — it already works correctly. Just ensure Ops View reads meter/keysafe fields from `property_passport` not `properties`.

---

### 3. Pipeline (`/pipeline`)

**Purpose:** Development projects in progress. Shows properties with `lifecycle_type = 'development'` and their go-live checklist progress. Once a project completes and lifecycle changes to `'investment'`, it drops off Pipeline and appears in Properties.

**Navigation:** Portfolio section (sidebar)

**Data source:** `properties` table (filtered to `lifecycle_type = 'development'`) + `go_live_checklists` table

**Fields displayed per card:**
- Address, Postcode/Town (from `properties`)
- Purchase Price (used as "Budget")
- Current Value (used as "Projected Value")
- Projected Profit (calculated: value - purchase price)
- Original Purchase Date
- Go-Live Checklist progress % (from `go_live_checklists`)

**Key database links:**
- `go_live_checklists.property_id` → `properties.id`
- Same `properties` table, just filtered by lifecycle

**No structural changes needed** — this page is clean.

---

### 4. Companies (`/companies`)

**Purpose:** Manage the SPV and holding company structure. Shows company registration details, Companies House compliance deadlines, and links to properties owned by each company and the ownership/shareholding structure.

**Navigation:** Portfolio section (sidebar)

**Data source:** `companies` table joined to `parties`

**List view columns:**
- Company Name (`legal_name`)
- Trading Name (`trading_name`)
- Company Number (`company_number`) — with link to Companies House
- Type (SPV / Holding Co / Operating Co / Other)
- Status (Active / Dormant / Sold / Closed)
- Accounts Due Date + status badge (overdue/due soon/ok)
- Confirmation Statement Due Date + status badge
- Incorporation Date

**Company Detail page (`/companies/:id`) shows:**
- All fields from list view
- Registered Address (`ch_registered_address`)
- Share Classes (from `share_classes` table)
  - Name, Issued Shares, Nominal Value, Currency, Confirmed status
- Shareholdings (from `shareholdings` table)
  - Shareholder name (from `parties`), Share Class, Shares Held, Ownership %, Source
- Properties owned by this company (from `properties` where `legal_owner_company_id = company.id`)
- Company secrets (Auth Code, UTR) via edge function

**Key database links:**
- `companies.party_id` → `parties.id` (every company is also a party)
- `companies.org_id` → `organizations.id`
- `share_classes.company_id` → `companies.id`
- `shareholdings.company_id` → `companies.id`
- `shareholdings.shareholder_party_id` → `parties.id`
- `shareholdings.share_class_id` → `share_classes.id`
- `properties.legal_owner_company_id` → `companies.id` (reverse lookup)

**No structural changes needed** — this page is well-linked.

---

### 5. Ownership (`/ownership`)

**Purpose:** A cross-cutting view showing who owns what across the entire portfolio. Uses the flexible `ownership_links` table which supports both company-owns-property and person-owns-company chains, plus beneficial ownership tracking.

**Navigation:** Portfolio section (sidebar)

**Data source:** `ownership_links` table joined to `parties` (for owner details)

**Grid columns:**
- Subject (Company name or Property address — resolved by `subject_type` + `subject_id`)
- Subject Type (COMPANY / PROPERTY)
- Owner (from `parties.display_name`)
- Owner Type (INDIVIDUAL / COMPANY)
- Ownership Type (SHAREHOLDING / BENEFICIAL / OTHER)
- Percentage
- Shares (if applicable)
- Effective From / To
- Source (manual / companies_house / import)

**Key database links:**
- `ownership_links.owner_party_id` → `parties.id`
- `ownership_links.subject_id` → `companies.id` (when `subject_type = 'COMPANY'`)
- `ownership_links.subject_id` → `properties.id` (when `subject_type = 'PROPERTY'`)
- Links to Companies page: click company subject → navigate to `/companies/:id`
- Links to Properties page: click property subject → navigate to `/properties/:id`

**No structural changes needed** — this is a flexible, well-designed table.

---

## Database Changes Required

### Migration 1: Remove duplicated fields from `properties`

The following fields exist on BOTH `properties` and `property_passport`. The `property_passport` table should be the single source of truth for these. Remove them from `properties` after migrating any data.

```sql
-- Step 1: Migrate data from properties → property_passport where passport exists but field is empty
UPDATE property_passport pp
SET 
  construction_type = COALESCE(pp.construction_type, p.construction_type),
  town_city = COALESCE(pp.town_city, p.town_city),
  county = COALESCE(pp.county, p.county),
  postcode = COALESCE(pp.postcode, p.postcode),
  built_in_year = COALESCE(pp.built_in_year, 
    CASE WHEN p.year_built ~ '^\d{4}$' THEN p.year_built::integer ELSE NULL END
  ),
  land_registry_title_number = COALESCE(pp.land_registry_title_number, p.title_number)
FROM properties p
WHERE pp.property_id = p.id;

-- Step 2: Create passport rows for properties that don't have one yet, copying over data
INSERT INTO property_passport (property_id, construction_type, town_city, county, postcode, built_in_year, land_registry_title_number)
SELECT 
  p.id,
  p.construction_type,
  p.town_city,
  p.county,
  p.postcode,
  CASE WHEN p.year_built ~ '^\d{4}$' THEN p.year_built::integer ELSE NULL END,
  p.title_number
FROM properties p
WHERE NOT EXISTS (SELECT 1 FROM property_passport pp WHERE pp.property_id = p.id)
AND (p.construction_type IS NOT NULL OR p.town_city IS NOT NULL OR p.county IS NOT NULL);

-- Step 3: Drop the duplicated columns from properties
-- DO NOT drop these yet — do it in a separate migration after all code is updated:
--   construction_type  (duplicated on property_passport)
--   year_built         (duplicated as built_in_year on property_passport)
-- 
-- KEEP these on properties (they are needed for display everywhere):
--   town_city          (used in 15+ components for address display)
--   county             (used in address display)
--   postcode           (used everywhere)
--   title_number       (used via property_title_numbers table, different from land_registry_title_number)
```

**Important:** `town_city`, `county`, and `postcode` should STAY on `properties` because they're used in dozens of components for address display (dashboard, pipeline, portal, map, property cards). The passport copies are the ones to deprecate — stop writing to `property_passport.town_city/county/postcode` and always read address from `properties`.

`title_number` on `properties` and `land_registry_title_number` on `property_passport` may actually be different things (a property can have multiple title numbers via `property_title_numbers` table). Keep both but clarify: `property_passport.land_registry_title_number` is the primary/original title number from the legal pack, while `property_title_numbers` is the full list.

### Migration 2: Deprecate passport address fields

```sql
-- Add comments to clarify which table is authoritative
COMMENT ON COLUMN property_passport.town_city IS 'DEPRECATED — use properties.town_city instead';
COMMENT ON COLUMN property_passport.county IS 'DEPRECATED — use properties.county instead';
COMMENT ON COLUMN property_passport.postcode IS 'DEPRECATED — use properties.postcode instead';
```

---

## Code Changes Required

### 1. Update Passport page to read from `property_passport`

**File:** `src/pages/Passport.tsx`

**Current:** Uses `useProperties()` — only sees fields on `properties` table.

**Change to:** Create a new hook `usePassportPageData()` that joins both tables:

```typescript
// New hook: src/hooks/usePassportPageData.ts
export function usePassportPageData() {
  return useQuery({
    queryKey: ['passport_page_data'],
    queryFn: async () => {
      // Get properties with their passport data
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select(`
          id, address_line, address_line2, postcode, town_city, county, area_name,
          uprn, planning_authority, property_type, listed_status, listing_number, 
          listing_grade, conservation_area, heritage_notes, is_grade_listed,
          property_passport(*)
        `)
        .order('address_line');

      if (propError) throw propError;
      return properties;
    },
  });
}
```

Then update `Passport.tsx` to:
- Use `usePassportPageData()` instead of `useProperties()`
- Display building classification fields from `property.property_passport`
- Display meters, access, accommodation from `property.property_passport`
- Keep address/listed/conservation reading from `property` directly

### 2. Update PassportRowEditor to save to both tables

**File:** `src/components/passport/PassportRowEditor.tsx`

**Current:** Saves everything to `properties` via `useUpdateCoreIdentity()`.

**Change to:** Split the save into two operations:
- Address, UPRN, planning authority, listed status, conservation area → save to `properties` (keep using `useUpdateCoreIdentity`)
- Construction type, year built, meters, access, accommodation, HMO, management → save to `property_passport` (use `useUpsertPropertyPassport`)

```typescript
const handleSave = async () => {
  // Save identity fields to properties table
  await updateCoreIdentity.mutateAsync({
    propertyId: property.id,
    data: {
      property_name: formData.property_name,
      address_line: formData.address_line,
      // ... address fields, listed_status, conservation_area
    },
  });

  // Save building/passport fields to property_passport table
  await upsertPassport.mutateAsync({
    property_id: property.id,
    construction_type: formData.construction_type,
    built_in_year: formData.year_built ? parseInt(formData.year_built) : null,
    // ... meter fields, access fields, accommodation fields
  });
};
```

### 3. Update Properties page Ops View

**File:** `src/pages/Properties.tsx`

**Current:** Already reads from `usePropertyPassports()` for Ops View columns. ✅ This is correct.

**Verify:** Ensure `keysafeCode`, `waterStopTap`, `electricMeter`, `gasMeter`, `waterMeter`, `constructionDateBand`, `hmoLicenceNumber`, `hmoLicenceExpiry`, `managementCompany` columns all read from the passport data, not from `properties`.

### 4. Update CoreIdentityCard

**File:** `src/components/passport/CoreIdentityCard.tsx`

**Current:** Reads `construction_type` and `year_built` from the `properties` row.

**Change to:** Read these from the property's passport record instead.

### 5. Update completeness calculations

**File:** `src/hooks/usePropertyPassport.ts` — `calculatePassportCompleteness()`

**Current:** Checks only 3 fields (`asset_agreement_category`, `kitchens`, `management_company_id`).

**Change to:** Check all the key passport fields:
```typescript
const requiredFields = [
  { key: 'construction_type', label: 'Construction Type', critical: true },
  { key: 'built_in_year', label: 'Year Built', critical: false },
  { key: 'number_of_storeys', label: 'Number of Storeys', critical: false },
  { key: 'keysafe_code', label: 'Keysafe Code', critical: false },
  { key: 'electric_meter_location', label: 'Electric Meter Location', critical: false },
  { key: 'gas_meter_location', label: 'Gas Meter Location', critical: false },
  { key: 'water_stop_tap_location', label: 'Water Stop Tap', critical: false },
  { key: 'kitchens', label: 'Kitchens', critical: false },
  { key: 'bathrooms', label: 'Bathrooms', critical: false },
  { key: 'bedrooms', label: 'Bedrooms', critical: false },
];
```

### 6. Update Missing Info page

**File:** `src/hooks/useMissingInfo.ts`

**Current:** Lists `built_in_year` as a passport field to check. Also lists `title_number` as a properties field.

**Verify:** Ensure `construction_type` is checked against `property_passport` not `properties` after migration.

---

## Field Ownership Summary

### `properties` table owns (DO NOT MOVE):
| Field | Why it stays |
|-------|-------------|
| `address_line`, `address_line2` | Used everywhere for display |
| `postcode`, `town_city`, `county`, `area_name` | Used in 15+ components |
| `uprn` | Unique to properties table, not duplicated |
| `property_type` | Used in filters, badges, analytics |
| `property_name` | Display name |
| `planning_authority` | Used in compliance context |
| `listed_status`, `listing_number`, `listing_grade` | Heritage fields used in Passport display and compliance |
| `conservation_area`, `heritage_notes`, `is_grade_listed` | Heritage flags |
| `tenure` | Legal/financial context |
| `beds`, `bathrooms` | High-level counts for portfolio views |
| `epc_rating`, `epc_required` | Compliance/risk views |
| `has_gas`, `has_solar`, `solar_*` fields | Energy/utility flags |
| `current_value_gbp`, `purchase_price_gbp`, `original_purchase_date` | Financial |
| `lifecycle_type`, `lifecycle_status_date`, `operational_date` | Status management |
| `legal_owner_company_id`, `legal_owner_party_id` | Ownership links |
| `latitude`, `longitude`, `geocode_*` | Map/location |
| All fire alarm, emergency lighting, CO alarm fields | Compliance flags |

### `property_passport` table owns (SINGLE SOURCE OF TRUTH):
| Field | Category |
|-------|----------|
| `construction_type` | Building classification |
| `construction_date_band` | Building classification |
| `built_in_year` | Building classification |
| `number_of_storeys` | Building classification |
| `basement` | Building classification |
| `parking` | Building classification |
| `keysafe_code` | Access & safety |
| `loft_access`, `has_loft_access` | Access & safety |
| `access_ramp` | Access & safety |
| `block_communal_entrance` | Access & safety |
| `water_stop_tap_location` | Utilities |
| `electric_meter_location`, `electric_meter_number` | Utilities |
| `gas_meter_location`, `gas_meter_number` | Utilities |
| `water_meter_location`, `water_meter_number` | Utilities |
| `has_gas_supply`, `communal_tv_supply` | Utilities |
| `oil_supplier`, `oil_tank_location`, `oil_tank_capacity_litres` | Utilities |
| `kitchens`, `bedrooms`, `hmo_bed_spaces` | Accommodation |
| `bathrooms`, `ensuites`, `wc_cloakroom` | Accommodation |
| `living_rooms_communal` | Accommodation |
| `hmo_licence_required`, `hmo_licence` | HMO/Licensing |
| `hmo_licence_number`, `hmo_licence_expiry` | HMO/Licensing |
| `local_authority`, `local_authority_id`, `local_authority_text` | Classification |
| `council_tax_band` | Classification |
| `asset_agreement_category`, `asset_performance_rating` | Classification |
| `has_bin_store`, `has_cycle_store`, `has_guest_room`, `carport` | Amenities |
| `management_company_id`, `management_company_text` | Management |
| `property_management_company`, `property_management_fee_percent` | Management |
| `photographs_link`, `dropbox_link` | Links |

### Fields to DROP from `properties` (after code update):
| Field on `properties` | Replaced by on `property_passport` |
|-----------------------|-------------------------------------|
| `construction_type` | `construction_type` (same name) |
| `year_built` (string) | `built_in_year` (integer) |

### Fields to DEPRECATE on `property_passport` (keep but stop writing):
| Field on `property_passport` | Authoritative source |
|------------------------------|---------------------|
| `town_city` | `properties.town_city` |
| `county` | `properties.county` |
| `postcode` | `properties.postcode` |

---

## Relationship Diagram

```
organizations
  └── memberships (user access)
  └── properties
  │     ├── property_passport (1:1, building identity)
  │     ├── loans (1:many, mortgage/finance)
  │     ├── income (1:many, rental income)
  │     ├── costs (1:many, bills/expenses)
  │     ├── compliance_items (1:many, certs/licences)
  │     ├── property_title_numbers (1:many)
  │     ├── go_live_checklists (1:1, pipeline tracking)
  │     ├── photos (1:many)
  │     ├── floorplans (1:many)
  │     ├── rooms (1:many, HMO room management)
  │     └── legal_owner_company_id → companies.id
  │
  └── companies
  │     ├── party_id → parties.id
  │     ├── share_classes (1:many)
  │     └── shareholdings (1:many)
  │           ├── share_class_id → share_classes.id
  │           └── shareholder_party_id → parties.id
  │
  └── ownership_links
  │     ├── subject_type + subject_id → companies.id OR properties.id
  │     └── owner_party_id → parties.id
  │
  └── parties (people and companies unified)
```

---

## Implementation Order

1. **Create the data migration** (Migration 1) — copy data from `properties` to `property_passport` where missing
2. **Create `usePassportPageData()` hook** — join query returning properties with their passport
3. **Update `Passport.tsx`** — use new hook, display all passport sections (A through J above)
4. **Update `PassportRowEditor`** — split saves between properties and property_passport tables
5. **Update `CoreIdentityCard`** — read `construction_type` and `built_in_year` from passport
6. **Update `calculatePassportCompleteness()`** — check the full set of passport fields
7. **Verify Properties Ops View** — confirm meter/keysafe columns read from passport join
8. **Run Migration 2** — deprecate passport address fields with comments
9. **Final migration** — drop `construction_type` and `year_built` from `properties` table

**Do NOT drop columns from `properties` until ALL code references have been updated and tested.**
