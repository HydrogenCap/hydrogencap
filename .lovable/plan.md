## Bulk Document Scanner v2 — audit (read-only)

**Headline finding:** §4.1 "Bulk document scanner v2" is **~100% already shipped**. Drag-folder ingress, filename auto-routing, and a single review queue are all live at `/bulk-upload`. Like the RRB tracker audit, this is verification — not a build.

---

### 1. Current state

**Route:** `/bulk-upload` (`src/App.tsx:642`, `ProtectedRoute`, lazy-loaded).

**Page** (`src/pages/BulkDocumentScanner.tsx`, 257 lines):
- Drop zone (react-dropzone) with **explicit "Upload folder" button** + hidden `<input webkitdirectory>` for OS folder picker
- Custom `getFilesFromEvent` intercepts native drops to walk folders via `dataTransfer.items.webkitGetAsEntry()` (recursive)
- Three-stage UX: **Queue → Processing (with progress %) → Summary → Review**
- Caps: 50 files, 10MB each; types: PDF, JPG, PNG, HEIC, DOCX
- Renders `BulkUploadQueue`, `BulkUploadSummary`, `BulkReviewQueue`

**Hook:** `useBulkDocumentUpload` (`src/hooks/useBulkDocumentUpload.ts`):
- Queue state with per-item status (queued/processing/extracted/failed)
- `addFiles`, `processAll`, `retryItem`, `removeItem`, `setPropertyForItem`, `clearQueue`
- Calls **`process-document-v2`** edge fn (523 lines — Gemini Vision pipeline)

**Folder walker:** `src/lib/documents/folderWalker.ts` (113 lines) — handles both `DataTransfer` (recursive entry walk) and `<input webkitdirectory>` paths.

---

### 2. Drag-folder support — **DONE**

Both ingress paths are live:

| Path | Implementation |
|---|---|
| Drag a folder onto drop zone | `walkDataTransfer(ev.dataTransfer)` in `getFilesFromEvent` (line 59-66) |
| Click "Upload folder" button | Hidden `<input webkitdirectory directory>` → `readInputFiles()` (line 75-83) |
| Drag flat files | react-dropzone default `onDrop` (line 38-40) |
| Click to browse files | react-dropzone `open()` |

Recursion handled. Validation + dedup + toast feedback inside `addFiles`. **No code lift needed.**

---

### 3. Filename auto-routing — **DONE**

- **Module:** `src/lib/documents/filenameClassifier.ts` (127 lines, tested in `__tests__/filenameClassifier.test.ts`)
- **When:** Runs **call-side, before the AI** — invoked at `useBulkDocumentUpload.ts:304` inside `addFiles` so every queued item has a `filenameHint: { category, confidence, reason }` immediately
- **Persisted:** Written to `documents.filename_category_hint` column at insert time (line 149) — AI hint stored separately as `ai_suggested_doc_type`
- **Rules:** Keyword-based, ordered specific→generic. Covers `gas-cert`/`cp12`, `eicr`/`electric`, `epc`, `fire-risk`/`fra`, `pat`, `legionella`/`lra`, plus more (file goes beyond first 60 lines viewed)
- **Reconciliation:** `BulkReviewQueue` displays both columns ("Filename hint" + "AI hint") and applies a 3-tier preference: confident-AI → filename → low-confidence-AI

So the `gas-cert-2026.pdf → gas_safety_certificate` example from the plan is the literal first rule in the file (confidence 0.92).

---

### 4. Single review queue — **DONE**

`BulkReviewQueue` (`src/components/documents/BulkReviewQueue.tsx`):
- Surfaces **after** processing completes (`isComplete && !isProcessing` triggers the summary card with a "Review N documents" CTA → flips `showReview=true`, hides queue+drop zone)
- Table view: filename, filename hint, AI hint, suggested property, confidence indicator, error hint
- "Confident" rows can be auto-accepted; low-confidence rows surface for manual fix
- Done → `clearQueue()` → navigate `/documents`

Inbox is **not** the review surface — this is a dedicated post-batch screen on the same page.

---

### 5. Ship sequence — **nothing required**

| Plan item | Status |
|---|---|
| (a) Drag-folder ingress | Already shipped |
| (b) Filename auto-routing | Already shipped (call-side, pre-AI, persisted to DB) |
| (c) Single review queue | Already shipped (`BulkReviewQueue`) |

**Remaining polish candidates** (only if David wants them — none implied by §4.1):

| # | Polish | Size |
|---|---|---|
| P1 | Lift the 50-file cap (the "drawer dump" might exceed 50). Needs server-side rate-limit review on `process-document-v2` | Medium — STOP-and-ask on rate limits |
| P2 | Auto-accept high-confidence rows on review-screen entry (currently user clicks through each) | Small |
| P3 | Add confidence badge column for the AI hint and a "skip and queue for manual classification" bulk action | Small |
| P4 | Expand filename rules — currently 7-ish core compliance categories; missing tenancy_agreement, mortgage_offer, valuation_report, insurance_policy | Small |
| P5 | Surface "drag a folder" affordance more prominently on Dashboard / empty-state Documents page (acquisition wedge per plan: "converts trial users") | Small |

---

### 6. Open product Qs — David's call

1. **50-file cap** — keep, raise to 100, or unlimited with chunked processing? The "dump my whole drawer" framing implies users will hit this on day one.
2. **Filename rule coverage** — extend beyond compliance to: tenancy AST/agreement, deposit certificate, mortgage offer, valuation, insurance schedule? Each adds 1 rule.
3. **Confidence threshold for auto-accept** — currently the review queue shows everything. Should rows where filename hint == AI hint AND property is suggested skip review entirely (auto-file)?
4. **Confidence-fail handling** — rows where AI extraction failed or both hints are null: keep in review with an "Unclassified" state? Drop into Inbox? Quarantine bucket?
5. **Property assignment** — auto-route by AI suggestion if confident, or always require user pick? Currently `setPropertyForItem` is manual.
6. **Discoverability** — `/bulk-upload` only reachable by URL today (no sidebar entry confirmed). Do we want a CTA on Dashboard / Documents empty state to drive trial conversions?
7. **Failure retries** — currently per-item via `retryItem`. Bulk "retry all failed" button worth adding?

---

### Files referenced (no edits)

- `src/pages/BulkDocumentScanner.tsx` (257 lines)
- `src/hooks/useBulkDocumentUpload.ts`
- `src/lib/documents/filenameClassifier.ts` (127 lines, tested)
- `src/lib/documents/folderWalker.ts` (113 lines)
- `src/components/documents/BulkUploadQueue.tsx`
- `src/components/documents/BulkUploadSummary.tsx`
- `src/components/documents/BulkReviewQueue.tsx`
- `supabase/functions/process-document-v2/index.ts` (523 lines)

**Recommendation:** No ship. If David wants to capitalise on the "trial conversion" framing, bundle P4 (rule expansion) + P5 (Dashboard CTA) + Q3 (auto-accept threshold) into one small follow-up. Otherwise close §4.1 as Done.
