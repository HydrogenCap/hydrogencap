# AE2: Demo Portfolio Seed Data

Let new users explore the platform with realistic sample data before adding their own. A "Try with demo portfolio" option in onboarding and a "Load demo data" button in settings.

## Demo Data Set

Create `src/lib/demoData.ts` containing a realistic UK property portfolio:

### 3 Properties

**Property 1 — 14 High Street, Cheltenham, GL50 1DZ**
- Type: hmo_licensed, Stage: stabilised, Entity: "Cheltenham Properties Ltd" (SPV)
- 5 lettable rooms (Room 1-5, mix of double/ensuite, £475-£625/mo), 2 communal (Kitchen, Lounge)
- Purchase: £185,000 (June 2022), Valuation: £240,000
- Mortgage: ABC Mortgages, £148,000, 5.49% fixed, £732/mo, LTV 61.7%
- Compliance: Gas cert (valid, expires in 8 months), EPC rating C (valid), EICR (valid), Fire Risk (expiring in 45 days), HMO Licence (valid, 3 years remaining)
- 4 active tenants, 1 room vacant

**Property 2 — 8 Oak Road, Oxford, OX1 3QR**
- Type: single_let, Stage: stabilised, Entity: "Personal" (personal entity)
- 1 room: "Whole Property", £1,200/mo
- Purchase: £320,000 (March 2021), Valuation: £365,000
- Mortgage: Natwest, £224,000, 4.89% variable, £1,180/mo, LTV 61.4%
- Compliance: Gas cert (valid), EPC rating D (valid but poor), EICR (expired 2 months ago — triggers red alert)
- 1 active tenant

**Property 3 — 22 Elm Avenue, Bristol, BS1 5TH**
- Type: hmo_mandatory, Stage: refurbishment, Entity: "Cheltenham Properties Ltd" (SPV)
- 7 lettable rooms (empty — refurbishment stage), 3 communal
- Purchase: £275,000 (January 2025), Valuation: £275,000
- Mortgage: Bridging loan, £220,000, 0.85%/mo, 12-month term, expires in 6 months
- Compliance: Buildings insurance only, rest pending (triggers missing compliance alerts)
- 0 tenants

### Supporting Data

**Legal Entities:**
- "Cheltenham Properties Ltd" — SPV, company number 12345678, 2 shareholders (user 70%, partner 30%)
- "Personal" — personal entity for the Oxford single let

**Tenants (5):**
- James Wilson, Room 1 @ 14 High St, £550/mo, tenancy started Sep 2024
- Sarah Chen, Room 2 @ 14 High St, £550/mo, tenancy started Nov 2024
- Marcus Johnson, Room 3 @ 14 High St, £625/mo (ensuite), tenancy started Aug 2024, break clause in 2 months
- Priya Patel, Room 5 @ 14 High St, £475/mo, tenancy started Jan 2025
- Tom & Emma Davis, 8 Oak Road, £1,200/mo, tenancy started April 2023, periodic (rolling)

**Rent Schedule:** 3 months of history per tenancy with realistic patterns:
- Most paid on time
- James Wilson paid 3 days late last month
- One month shows a £50 shortfall from Priya Patel

**Void Periods:**
- Room 4 @ 14 High St: void since 3 weeks ago, reason: "between_tenants", estimated cost £500/mo

**Maintenance Requests (2):**
- Dripping kitchen tap @ 14 High St, category: plumbing, urgency: normal, status: scheduled
- Damp patch in Room 2 @ 14 High St, category: damp_mould, urgency: urgent, status: new

## Seed Function

Create `src/lib/seedDemoData.ts`:

```typescript
export async function seedDemoData(orgId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Create legal entities
  // 2. Create properties_v2
  // 3. Create rooms_v2
  // 4. Create tenants_v2 + tenancies_v2
  // 5. Create loan_facilities
  // 6. Create compliance_requirements_v2 + compliance_documents_v2
  // 7. Create rent_schedule + rent_payments (3 months history)
  // 8. Create void_periods
  // 9. Create maintenance_requests
  // 10. Tag all records with a `is_demo_data: true` metadata field or a known prefix

  // All inserts use the user's org_id
  // Return summary: { properties: 3, rooms: 15, tenants: 5, ... }
}

export async function clearDemoData(orgId: string): Promise<void> {
  // Delete all records tagged as demo data for this org
  // Use cascading deletes or delete in reverse order of dependencies
  // Order: rent_payments → rent_schedule → maintenance_requests → void_periods → 
  //        tenancies_v2 → tenants_v2 → compliance_documents_v2 → compliance_requirements_v2 →
  //        loan_facilities → rooms_v2 → properties_v2 → legal_entities (where is_demo = true)
}
```

**Demo data tagging:** Add a `notes` or metadata field containing `'[DEMO]'` prefix to every demo record, OR add a boolean `is_demo` column to `properties_v2`:

```sql
ALTER TABLE properties_v2 ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
```

Use this to identify and bulk-delete demo data. For related tables (rooms, tenants, etc.), cascade through the property relationship.

## Integration Points

### Onboarding Wizard (Step 5 — Complete)

Add a secondary action on the completion screen:

```tsx
<div className="flex flex-col gap-2">
  <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
  <Button 
    variant="outline" 
    onClick={async () => {
      await seedDemoData(orgId, userId);
      toast({ title: 'Demo portfolio loaded', description: '3 properties with sample data' });
      navigate('/dashboard');
    }}
  >
    <Sparkles className="h-4 w-4 mr-2" />
    Explore with demo data first
  </Button>
</div>
```

### Settings Page

In the Settings page, add a "Demo Data" section (under the Admin/Data tab):

- If demo data exists: "Demo portfolio is loaded" with a "Remove demo data" destructive button
- If no demo data: "Load demo data" button with description: "Explore the platform with 3 sample properties, tenants, and compliance data. You can remove it at any time."

### Dashboard Banner

If demo data is active (check for any `properties_v2` with `is_demo = true`), show a subtle banner at the top of the dashboard:

```
ℹ️ You're viewing demo data. [Remove demo data] to start with your own portfolio, or [Add a real property] alongside it.
```

## Do NOT

- Do NOT auto-load demo data — always require explicit user action
- Do NOT mix demo data with real data in reports or exports — filter by `is_demo = false`
- Do NOT create demo auth users — demo tenants don't have portal access
- Do NOT seed more than 3 properties — keep it lightweight
- Do NOT create demo data for edge functions or AI features — just core CRUD data
