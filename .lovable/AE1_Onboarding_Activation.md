# AE1: Onboarding Wizard V2 + Dashboard Activation Checklist

The onboarding wizard exists (`src/components/onboarding/OnboardingWizard.tsx`) but creates properties on the V1 `properties` table and is too minimal. Upgrade it to V2 and add a persistent activation checklist on the dashboard.

## Upgrade OnboardingWizard to V2

In `src/components/onboarding/OnboardingWizard.tsx`:

### Fix V1 References

The `createProperty` mutation currently inserts into `properties`. Change to:

```typescript
const { error } = await supabase
  .from('properties_v2')
  .insert({
    org_id: orgId,
    address_line_1: address.trim(),
    postcode: postcode.trim().toUpperCase(),
    city: city.trim(),
    country: 'England',
    property_type: propertyType,
    lifecycle_stage: 'pipeline',
    total_lettable_rooms: parseInt(rooms) || 0,
  });
```

### Expand Steps from 4 to 6

Current: `['Welcome', 'Organization', 'First Property', 'Complete']`

New: `['Welcome', 'About You', 'Organization', 'First Property', 'Your Goals', 'Complete']`

**Step 0 — Welcome** (keep existing, update copy):
- "Welcome to Hydrogen Capital"
- "Set up your portfolio in under 2 minutes"
- Mention: "Track compliance, manage tenants, monitor cashflow — all in one place"

**Step 1 — About You** (NEW):
- **Your name** — first name + last name (save to `profiles` table)
- **Your role** — radio buttons: "Individual Landlord", "Portfolio Manager", "Property Developer", "Letting Agent", "Other"
- Save role to `profiles.role` (add column if missing: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT`)
- This data helps tailor the dashboard and future feature suggestions

**Step 2 — Organization** (existing, enhanced):
- Keep org name field
- Add **portfolio size** radio: "1-5 properties", "6-20 properties", "20-50 properties", "50+"
- Save to `organizations` metadata or a new column `estimated_portfolio_size`

**Step 3 — First Property** (existing, enhanced):
- Keep address + postcode
- Add **city** field (required)
- Add **property type** dropdown: Single Let, HMO (Licensed), HMO (Mandatory), Multi-Unit — from `PROPERTY_TYPES`
- Add **how many lettable rooms?** number input (only shown for HMO types)
- "Skip for now" option remains

**Step 4 — Your Goals** (NEW):
- "What matters most to you?" — multi-select checkboxes:
  - ☐ Compliance tracking (never miss an expiry)
  - ☐ Rent collection & arrears monitoring
  - ☐ Financial performance & cashflow
  - ☐ Tenant management
  - ☐ Mortgage & lender reporting
  - ☐ Team collaboration
- Save selections to `profiles.onboarding_goals` (JSON array column: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_goals JSONB DEFAULT '[]'`)
- These selections influence which dashboard widgets are promoted and which checklist items are prioritised

**Step 5 — Complete** (existing, enhanced):
- "You're all set, {firstName}!"
- Show a summary: org name, property count, selected goals
- "Go to Dashboard" button
- Below: "Your setup checklist will guide you through the next steps"

## Dashboard Activation Checklist

Create `src/components/dashboard/ActivationChecklist.tsx`:

A persistent card on the Dashboard that tracks setup completion. Only visible when `onboarding_completed = true` AND at least one item is incomplete. Dismissable permanently.

### Checklist Items

Each item queries real data to check completion:

```typescript
const checklistItems = [
  {
    id: 'add_property',
    label: 'Add your first property',
    description: 'Set up a property with address and type',
    check: () => propertiesCount > 0,
    action: () => openPropertyWizard(), // from WZ1
    icon: Building2,
  },
  {
    id: 'add_rooms',
    label: 'Add rooms to a property',
    description: 'Define lettable rooms with rent amounts',
    check: () => roomsCount > 0,
    action: () => navigateToFirstProperty(),
    icon: DoorOpen,
  },
  {
    id: 'upload_compliance',
    label: 'Upload a compliance certificate',
    description: 'Gas safety, EPC, EICR — keep them all in one place',
    check: () => complianceDocsCount > 0,
    action: () => navigate('/compliance-v2'),
    icon: Shield,
  },
  {
    id: 'add_tenant',
    label: 'Add a tenant',
    description: 'Record your tenants and tenancy details',
    check: () => tenantsCount > 0,
    action: () => navigate('/tenants-v2'),
    icon: Users,
  },
  {
    id: 'add_mortgage',
    label: 'Add mortgage details',
    description: 'Track LTV, rates, and monthly payments',
    check: () => loansCount > 0,
    action: () => navigate('/lending'),
    icon: PoundSterling,
  },
  {
    id: 'invite_team',
    label: 'Invite a team member (optional)',
    description: 'Collaborate with your business partner or accountant',
    check: () => teamMembersCount > 1,
    action: () => navigate('/settings?tab=team'),
    icon: UserPlus,
    optional: true,
  },
];
```

### Hook: `useActivationChecklist`

Create `src/hooks/useActivationChecklist.ts`:

```typescript
export function useActivationChecklist() {
  // Query counts for each check
  const { data: properties } = usePropertiesV2();
  const { data: rooms } = useRoomsV2(); // all rooms across properties
  const { data: complianceDocs } = useComplianceMatrix();
  // ... etc

  const items = checklistItems.map(item => ({
    ...item,
    completed: item.check(),
  }));

  const completedCount = items.filter(i => i.completed).length;
  const totalRequired = items.filter(i => !i.optional).length;
  const allRequiredComplete = items.filter(i => !i.optional).every(i => i.completed);

  return { items, completedCount, totalRequired, allRequiredComplete };
}
```

### Checklist UI

```
┌──────────────────────────────────────────────────────────────┐
│ 🚀 Get Started with Hydrogen Capital          3/5 complete  │
│ ████████████████░░░░░░░░░░░                    [Dismiss ×]  │
│                                                              │
│ ✅ Add your first property                                    │
│ ✅ Add rooms to a property                                    │
│ ✅ Upload a compliance certificate                            │
│ ○  Add a tenant                                   [Do this →]│
│ ○  Add mortgage details                           [Do this →]│
│ ○  Invite a team member (optional)                [Do this →]│
└──────────────────────────────────────────────────────────────┘
```

- Progress bar at top showing completion percentage
- Completed items show green checkmark, greyed out text
- Incomplete items show circle, with a "Do this →" action button
- Optional items labelled "(optional)"
- "Dismiss" button sets a `profiles.checklist_dismissed` flag (add column if needed)
- When all required items complete, show a celebration state: "🎉 Setup complete! You're ready to manage your portfolio like a pro." with confetti animation or just a green card

### Dashboard Integration

In `Dashboard.tsx`, add the `ActivationChecklist` at the very top of the page (above KPI cards), conditionally:

```tsx
{!checklistDismissed && !allRequiredComplete && (
  <ActivationChecklist />
)}
```

## Contextual Empty States

Update empty states across key pages to reference checklist items:

- **Properties page (0 properties)**: "Add your first property to get started" → opens Property Wizard
- **Compliance page (0 docs)**: "Upload your first compliance certificate" → opens upload dialog
- **Tenants page (0 tenants)**: "Add your first tenant" → opens tenant creation
- **Lending page (0 loans)**: "Add mortgage details to track LTV and rates" → opens loan form

Use the existing `EmptyState` component but with more specific copy and icons per page.

## Do NOT

- Do NOT remove the existing `OnboardingWizard.tsx` — upgrade it in place
- Do NOT change the `ProtectedRoute` onboarding check logic — it works correctly
- Do NOT add demo data in this prompt — that's AE2
- Do NOT make the checklist blocking — it's guidance, not a gate
