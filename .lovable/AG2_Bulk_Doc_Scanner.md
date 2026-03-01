# AG2: Bulk Document Scanner — Upload, Classify & File

The `categorise-documents` edge function (763 lines) and `process-document` edge function already exist. This prompt builds the **bulk upload UI** — drag a folder of PDFs/images, AI classifies each one, user confirms, and they're filed to the correct property's compliance record.

## Bulk Upload Page

Create `src/pages/BulkUpload.tsx` with route `/bulk-upload` (lazy-loaded, protected):

### Upload Zone

Full-width dropzone at the top of the page:

```tsx
<div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
  <h3 className="text-lg font-semibold">Drop files here or click to browse</h3>
  <p className="text-sm text-muted-foreground mt-1">
    PDF, JPG, PNG — up to 50 files at once, 20MB per file
  </p>
  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" />
</div>
```

Accept: PDF, JPG, JPEG, PNG, WEBP. Max 50 files, max 20MB each.

### Processing Pipeline

When files are dropped:

1. **Upload to Supabase Storage** — upload each file to `compliance-documents/{org_id}/inbox/{filename}` (a temporary inbox folder)
2. **Show progress** — progress bar per file (uploading → classifying → done)
3. **Call `categorise-documents`** for each file — this edge function uses AI to detect the document type, extract key data (expiry dates, certificate numbers, addresses)
4. **Call `process-document`** if the categorisation returns a compliance type — this extracts structured data

### Classification Results Table

After processing, show a review table:

```
┌──────┬──────────────────────┬────────────────┬───────────────┬──────────┬──────────┬─────────┐
│ File │ Detected Type        │ Confidence     │ Property      │ Expiry   │ Cert #   │ Actions │
├──────┼──────────────────────┼────────────────┼───────────────┼──────────┼──────────┼─────────┤
│ 📄 scan001.pdf │ Gas Safety (CP12) │ ✅ High (92%) │ 14 High St ▼ │ 15/03/26 │ CP-4421  │ ✓ ✕    │
│ 📄 scan002.pdf │ EPC               │ ✅ High (88%) │ 8 Oak Rd ▼   │ 20/01/34 │ 0012-... │ ✓ ✕    │
│ 📄 IMG_3341.jpg│ Fire Risk Assess. │ ⚠️ Med (65%)  │ [Select] ▼   │ [Enter]  │ —        │ ✓ ✕    │
│ 📄 invoice.pdf │ ❓ Unknown        │ ❌ Low (30%)  │ [Select] ▼   │ —        │ —        │ ✓ ✕    │
└──────┴──────────────────────┴────────────────┴───────────────┴──────────┴──────────┴─────────┘
```

Each row is editable:

- **Detected Type** — dropdown to override AI classification (from `COMPLIANCE_DOC_TYPES`)
- **Confidence** — colour coded: green >80%, amber 50-80%, red <50%
- **Property** — dropdown of `properties_v2`, auto-matched if AI extracted an address
- **Expiry** — date picker, pre-filled if AI extracted a date
- **Cert #** — text input, pre-filled if AI extracted
- **Actions**: ✓ (accept/confirm) and ✕ (reject/skip)
- Click the filename to preview the document in a side panel or modal

### Property Matching

The AI may extract an address from the document. Try to auto-match:

```typescript
function matchPropertyByAddress(extractedAddress: string, properties: PropertyV2[]): PropertyV2 | null {
  // Fuzzy match: normalise postcodes, strip common words, compare
  // Match on postcode first (most reliable), then address line
  const normalised = extractedAddress.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
  
  return properties.find(p => {
    const propPostcode = p.postcode?.toLowerCase().replace(/\s/g, '') || '';
    const extractedPostcode = extractPostcode(normalised);
    if (propPostcode && extractedPostcode && propPostcode === extractedPostcode) return true;
    
    const propAddr = p.address_line_1.toLowerCase();
    return normalised.includes(propAddr) || propAddr.includes(normalised);
  }) || null;
}
```

### Bulk Confirm

"File All Confirmed Documents" button at the bottom:

For each confirmed row:
1. Move the file from `inbox/` to `compliance-documents/{org_id}/{property_id}/{doc_type}/{filename}`
2. Create a `compliance_documents_v2` record with:
   - `property_id`, `document_type`, `issue_date`, `expiry_date`, `certificate_number`
   - `file_path` pointing to the storage location
   - `status`: calculated from expiry date (valid/expiring_soon/expired)
3. If a `compliance_requirements_v2` record exists for this property+doc_type, link it
4. Show success toast: "Filed {N} documents to {M} properties"

### Rejected / Unknown Documents

Documents marked with ✕ or unmatched:
- Move to `compliance-documents/{org_id}/unfiled/` in storage
- Show in a separate "Unfiled" section at the bottom
- User can manually classify and file them later

## Scanner Hook

Create `src/hooks/useBulkDocScanner.ts`:

```typescript
interface ScannedDocument {
  file: File;
  storagePath: string;
  classification: {
    documentType: string | null;
    confidence: number;
    extractedData: {
      address?: string;
      postcode?: string;
      expiryDate?: string;
      issueDate?: string;
      certificateNumber?: string;
      rating?: string; // for EPCs
    };
  };
  matchedPropertyId: string | null;
  userOverrides: {
    documentType?: string;
    propertyId?: string;
    expiryDate?: string;
    certificateNumber?: string;
  };
  status: 'uploading' | 'classifying' | 'ready' | 'confirmed' | 'rejected' | 'filed' | 'error';
  error?: string;
}
```

## Entry Points

Add a "Bulk Upload" action in:
- Compliance page header: "Bulk Upload Certificates" button
- Property detail compliance tab: "Upload Multiple" button (pre-selects the property)
- Sidebar: add to Operations group with `FolderUp` icon

## Queue Processing

Process files in parallel with a concurrency limit of 3 (to avoid overwhelming the edge functions):

```typescript
async function processQueue(files: File[], concurrency = 3) {
  const queue = [...files];
  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      await uploadAndClassify(file);
    }
  });
  await Promise.all(workers);
}
```

## Do NOT

- Do NOT call the AI classification on non-document files (filter by file type first)
- Do NOT auto-file documents without user confirmation — always show the review table
- Do NOT delete uploaded files if classification fails — keep them in `inbox/` for manual review
- Do NOT modify the `categorise-documents` or `process-document` edge functions — use them as-is
- Do NOT process more than 50 files at once — show an error if the user tries
