

# Fix Document Processing Pipeline — Stuck Documents

## Problem
46 documents are stuck in `pending` (43) or `processing` (3) status because:
1. The `process-document-v2` edge function updates `document_extractions` but never writes back to the `documents` table
2. The frontend catch block doesn't mark failed documents in the DB
3. No cleanup mechanism exists for stuck documents

## Plan

### Step 1 — Fix `process-document-v2/index.ts` (edge function)
After line 364 (the `document_extractions` update), add a second update to the `documents` table:

```typescript
await supabase.from("documents").update({
  extraction_status: needsHumanReview ? 'needs_review' : 'completed',
  ai_suggested_doc_type: result.doc_type,
  ai_doc_type_confidence: result.doc_type_confidence,
  ai_suggested_property_id: extractedFields.property_id_match ?? null,
  extracted_address_text: extractedFields.address ?? null,
  extracted_issue_date: extractedFields.issue_date ?? null,
  extracted_reference_number: extractedFields.reference_number ?? null,
  expiry_date: extractedFields.expiry_date ?? null,
}).eq("id", document_id);
```

Also in the outer catch block (~line 398), mark the document as failed:

```typescript
// After logging the error, update the document status
if (typeof document_id === 'string') {
  await supabase.from("documents").update({ extraction_status: 'failed' }).eq("id", document_id);
}
```

Then redeploy the edge function.

### Step 2 — Fix `src/hooks/useBulkDocumentUpload.ts`
In the extraction catch block (line 230-236), add a DB update to mark the document as failed:

```typescript
await (supabase as any).from('documents').update({ extraction_status: 'failed' }).eq('id', docRecord.id);
```

### Step 3 — Clear stuck documents
Run a one-time SQL update to reset the 46 stuck documents:

```sql
UPDATE documents
SET extraction_status = 'failed'
WHERE extraction_status IN ('pending', 'processing')
  AND created_at < now() - interval '10 minutes';
```

## Files Changed
- `supabase/functions/process-document-v2/index.ts` — write-back to `documents` table on success and failure
- `src/hooks/useBulkDocumentUpload.ts` — mark document as failed in catch block
- One-time data fix via SQL insert tool

