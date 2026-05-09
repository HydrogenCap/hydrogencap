## share_classes §0b audit — STOP-and-ask triggered (case b)

Audit complete; **one of the three STOP triggers fired**: `useShareRegister.ts` is writing V2-shaped payloads to the V1 table. That's a real bug to fix (or rule on) before Ship A — answer the design question at the bottom and then the rest of the plan ships clean.

### Step 1 — Data characterisation

| Metric | Value | Notes |
|---|---|---|
| `share_classes` (V1) rows | **19** | Unchanged from #76 snapshot |
| `share_classes_v2` rows | **19** | Unchanged |
| Shared ids (V1 ∩ V2) | **0** | 100% disjoint, as #27 predicted |
| V1-only ids | 19 | All V1 rows |
| V2-only ids | 19 | All V2 rows |
| `migrated_from_v1` sentinel column on V1 | **absent** | No tenants-style migration trail; V2 was populated by an entirely separate pipeline |

Coincidence of 19/19 ≠ duplicate set (id-disjoint). Whether they're the **same logical share classes** for the same companies (just split across schemas) is a Q1-style dedupe question we have NOT yet answered for share_classes — see design question #1 below.

### Step 2 — Schema mapping (apples vs oranges)

| V1 `share_classes` (10 cols) | V2 `share_classes_v2` (14 cols) | Drift |
|---|---|---|
| `id`, `created_at`, `updated_at` | same | — |
| **`company_id`** → FK `companies` | **`entity_id`** → FK `legal_entities` | parent table changed (companies V1 → legal_entities V2) |
| `name` | `class_name` | renamed |
| `issued_shares`, `nominal_value`, `currency`, `is_primary` | same | — |
| `shares_confirmed` | — | **V1-only**: data-quality flag (used by `confirmShareCapital` mutation) |
| — | `voting_rights`, `dividend_rights`, `total_authorised`, `notes`, **`org_id`** | V2-only: rights model + direct org tenancy |

**No V2 schema gap blocks cutover** (so STOP trigger (a) does NOT fire). The only V1-only field, `shares_confirmed`, can be carried forward by adding a nullable column to V2 (1-line migration), or absorbed into V2's `notes`, or dropped if "confirmed" is no longer a workflow concept — see design question #2.

### Step 3 — Writers/readers (`from('share_classes')`)

10 hits across 3 hooks (matches #76):

| File | Lines | Schema used | Verdict |
|---|---|---|---|
| `src/hooks/useCompanies.ts` | 125, 207, 294, 314, 335 | **V1** (`company_id`, `name`, `shares_confirmed`) | Correct V1 caller — read + 3 writes (auto-create Ordinary on company create, create, update, confirm) |
| `src/hooks/useCompanyLookthrough.ts` | 82 | **V1** (`company_id`) | Read-only — feeds the legacy lookthrough that `useOwnershipData` already replaced |
| `src/hooks/useShareRegister.ts` | 103, 132, 150, 169 | **V2 schema** (`entity_id`, `class_name`) routed to **V1 table** | 🚨 **Schema-mismatched** — read filters on `entity_id` (which doesn't exist on V1) and write payload shape is V2-shaped |

**STOP-and-ask trigger (b) fires here**, but with a twist: it's not a double-writer in the classic sense — `useShareRegister` is a **single-target writer pointed at the wrong target**. Either:

- (i) it's currently silently broken (PostgREST will reject `.eq('entity_id', …)` against V1 with a 400 — which means UI features powered by `useShareRegister` are dead in prod today), OR
- (ii) it's a typo that was always meant to be `share_classes_v2` and the test coverage / UI path never exercised it, OR
- (iii) it's vestigial — the screen that powered it was retired, but the hook was left wired.

Easy verification: grep for `useShareRegister` consumers to see which UI surface calls it. (`useShareCapital` from `src/hooks/useShareCapital.ts`, included in the codebase context, is a separate hook that ALREADY targets `share_classes_v2` correctly — strongly suggests `useShareRegister` is duplicate/legacy code).

### Step 4 — pg_depend (RLS + functions + triggers)

- **0 inbound FKs** to `public.share_classes` ✅ clean drop on the FK side
- **0 functions** reference `share_classes` row type (per `pg_depend` scan) ✅
- **1 trigger**: `update_share_classes_updated_at` → `handle_updated_at()` (generic, drops with the table) ✅
- **4 own-table RLS policies** all share the same `EXISTS (SELECT 1 FROM companies c WHERE c.id = share_classes.company_id AND user_has_org_access(c.org_id))` shape (one each for SELECT/INSERT/UPDATE/DELETE):
  - `Users can view share classes in their org`
  - `Users can insert share classes in their org`
  - `Users can update share classes in their org`
  - `Users can delete share classes in their org`

These reference **`public.companies`** — the V1 of `legal_entities`, which is the **expected** parent (so STOP trigger (c) does NOT fire). `companies` is not on the §0b list this round, so we cannot "rewrite onto legal_entities" the way #73's tenant_portal cutover did — `companies` is still live.

**However**: because `companies` is staying for now, the existing RLS policies remain valid up until DROP, and they drop atomically with the V1 table. **The "PRECURSOR — rewrite RLS to JOIN legal_entities" ship from the prompt is therefore unnecessary** — the policies aren't blocking the drop, they're carried by it. (If `companies` were itself being cutover this round, the precursor would matter; it isn't.)

This is the same pattern as #85's compliance: the V1 RLS dies with the V1 table, no precursor required.

### Step 5 — Recommended ship sequence

| Ship | Action | Estimate | Notes |
|---|---|---|---|
| **A.5 (decision)** | David answers Q1 (dedupe vs union) + Q2 (`shares_confirmed` keep/drop) + Q3 (resolve `useShareRegister` mismatch) | — | Single decision prompt — mandatory before any code |
| **A** | Fix `useShareRegister` per Q3 verdict (delete-as-dead, OR repoint to `share_classes_v2`) | 1 prompt | If repointed it becomes a redundant-with-`useShareCapital` hook — likely dead-code path |
| **B (data)** | Backfill missing rows V1→V2 + carry `shares_confirmed` per Q2 | 1 prompt (or skipped if Q1 says V2 already covers all live companies) | Requires Q2 answer to know schema target |
| **B-schema** | (optional) Add `shares_confirmed boolean` to V2 if Q2 = keep | 1 prompt or 0 | Single nullable column |
| **C** | Repoint `useCompanies.ts` (5 refs) + `useCompanyLookthrough.ts` (1 ref) to V2; rename `name`→`class_name`, `company_id`→`entity_id` | 1 prompt | **Note**: this also requires repointing the parent lookups from `companies` to `legal_entities`, which is a separate scope — see open question #4 |
| **D** | Background functions check | 0 prompts | pg_depend confirms none |
| **PRECURSOR (RLS rewrite)** | ❌ NOT needed | 0 prompts | RLS drops with V1 table; `companies` parent stays |
| **E** | Install `v1_freeze_guard` on `public.share_classes` (per #85, not yet installed) | 1 prompt | Audited via `v1_freeze_violations` table from #88 |
| **F** | Drop `public.share_classes` + 4 RLS + 1 trigger | 1 prompt after soak | Clean — 0 FKs, 0 functions, only own triggers/policies |

**Total estimate: 4–6 prompts** (5 most likely: A.5 + A + maybe B + C + E + F), pending the dedupe answer and the `useShareRegister` verdict.

### Open design questions (for David — A.5 prompt should cover all four)

1. **Dedupe Q (Q1-style)**: Are V1's 19 rows and V2's 19 rows the same 19 logical share classes for the same 19 companies (just split across schemas), or are they two independent sets that need union (38 logical rows)? **Quick check**: do the same companies (matched by `companies.legal_name`↔`legal_entities.entity_name`) each have a primary share class in BOTH tables, or is it 1:1 across V1's `companies` set and V2's `legal_entities` set? Need a follow-up query.
2. **`shares_confirmed` Q**: V1 has it; V2 doesn't. Is "shares confirmed" still a meaningful workflow (the `useConfirmShareCapital` mutation exists) — keep it (add column to V2), drop it (workflow retired), or absorb it (treat all V2 rows as implicitly confirmed)?
3. **`useShareRegister` Q (the smoking gun)**: V2-shaped payloads going to V1 table. Three options: (i) **delete the hook** (`useShareCapital` already covers V2), (ii) repoint to `share_classes_v2` and keep both hooks (redundancy), (iii) merge into `useShareCapital`. Recommended: **delete** — `useShareCapital` is the canonical V2 hook and is already exported from the codebase.
4. **Parent table cutover Q**: `useCompanies.ts` and `useCompanyLookthrough.ts` query `companies` (V1) heavily. Repointing share_classes refs in these files to `share_classes_v2` (which uses `entity_id` → `legal_entities`) means the surrounding code also has to switch parent. Either (a) repoint the share_classes refs and leave `companies` calls alone (will work as long as the same id is in both tables — but per #76 they're disjoint so this WILL break), or (b) bundle a `companies → legal_entities` cutover into Ship C, ballooning it to ~3–5 prompts. **This is the biggest scope question** and may push share_classes out of §0b until `companies` is also ready.

### Headline

share_classes is **mostly clean** for cutover — no FKs, no function deps, V2 schema is a superset (minus `shares_confirmed`), V1 RLS dies with the table. The blocker is **not** the table itself; it's that the V1→V2 redirect of `useCompanies` / `useCompanyLookthrough` is **coupled to the parallel `companies → legal_entities` cutover**, which isn't on this round's §0b list. Plus the `useShareRegister` schema-mismatch needs a decision.

**Recommendation**: A.5 prompt first to lock Q1–Q4, then consider whether share_classes should ship in this §0b wave or be deferred until `companies` joins it.
