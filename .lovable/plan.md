
# NULL-confidence AI suggestion triage — 2026-05-08

Read-only follow-up to `docs/release/ai-suggested-property-id-triage-2026-05-04.md`.
**No data changed.**

## 1. Where the trapdoor lives (confirmed)

- **Table**: `public.documents` (no separate `ai_property_suggestions` table — suggestions live as columns on `documents`).
- **Suggestion columns**: `ai_suggested_property_id`, `ai_property_confidence`, `ai_suggested_doc_type`, `ai_doc_type_confidence`.
- **Confirmation semantics**: a suggestion is confirmed when `documents.property_id IS NOT NULL`; unreviewed = `ai_suggested_property_id IS NOT NULL AND property_id IS NULL`.
- **Trapdoor logic**: `src/lib/inboxBulkGate.ts → partitionReadyDocs()`, called from `src/pages/Inbox.tsx`. NULL on either confidence routes the row to the `nullConfidence` bucket — visible in the Inbox under "Review manually before bulk-accept", excluded from silent Accept-All, requires explicit confirm dialog.
- **Live count today**: still **5** rows match (`ai_suggested_property_id IS NOT NULL AND property_id IS NULL`), all `ai_property_confidence IS NULL`, all `review_status = 'pending'`, all `gemini-2.5-flash`. Same set as the 2026-05-04 audit — none cleared since.

## 2. The 5 stuck rows (sorted by created_at asc)

| # | id | created (UTC) | doc (original_file_name) | target_field | suggested_value (property) | property context (extracted_address_text → address_line_1, postcode) | likely reason NULL | recommended action |
|---|---|---|---|---|---|---|---|---|
| 1 | `fae24951-9e46-4066-9b34-0adb5627df67` | 2026-04-26 23:13:03 | `25 Arle Gardnens - Insurance.pdf` (typo "Gardnens") | `documents.property_id` (← `ai_suggested_property_id`) + `doc_type` (suggested `building_insurance`, conf 0.99) | `f4938519-8091-4644-ac3b-a021e6d67b8d` — 25 Arle Gardens | extracted: "25 Arle Gardens, Cheltenham" → DB: 25 Arle Gardens, GL51 8HP — exact match | Filename typo + bulk re-upload pass that seeded `ai_suggested_property_id` without scoring (see audit §1 "Notable"). Doc-type confidence populated, property confidence skipped — same code path on all 4 same-second-batch rows. | **Approve to `f4938519…` (25 Arle Gardens)** — extracted address matches DB exactly. |
| 2 | `2a274297-c909-48ac-ad94-cd73f3cf0000` | 2026-04-26 23:13:04 | `25 Arle Gardens - Fire Risk Assement.pdf` | `property_id` + `doc_type` (`fire_risk_assessment`, conf 1.00) | `f4938519…` — 25 Arle Gardens | extracted: "25 Arle Gardens, Cheltenham" → 25 Arle Gardens, GL51 8HP — exact match | Same bulk re-upload batch (4 rows in 5s window), confidence not populated. | **Approve to `f4938519…`**. |
| 3 | `d982d87d-d086-4fc2-ba11-bda6f5cd1408` | 2026-04-26 23:13:06 | `25 Arle Gardens – Fire Alarm Certificate Feb 2026.pdf` | `property_id` + `doc_type` (`fire_alarm_certificate`, conf 0.99) | `f4938519…` — 25 Arle Gardens | extracted: "25 Arle Gardens, Cheltenham, Gloucestershire" → 25 Arle Gardens, GL51 8HP — exact match | Same bulk re-upload batch. | **Approve to `f4938519…`**. |
| 4 | `8449adcd-6a1b-4937-abd5-9668f95dc86e` | 2026-04-26 23:13:08 | `25 Arle Gardens – Gas Safety Certificate Feb 2026.pdf` | `property_id` + `doc_type` (`gas_safety_certificate`, conf 1.00) | `f4938519…` — 25 Arle Gardens | extracted: "25 Arle Gardens\nCheltenham" → 25 Arle Gardens, GL51 8HP — exact match | Same bulk re-upload batch. | **Approve to `f4938519…`**. |
| 5 | `ac7a6017-5fc1-4cb6-a285-ea7422ccd92f` | 2026-04-28 23:18:39 | `Gas_Certificate_Ref_68489259 (3).pdf` (opaque filename) | `property_id` + `doc_type` (`gas_safety_certificate`, conf 0.99) | `bb3cef38-6090-4eac-a6f8-05a6a1d82888` — 12 Thames Road, Cheltenham | extracted: "12 Thames Road\nCheltenham" → 12 Thames Road, Cheltenham, GL52 5PT — exact match | Different upload session 2 days later; same NULL-confidence path. Filename gives no address signal — match relies solely on extracted body text. | **Leave for human eyeball**, then Approve to `bb3cef38…` if the PDF body confirms 12 Thames Road. Address match is exact, so default action is approve. |

## 3. Summary

- **All 5 rows are still trapped** (no auto-clearing has happened since 2026-05-04).
- **All 5 have `ai_property_confidence IS NULL`** — confirms #57b's read that this is the bulk re-upload path that populated `ai_suggested_property_id` + `ai_doc_type_confidence` but never wrote `ai_property_confidence`. The 4 same-second rows on 2026-04-26 are clearly one batch; the 2026-04-28 row is a separate single upload.
- **All 5 have `extracted_address_text` that exactly matches `properties_v2.address_line_1` for the suggested property** — the AI's suggestions look correct on paper. Rows 1–4 also match on filename. Row 5 is filename-opaque but body-text-clean.
- **Recommended disposition**: approve all 5 to the suggested property. No rejections needed. Row 5 deserves a quick human glance at the PDF before approval but the address signal is unambiguous.
- **No code or data changes are part of this plan** — David triages per-row in the Inbox using the existing `ComplianceReviewCard` dropdown + the "Confirm & accept all unscored" button #57b shipped.

## 4. STOP-and-ask check

The trapdoor is exactly where #57b's audit said it was (`src/lib/inboxBulkGate.ts` + `src/pages/Inbox.tsx`, gating on NULL `ai_*_confidence`), and the 5-row set is unchanged. Nothing to escalate.
