# Prompt 1.6 (Revised v2) — Create Tenancy Dialog with AI-Powered PDF Extraction

**Depends on:** Prompt 1.4 (company tenant support with tenant_type field)

Copy and paste this into Lovable:

---

```
The TenantDetail page at src/pages/TenantDetail.tsx has a "Create Tenancy" button wired to showTenancyDialog state, but the dialog doesn't exist ({/* TODO: Create tenancy dialog */}). The tenant can be an individual OR a limited company (tenant_type field on tenants table).

IMPORTANT: When the user uploads a signed tenancy agreement PDF, the system should use AI to extract key tenancy terms and pre-fill the form — exactly like the compliance document upload in ComplianceUploadDialog.tsx uses the process-document edge function.

## 1. NEW EDGE FUNCTION: process-tenancy-agreement

Create a new Supabase edge function at supabase/functions/process-tenancy-agreement/index.ts

This function follows the same pattern as the existing process-document edge function (same auth, same AI gateway, same base64 PDF handling), but with a tenancy-specific prompt.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessTenancyRequest {
  fileUrl: string;
  tenantName: string;
  tenantType: 'individual' | 'company';
  propertyAddress: string;
}

// Reuse the same fetchFileAsDataUrl helper from process-document
async function fetchFileAsDataUrl(fileUrl: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const contentType = response.headers.get('content-type') || 'application/pdf';
  const mimeType = contentType.split(';')[0].trim();
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { fileUrl, tenantName, tenantType, propertyAddress }: ProcessTenancyRequest = await req.json();

    const { dataUrl } = await fetchFileAsDataUrl(fileUrl);

    const systemPrompt = `You are a UK property solicitor's assistant. Analyze this tenancy agreement PDF and extract the key terms.

The tenant is a ${tenantType === 'company' ? 'limited company' : 'private individual'}.
Expected tenant name: ${tenantName}
Expected property address: ${propertyAddress}

Extract ALL of the following information. If a field is not found in the document, return null for that field.

Respond with valid JSON only (no markdown, no code blocks):
{
  "document_type": "ast | company_let | licence_to_occupy | lodger_agreement | other",
  "tenant_name_on_agreement": "string — exact tenant name as written on the agreement",
  "tenant_name_matches": true/false — does the name on the agreement match the expected tenant,
  "landlord_name": "string or null — landlord or management company name",
  "property_address_on_agreement": "string — full property address from the agreement",
  "property_address_matches": true/false — does the address match the expected property,
  "room_or_unit": "string or null — specific room, flat, or unit number if mentioned",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null — fixed term end date",
  "rent_amount_pcm": number or null — monthly rent in pounds (numeric only, no £ sign),
  "rent_due_day": number or null — day of month rent is due (1-28),
  "deposit_amount": number or null — deposit amount in pounds,
  "deposit_scheme": "string or null — DPS, TDS, mydeposits, or other scheme name",
  "notice_period_weeks": number or null,
  "break_clause_date": "YYYY-MM-DD or null — earliest break clause date",
  "break_clause_notice_months": number or null,
  "permitted_occupants": number or null — max number of occupants,
  "includes_bills": true/false/null — whether rent includes any utilities,
  "bills_included": "string or null — which bills are included if any",
  "furnished_status": "furnished | unfurnished | part_furnished | null",
  "pet_clause": "allowed | not_allowed | with_permission | null",
  "guarantor_required": true/false/null,
  "guarantor_name": "string or null",
  "special_conditions": ["array of notable special clauses as short strings"],
  "is_signed": true/false/null — does the document appear to be signed by all parties,
  "signature_date": "YYYY-MM-DD or null — date of signatures",
  "confidence": 0.0-1.0 — overall confidence in extraction quality,
  "issues": [{"message": "string", "severity": "critical | warning | info"}] — any concerns about the document
}

IMPORTANT RULES:
- For rent_amount_pcm: extract the MONTHLY figure. If only weekly rent is given, multiply by 52/12. If only annual rent is given, divide by 12.
- For dates: use YYYY-MM-DD format. Convert UK date formats (DD/MM/YYYY) correctly.
- For deposit_scheme: look for references to DPS, TDS, mydeposits, or "Deposit Protection Service", "Tenancy Deposit Scheme".
- For company tenants: the tenant name may be a company name with a Companies House number. Note this.
- Flag any unusual clauses in special_conditions (e.g. rent escalation clauses, forfeiture clauses, unusual break terms).
- Flag in issues if the document appears unsigned, undated, or if tenant/property names don't match.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this tenancy agreement and extract all key terms." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    let extraction;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extraction = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Parse error, raw:", responseText);
      extraction = { confidence: 0, issues: [{ message: "Failed to parse document", severity: "critical" }] };
    }

    return new Response(
      JSON.stringify({ success: true, extraction }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process tenancy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

## 2. CREATE THE DIALOG COMPONENT

Create src/components/tenants/CreateTenancyDialog.tsx

Props:
- open: boolean
- onOpenChange: (open: boolean) => void
- tenantId: string
- tenantName: string (company_name for companies, "First Last" for individuals)
- tenantType: 'individual' | 'company'

### The dialog is a multi-step wizard with 4 steps:

**Step 1: Upload Agreement (FIRST step — this is the key change)**

Show a large drag-and-drop upload zone (matching DocumentUploadZone style):
- Accept PDF only (application/pdf), max 20MB
- Title: "Upload Signed Tenancy Agreement"
- Subtitle: "AI will extract the key terms automatically"
- On file drop/select:
  1. Upload the file to Supabase storage: bucket 'documents', path `tenancy-agreements/${Date.now()}_agreement.pdf`
  2. Get the public URL
  3. Show a processing state with animated progress bar and steps: "Uploading document..." → "Extracting text..." → "AI reading agreement..." → "Extracting terms..."
  4. Call the process-tenancy-agreement edge function via supabase.functions.invoke('process-tenancy-agreement', { body: { fileUrl, tenantName, tenantType, propertyAddress: '' } })
  5. On success: store the extraction result in component state, auto-advance to Step 2
  6. On error: show error toast but allow manual entry via "Skip — enter details manually" link

Also show a "Skip — enter details manually" link below the upload zone that advances to Step 2 with empty form fields.

**Step 2: Property & Room**

- property_id (required) — Select dropdown from useProperties(), showing address_line
- room_id (required) — Select dropdown from useRoomsWithTenancy(property_id), filtered to vacant rooms only. Show room_name, room_type, target_rent_pcm.

If AI extraction found a property_address_on_agreement, show an info banner:
  "AI detected property: [address]. Please confirm by selecting the matching property below."
If AI extracted room_or_unit, show it as a hint next to the room selector.

Navigation: "Back" and "Next"

**Step 3: Tenancy Terms (PRE-FILLED FROM AI)**

All fields in this step should be pre-filled from the AI extraction result where available. Show a small blue "AI" badge next to any field that was auto-filled, so the user knows which values came from the document.

- start_date (required) — Date picker. Pre-fill from extraction.start_date
- end_date (optional) — Date picker. Pre-fill from extraction.end_date. For company tenants label "Lease end date"
- rent_amount_pcm (required) — Number input. Pre-fill from extraction.rent_amount_pcm. Show the room's target_rent_pcm as reference text below: "Room target rent: £X/mo"
- rent_due_day (required) — Number 1-28, default 1. Pre-fill from extraction.rent_due_day
- notice_period_weeks — Number, default 4. Pre-fill from extraction.notice_period_weeks

Deposit section (Card):
- deposit_amount — Number. Pre-fill from extraction.deposit_amount
- deposit_scheme — Select: DPS, TDS, mydeposits, None. Pre-fill from extraction.deposit_scheme
- deposit_reference — Text
- deposit_protected_date — Date picker
- For company tenants: show info note about AST vs company let deposit rules

AI Insights section (only shown if AI extraction has data):
- A collapsible Card titled "AI Agreement Analysis" with a Bot icon
- Show extracted special_conditions as a bulleted list
- Show furnished_status, pet_clause, includes_bills, permitted_occupants as a summary grid
- Show guarantor_name if extracted
- Show break_clause_date if extracted
- Show any issues from the AI as warning/critical Alert components:
  - "Document appears unsigned" (critical) 
  - "Tenant name doesn't match" (warning)
  - "Property address doesn't match" (warning)

Navigation: "Back" and "Next"

**Step 4: Review & Confirm**

Show a read-only summary of everything:
- Tenant name + type badge (Company / Individual)
- Property address + room name
- Start date → End date (or "Periodic" if no end date)
- Rent: £X/mo, due day X
- Deposit: £X with [scheme]
- Agreement: ✓ Uploaded / ✗ Not uploaded (with "Upload now" link back to step 1)
- If AI issues exist, show them here as final warnings

"Create Tenancy" button with Loader2 spinner.

### Save logic:

1. Create tenancy via useCreateTenancy() with all form fields + tenancy_agreement_url (the storage URL from step 1, or null)
2. Update room status to 'occupied' via useUpdateRoom()
3. Update tenant status to 'active' if currently 'prospect' via useUpdateTenant()
4. Invalidate: ['tenancies'], ['rooms'], ['tenants'], ['rent_schedule']
5. On success: toast + close dialog
6. On error: destructive toast, keep dialog open

### Zod validation:

```typescript
const createTenancySchema = z.object({
  property_id: z.string().uuid('Select a property'),
  room_id: z.string().uuid('Select a room'),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional(),
  rent_amount_pcm: z.coerce.number().min(1, 'Rent must be > £0'),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  notice_period_weeks: z.coerce.number().int().min(0).optional(),
  deposit_amount: z.coerce.number().min(0).optional(),
  deposit_scheme: z.string().optional(),
  deposit_reference: z.string().optional(),
  deposit_protected_date: z.string().optional(),
  notes: z.string().optional(),
});
```

## 3. TENANCY AGREEMENT VIEWER ON TENANT DETAIL

On TenantDetail.tsx, for each tenancy card in the list, add document actions:

If tenancy.tenancy_agreement_url is NOT null:
- "View Agreement" button (FileText icon, outline variant, small) — opens PDF in new tab
- "Replace" button (Upload icon, ghost variant, small) — opens a small dialog to upload a replacement PDF (same storage upload flow, updates tenancy_agreement_url)

If tenancy.tenancy_agreement_url IS null:
- "Upload Agreement" button (Upload icon, outline variant, amber text) — opens upload dialog

Place these buttons in the tenancy card, aligned right, below the rent amount.

## 4. WIRE INTO TENANT DETAIL

In src/pages/TenantDetail.tsx:
- Import CreateTenancyDialog
- Render it with: open={showTenancyDialog}, onOpenChange={setShowTenancyDialog}, tenantId={tenant.id}, tenantName={tenant.tenant_type === 'company' ? tenant.company_name : `${tenant.first_name} ${tenant.last_name}`}, tenantType={tenant.tenant_type || 'individual'}
- Replace the TODO comment
- Wrap the page in <AppLayout>

## 5. ALSO CREATE: MAINTENANCE REQUEST DIALOG

MaintenanceRequests.tsx has {/* TODO: Create maintenance dialog */}.

Create src/components/maintenance/CreateMaintenanceDialog.tsx:
- property_id (Select from useProperties — required)
- room_id (Select from useRooms filtered by property — optional)
- tenant_id (Select from active tenants at property — optional)
- category (Select: plumbing, electrical, heating, appliance, damp_mould, structural, security, cleaning, garden, other — required)
- title (text, required, placeholder "e.g. Leaking tap in kitchen")
- description (textarea, required)
- urgency (Select: emergency, urgent, normal, low — default normal)
- location_in_property (text, optional)

Uses useCreateMaintenanceRequest(). Toast + close on success.

Wire into MaintenanceRequests.tsx. Wrap RentCollection.tsx and MaintenanceRequests.tsx in <AppLayout>.
```

---

## How the AI extraction flow works

1. **User drops PDF** → uploaded to Supabase storage immediately
2. **Edge function called** → downloads the PDF, converts to base64, sends to Gemini via Lovable AI Gateway
3. **Gemini reads the full agreement** → extracts 20+ structured fields including rent, dates, deposit, break clauses, special conditions, and flags issues (unsigned, name mismatch, etc.)
4. **Form pre-fills** → Step 3 shows all extracted values with blue "AI" badges. User reviews, corrects if needed, then confirms.
5. **Edge cases handled**:
   - AI fails → user gets "Skip — enter manually" option
   - Name doesn't match → warning shown but not blocking
   - Document unsigned → critical warning on review step
   - Only weekly/annual rent found → AI converts to monthly
   - Company tenant → AI looks for Companies House number and company-specific clauses

This mirrors the existing compliance upload workflow where AI extracts issue/expiry dates from certificates — same infrastructure, different extraction template.
