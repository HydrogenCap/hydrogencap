# HydrogenCap — NEXT Phase 2.5: AI Document Auto-Classification

## Context

HydrogenCap already has an AI-powered compliance checker that extracts expiry dates from Gas Safety Certificates, EPCs, and Fire Risk Assessments using Claude's API. That was a smart start. But it only works when the operator manually selects the document type and property before uploading.

At 50 properties with 500+ compliance documents, the operator should not have to think about classification at all. The workflow should be: drag a PDF onto the screen → AI identifies what it is → AI extracts all key data → AI files it to the correct property → compliance records update automatically → done. Zero manual data entry. Zero classification decisions.

This module extends the existing AI capability into a full document intelligence pipeline: classify, extract, validate, and file — all from a single upload action.

## Important: API Key Configuration

This module uses the Anthropic Claude API. The user needs an API key from console.anthropic.com. Like the Companies House key, this should be stored in app_settings and used server-side via a Supabase Edge Function where possible.

Add to app_settings:

```sql
insert into public.app_settings (setting_key, description)
values ('anthropic_api_key', 'Claude API key for document AI processing')
on conflict (setting_key) do nothing;
```

## Database Tables

### `document_processing_queue`

Track documents through the AI processing pipeline:

```sql
create table public.document_processing_queue (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes integer,
  status text not null default 'pending' check (status in (
    'pending',
    'classifying',
    'extracting',
    'validating',
    'filing',
    'completed',
    'failed',
    'requires_review'
  )),
  -- AI classification results
  detected_document_type text,
  classification_confidence numeric(3,2),
  detected_property_id uuid references public.properties(id),
  property_match_confidence numeric(3,2),
  property_match_method text,
  -- AI extraction results
  extracted_data jsonb,
  extraction_confidence numeric(3,2),
  -- Validation
  validation_errors text[],
  validation_warnings text[],
  -- Filing
  compliance_document_id uuid references public.compliance_documents(id),
  filed_automatically boolean default false,
  -- Processing metadata
  ai_model text default 'claude-sonnet-4-20250514',
  ai_tokens_used integer,
  processing_time_ms integer,
  error_message text,
  retry_count integer default 0,
  -- User review
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_action text check (review_action in ('approved', 'corrected', 'rejected')),
  review_corrections jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_doc_queue_status on public.document_processing_queue(status);
create index idx_doc_queue_document_type on public.document_processing_queue(detected_document_type);
create index idx_doc_queue_property on public.document_processing_queue(detected_property_id);
create index idx_doc_queue_created on public.document_processing_queue(created_at);
```

### `ai_extraction_templates`

Define what data to extract for each document type. This makes extraction configurable without code changes:

```sql
create table public.ai_extraction_templates (
  id uuid primary key default gen_random_uuid(),
  document_type text not null unique,
  display_name text not null,
  extraction_fields jsonb not null,
  classification_keywords text[] not null,
  typical_issuers text[],
  has_expiry boolean default true,
  default_validity_months integer,
  created_at timestamptz default now()
);

insert into public.ai_extraction_templates (document_type, display_name, extraction_fields, classification_keywords, typical_issuers, has_expiry, default_validity_months) values
(
  'gas_safety_certificate',
  'Gas Safety Certificate (CP12)',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Certificate Number", "type": "text", "required": false},
      {"key": "issue_date", "label": "Date of Inspection", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Expiry Date / Next Inspection Due", "type": "date", "required": true},
      {"key": "engineer_name", "label": "Engineer Name", "type": "text", "required": false},
      {"key": "gas_safe_number", "label": "Gas Safe Registration Number", "type": "text", "required": false},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "landlord_name", "label": "Landlord / Responsible Person", "type": "text", "required": false},
      {"key": "appliances_tested", "label": "Number of Appliances Tested", "type": "number", "required": false},
      {"key": "result", "label": "Overall Result", "type": "text", "required": false}
    ]
  }',
  ARRAY['gas safety', 'cp12', 'gas safe', 'landlord gas safety record', 'lgsr', 'gas appliance', 'gas safe register'],
  ARRAY['British Gas', 'HomeServe', 'Local Gas Engineers', 'Corgi'],
  true,
  12
),
(
  'epc',
  'Energy Performance Certificate (EPC)',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Certificate Reference", "type": "text", "required": true},
      {"key": "issue_date", "label": "Date of Assessment", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Valid Until", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "energy_rating", "label": "Energy Rating (A-G)", "type": "text", "required": true},
      {"key": "energy_score", "label": "Energy Efficiency Score (1-100)", "type": "number", "required": false},
      {"key": "potential_rating", "label": "Potential Rating", "type": "text", "required": false},
      {"key": "assessor_name", "label": "Assessor Name", "type": "text", "required": false},
      {"key": "total_floor_area", "label": "Total Floor Area (m²)", "type": "number", "required": false}
    ]
  }',
  ARRAY['energy performance', 'epc', 'energy rating', 'energy efficiency', 'energy certificate', 'sap rating'],
  ARRAY['Elmhurst Energy', 'Stroma', 'Quidos'],
  true,
  120
),
(
  'eicr',
  'Electrical Installation Condition Report (EICR)',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Report Reference", "type": "text", "required": false},
      {"key": "issue_date", "label": "Date of Inspection", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Next Inspection Due / Recommended", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "electrician_name", "label": "Inspector Name", "type": "text", "required": false},
      {"key": "niceic_number", "label": "NICEIC / Registration Number", "type": "text", "required": false},
      {"key": "overall_result", "label": "Overall Condition (Satisfactory / Unsatisfactory)", "type": "text", "required": true},
      {"key": "c1_codes", "label": "C1 (Danger Present) Count", "type": "number", "required": false},
      {"key": "c2_codes", "label": "C2 (Potentially Dangerous) Count", "type": "number", "required": false},
      {"key": "c3_codes", "label": "C3 (Improvement Recommended) Count", "type": "number", "required": false}
    ]
  }',
  ARRAY['electrical installation', 'eicr', 'condition report', 'periodic inspection', 'electrical safety', 'niceic', 'bs 7671'],
  ARRAY['NICEIC', 'NAPIT', 'ELECSA'],
  true,
  60
),
(
  'fire_risk_assessment',
  'Fire Risk Assessment',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Report Reference", "type": "text", "required": false},
      {"key": "issue_date", "label": "Date of Assessment", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Review Date", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "assessor_name", "label": "Assessor Name", "type": "text", "required": false},
      {"key": "risk_level", "label": "Overall Risk Level", "type": "text", "required": false},
      {"key": "action_items_count", "label": "Number of Action Items", "type": "number", "required": false},
      {"key": "high_priority_items", "label": "High Priority Actions", "type": "number", "required": false}
    ]
  }',
  ARRAY['fire risk', 'fra', 'fire safety', 'fire assessment', 'regulatory reform', 'fire precautions'],
  ARRAY[],
  true,
  12
),
(
  'hmo_licence',
  'HMO Licence',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Licence Number", "type": "text", "required": true},
      {"key": "issue_date", "label": "Date of Issue / Grant Date", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Expiry Date", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "licence_holder", "label": "Licence Holder Name", "type": "text", "required": false},
      {"key": "max_occupants", "label": "Maximum Permitted Occupants", "type": "number", "required": false},
      {"key": "max_households", "label": "Maximum Households", "type": "number", "required": false},
      {"key": "council_name", "label": "Issuing Council / Authority", "type": "text", "required": false},
      {"key": "licence_type", "label": "Licence Type (Mandatory / Additional / Selective)", "type": "text", "required": false},
      {"key": "conditions_count", "label": "Number of Conditions", "type": "number", "required": false}
    ]
  }',
  ARRAY['hmo licence', 'house in multiple occupation', 'hmo license', 'mandatory licence', 'additional licence', 'selective licence'],
  ARRAY[],
  true,
  60
),
(
  'buildings_insurance',
  'Buildings Insurance',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Policy Number", "type": "text", "required": true},
      {"key": "issue_date", "label": "Cover Start Date", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Cover End Date / Renewal Date", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "insurer_name", "label": "Insurance Provider", "type": "text", "required": false},
      {"key": "sum_insured", "label": "Sum Insured / Rebuild Value", "type": "number", "required": false},
      {"key": "excess", "label": "Excess Amount", "type": "number", "required": false},
      {"key": "premium", "label": "Annual Premium", "type": "number", "required": false},
      {"key": "policyholder", "label": "Policyholder Name", "type": "text", "required": false}
    ]
  }',
  ARRAY['buildings insurance', 'property insurance', 'landlord insurance', 'building insurance policy', 'schedule of insurance', 'insurance certificate'],
  ARRAY['Aviva', 'AXA', 'Zurich', 'Just Landlords', 'Alan Boswell', 'Rentguard'],
  true,
  12
),
(
  'landlord_liability_insurance',
  'Landlord Liability Insurance',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Policy Number", "type": "text", "required": true},
      {"key": "issue_date", "label": "Cover Start Date", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Cover End Date", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "insurer_name", "label": "Insurance Provider", "type": "text", "required": false},
      {"key": "cover_limit", "label": "Cover Limit", "type": "number", "required": false},
      {"key": "premium", "label": "Annual Premium", "type": "number", "required": false}
    ]
  }',
  ARRAY['landlord liability', 'public liability', 'employer liability', 'liability insurance'],
  ARRAY[],
  true,
  12
),
(
  'fire_alarm_cert',
  'Fire Alarm Certificate',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Certificate Number", "type": "text", "required": false},
      {"key": "issue_date", "label": "Date of Test / Inspection", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Next Test Due", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "engineer_name", "label": "Engineer / Company", "type": "text", "required": false},
      {"key": "system_type", "label": "System Type / Grade", "type": "text", "required": false},
      {"key": "zones_tested", "label": "Number of Zones", "type": "number", "required": false},
      {"key": "result", "label": "Test Result", "type": "text", "required": false}
    ]
  }',
  ARRAY['fire alarm', 'fire detection', 'fire alarm certificate', 'bs 5839', 'alarm test', 'fire alarm system'],
  ARRAY[],
  true,
  12
),
(
  'emergency_lighting_cert',
  'Emergency Lighting Certificate',
  '{
    "fields": [
      {"key": "certificate_number", "label": "Certificate Number", "type": "text", "required": false},
      {"key": "issue_date", "label": "Date of Test", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Next Test Due", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "engineer_name", "label": "Engineer / Company", "type": "text", "required": false},
      {"key": "luminaires_tested", "label": "Number of Luminaires Tested", "type": "number", "required": false},
      {"key": "result", "label": "Test Result", "type": "text", "required": false}
    ]
  }',
  ARRAY['emergency lighting', 'emergency light', 'bs 5266', 'emergency luminaire'],
  ARRAY[],
  true,
  12
),
(
  'smoke_co_alarm_cert',
  'Smoke & CO Alarm Certificate',
  '{
    "fields": [
      {"key": "issue_date", "label": "Date of Test", "type": "date", "required": true},
      {"key": "expiry_date", "label": "Next Test Due", "type": "date", "required": true},
      {"key": "property_address", "label": "Property Address", "type": "address", "required": true},
      {"key": "engineer_name", "label": "Tester Name", "type": "text", "required": false},
      {"key": "smoke_alarms_count", "label": "Smoke Alarms Tested", "type": "number", "required": false},
      {"key": "co_alarms_count", "label": "CO Alarms Tested", "type": "number", "required": false},
      {"key": "result", "label": "Overall Result", "type": "text", "required": false}
    ]
  }',
  ARRAY['smoke alarm', 'carbon monoxide', 'co alarm', 'smoke detector', 'smoke and carbon monoxide'],
  ARRAY[],
  true,
  12
);
```

### RLS Policies

```sql
alter table public.document_processing_queue enable row level security;
alter table public.ai_extraction_templates enable row level security;

create policy "Authenticated access" on public.document_processing_queue for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated read" on public.ai_extraction_templates for select using (auth.uid() is not null);
```

---

## AI Processing Pipeline

The document processing pipeline has 4 stages. Each stage calls the Claude API separately to keep prompts focused and allow partial recovery on failure.

### Stage 1: Classification

**Input:** The uploaded document (PDF converted to images, or image file directly)

**Claude API prompt:**

```
You are a UK property compliance document classifier. Analyse this document and identify what type of compliance document it is.

Respond in JSON only, no other text:
{
  "document_type": "one of: gas_safety_certificate, epc, eicr, fire_risk_assessment, hmo_licence, selective_licence, buildings_insurance, landlord_liability_insurance, rent_guarantee_insurance, legionella_risk_assessment, asbestos_survey, pat_testing, emergency_lighting_cert, fire_alarm_cert, smoke_co_alarm_cert, furniture_fire_safety, other, unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of classification"
}
```

**After classification:**
- If confidence >= 0.80, proceed to Stage 2 automatically
- If confidence 0.50-0.79, proceed but flag for review
- If confidence < 0.50 or "unknown", set status = 'requires_review'

### Stage 2: Extraction

**Input:** The document + the extraction template for the detected document type

**Claude API prompt:**

```
You are a UK property document data extractor. This document has been classified as a {document_type} ({display_name}).

Extract the following fields from this document. Respond in JSON only:
{
  "fields": {
    "issue_date": "YYYY-MM-DD or null",
    "expiry_date": "YYYY-MM-DD or null",
    "certificate_number": "string or null",
    "property_address": "full address string or null",
    ... (all fields from extraction template)
  },
  "extraction_confidence": 0.0 to 1.0,
  "notes": "any important observations about the document"
}

For dates, convert to YYYY-MM-DD format. If the document shows a date like "15th February 2026", convert to "2026-02-15".
If a field cannot be found in the document, set it to null.
If the expiry date is not explicitly stated but an issue date and validity period are given, calculate the expiry date.
```

### Stage 3: Property Matching

**Input:** The extracted property_address field + the list of all property addresses in the system

**Logic (done in application code, not AI):**

1. Normalise the extracted address: lowercase, remove punctuation, standardise abbreviations (St → Street, Rd → Road, etc.)
2. Compare against all property addresses using fuzzy matching:
   - Exact postcode match: high confidence (0.90)
   - Exact first line + postcode: very high confidence (0.95)
   - Partial address match with Levenshtein distance: medium confidence (0.60-0.80)
   - No match found: set status = 'requires_review'
3. If multiple properties have the same or similar address, flag for manual selection

```typescript
// Property matching logic
function matchPropertyAddress(
  extractedAddress: string,
  properties: Array<{ id: string; address_line_1: string; postcode: string }>
): { propertyId: string; confidence: number; method: string } | null {

  const normalised = normaliseAddress(extractedAddress);

  // Extract postcode from the address string
  const postcodeMatch = normalised.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  const extractedPostcode = postcodeMatch ? postcodeMatch[0].replace(/\s+/g, '').toUpperCase() : null;

  for (const property of properties) {
    const propPostcode = property.postcode.replace(/\s+/g, '').toUpperCase();
    const propAddress = normaliseAddress(property.address_line_1);

    // Exact postcode + address line match
    if (extractedPostcode === propPostcode && normalised.includes(propAddress)) {
      return { propertyId: property.id, confidence: 0.95, method: 'exact_match' };
    }

    // Postcode match only
    if (extractedPostcode === propPostcode) {
      return { propertyId: property.id, confidence: 0.85, method: 'postcode_match' };
    }

    // Address line contains property address (without postcode)
    if (normalised.includes(propAddress) && propAddress.length > 5) {
      return { propertyId: property.id, confidence: 0.70, method: 'address_match' };
    }
  }

  return null;
}

function normaliseAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[,.\-]/g, ' ')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bclose\b/g, 'cl')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Stage 4: Validation & Filing

**Validation checks:**
- Issue date is a valid date and not in the future
- Expiry date is after issue date
- Expiry date minus issue date roughly matches the expected validity period (within 20% tolerance)
- Property match confidence >= 0.70
- Classification confidence >= 0.80
- All required fields (from extraction template) are non-null

**Validation errors** (block auto-filing):
- No property match
- Issue date in the future
- Expiry date before issue date
- Classification confidence < 0.50

**Validation warnings** (allow auto-filing but flag for review):
- Low confidence on any field
- Expiry period differs from expected
- Some required fields are null
- Property match confidence between 0.70-0.85

**Auto-filing criteria** (all must be true):
- Classification confidence >= 0.85
- Property match confidence >= 0.85
- No validation errors
- All required fields extracted

**Auto-filing action:**
1. Create a compliance_document record with ai_extracted = true and ai_confidence_score = extraction_confidence
2. If a current document of the same type exists for the property, supersede it
3. Upload the file to the compliance-documents storage bucket
4. Update the document_processing_queue status to 'completed' with filed_automatically = true
5. Auto-resolve any open compliance_task for this property + document type

---

## UI — Smart Upload

### Universal Drop Zone

Add a **universal document upload area** accessible from:
1. A prominent "Upload Documents" button on the Compliance Dashboard
2. The Property Detail page compliance section
3. A drag-and-drop zone on the main dashboard

**Drop Zone Design:**
- Large dashed-border area with icon and text: "Drop compliance documents here or click to browse"
- Accept: PDF, JPG, PNG, WEBP
- Multiple file upload supported
- Maximum 10 files per batch, 10MB per file

**Upload Flow:**

When files are dropped or selected:

1. Show each file as a card in an "Upload Queue" panel:
   - File name, file size, thumbnail preview (for images) or PDF icon
   - Status indicator: spinning = processing, checkmark = done, warning = needs review, X = failed
   - Progress bar showing current pipeline stage: Classifying → Extracting → Matching → Filing

2. For each file, start the pipeline asynchronously:
   - Create a document_processing_queue record with status = 'pending'
   - Begin Stage 1 (Classification)
   - Update the card in real-time as each stage completes

3. As each file completes processing, update the card to show:
   - **Auto-filed successfully**: Green card with checkmark. Show: document type detected, property matched, key fields extracted (issue date, expiry date). "View Document" link to the compliance detail.
   - **Needs review**: Amber card. Show: what was detected, what needs confirmation. "Review" button opens the review modal.
   - **Failed**: Red card. Show: error message. "Retry" button or "Upload Manually" fallback.

### AI Processing Status Display

For each file in the queue, show a multi-step progress indicator:

```
[✅ Classified: Gas Safety Certificate (95%)] → [✅ Extracted: 8/9 fields (92%)] → [✅ Matched: 14 High Street (95%)] → [✅ Filed]
```

Or if there is a problem at any stage:

```
[✅ Classified: EPC (88%)] → [✅ Extracted: 6/9 fields (78%)] → [⚠️ Property: 2 possible matches] → [⏸ Awaiting Review]
```

### Review Modal

When a document needs review (low confidence, multiple property matches, missing fields), clicking "Review" opens a modal:

**Document Preview:**
- Left side: the uploaded document (PDF viewer or image display)

**AI Results (right side):**

**Classification:**
- Detected type with confidence percentage
- Dropdown to override: "AI detected Gas Safety Certificate (88%). Is this correct?" [dropdown of all document types]

**Extracted Data:**
- Each field shown as an editable form field, pre-populated with AI-extracted values
- Confidence indicator per field: green >= 0.85, amber 0.60-0.84, red < 0.60
- Fields the AI could not extract shown as empty with red "Not found" label
- User can fill in or correct any field

**Property Match:**
- If matched: show matched property with confidence. "Is this correct?" Yes/No
- If multiple matches: show all candidates as radio buttons with confidence scores. User selects the correct one.
- If no match: show dropdown of all properties for manual selection
- "This is for a new property not yet in the system" option

**Validation Issues:**
- List any validation errors or warnings
- User confirms or corrects

**Actions:**
- "Approve & File" — creates the compliance document with corrected data, sets review_action = 'corrected' if changes were made or 'approved' if no changes
- "Reject" — marks as rejected, does not file. Asks for reason.
- "Save for Later" — keeps in queue as 'requires_review'

---

## UI — Processing Dashboard

Add an "AI Processing" sub-tab or section within the Compliance page:

### Queue Summary Stats

3 stat cards:
1. **Processed Today** — count of completed items today. Green.
2. **Awaiting Review** — count of requires_review items. Amber if > 0.
3. **Auto-File Rate** — percentage of documents auto-filed without review in last 30 days. Target: >80%. Shows AI accuracy trend.

### Processing History Table

Table showing document_processing_queue entries:

Columns:
- **File** (file name, clickable to view)
- **Detected Type** (document type with confidence badge)
- **Property** (matched property address with confidence badge)
- **Status** — badge: completed (green), requires_review (amber), failed (red), processing (blue spinning)
- **Filed** — "Auto" green badge if filed_automatically, "Manual" blue if reviewed, "—" if not filed
- **Processed** (relative time)
- **Actions**: Review (if requires_review), View Document (if filed)

Filters: Status, Document Type, Property, Date range

### AI Accuracy Metrics

A small analytics card showing:
- Classification accuracy: % of auto-classified documents that were not corrected during review
- Extraction accuracy: average extraction_confidence across all processed documents
- Auto-file rate: % filed without human intervention
- Most common correction: which field or classification is most often corrected (feeds back into prompt improvement)

---

## UI — Update Property Detail Compliance Section

Enhance the "Upload Document" button on the Property Detail page:

When uploading from a property context:
- Skip the property matching stage entirely (property is already known)
- Still run classification and extraction
- Auto-populate the property_id on the queue record
- Show the same real-time processing status as the universal upload

---

## UI — Settings: AI Configuration

Add an "AI Document Processing" section in Settings:

**API Key:**
- Anthropic API Key (password input, masked)
- "Test Connection" button — sends a minimal API call to verify the key works
- Status indicator: green "Connected" / red "Not Configured"

**Processing Preferences:**
- Auto-file threshold (confidence slider, default 0.85): "Documents above this confidence level will be filed automatically without review"
- Default AI model: dropdown showing "Claude Sonnet 4 (Recommended)" — allow future model selection
- Enable/disable auto-processing: toggle (default on). When off, all uploads go to manual review regardless of confidence.

**Cost Tracking:**
- Show total API tokens used this month
- Estimated cost based on Anthropic pricing
- Average tokens per document

---

## Supabase Edge Function — AI Document Processor

Create an Edge Function that handles the AI pipeline:

```typescript
// supabase/functions/process-document/index.ts

// This function:
// 1. Receives a document_processing_queue ID
// 2. Downloads the file from Supabase Storage
// 3. Sends to Claude API for classification
// 4. Sends to Claude API for extraction
// 5. Runs property matching
// 6. Runs validation
// 7. Auto-files if criteria met
// 8. Updates queue status throughout

// Key implementation notes:
// - For PDFs: convert to images before sending to Claude (Claude accepts images natively)
// - Use the ai_extraction_templates table to build extraction prompts dynamically
// - Store intermediate results in extracted_data JSONB field
// - Track tokens used for cost monitoring
// - Handle API errors gracefully with retry logic (max 2 retries)
```

**If Edge Functions are not available in Lovable**, implement the pipeline as a client-side async workflow:
1. Upload file to Supabase Storage
2. Create queue record
3. Call Claude API from the browser (less ideal but functional)
4. Update queue record at each stage
5. File the document when complete

The client-side approach works but means processing only happens when the user is on the page. Edge Functions allow background processing.

---

## Fallback: Manual Upload Still Available

The existing manual compliance document upload (from section 1.6) must remain fully functional. AI processing is an enhancement, not a replacement. If the AI fails, the operator can always:
1. Click "Upload Manually" from the failed queue item
2. This opens the standard upload form (property, document type, dates — all manual)
3. Pre-populates any fields the AI did manage to extract

---

## Design

- The real-time processing status is the showcase UX. Watching the AI classify, extract, match, and file a document in 5-10 seconds is the "wow" moment that sells the product. Make the progress steps animate smoothly and feel fast.
- The confidence badges must be honest. If the AI is only 60% sure, show 60% in amber. Users need to trust the system, and trust comes from transparency about uncertainty, not false confidence.
- The review modal with document preview on the left and editable fields on the right is the power-user interface. It should feel like a data entry accelerator — the AI did 90% of the work, the user just confirms or tweaks.
- Auto-file rate is the key metric for this feature. Below 70% and the AI is creating more review work than it saves. Above 85% and it is genuinely transformative. Track this and use it to improve prompts over time.
- The extraction templates table makes this system extensible without code changes. When a new document type needs to be supported, add a row to the table with the field definitions and keywords. No deployment needed.

## TypeScript

Generate types for: document_processing_queue, ai_extraction_templates. Create types for the AI pipeline stages: `ClassificationResult`, `ExtractionResult`, `PropertyMatchResult`, `ValidationResult`. Create a `ProcessingStatus` union type. Type the extraction template fields structure as `ExtractionField` and `ExtractionTemplate`.
