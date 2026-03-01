# AG1: Document Template Generator

Generate pre-filled property documents from existing data: Section 21 notices, Section 8 notices, rent increase letters, guarantor agreements, inventory templates, and How to Rent cover letters. Editable before download as PDF.

## Template Library

Create `src/lib/documentTemplates.ts`:

Define templates as structured objects. Each template specifies fields, legal text, and which data auto-fills from the database.

### Available Templates

```typescript
export const DOCUMENT_TEMPLATES = [
  {
    id: 'section_21_notice',
    name: 'Section 21 Notice (Form 6A)',
    description: 'No-fault eviction notice — requires 2 months\' notice, valid Gas Cert, EPC, and How to Rent guide served',
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant', 'compliance'],
    legalWarning: 'This generates a template only. Seek legal advice before serving any notice.',
  },
  {
    id: 'section_8_notice',
    name: 'Section 8 Notice (Form 3)',
    description: 'Eviction notice on specific grounds — select applicable grounds',
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant'],
    legalWarning: 'This generates a template only. Seek legal advice before serving any notice.',
  },
  {
    id: 'section_13_rent_increase',
    name: 'Section 13 Rent Increase Notice',
    description: 'Formal rent increase for periodic tenancies — requires 1 month notice for monthly tenancies',
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'guarantor_agreement',
    name: 'Guarantor Agreement',
    description: 'Standard guarantor form for a named tenant',
    category: 'agreements',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'inventory_template',
    name: 'Inventory & Schedule of Condition',
    description: 'Room-by-room inventory template with condition notes',
    category: 'inventories',
    requiredData: ['property', 'rooms'],
  },
  {
    id: 'how_to_rent_cover',
    name: 'How to Rent — Cover Letter & Proof of Service',
    description: 'Cover letter confirming the How to Rent guide was provided to the tenant',
    category: 'compliance',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'tenant_reference_request',
    name: 'Landlord Reference Request',
    description: 'Request a reference from a prospective tenant\'s previous landlord',
    category: 'lettings',
    requiredData: ['property'],
  },
] as const;
```

## Template Generation Page

Create `src/pages/DocumentTemplates.tsx` with route `/templates`:

### Template Browser

Grid of template cards, grouped by category (Notices, Agreements, Inventories, Lettings, Compliance):

```
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ 📋 Section 21       │ │ 📋 Section 8        │ │ 📋 Rent Increase    │
│ Notice (Form 6A)    │ │ Notice (Form 3)     │ │ (Section 13)        │
│                     │ │                     │ │                     │
│ No-fault eviction   │ │ Eviction on specific│ │ Formal increase for │
│ notice...           │ │ grounds...          │ │ periodic tenancies  │
│                     │ │                     │ │                     │
│ [Generate →]        │ │ [Generate →]        │ │ [Generate →]        │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### Template Generation Flow

When user clicks "Generate":

**Step 1 — Select Property & Tenant:**
- Property dropdown (from `properties_v2`)
- Room dropdown (if HMO)
- Tenant dropdown (from active `tenancies_v2` for that property/room)
- Auto-fills based on selection

**Step 2 — Template-Specific Fields:**

For **Section 21 Notice**:
- Notice date (default: today)
- Earliest end date (auto-calculated: today + 2 months, snapped to end of tenancy period)
- Pre-flight checks (auto-verified from data):
  - ☑/☒ Valid Gas Safety Certificate served
  - ☑/☒ Valid EPC served
  - ☑/☒ How to Rent guide served
  - ☑/☒ Deposit registered with scheme
  - ☑/☒ Tenancy is not within first 4 months
- If any check fails, show warning: "This Section 21 notice may not be valid"

For **Section 13 Rent Increase**:
- Current rent (auto-filled)
- New rent amount (user enters)
- Increase date (auto-calculated: current rent period + 1 month minimum)
- Increase percentage (auto-calculated)

For **Inventory Template**:
- Room list auto-populated from `rooms_v2`
- Each room generates sections for: walls, ceiling, floor, doors, windows, fixtures, furniture, general condition
- Blank fields for the user to fill in during inspection

For **Guarantor Agreement**:
- Guarantor name (user enters)
- Guarantor address (user enters)
- Guaranteed amount (defaults to annual rent)

**Step 3 — Preview & Download:**
- Rendered preview of the document (HTML)
- "Download as PDF" button (generates via jsPDF)
- "Edit before download" — opens an editable rich text area with the generated content

## PDF Generation

Create `src/lib/templatePdfGenerator.ts`:

Use jsPDF + autoTable (same pattern as `mortgageBrokerPackGenerator.ts`):

Each template has its own generator function:

```typescript
export function generateSection21PDF(data: Section21Data): jsPDF {
  const doc = new jsPDF();
  
  // Header: "HOUSING ACT 1988 — SECTION 21(1) / 21(4)"
  // "NOTICE REQUIRING POSSESSION OF A PROPERTY LET ON AN ASSURED SHORTHOLD TENANCY"
  
  // Form 6A prescribed format fields:
  // To: [tenant name]
  // Of: [property address]
  // From: [landlord/agent name]
  // Date: [notice date]
  
  // "I/We give you notice that I/we require possession of the dwelling-house
  //  known as [address] after [date]"
  
  // Notes section
  // Signature line
  
  return doc;
}
```

**Critical: Use the actual prescribed form wording from UK legislation.** Section 21 uses Form 6A, Section 8 uses Form 3. These have specific required text. The template should match the official form structure.

## Document History

Track generated documents:

```sql
CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  template_id TEXT NOT NULL,
  property_id UUID REFERENCES properties_v2(id),
  tenancy_id UUID REFERENCES tenancies_v2(id),
  tenant_id UUID REFERENCES tenants_v2(id),
  generated_data JSONB, -- the data used to generate
  storage_path TEXT, -- if saved to storage
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Show a "Recent Documents" section on the templates page with download links.

## Sidebar

Add "Templates" to the Operations group, using the `FileSignature` icon from lucide-react.

## Do NOT

- Do NOT provide legal advice — always show disclaimers
- Do NOT generate Assured Shorthold Tenancy agreements (these are too complex and vary by landlord — suggest professional templates from NRLA instead)
- Do NOT auto-serve notices — just generate the document
- Do NOT build e-signature integration
- Do NOT store generated PDFs permanently unless the user explicitly saves them
