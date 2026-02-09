# Prompt 2.1 (Revised) — Tenancy Compliance Checklist

**Depends on:** Prompt 1.4 (company tenant support must be in place first)

Copy and paste this into Lovable:

---

```
This is a critical legal compliance feature. When a tenancy is created, the system must auto-generate a checklist of legally required items. IMPORTANT: The tenant can be either an individual or a limited company (tenant_type field added in the previous update). Some compliance items differ based on tenant type.

## 1. DATABASE

Create a new migration adding a `tenancy_compliance_items` table:

- id (uuid, primary key, default gen_random_uuid())
- tenancy_id (uuid, references tenancies.id ON DELETE CASCADE, not null)
- org_id (uuid, references organizations.id, not null)
- item_type (text, not null) — see list below
- label (text, not null) — human readable name
- is_required (boolean, default true)
- is_applicable (boolean, default true) — false when the item doesn't apply to this tenancy type (e.g. Right to Rent for company tenants)
- completed_date (date, nullable)
- completed_by (text, nullable) — who marked it complete
- document_url (text, nullable) — link to uploaded evidence
- due_date (date, nullable)
- notes (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

Add RLS policies matching the pattern used by other tables (org_id based via memberships lookup). Enable SELECT, INSERT, UPDATE, DELETE for authenticated users within the same org.

## 2. AUTO-GENERATION LOGIC

Create a Supabase database function called `generate_tenancy_compliance_items` that is triggered AFTER INSERT on the `tenancies` table. It should:

a) Look up the tenant record to get `tenant_type` (individual or company)
b) Look up the property record to get `has_gas`
c) Insert the following items into `tenancy_compliance_items`:

FOR ALL TENANCIES (both individual and company):

| item_type | label | due_date | notes |
|---|---|---|---|
| tenancy_agreement_signed | Tenancy agreement signed by all parties | tenancy start_date | |
| epc_to_tenant | EPC provided to tenant | tenancy start_date | Must be provided before tenancy begins |
| inventory_completed | Inventory / schedule of condition completed | tenancy start_date | |
| standing_order_setup | Payment method confirmed | start_date + 7 days | |
| gas_cert_to_tenant | Gas Safety Certificate provided to tenant | tenancy start_date | ONLY insert if property has_gas is NOT false. Set is_applicable = false if has_gas = false |
| smoke_co_alarms | Smoke and CO alarms tested and confirmed working | tenancy start_date | |

FOR INDIVIDUAL TENANTS ONLY (tenant_type = 'individual'):

| item_type | label | due_date | notes |
|---|---|---|---|
| right_to_rent | Right to Rent check completed | tenancy start_date | Immigration Act 2014 — must be checked before occupation |
| how_to_rent | How to Rent guide provided | tenancy start_date | Required for valid Section 21 notice |
| deposit_protection | Deposit protected with approved scheme | start_date + 30 days | ONLY if tenancy deposit_amount > 0 |
| deposit_prescribed_info | Deposit prescribed information served | start_date + 30 days | ONLY if tenancy deposit_amount > 0. Must include scheme details, landlord contact, dispute resolution info |

FOR COMPANY TENANTS ONLY (tenant_type = 'company'):

| item_type | label | due_date | notes |
|---|---|---|---|
| company_verification | Company verification completed (Companies House check) | tenancy start_date | Verify company is active and not dissolved |
| authorised_signatory | Authorised signatory confirmed | tenancy start_date | Confirm the person signing has authority to bind the company |
| right_to_rent_note | Right to Rent — company let exemption noted | tenancy start_date | Set is_required = false, is_applicable = false. Right to Rent does not apply to company lets. If the company sub-lets to individuals, the company is responsible for Right to Rent checks on those occupiers. |
| deposit_protection_company | Deposit protected (if applicable) | start_date + 30 days | ONLY if deposit_amount > 0. Note: deposit protection applies to ASTs. If the tenancy is a contractual/company let rather than an AST, deposit protection may not be legally required. Mark is_required = true but add note: "Review whether this is an AST or company let — deposit protection is mandatory for ASTs only" |

The function must be a SECURITY DEFINER function (to access other tables). Use the NEW.org_id, NEW.tenant_id, NEW.property_id from the inserted tenancy row.

## 3. HOOKS

Create src/hooks/useTenancyCompliance.ts:

```typescript
// Fetch compliance items for a specific tenancy
export function useTenancyCompliance(tenancyId: string | undefined) {
  return useQuery({
    queryKey: ['tenancy-compliance', tenancyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenancy_compliance_items')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });
}

// Mark an item as completed
export function useCompleteTenancyComplianceItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('tenancy_compliance_items')
        .update({
          completed_date: new Date().toISOString().split('T')[0],
          completed_by: user?.email || 'Unknown',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
      toast({ title: 'Item completed', description: data.label });
    },
  });
}

// Uncomplete an item (undo)
export function useUncompleteTenancyComplianceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('tenancy_compliance_items')
        .update({
          completed_date: null,
          completed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
    },
  });
}

// Fetch stats across ALL active tenancies for dashboard/actions
export function useTenancyComplianceStats() {
  return useQuery({
    queryKey: ['tenancy-compliance-stats'],
    queryFn: async () => {
      // Get all compliance items for active tenancies
      const { data, error } = await supabase
        .from('tenancy_compliance_items')
        .select(`
          *,
          tenancy:tenancies!inner(
            id, status, tenant_id, property_id, room_id,
            tenant:tenants(id, first_name, last_name, tenant_type, company_name),
            property:properties(id, address_line),
            room:rooms(id, room_name)
          )
        `)
        .eq('tenancy.status', 'active')
        .eq('is_applicable', true)
        .eq('is_required', true);

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const items = data || [];

      const totalItems = items.length;
      const completedItems = items.filter(i => i.completed_date).length;
      const overdueItems = items.filter(i =>
        !i.completed_date && i.due_date && i.due_date < today
      );
      const upcomingItems = items.filter(i =>
        !i.completed_date && i.due_date && i.due_date >= today
      );

      return {
        totalItems,
        completedItems,
        overdueCount: overdueItems.length,
        overdueItems,
        upcomingItems,
        completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100,
      };
    },
  });
}
```

## 4. UI — TENANCY COMPLIANCE CARD ON TENANT DETAIL

On the TenantDetail page (src/pages/TenantDetail.tsx), within the "Tenancies" tab content, after each tenancy card that has status 'active' or 'pending', add a TenancyComplianceChecklist component.

Create src/components/tenants/TenancyComplianceChecklist.tsx:

Props: tenancyId (string), tenantType ('individual' | 'company')

Layout:

a) **Header bar** with progress: 
   - "Tenancy Compliance — 7/9 items completed" with a Progress bar
   - If all complete: green background with "✓ Fully compliant — valid for Section 21" message
   - For company tenants: show a subtle info badge "Company let" next to the header

b) **Warning banner** (only if overdue items exist):
   - Red/destructive background
   - For individual tenants: "⚠️ X compliance items are overdue — you cannot serve a valid Section 21 notice until all items are completed"
   - For company tenants: "⚠️ X compliance items are overdue — review and complete to ensure tenancy is properly documented"

c) **Checklist items** as a compact list. Each row shows:
   - Checkbox (Checkbox component from shadcn)
   - Label text
   - Due date badge (if set): green if completed before due, amber if due within 7 days, red if overdue
   - Status: "Completed [date]" in green, "Due [date]" in muted, "Overdue by X days" in red
   - For items where is_applicable = false: show greyed out with strikethrough and "(Not applicable)" text
   - For items where is_required = false: show with "(Optional)" badge

d) **Checkbox behaviour**:
   - Clicking an unchecked box opens a small AlertDialog: "Mark [item label] as completed?" with optional notes textarea and Confirm/Cancel buttons
   - On confirm: calls useCompleteTenancyComplianceItem
   - Clicking a checked box opens: "Mark as incomplete?" confirm dialog, calls useUncompleteTenancyComplianceItem

e) **Group items visually** by category:
   - "Pre-Tenancy Checks" — right_to_rent, company_verification, authorised_signatory
   - "Documents Served" — how_to_rent, epc_to_tenant, gas_cert_to_tenant, tenancy_agreement_signed
   - "Deposit" — deposit_protection, deposit_prescribed_info, deposit_protection_company
   - "Property Setup" — inventory_completed, standing_order_setup, smoke_co_alarms

f) At the bottom, show a small muted text note:
   - For individual tenants: "These items are required under the Deregulation Act 2015, Housing Act 2004, and Immigration Act 2014 for a valid Section 21 notice."
   - For company tenants: "Company lets may not require all items listed for ASTs. Items marked as not applicable have been excluded. Seek legal advice if unsure."

## 5. ACTIONS INTEGRATION

In src/hooks/usePortfolioRisks.ts:

a) Add a new risk type to the RiskType union: 'tenancy_compliance'

b) Add it to the riskTypeLabels map: tenancy_compliance: 'Tenancy Compliance'

c) In the calculatePortfolioRisks function, add a new section at the end (after the existing operational_data risks). This section should:

   - Accept an additional parameter: `tenancyComplianceOverdue` which is an array of overdue items from useTenancyComplianceStats
   - For each overdue item, create a risk:
     - id: `tenancy-compliance-${item.id}`
     - propertyId: item.tenancy.property_id
     - address: item.tenancy.property.address_line
     - type: 'tenancy_compliance'
     - severity: 'critical' (overdue tenancy compliance is always critical — it blocks Section 21)
     - message: For individual tenants: `${item.label} overdue for ${tenant.first_name} ${tenant.last_name} — Section 21 invalid`
                For company tenants: `${item.label} overdue for ${tenant.company_name}`
     - targetUrl: `/tenants/${item.tenancy.tenant_id}`

d) In the usePortfolioRisks hook, call useTenancyComplianceStats() and pass the overdueItems into calculatePortfolioRisks. Update the function signature accordingly.

e) Add the icon mapping in Actions.tsx: tenancy_compliance: <Shield className="h-4 w-4" />

f) Add the filter option in Actions.tsx SelectContent: <SelectItem value="tenancy_compliance">Tenancy Compliance</SelectItem>

## 6. DASHBOARD INTEGRATION

In the ThisMonthWidget (or wherever "This Month" summary is rendered), add a row if there are any overdue tenancy compliance items:

"X tenancy compliance items overdue" with a red badge, linking to /actions?type=tenancy_compliance

## 7. RETROACTIVE GENERATION

For existing tenancies that were created before this migration, there won't be any compliance items. Add a one-time SQL migration that runs the generate_tenancy_compliance_items function for every tenancy with status = 'active'. This ensures existing active tenancies get their checklists populated.

The SQL should be:
```sql
-- Backfill compliance items for existing active tenancies
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT * FROM tenancies WHERE status = 'active'
  LOOP
    -- The trigger function handles the logic
    PERFORM generate_tenancy_compliance_items(t);
  END LOOP;
END;
$$;
```

Alternatively, if the trigger function uses NEW record syntax, create a separate backfill function that accepts a tenancy row and inserts the items directly.
```

---

## Key differences from the original Prompt 2.1

1. **Company vs individual conditional logic** — Right to Rent is NOT generated for company tenants. Instead, a `right_to_rent_note` item is inserted as not-applicable with an explanatory note. Company tenants get `company_verification` and `authorised_signatory` items instead.

2. **Deposit protection nuance** — For company tenants, deposit protection may not be legally required if the let is not an AST. The item is still generated but with an advisory note telling the user to check.

3. **is_applicable column** — New column that distinguishes between "this item exists but doesn't apply to this tenancy type" vs "this item is required but not yet done". Items with is_applicable = false are shown greyed out rather than hidden, so users can see the reasoning.

4. **Section 21 messaging** — The warning banner uses different language for company tenants (Section 21 framing is less relevant for non-AST company lets).

5. **Tenant display name** — The risk messages in Actions use `company_name` for company tenants, `first_name + last_name` for individuals.

6. **Backfill migration** — Ensures existing active tenancies get retroactive checklists, not just new ones.
