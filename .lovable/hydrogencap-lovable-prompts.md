# HydrogenCap — Lovable Prompts (Sequenced)

Use these prompts in order. Each one builds on the previous. Copy-paste each prompt into Lovable one at a time, review the result, then proceed to the next.

---

## PHASE 1 — FIX WHAT'S BROKEN

---

### Prompt 1.1 — Shared getUserOrgId utility + QueryClient defaults

```
I need two foundational fixes:

1. SHARED getUserOrgId UTILITY

The function `getUserOrgId()` is copy-pasted in 22 separate files. Create a single shared utility at `src/lib/getUserOrgId.ts`:

export async function fetchUserOrgId(): Promise<string> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error('No organization found');
  return data.org_id;
}

Then find and replace every local `getUserOrgId` function in ALL hook files and components with an import from `@/lib/getUserOrgId`. Files that need updating include: useProperties.ts, useCompliance.ts, useCompanies.ts, useOwnership.ts, useOwnershipGroups.ts, useOwnershipLookthrough.ts, useActivityLog.ts, useBatchImport.ts, useBeneficialGroups.ts, useComplianceIntake.ts, useDocumentManagement.ts, useDocuments.ts, useDismissedDuplicates.ts, useLocalAuthorities.ts, useMaintenanceRequests.ts, useManagementCompanies.ts, useParties.ts, useRentCollection.ts, useRooms.ts, useTenancies.ts, useTenants.ts, and components/inbox/DocumentUploadZone.tsx. Remove every local `async function getUserOrgId()` definition from these files after replacing with the import.

2. QUERY CLIENT DEFAULTS

In App.tsx, update the QueryClient instantiation to include sensible defaults:

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

Do NOT change any other functionality. These are purely refactoring changes.
```

---

### Prompt 1.2 — Fix empty catch blocks and add error handling to pages

```
Two related fixes for error handling:

1. EMPTY CATCH BLOCKS

Find every `} catch {` (catch with no error parameter and no body) across the entire codebase. There are approximately 40 of them. Replace each with proper error handling:

} catch (error) {
  console.error('Operation failed:', error);
  toast({
    title: 'Something went wrong',
    description: error instanceof Error ? error.message : 'Please try again',
    variant: 'destructive',
  });
}

Import toast where it isn't already imported. If the file doesn't use toast (like lib files), just add the console.error line.

2. DASHBOARD ERROR STATE

In Dashboard.tsx, the useProperties hook only checks `isLoading` but never checks for errors. After the loading skeleton return block, add:

const { data: properties, isLoading, error, isError } = useProperties();

if (isError) {
  return (
    <AppLayout>
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="text-muted-foreground mt-2">{error?.message || 'Please try again'}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Refresh Page
        </Button>
      </div>
    </AppLayout>
  );
}

Apply the same error state pattern to Properties.tsx, Companies.tsx, Compliance.tsx, and Insights.tsx — every page that uses useProperties or other primary data hooks. Keep the existing loading skeleton patterns.
```

---

### Prompt 1.3 — Add ErrorBoundary to AppLayout

```
In src/components/layout/AppLayout.tsx, wrap the {children} inside the <main> element with the existing ErrorBoundary component:

import { ErrorBoundary } from '@/components/common/ErrorBoundary';

Inside the component, change:
<main className="flex-1 overflow-auto p-6">
  {children}
</main>

To:
<main className="flex-1 overflow-auto p-6">
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
</main>

This is a one-line change. It ensures every page wrapped in AppLayout has crash protection. Do not modify ErrorBoundary itself or any other component.
```

---

### Prompt 1.4 — Add Tenant dialog

```
The Tenants page at src/pages/Tenants.tsx has a TODO comment: {/* TODO: Add tenant dialog */}. The "Add Tenant" button exists but the dialog is missing.

Create a new component at src/components/tenants/AddTenantDialog.tsx that:

1. Uses a Dialog (from shadcn) with open/onOpenChange props
2. Contains a form with react-hook-form and zodResolver
3. Fields: first_name (required), last_name (required), email, phone, status (dropdown: prospect, active — default prospect), date_of_birth, national_insurance, employment_status (dropdown: employed, self-employed, unemployed, student, retired), employer_name, annual_income, previous_address, notes
4. Uses the existing useCreateTenant() hook from src/hooks/useTenants.ts to save
5. Shows a loading spinner on the submit button while saving
6. Closes the dialog and shows a success toast on completion
7. Navigates to the new tenant's detail page on success using useNavigate

Style it consistently with other dialogs in the app (e.g. AddContractorDialog). Use Card sections to group: Personal Details, Employment & Income, Previous Address, Notes.

Import and use this dialog in Tenants.tsx, replacing the TODO comment. Wire it to the existing showAddDialog state and setShowAddDialog function.

Also wrap the Tenants page in <AppLayout> for consistency — currently it uses <div className="container py-6"> but every other main page uses AppLayout. Same for RentCollection.tsx and MaintenanceRequests.tsx — wrap them in AppLayout too.
```

---

### Prompt 1.5 — Record Payment dialog

```
The RentCollection page at src/pages/RentCollection.tsx has {/* TODO: Record payment dialog */} and already has paymentItem state for the selected rent schedule item.

Create a new component at src/components/rent/RecordPaymentDialog.tsx that:

1. Receives props: open, onOpenChange, rentScheduleItem (the RentScheduleWithDetails type)
2. Shows a Dialog with the tenant name, property address, and amount due pre-filled as read-only header info
3. Form fields: amount (number, pre-filled with amount_outstanding), payment_date (date picker, defaults to today), payment_method (dropdown: bank_transfer, standing_order, cash, cheque, other), reference (text, optional), notes (optional)
4. Validates that amount > 0 and doesn't exceed amount_outstanding (allow partial payments)
5. Creates a record in the rent_payments table using a new useRecordPayment() mutation hook
6. The mutation should also update the corresponding rent_schedule record: increment amount_paid, decrement amount_outstanding, set status to 'paid' if amount_outstanding reaches 0, or 'partial' if some remains
7. Invalidates queryKeys: ['rent_schedule'], ['rent_payments'], ['arrears']
8. Shows success toast with payment amount confirmed

Wire this into RentCollection.tsx by replacing the TODO comment. Pass paymentItem to the dialog and use setPaymentItem(null) to close.
```

---

### Prompt 1.6 — Create Maintenance Request dialog

```
The MaintenanceRequests page at src/pages/MaintenanceRequests.tsx has {/* TODO: Create maintenance dialog */}.

Create src/components/maintenance/CreateMaintenanceDialog.tsx:

1. Dialog with open/onOpenChange props
2. Form fields:
   - property_id (Select dropdown populated from useProperties, showing address_line — required)
   - room_id (Select dropdown populated from useRooms filtered by selected property_id — optional, only show if property selected)
   - tenant_id (Select dropdown populated from active tenants at the selected property — optional)
   - category (Select: plumbing, electrical, heating, appliance, damp_mould, structural, security, cleaning, garden, other — required)
   - title (text, required)
   - description (textarea, required)
   - urgency (Select: emergency, urgent, normal, low — default normal — required)
   - location_in_property (text, optional, e.g. "Kitchen" or "Room 3 bathroom")
3. Uses the existing useCreateMaintenanceRequest() mutation from useMaintenanceRequests.ts
4. Success toast and dialog close on completion

Wire it into MaintenanceRequests.tsx. The page already has the maintenance list view — just add the dialog trigger.

Also create a CreateTenancyDialog component at src/components/tenants/CreateTenancyDialog.tsx for the TenantDetail.tsx TODO:

1. Props: open, onOpenChange, tenantId (pre-selected tenant)
2. Fields: property_id (Select), room_id (Select filtered by property), start_date, end_date (optional), rent_amount_pcm (number), rent_due_day (number 1-28, default 1), deposit_amount, deposit_scheme (dropdown: DPS, TDS, mydeposits), deposit_reference, deposit_protected_date
3. Uses useCreateTenancy() hook
4. On success: invalidates tenancies + rooms + rent_schedule queries

Wire it into TenantDetail.tsx replacing the TODO.
```

---

### Prompt 1.7 — Sidebar reorganisation

```
Reorganise the sidebar in src/components/layout/AppSidebar.tsx. The current flat list of 19 items needs grouping into 4 sections.

Replace the current mainNavItems array and rendering with grouped sections:

PORTFOLIO section:
- Dashboard (LayoutDashboard, /dashboard)
- Properties (Building2, /properties) 
- Pipeline (Construction, /pipeline)
- Companies (Briefcase, /companies)
- Ownership (Users, /ownership)

OPERATIONS section:
- Actions (AlertTriangle, /actions) — keep the existing badge showing action count
- Compliance (Shield) — keep the existing collapsible sub-menu with Register, Inbox, Calendar
- Contractors (HardHat, /contractors)
- Jobs (ClipboardList, /jobs) — keep the existing jobs badge
- Tenants (Users, /tenants)
- Rent (PoundSterling, /rent)
- Maintenance (Wrench, /maintenance)
- Insurance — new item (Shield, /insurance) — for now just link to /settings since insurance is only accessible from property detail; we'll add a dedicated page later

INTELLIGENCE section:
- Insights (TrendingUp, /insights)
- Reports (FileText, /reports)
- Refinance (CalendarDays, /refinance-calendar)
- Timeline (History, /timeline)
- Chat (MessageSquare, /chat)

ADMIN section:
- Import (no icon change, /import)
- Passport (ClipboardList, /passport)
- Missing Info (AlertCircle, /missing-info)
- Settings (Settings, /settings)

Use SidebarGroupLabel for each section title (styled as uppercase, muted text, small — matching the existing "Menu" label style). Keep all existing badge logic, active state detection, and the Compliance collapsible sub-menu exactly as they are.

Remove the Tenants/Rent/Maintenance items from wherever they previously appeared and place them in Operations. Everything else keeps its existing routes and behaviour.
```

---

## PHASE 2 — DOMAIN GAPS

---

### Prompt 2.1 — Tenancy Compliance Checklist

```
This is a critical legal compliance feature. When a tenancy is created, the system must auto-generate a compliance checklist of legally required items.

1. DATABASE: Create a new migration adding a `tenancy_compliance_items` table:
   - id (uuid, primary key, default gen_random_uuid())
   - tenancy_id (uuid, references tenancies.id ON DELETE CASCADE, not null)
   - org_id (uuid, references organizations.id, not null)
   - item_type (text, not null) — one of: 'how_to_rent', 'prescribed_info', 'gas_cert_to_tenant', 'epc_to_tenant', 'right_to_rent', 'deposit_protection', 'deposit_prescribed_info', 'tenancy_agreement_signed', 'inventory_completed', 'standing_order_setup'
   - label (text, not null) — human readable name
   - is_required (boolean, default true)
   - completed_date (date, nullable)
   - completed_by (text, nullable)
   - document_url (text, nullable)
   - due_date (date, nullable) — e.g. deposit protection must be within 30 days of receipt
   - notes (text, nullable)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

   Add RLS policies matching the pattern used by other tables (org_id based via memberships).

2. AUTO-GENERATION: Create a Supabase database function (or trigger) that fires AFTER INSERT on tenancies. It should insert the following items into tenancy_compliance_items:
   - 'how_to_rent' — "How to Rent guide provided" — due_date = tenancy start_date
   - 'right_to_rent' — "Right to Rent check completed" — due_date = tenancy start_date
   - 'tenancy_agreement_signed' — "Tenancy agreement signed" — due_date = tenancy start_date
   - 'epc_to_tenant' — "EPC provided to tenant" — due_date = tenancy start_date
   - 'gas_cert_to_tenant' — "Gas Safety Certificate provided" — due_date = tenancy start_date (only if the property has_gas is not false)
   - 'deposit_protection' — "Deposit protected with scheme" — due_date = tenancy start_date + 30 days (only if deposit_amount > 0)
   - 'deposit_prescribed_info' — "Deposit prescribed information served" — due_date = tenancy start_date + 30 days (only if deposit_amount > 0)
   - 'inventory_completed' — "Inventory/check-in completed" — due_date = tenancy start_date
   - 'standing_order_setup' — "Standing order/payment method confirmed" — due_date = tenancy start_date + 7 days

3. HOOK: Create src/hooks/useTenancyCompliance.ts with:
   - useTenancyCompliance(tenancyId) — fetches items for a tenancy
   - useUpdateTenancyComplianceItem() — mutation to mark an item completed (sets completed_date to today, completed_by to current user email)
   - useTenancyComplianceStats() — fetches all items across all active tenancies and returns: totalItems, completedItems, overdueItems (due_date < today and not completed)

4. UI: On the TenantDetail page, add a "Tenancy Compliance" card within the tenancy section. Show a checklist with:
   - Each item as a row with: checkbox (to mark complete), label, due date, status badge (completed/pending/overdue)
   - Clicking the checkbox opens a small confirm dialog, then marks the item as completed with today's date
   - Show a progress bar at the top: "7/9 items completed"
   - Overdue items should show in red with "Overdue by X days"
   - Include a warning banner at the top if any items are overdue: "⚠️ X compliance items are overdue — you cannot serve a valid Section 21 notice until all items are completed"

5. ACTIONS INTEGRATION: In usePortfolioRisks.ts, add a new risk type 'tenancy_compliance'. Query tenancy_compliance_items where due_date < today AND completed_date IS NULL AND the tenancy status is 'active'. Create a risk item for each overdue compliance item with severity 'critical' and message showing the item label and tenant name.
```

---

### Prompt 2.2 — Void Period Tracking

```
Add void period tracking to the property management system.

1. DATABASE: Create migration for `void_periods` table:
   - id (uuid, primary key, default gen_random_uuid())
   - property_id (uuid, references properties.id ON DELETE CASCADE, not null)
   - org_id (uuid, references organizations.id, not null)
   - start_date (date, not null)
   - end_date (date, nullable — null means currently void)
   - reason (text, nullable) — e.g. "Between tenants", "Refurbishment", "Awaiting licence"
   - estimated_monthly_cost (numeric, nullable) — mortgage + council tax + insurance running cost during void
   - notes (text, nullable)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

   Add RLS policies matching other tables.

2. HOOK: Create src/hooks/useVoidPeriods.ts:
   - useVoidPeriods(propertyId?) — lists void periods, ordered by start_date desc
   - useActiveVoids() — fetches all void periods where end_date IS NULL (currently void properties)
   - useCreateVoidPeriod() mutation
   - useEndVoidPeriod() mutation — sets end_date
   - useVoidStats() — calculates: total void days this year, average void length, portfolio void rate (void days / total possible days), total estimated void cost

3. UI CHANGES:

   a) Property Detail page — In the Overview tab, add a "Void History" card below the existing Notes section. Show:
      - Current void status (if end_date is null, show "Currently Void since [date]" with a red badge and an "End Void" button)
      - "Start Void Period" button (opens a small dialog with start_date, reason, estimated_monthly_cost)
      - Table of past void periods: start, end, duration in days, reason, cost
      - Summary: Total void days, average duration

   b) Dashboard — Add void information to the existing KPI area. If there are any active voids, show a small indicator: "X properties void" as a subtitle on the Actions Required KPI card. In the ThisMonthWidget, add a row showing properties currently void.

   c) Actions page — In usePortfolioRisks.ts, add risk type 'void_period'. Any property void for more than 14 days should appear as a warning. Any property void for more than 30 days should be critical. Message: "Void for X days — estimated cost: £Y".

4. AUTO-TRIGGER: When a property's occupancy_status is changed to 'Void' via useUpdateProperty, automatically create a void period record with start_date = today. When changed from 'Void' to 'Occupied', automatically end the active void period with end_date = today.
```

---

### Prompt 2.3 — Leasehold Health Monitoring

```
Add leasehold tracking and health alerts.

1. DATABASE: Create migration for a `leasehold_details` table:
   - id (uuid, primary key, default gen_random_uuid())
   - property_id (uuid, references properties.id ON DELETE CASCADE, unique, not null)
   - org_id (uuid, references organizations.id, not null)
   - original_lease_length_years (integer, nullable)
   - lease_start_date (date, nullable)
   - ground_rent_annual (numeric, nullable)
   - ground_rent_review_date (date, nullable)
   - ground_rent_review_type (text, nullable) — 'fixed', 'rpi', 'doubling', 'market'
   - service_charge_annual (numeric, nullable)
   - service_charge_year (integer, nullable) — which year is the service_charge_annual for
   - managing_agent (text, nullable)
   - managing_agent_contact (text, nullable)
   - freeholder_name (text, nullable)
   - next_section20_date (date, nullable) — upcoming major works consultation
   - section20_notes (text, nullable)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

   Add RLS policies.

2. HOOK: Create src/hooks/useLeaseholdDetails.ts:
   - useLeaseholdDetails(propertyId) — fetch single record
   - useUpsertLeaseholdDetails() — create or update
   - useLeaseholdHealth() — fetches all leasehold properties and calculates: remaining years (from lease_start_date + original_lease_length_years), risk level (below 80 = amber, below 60 = red, below 30 = critical), total annual ground rent across portfolio, total annual service charges

3. UI:

   a) Property Detail — Overview tab: If the property tenure is "Leasehold" or "Share of Freehold", show a "Leasehold Details" card (between Property Details and Location/Registry cards) with:
      - Editable fields for all leasehold_details columns
      - Calculated "Years Remaining" with a colour-coded badge: green (80+), amber (60-80), red (below 60), critical red (below 30)
      - A warning message if below 80: "Consider lease extension — below 80 years affects mortgage availability"
      - Ground rent and service charge displayed with the annual total
      - Section 20 notice date if upcoming

   b) Actions page: Add risk type 'lease_length' to usePortfolioRisks.ts:
      - Below 80 years = warning, message: "Lease at X years — below mortgage threshold"
      - Below 60 years = critical, message: "Lease at X years — critical, affects value and mortgageability"
      - Section 20 notice within 90 days = warning

   c) Insights page: Add a "Leasehold Health" summary card showing: count of leasehold properties, average years remaining, properties below 80 years, total ground rent + service charge cost.

   d) Dashboard: In the portfolio costs area or the DataQualityWidget, show total annual ground rent + service charge if leasehold properties exist.
```

---

### Prompt 2.4 — HMO Room Compliance

```
Enhance the existing rooms system with HMO-specific compliance checking.

The rooms table and hooks already exist at src/hooks/useRooms.ts. The Room type has square_footage and room_type fields.

1. DATABASE: Add columns to the rooms table via migration:
   - has_fire_door (boolean, nullable)
   - has_window (boolean, nullable)
   - has_lock (boolean, nullable)
   - width_meters (numeric, nullable)
   - length_meters (numeric, nullable)
   - area_sqm (numeric, nullable) — auto-calculated or manually entered
   - max_occupants (integer, default 1)
   - current_occupants (integer, default 0)

2. COMPLIANCE LOGIC: Create src/lib/hmoCompliance.ts with:

   Minimum room size rules (Housing Act 2004):
   - 1 person over 10: minimum 6.51 sqm
   - 2 persons over 10: minimum 10.22 sqm
   - 1 person under 10: minimum 4.64 sqm
   
   Function: checkRoomCompliance(room) returns:
   - { compliant: boolean, issues: string[] }
   - Checks: area_sqm >= minimum for max_occupants, has_fire_door, has_window, has_lock
   
   Function: checkPropertyHmoCompliance(rooms, property) returns:
   - Overall compliance score
   - Room-by-room issues
   - Amenity ratio check: for properties with 5+ bedrooms, require 1 bathroom per 5 occupants and 1 kitchen per 7 occupants (count room_type === 'bathroom' and 'kitchen' if we add those, otherwise just report total counts)

3. UI — Property Detail: For properties where is_hmo_licensed is true OR asset_category includes 'HMO', add an "HMO Room Register" card in the Operations tab (before or after the passport form). This card should:

   a) Show a grid/table of all rooms for the property with columns: Room Name, Type, Floor, Area (sqm), Max Occupants, Status (occupied/vacant), Fire Door ✓/✗, Window ✓/✗, Lock ✓/✗, Compliance (green tick or red issues)
   
   b) Each row is clickable to open an edit drawer with all room fields including the new HMO fields
   
   c) Show summary at top: "X/Y rooms compliant", occupancy rate, total occupants vs max
   
   d) If any room is below minimum size, show a red warning: "Room [name] is [X]sqm — below [minimum]sqm minimum for [occupant count] person(s)"

   e) "Add Room" button that opens a dialog (reuse/enhance existing room creation)

4. ACTIONS INTEGRATION: In usePortfolioRisks.ts, for HMO properties, check room compliance and add risks:
   - Room below minimum size = critical
   - Missing fire door on any room = warning
   - No rooms defined on an HMO property = warning: "HMO has no rooms defined"
```

---

### Prompt 2.5 — Insurance Gap Analysis

```
Surface the existing insurance system as a compliance concern and add gap detection.

The insurance hooks and components already exist at src/hooks/useInsurance.ts and src/components/insurance/InsurancePanel.tsx. Insurance is currently only visible on the Property Detail page.

1. ACTIONS INTEGRATION: In usePortfolioRisks.ts, add risk type 'insurance':
   - Property with NO active insurance policy = critical, message: "No active insurance policy"
   - Insurance renewal within 30 days = warning, message: "Insurance renews in X days — [insurer name]"
   - Insurance expired (renewal_date < today AND status is 'active') = critical, message: "Insurance policy expired on [date]"
   
   To do this, create a new hook src/hooks/useInsuranceRisks.ts that fetches all insurance_policies with property joins, and returns an array of risks. Then consume these risks in usePortfolioRisks.

2. DASHBOARD: In the ThisMonthWidget or UpcomingExpirationsWidget, include insurance renewals alongside compliance expirations. Show them in the same timeline with an insurance icon.

3. PROPERTY MAP: In src/components/maps/PropertyMap.tsx, replace the hardcoded `const hasMissingInsurance = false; // TODO: Check insurance_policies table` with an actual check. Query insurance_policies for each property or pass insurance data as a prop. Properties without active insurance should show a warning indicator on the map marker.

4. PROPERTY DETAIL: On the Finance tab, below the valuation section, add a small "Insurance Summary" card that shows: insurer name, renewal date (with days remaining badge), annual premium. This supplements the full InsurancePanel that exists elsewhere.
```

---

## PHASE 3 — INTELLIGENCE LAYER

---

### Prompt 3.1 — Portfolio Stress Testing

```
Add a stress testing tool to the Insights page.

Create a new component src/components/insights/StressTestPanel.tsx:

1. Show three adjustable parameters with sliders:
   - Interest rate change: -2% to +5% (step 0.25%)
   - Property value change: -30% to +20% (step 5%)
   - Void rate assumption: 0% to 20% (step 2%)

2. For each scenario, recalculate and display in a results table:
   - Portfolio monthly cashflow (current vs stressed)
   - Portfolio average LTV (current vs stressed)
   - Number of properties with negative cashflow (current vs stressed)
   - Number of properties with LTV above 75% (current vs stressed)
   - Total equity (current vs stressed)

3. Use the existing calculation functions from src/lib/calculations.ts. For each property:
   - Rate stress: Recalculate mortgage payment using current balance and (current rate + adjustment). Use calculateMonthlyMortgagePayment with the stressed rate.
   - Value stress: Multiply current_value_gbp by (1 + valueChange/100). Recalculate LTV with new value.
   - Void stress: Reduce annual rent by void rate percentage.

4. Show results in a clean table with red/green colour coding comparing current vs stressed figures. Add a "Traffic light" summary at the top:
   - Green: Portfolio remains cash-positive and all LTVs below 75%
   - Amber: Some properties go cash-negative OR some LTVs exceed 75%
   - Red: Portfolio-level cashflow goes negative OR average LTV exceeds 85%

5. Include three preset "quick scenario" buttons:
   - "Rate rise +2%": Sets interest rate to +2%, everything else 0
   - "Market correction": Sets values to -15%, rates to +1%
   - "Worst case": Values -20%, rates +3%, voids 10%

6. Add this panel as a new tab on the Insights page called "Stress Test", alongside the existing content tabs.

Use the existing useProperties hook data. All calculations should be client-side in useMemo — no new database queries needed.
```

---

### Prompt 3.2 — Property Document Checklist

```
Add a document completeness checker per property.

1. Create src/lib/documentChecklist.ts with a list of expected documents per property:

   const REQUIRED_DOCUMENTS = [
     { key: 'title_deeds', label: 'Title Deeds / Land Registry', category: 'Legal', alwaysRequired: true },
     { key: 'tenancy_agreement', label: 'Current Tenancy Agreement', category: 'Tenancy', condition: (p) => p.occupancy_status === 'Occupied' },
     { key: 'mortgage_offer', label: 'Mortgage Offer / Facility Letter', category: 'Finance', condition: (p) => p.loans?.length > 0 },
     { key: 'insurance_schedule', label: 'Insurance Schedule', category: 'Insurance', alwaysRequired: true },
     { key: 'gas_safety', label: 'Gas Safety Certificate', category: 'Compliance', condition: (p) => p.has_gas !== false },
     { key: 'eicr', label: 'Electrical Safety Certificate (EICR)', category: 'Compliance', alwaysRequired: true },
     { key: 'epc', label: 'Energy Performance Certificate', category: 'Compliance', condition: (p) => p.epc_required !== false },
     { key: 'fire_risk_assessment', label: 'Fire Risk Assessment', category: 'Compliance', condition: (p) => p.asset_category?.includes('HMO') },
     { key: 'hmo_licence', label: 'HMO Licence', category: 'Compliance', condition: (p) => p.is_hmo_licensed },
     { key: 'floor_plans', label: 'Floor Plans', category: 'Property', alwaysRequired: false },
     { key: 'valuation_report', label: 'Most Recent Valuation', category: 'Finance', alwaysRequired: false },
     { key: 'company_cert', label: 'Company Certificate of Incorporation', category: 'Legal', condition: (p) => !!p.legal_owner_company_id },
   ];

   Function: getDocumentChecklist(property, complianceItems, documents) returns array of { key, label, category, required, present, documentUrl? }

   "present" is determined by checking:
   - complianceItems for compliance documents (match by type)
   - documents table entries for other document types
   - specific property fields (e.g. tenancy_agreement_url on tenancies)

2. UI: On Property Detail, in the "Media & Docs" tab, add a "Document Checklist" card at the top (above Photos & Gallery). Display:
   - Progress bar: "8/12 documents present"
   - Grouped by category (Legal, Finance, Compliance, Tenancy, Property)
   - Each item shows: ✓ green or ✗ red, label, "View" link if present, "Upload" button if missing (links to compliance upload or document upload as appropriate)
   - Only show required items by default, with a toggle to "Show optional items"

3. DASHBOARD DATA QUALITY: In the DataQualityWidget, add "document completeness" as a metric alongside the existing data quality checks. Show average document completeness % across portfolio.
```

---

### Prompt 3.3 — Enhanced yield metrics and Dashboard simplification

```
Two changes in this prompt:

1. YIELD METRICS

In src/lib/calculations.ts, add a new function:

export function calculateGrossYield(annualRent: number | null, currentValue: number | null): number | null {
  if (!annualRent || !currentValue || currentValue === 0) return null;
  return (annualRent / currentValue) * 100;
}

Update the Property Detail KPI cards to show 3 yield metrics instead of just "Net Yield":
- Replace the single Net Yield card with a card that shows:
  - Main value: Net Yield (keep existing calculation)
  - Subtitle line 1: "Gross: X.X%" (using calculateGrossYield)
  - Subtitle line 2: "ROCE: X.X%" (using existing calculateROCE)

This is a small change to the KPI grid in PropertyDetail.tsx.

2. DASHBOARD SIMPLIFICATION

Restructure Dashboard.tsx to reduce the vertical scroll. The overview tab currently shows 13+ sections vertically. Reorganise into:

Keep the KPI cards row as-is (4 cards at top).
Keep the Missing Info shortcut card as-is.

Below that, replace the current vertical stack with a 3-tab layout:

Tab "Today" (default):
  - ThisMonthWidget (left column)
  - ActionsRequiredWidget (right column, or below on mobile)

Tab "Health":
  - PortfolioHealthWidget
  - MissingComplianceWidget  
  - UpcomingExpirationsWidget
  - DataQualityWidget
  - StockConditionSection

Tab "Portfolio":
  - Property Map (full width)
  - Lender Exposure chart + Area Exposure chart (side by side)
  - BeneficialOwnerWidget

Keep the existing Shareholders tab as a top-level tab alongside Overview.

Remove RecentActivityWidget from the dashboard — it's available on individual property pages where it's more useful. This significantly reduces scroll depth.

All existing components stay the same. We're only changing the layout/tab structure in Dashboard.tsx.
```

---

### Prompt 3.4 — Capex / Works Tracker for Development Properties

```
Add capital expenditure tracking for development/refurbishment properties.

1. DATABASE: Create migration for `project_costs` table:
   - id (uuid, primary key, default gen_random_uuid())
   - property_id (uuid, references properties.id ON DELETE CASCADE, not null)
   - org_id (uuid, references organizations.id, not null)
   - category (text, not null) — one of: 'acquisition', 'stamp_duty', 'legal_fees', 'survey_fees', 'build_costs', 'professional_fees', 'finance_costs', 'furnishing', 'contingency', 'other'
   - description (text, nullable)
   - budgeted_amount (numeric, not null)
   - actual_amount (numeric, nullable)
   - date_incurred (date, nullable)
   - contractor_job_id (uuid, references contractor_jobs.id, nullable) — link to job if applicable
   - invoice_url (text, nullable)
   - status (text, default 'budgeted') — 'budgeted', 'committed', 'paid'
   - notes (text, nullable)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())

   Add RLS policies.

2. HOOK: Create src/hooks/useProjectCosts.ts:
   - useProjectCosts(propertyId) — list all costs for a property
   - useCreateProjectCost() mutation
   - useUpdateProjectCost() mutation
   - useDeleteProjectCost() mutation
   - useProjectSummary(propertyId) — returns: totalBudget, totalActual, variance, profitOnCost (if GDV data available)

3. UI: On Property Detail — For properties where lifecycle_type is 'development', add a "Project Costs" tab (or section within the Finance tab). Show:

   a) Summary cards: Total Budget | Total Actual Spend | Variance (over/under) | Budget Remaining
   
   b) If the property has current_value_gbp (used as GDV) and purchase_price_gbp, show:
      - "Development Appraisal" card: GDV, Total Costs (purchase + project costs), Projected Profit, Profit on Cost %
   
   c) Costs table grouped by category with columns: Category, Description, Budget, Actual, Variance, Status, Date
   
   d) "Add Cost" button opening a dialog with all project_costs fields
   
   e) Budget vs Actual bar chart (horizontal bars, one per category, showing budget as outline and actual as fill)

4. PIPELINE PAGE: On the Pipeline page (src/pages/Pipeline.tsx), for each development property card, show the budget vs actual summary from useProjectSummary. Currently the pipeline page shows "Projected GDV" — supplement this with "Budget: £X / Spent: £X".
```

---

## PHASE 4 — POLISH & SCALE

---

### Prompt 4.1 — Actions Resolve Workflow

```
Transform the Actions page from a read-only risk list into an operational tool.

1. DATABASE: Create migration for `action_responses` table:
   - id (uuid, primary key, default gen_random_uuid())
   - risk_id (text, not null) — the generated risk ID (e.g. "ltv-abc123")
   - risk_type (text, not null) — matches the risk type from usePortfolioRisks
   - property_id (uuid, references properties.id, not null)
   - org_id (uuid, references organizations.id, not null)
   - response_type (text, not null) — 'resolved', 'snoozed', 'assigned', 'note_added'
   - snooze_until (date, nullable) — for snoozed items
   - assigned_to (text, nullable) — name or email
   - notes (text, nullable)
   - created_by (uuid, references auth.users.id, nullable)
   - created_at (timestamptz, default now())

   Add RLS policies.

2. HOOK: Create src/hooks/useActionResponses.ts:
   - useActionResponses() — fetch all responses
   - useSnoozedActions() — fetch responses where response_type = 'snoozed' AND snooze_until >= today
   - useCreateActionResponse() mutation

3. UI CHANGES to Actions page (src/pages/Actions.tsx):

   a) Add a three-dot menu (DropdownMenu) on each risk row with options:
      - "Resolve" → Opens a dialog based on risk type:
        - For compliance risks: "Upload Certificate" button that navigates to the property's compliance tab
        - For LTV/cashflow risks: Shows a note field + "Mark as Acknowledged"
        - For void period: "End Void" button
        - For tenancy compliance: Navigates to the tenant detail page
      - "Snooze" → Opens a small dialog: "Remind me in" dropdown (7 days, 14 days, 30 days, 60 days, 90 days) + optional note. Saves to action_responses.
      - "Assign" → Text input for assignee name/email + note. Saves to action_responses.
      - "Add Note" → Just a text field for notes. Saves to action_responses.

   b) Filter out snoozed items by default. Add a toggle button: "Show snoozed (X)" that reveals snoozed items with a muted appearance and a "Snooze expires [date]" badge.

   c) Show a small history indicator on items that have previous action_responses. Clicking it shows a popover with the response history: who did what, when.

4. The existing risk table and filtering stays exactly as-is. We're only adding the action menu column and the snooze filtering.
```

---

### Prompt 4.2 — Compliance Register grouped by property

```
Add a "By Property" view to the Compliance page alongside the existing flat list.

In src/pages/Compliance.tsx:

1. Add a view toggle at the top (next to the existing filters): two buttons "By Item" | "By Property". Default to "By Item" (current view).

2. When "By Property" is selected, show a different layout:
   - List of property cards, one per property, ordered by compliance score ascending (worst first)
   - Each property card shows:
     - Property address + postcode
     - Compliance score as a coloured progress bar (percentage of valid items out of required items)
     - Summary badges: "X valid", "X expiring", "X expired", "X missing"
     - Expandable/collapsible content showing the individual compliance items for that property (reuse the existing ComplianceRegisterItem component)
   - Properties with all items valid are collapsed by default, properties with issues are expanded

3. Keep all existing filters (status, type, search) working in both views. In "By Property" view:
   - Status filter hides/shows properties based on whether they have items matching the status
   - Type filter shows only properties that have (or should have) that compliance type
   - Search filters by property address

4. Use the existing `allItemsWithMissing` data and `complianceStats` — no new queries needed. Just reshape the grouping in a useMemo.

5. Above the list in "By Property" view, show portfolio summary: "X/Y properties fully compliant | Z items need attention"
```

---

### Prompt 4.3 — Code splitting with React.lazy

```
Add route-level code splitting to App.tsx. This is a performance optimisation — no visual changes.

1. In App.tsx, replace every direct page import with React.lazy:

import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Properties = lazy(() => import('./pages/Properties'));
const PropertyNew = lazy(() => import('./pages/PropertyNew'));
const PropertyEdit = lazy(() => import('./pages/PropertyEdit'));
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
// ... all other page imports converted to lazy

Keep the Auth, ForgotPassword, ResetPassword pages as direct imports (they're entry points and should load immediately).

Keep the marketing pages (MarketingHome etc.) and portal pages as lazy imports too.

2. Wrap the <Routes> block in a <Suspense> with a loading fallback:

<Suspense fallback={
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
}>
  <Routes>
    {/* ... all routes stay exactly the same ... */}
  </Routes>
</Suspense>

3. In vite.config.ts, add manual chunk splitting:

build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        query: ['@tanstack/react-query'],
        supabase: ['@supabase/supabase-js'],
        charts: ['recharts'],
        maps: ['leaflet', 'react-leaflet'],
        pdf: ['jspdf', 'jspdf-autotable'],
      },
    },
  },
},

Do NOT change any component logic, routes, or functionality. This is purely a build optimisation.
```

---

### Prompt 4.4 — Property Detail Status Bar

```
Add a compact status bar to the Property Detail page, between the header and the KPI cards.

In src/pages/PropertyDetail.tsx, after the header div and before the KPI grid, add a new component:

Create src/components/property/PropertyStatusBar.tsx:

Props: propertyId, property (PropertyWithFinancials), complianceScore (number), passportCompleteness (number)

Display as a single horizontal row with 4-5 compact status indicators:

1. COMPLIANCE: Green/Amber/Red dot + "Compliant" / "X issues" — use existing compliance data. If no compliance items exist, show grey "Not checked".

2. TENANCY: If occupied: Green dot + tenant name (from active tenancy) + lease end date. If void: Red dot + "Void since [date]" or "Void" if no void tracking yet. If development: Grey dot + "Development".

3. NEXT ACTION: Show the single most urgent item from usePortfolioRisks filtered to this property. E.g. "Gas cert expires in 12 days" with an amber/red icon. If no actions: green dot + "No actions due".

4. DATA QUALITY: Show passport completeness as a small circular progress indicator + percentage.

Style this as a subtle bar with bg-muted/30 and rounded-lg, items separated by vertical dividers, each item being an icon + short text. Should not exceed one line on desktop. On mobile, stack into 2x2 grid.

Fetch the required data:
- usePropertyCompliance(propertyId) for compliance score
- usePropertyPassport(propertyId) for passport completeness  
- usePortfolioRisks() filtered to this property for next action
- useTenancies({ propertyId, status: 'active' }) for current tenant

This gives you a "traffic light" view of any property at a glance without scrolling.
```

---

*End of prompts. Use in order, review each result before proceeding to the next. Prompts 1.1-1.3 are pure refactoring. 1.4-1.7 complete broken UI. 2.x fills domain gaps. 3.x adds intelligence. 4.x polishes the workflow.*
