# Prompt 1.4 — Add Tenant Dialog (Company Tenant Support)

Copy and paste this into Lovable:

---

```
The Tenants page at src/pages/Tenants.tsx has a TODO: {/* TODO: Add tenant dialog */}. The "Add Tenant" button exists but the dialog is missing.

IMPORTANT CONTEXT: Most properties in this portfolio are let to limited companies, not individuals. The current tenants table only has individual person fields (first_name, last_name, NI number, employer etc). We need to support BOTH corporate tenants and individual tenants.

## 1. DATABASE MIGRATION

Add new columns to the existing `tenants` table:

- tenant_type (text, not null, default 'individual') — either 'individual' or 'company'
- company_name (text, nullable) — trading or registered name of the tenant company
- company_number (text, nullable) — Companies House registration number
- company_registered_address (text, nullable)
- company_contact_name (text, nullable) — the named contact person at the company
- company_contact_email (text, nullable)
- company_contact_phone (text, nullable)
- company_contact_role (text, nullable) — e.g. "Director", "Office Manager", "Letting Agent"
- trading_name (text, nullable) — if different from registered company name
- vat_registered (boolean, nullable)
- vat_number (text, nullable)

Make first_name and last_name nullable in the database (they're currently required). For company tenants, the company_name is the primary identifier. For individuals, first_name + last_name remain the identifiers.

Add a CHECK constraint: 
- If tenant_type = 'individual', first_name must not be null
- If tenant_type = 'company', company_name must not be null

## 2. UPDATE TYPES AND HOOK

In src/hooks/useTenants.ts, update the Tenant interface to include all new fields:

```typescript
export type TenantType = 'individual' | 'company';

export interface Tenant {
  // ... all existing fields ...
  tenant_type: TenantType;
  company_name: string | null;
  company_number: string | null;
  company_registered_address: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_contact_phone: string | null;
  company_contact_role: string | null;
  trading_name: string | null;
  vat_registered: boolean | null;
  vat_number: string | null;
}
```

## 3. CREATE THE DIALOG

Create src/components/tenants/AddTenantDialog.tsx:

The dialog should have a prominent toggle at the top: "Individual" | "Company" (using a TabsList-style toggle, defaulting to "Company" since that's the most common case).

### When "Company" is selected, show these fields:

**Company Details section (Card):**
- company_name (required) — text input
- company_number — text input with a "Lookup" button next to it. The lookup button should use the existing useCompaniesHouse() hook from src/hooks/useCompaniesHouse.ts to search Companies House by number. If found, auto-fill company_name, company_registered_address, and company_number from the CH result. Show a green tick and "Verified" badge next to company_number when CH lookup succeeds.
- company_registered_address — text input (auto-filled from CH if available)
- trading_name — text input, optional, labelled "Trading name (if different)"
- vat_registered — checkbox
- vat_number — text input, only visible when vat_registered is checked

**Primary Contact section (Card):**
- company_contact_name (required for company tenants) — text input, labelled "Contact Name"
- company_contact_role — text input, placeholder "e.g. Director, Office Manager"
- company_contact_email — email input
- company_contact_phone — phone input

**Additional section (collapsed by default using Collapsible):**
- notes — textarea
- status — dropdown (prospect, active), default "prospect"

When saving a company tenant:
- Set tenant_type = 'company'
- Set first_name = company_contact_name (first word) and last_name = company_contact_name (remaining words) as a fallback so existing queries that rely on first_name/last_name don't break. Or if no contact name, set first_name = company_name and last_name = '(Company)'.

### When "Individual" is selected, show these fields:

**Personal Details section (Card):**
- first_name (required) — text input
- last_name (required) — text input
- email — email input
- phone — phone input
- date_of_birth — date input
- national_insurance — text input

**Employment & Income section (Card):**
- employment_status — dropdown: employed, self-employed, unemployed, student, retired
- employer_name — text input
- annual_income — number input

**References section (collapsed by default):**
- previous_address — text input
- previous_landlord_name — text input
- previous_landlord_phone — text input
- guarantor_name, guarantor_email, guarantor_phone, guarantor_address

**Additional section (collapsed by default):**
- notes — textarea
- status — dropdown (prospect, active), default "prospect"

When saving: Set tenant_type = 'individual'.

### Both types:
- Use react-hook-form with zodResolver
- Use the existing useCreateTenant() hook to save
- Show a loading spinner on submit
- On success: close dialog, show toast, navigate to /tenants/{newId}

## 4. UPDATE DISPLAY COMPONENTS

### Tenants.tsx (list page):
Update the TenantCard component to handle both types:
- For company tenants: Show company_name as the primary heading (bold), with a Building2 icon. Show company_contact_name as secondary text. Show company_number as a small badge if available.
- For individual tenants: Keep existing display with first_name + last_name and User icon.

### TenantDetail.tsx:
Update to show the correct detail sections based on tenant_type:
- Company tenants: Show Company Details card (name, number, registered address, trading name, VAT), Contact Details card (contact name, role, email, phone)
- Individual tenants: Keep existing layout

### Tenants.tsx filters:
Add a filter option to switch between "All", "Companies", "Individuals" using the existing Tabs pattern. Filter by tenant_type.

## 5. WRAP IN AppLayout

The Tenants page currently uses `<div className="container py-6">`. Wrap it in <AppLayout> for consistency with every other main page. Same for RentCollection.tsx and MaintenanceRequests.tsx.

Wire the new AddTenantDialog into Tenants.tsx, replacing the TODO comment. Use the existing showAddDialog state.
```

---

## Notes for subsequent prompts

This change affects Prompt 2.1 (Tenancy Compliance Checklist) — for company tenants, some individual-only compliance items don't apply:

- "Right to Rent check" — does NOT apply to company lets (the company is the tenant, not an individual occupying under immigration law). However, if the company then sub-lets to individuals, the company becomes responsible for Right to Rent checks on those individuals. For now, make Right to Rent optional for company tenants with a note explaining this.
- "Guarantor" fields — rarely used for company tenants (the company itself is the contracting party)
- Deposit protection — still applies to company tenants in most cases, but some commercial-style company lets may be excluded. Keep it as required but allow manual override.

The RentCollection and Maintenance prompts (1.5, 1.6) don't need changes — they reference tenancy_id not tenant details, so they work regardless of tenant type.
