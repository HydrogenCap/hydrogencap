# AF2: Tenant Portal V2 Migration + Maintenance Submission

The tenant portal exists with 5 pages (843 lines total) but queries V1 tables (`tenancies`, `properties`, `rooms`, `tenants`, `rent_schedule`). Migrate to V2 and add the ability for tenants to submit maintenance requests directly.

## Migrate All Portal Queries to V2

### TenantPortalHome.tsx

Change:
- `.from('tenancies')` → `.from('tenancies_v2')`
- `.select('*, property:properties(address_line, postcode), room:rooms(room_name), tenant:tenants(...)')` → `.select('*, property:properties_v2(address_line_1, postcode), room:rooms_v2(room_name), tenant:tenants_v2(...)')`
- `.from('rent_schedule')` — check if this table has changed or if it still references V1 tenancy IDs
- Display: `property.address_line` → `property.address_line_1`

### TenantDocuments.tsx

Change any references to V1 compliance tables to use `compliance_documents_v2`. Tenants should see:
- Gas Safety Certificate (legally required to provide)
- EPC (legally required to provide)
- EICR (recommended)
- How to Rent guide (legally required)

### TenantMaintenance.tsx

Change:
- `.from('maintenance_requests')` queries — these reference V1 `properties`, `rooms`
- Update joins to V2 tables

### TenantRentHistory.tsx

Change rent schedule queries to use V2 tenancy IDs.

### useTenantPortalSession.ts

Verify this hook correctly resolves the tenant's tenancy from V2 tables. If it queries `tenancies` → change to `tenancies_v2`.

## Add Tenant Maintenance Submission

Currently tenants can VIEW maintenance requests but likely can't CREATE them. Add a submission form:

### Submit Request Button

On `TenantMaintenance.tsx`, add a prominent "Report an Issue" button at the top:

```tsx
<Button onClick={() => setShowSubmitForm(true)} className="w-full md:w-auto">
  <Plus className="h-4 w-4 mr-2" />
  Report an Issue
</Button>
```

### Submission Form

Opens a Sheet/Dialog with simplified fields (tenant-friendly language, not landlord jargon):

- **What's the problem?** — select category with friendly labels:
  - "Plumbing (leaks, blocked drains, toilets)" → plumbing
  - "Heating (boiler, radiators, hot water)" → heating
  - "Electrical (lights, sockets, fuse box)" → electrical
  - "Damp or mould" → damp_mould
  - "Doors, windows or locks" → security
  - "Appliance (oven, washing machine, fridge)" → appliance
  - "Something else" → other

- **Describe the issue** — textarea, placeholder: "Please describe what's wrong and where in the property it is"

- **How urgent is this?** — radio buttons with plain English:
  - "Emergency — danger to safety or severe damage" → emergency
  - "Urgent — affecting daily living" → urgent
  - "Not urgent — can wait a few days" → normal
  - "Minor — can be done whenever convenient" → low

- **Add photos (optional)** — photo upload (reuse the PhotoUpload component from AC2a if available, otherwise a simple file input)
  - Upload to `maintenance-photos/{org_id}/tenant-submitted/{filename}`

- **Your contact preference** — radio: "Email me updates", "Text me updates", "Either is fine"

### Submission Logic

```typescript
// Insert as maintenance_request with:
// - created_by_type: 'tenant'
// - property_id and room_id from the tenant's active tenancy
// - tenant_id from the session
// - status: 'new'

// After insert, create a notification for the landlord:
// { category: 'maintenance', severity: urgency-based, title: 'Tenant reported: {category}', ... }
```

### Tenant View of Their Requests

Show the tenant's submitted requests with:
- Status updates (from `maintenance_updates` where `visible_to_tenant = true`)
- Contractor assignment (if any)
- Resolution timeline

## Tenant Certificate Access

Legally, landlords must provide tenants with copies of Gas Safety Certificate, EPC, and How to Rent guide. On the `TenantDocuments.tsx` page:

- Query `compliance_documents_v2` for the tenant's property
- Filter to: `gas_safety_certificate`, `epc`, `eicr`
- Show document status (valid/expiring/expired) and expiry date
- If a signed URL exists for the document file, show a "Download" button
- If no document uploaded yet, show: "Your landlord hasn't uploaded this yet"

## Do NOT

- Do NOT change the tenant authentication/invitation system — it works
- Do NOT give tenants access to financial data, landlord notes, or other tenants' info
- Do NOT let tenants edit or delete maintenance requests after submission
- Do NOT expose the tenant's rent arrears or payment history to other tenants
- Do NOT query across properties — tenants only see data for their own tenancy
