# AI-suggested property_id triage — 2026-05-04

Read-only audit. Resolves the "~158 unconfirmed AI suggestions" callout from
Prompt #41. **Actual count is 5, not 158** — see §1. The smaller number changes
the recommendation; details below.

---

## 1. Data inventory

`documents.ai_suggested_property_id` is now FK → `properties_v2(id)` post-#41.
Confirmation is implicit: a document is **confirmed** when `documents.property_id`
is non-NULL (the user accepted via Inbox/ComplianceReviewCard). There is no
separate `ai_suggestion_confirmed_at` column — confirmation = `property_id IS NOT NULL`.

### Headline counts (live DB, 2026-05-04)

| Bucket | Rows |
|---|---|
| Total documents with an AI suggestion | **163** |
| ✅ Confirmed (user kept the suggestion) — `property_id = ai_suggested_property_id` | 156 |
| ✅ Confirmed-but-overridden (user picked a different property) | 2 |
| ⚠️ **Unconfirmed** — `property_id IS NULL` | **5** |

So Prompt #41's "~158 unconfirmed vs ~3 expected" was an inversion: 158 are
**confirmed** (the AI was right and users accepted), and only **5 are unconfirmed**.

### The 5 unconfirmed rows

All 5 belong to a single org (`e74ae9f0-…`) and were uploaded in a 3-day window:

| Doc id | File | Suggested on | Suggested property | `ai_property_confidence` | Model |
|---|---|---|---|---|---|
| `fae24951…` | 25 Arle Gardnens - Insurance.pdf | 2026-04-26 | 25 Arle Gardens | NULL | gemini-2.5-flash |
| `2a274297…` | 25 Arle Gardens - Fire Risk Assement.pdf | 2026-04-26 | 25 Arle Gardens | NULL | gemini-2.5-flash |
| `d982d87d…` | 25 Arle Gardens – Fire Alarm Certificate Feb 2026.pdf | 2026-04-26 | 25 Arle Gardens | NULL | gemini-2.5-flash |
| `8449adcd…` | 25 Arle Gardens – Gas Safety Certificate Feb 2026.pdf | 2026-04-26 | 25 Arle Gardens | NULL | gemini-2.5-flash |
| `ac7a6017…` | Gas_Certificate_Ref_68489259 (3).pdf | 2026-04-28 | 12 Thames Road, Cheltenham | NULL | gemini-2.5-flash |

By age: 4 rows from week of 2026-04-20, 1 row from week of 2026-04-27.

### Notable

- **Confidence is NULL on all 5.** These look like rows from the bulk
  re-upload pass that seeded suggestions without populating
  `ai_property_confidence`. The Inbox "high-confidence" filter
  (`>= 0.7`) silently excludes them from `Accept All`, which is why they've
  sat unconfirmed.
- 4 of the 5 are clearly correct on filename match alone (25 Arle Gardens).
- The 5th (12 Thames Road) is plausible from the gas-cert filename ref but
  needs human verification.
- All 5 are from one power user — not a systemic backfill issue across orgs.

---

## 2. Current Vault / Inbox behaviour

The "AI Document Vault" surface is `src/pages/Inbox.tsx`. Confirmed behaviour:

- Documents with a suggestion sit in `readyDocs` (extraction completed,
  review_status = `pending`).
- `highConfidenceDocs` filter gates `Accept All`:
  ```ts
  d.ai_suggested_doc_type
    && (d.ai_doc_type_confidence || 0) >= 0.7
    && d.ai_suggested_property_id
    && (d.ai_property_confidence || 0) >= 0.7
  ```
  → Because all 5 unconfirmed rows have NULL confidence, `(NULL || 0) = 0`,
  they fall **below** the threshold and are excluded from bulk-accept. They
  remain visible in the Inbox list and editable per-row via
  `ComplianceReviewCard`, which already renders an "AI suggested: <property>"
  chip with an inline property dropdown the user can accept or override
  (`ComplianceReviewCard.tsx:529`, `:248`).

So today's behaviour is closest to **option B** (per-doc Accept/Reject inline),
but bulk-accept is gated out for these 5 rows because they have no confidence
score. They are **not** silently treated as confirmed and **not** hidden;
they're just stuck in the per-row review lane forever.

---

## 3. Options

### Option A — Auto-clear (or downgrade) suggestions older than N days

Implementation: cron-style edge function (or a one-off SQL) that nullifies
`ai_suggested_property_id` on rows where `created_at < now() - interval 'N days'`
and `property_id IS NULL`. UI shows "expired suggestion — please pick a property
manually".

- **Cost**: Small (one edge function + 1 status badge in `ComplianceReviewCard`).
- **User-facing**: Suggestions silently disappear after N days; users have to
  classify from scratch. Loses the AI's work for the rare cold-storage case
  where the user *is* coming back to review.

### Option B — Inline Accept/Reject chip per document

Implementation: 95% already shipped (`ComplianceReviewCard` renders the chip
+ dropdown). The only gap is that the 5 NULL-confidence rows are excluded
from `Accept All`. Fix: change the gate to `(ai_property_confidence ?? 0) >= 0.7`
**OR** to "confidence ≥ 0.7 OR (NULL confidence AND filename starts with the
property's first token)".

- **Cost**: Tiny (one filter tweak in `Inbox.tsx`, optional badge that says
  "no confidence score — review manually").
- **User-facing**: 4 of the 5 stuck rows would be 1-click acceptable from the
  bulk action; the 5th remains a per-row review.

### Option C — Dedicated "Review queue" panel

Implementation: new section on the Inbox page (or a `/inbox/review` sub-route)
that lists every doc with `ai_suggested_property_id IS NOT NULL AND
property_id IS NULL`, sorted by age desc, with bulk Accept / Reject / Skip
buttons. Becomes the canonical home for AI-suggestion triage.

- **Cost**: Medium (new component, new query, new bulk handler that mirrors
  `acceptAllHighConfidence` but accepts arbitrary suggestions).
- **User-facing**: Clear "you have 5 documents waiting for AI-suggestion
  review" callout — solves the "stuck forever" problem and scales if the
  count balloons later.

### Option D — Leave alone, document the convention

Implementation: none. Update the audit/release doc to clarify that
`property_id IS NULL AND ai_suggested_property_id IS NOT NULL` is the canonical
"unreviewed AI suggestion" state and that these rows live in
`ComplianceReviewCard` per-row review.

- **Cost**: Zero.
- **User-facing**: No change. The 5 rows stay where they are; relies on the
  power user noticing them in the Inbox list.

---

## 4. Recommendation

Given the actual count is **5, not 158**, the right answer is the cheapest
that unblocks the immediate stuck rows and is robust if the count climbs:

### **B + (lightweight) C**

1. **B (5-min fix)**: change the high-confidence gate so NULL-confidence
   suggestions aren't silently excluded from Accept-All — gate on
   `ai_property_confidence ?? 0 >= 0.7` is wrong because it treats
   "no score" as "low score". Use `ai_property_confidence === null ||
   ai_property_confidence >= 0.7` and let the user eyeball them in the
   Accept-All confirm step. Alternatively, run a one-off backfill that
   re-scores those 5 rows.
2. **Lightweight C**: add a small "5 unreviewed AI suggestions" badge at the
   top of the Inbox page that filters the list to those rows when clicked.
   No new route, no new bulk handler — just an existing filter chip.

We do **not** recommend A (auto-clear) — destroying the AI's work because the
user hasn't reviewed yet is the wrong default for a property-management tool
where docs sometimes sit for weeks before someone gets to them.

We do **not** recommend full C (dedicated /review page) — premature for 5 rows
in 1 org. Revisit if a future audit finds the count > 50.

---

## DAVID DECISION

**5 documents (1 org, all uploaded 26–28 April) have AI-suggested property
links that no one has confirmed.** They're not lost — they sit in the Inbox
per-row review lane — but they're excluded from the "Accept All" bulk action
because their `ai_property_confidence` is NULL (not low, just unscored).

Please choose:

- **A** — auto-clear suggestions older than N days (destructive, scales the
  problem away by hiding it). Small cost.
- **B** — fix the bulk-accept filter to include NULL-confidence suggestions
  AND add a small "X unreviewed" badge (recommended). Tiny cost.
- **C** — build a full Review-Queue page (overkill for 5 rows but future-proofs
  if the count climbs). Medium cost.
- **D** — leave alone, document the convention that
  `property_id IS NULL AND ai_suggested_property_id IS NOT NULL` is the
  canonical "unreviewed" state. Zero cost.

Default if no decision in 7 days: **B**.

---

## #57 follow-up shipped 2026-05-04 (Option B + lightweight C)

David picked **B + lightweight C**. Implementation:

### Bulk-gate fix (Option B)
- Extracted the gate into a pure helper `src/lib/inboxBulkGate.ts` with
  `partitionReadyDocs()` returning **three** buckets:
  `highConfidence` (≥0.7 on both scores), `nullConfidence` (suggestion present
  but at least one score is NULL), `lowConfidence` (numeric score below 0.7).
- The 5 stuck rows used to fall into `(NULL || 0) >= 0.7 → false` and were
  silently lumped under "Needs review" with no path to bulk-accept. They now
  surface under a new **"Review manually before bulk-accept"** sub-header
  with a dedicated `Confirm & accept all unscored` button that opens an
  `AlertDialog` requiring explicit user confirmation. NULL-confidence rows
  are never accepted silently — both the header `Confirm All` button and the
  selected-row `Accept All` button only auto-process `highConfidence` rows.
- If a user's selection is **entirely** NULL-confidence, `handleBulkAccept`
  routes through the same explicit-confirm dialog instead of the toast
  rejection that #41 shipped.

### Unreviewed-AI chip (lightweight Option C)
- New header chip beside the existing "X pending" badge:
  `{count} unreviewed AI suggestions` driven by `countUnreviewedAISuggestions()`
  (semantics: `ai_suggested_property_id IS NOT NULL AND property_id IS NULL`,
  matching the audit's canonical query). Click toggles a page-level filter
  via `showUnreviewedOnly` that narrows all three sub-headers to those rows.
  No new route, no separate review page (full Option C deferred until count > 50).

### Tests
- `src/lib/__tests__/inboxBulkGate.test.ts` — 6 tests covering:
  high/null/low partitioning, mixed batch, NULL-confidence stuck-rows
  scenario surfaces in `nullConfidence` bucket, chip count semantics,
  `isUnreviewedAISuggestion()` helper.
- All 6 pass.

### Before / after
| | Before | After |
|---|---|---|
| Stuck unreviewed AI suggestions reachable from header bulk-accept | 0 of 5 | 5 of 5 (via explicit confirm) |
| Header chip surfacing the count | absent | "5 unreviewed AI suggestions" |
| NULL-confidence silently bulk-accepted | n/a (silently dropped) | never — explicit confirm required |

### Files changed
- `src/lib/inboxBulkGate.ts` (new)
- `src/lib/__tests__/inboxBulkGate.test.ts` (new)
- `src/pages/Inbox.tsx` (gate + chip + manual-review sub-header + confirm dialog)
- `docs/release/ai-suggested-property-id-triage-2026-05-04.md` (this section)

No schema changes, no migrations.
