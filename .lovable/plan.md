## Renters' Rights Bill tracker — audit (read-only)

**Headline finding:** The plan item is **~90% already shipped**. Scoring engine, DB view, portfolio hook, per-property hook, dashboard KPI tile, and a per-property readiness table all exist. The only genuine gap is a **per-property checklist surface** (the existing UI shows a portfolio table, not a 4–6 item checklist on a single property's page). No new tables or scoring engine work needed.

---

### 1. Current state — what's already built

**Page** (`src/pages/RentersRightsBill/index.tsx`, 33 lines, folder-module per #60d):
- `ReadinessSummaryCard` → wraps `RRBReadinessTable` (portfolio table: address, total /100 badge, 5 sub-score chips, missing-items popover, deep-link to `/properties-v2/:id`)
- `BillProvisionsCard`, `EvidenceLogCard`, `AwaaabComplaintsCard`, `DecentHomesChecklistCard` — Bill obligations, evidence storage (localStorage), AWAAAB complaints, decent-homes checklist
- State hook: `useRentersRightsBillState` (settings + localStorage-backed)

**Scoring engine** (`src/lib/rrb/score.ts`, pure function, tested):
5 sub-scores × 20 each, total /100:
1. **Tenancy terms** (proportional credit; penalises fixed-term-without-break)
2. **Deposit protection** (binary; needs scheme + reference on every active tenancy)
3. **Rent increases** (20 normal / 10 insufficient history / 0 if double-increase within 12mo)
4. **Compliance certs** (5 each: gas, EICR, EPC, fire/alarm — read from `compliance_matrix_v2`)
5. **HMO licence** (binary; only penalises if `is_hmo`)

**DB view:** `rrb_readiness_v` (migration 20260426091221) — server-side computed; `GRANT SELECT … TO authenticated`.

**Hooks** (`src/hooks/useRRBReadiness.ts`):
- `useRRBReadinessPortfolio()` → `{averageScore, propertiesBelow80, totalProperties, rows[]}`
- `useRRBReadinessProperty(id)` → row + recomputed `missingData[]` (re-runs `computeRRBScore` client-side off live `tenancy_agreements`, `rent_schedule`, `compliance_matrix_v2`, `properties_v2`)

**Dashboard KPI:** `RentersRightsBillKPI` already mounted on `Dashboard.tsx:344` — 72px progress ring, colour-banded (green ≥80, amber ≥60, red <60), subtitle "N properties below 80%", click→`/renters-rights`.

---

### 2. Readiness scoring inputs — coverage matrix

| Plan input | Source | Status |
|---|---|---|
| Open-ended tenancy migration status | `tenancy_agreements.is_periodic` + `tenancy_type` + `break_clause_date` (composed into `agreement_text`, regex'd in `isFixedTermWithoutBreak`) | ✅ Captured. Heuristic — see Q1 |
| Written terms presence | **Not directly scored.** Implied via tenancy_agreements row existing + `agreement_text` parsing | ⚠️ Gap — see Q2 |
| Deposit protection scheme record | `tenancy_agreements.deposit_scheme` + `deposit_reference` | ✅ Captured |
| Rent-increase cap compliance | `rent_schedule` rows grouped by tenancy; flags 2 amount changes <365 days apart | ✅ Captured. Note: this is a frequency check, not a CPI/% cap check — see Q3 |
| Required compliance certs | `compliance_matrix_v2` (V2 view, with `is_required` filter) | ✅ Captured |
| HMO licence | `properties_v2.is_hmo_licensed` + `hmo_licence_number` + `property_type` substring match | ✅ Captured. `licence_type_matches` defaulted true — see Q4 |

**Verdict:** All 4 plan inputs are already wired. No new capture columns needed unless we tighten any of Q1–Q4.

---

### 3. Portfolio "Bill readiness" KPI — placement

**Already placed** at `Dashboard.tsx:344`. Position appears to be in the secondary KPI strip (not adjacent to the Activation funnel section shipped today). Possible re-placements if David wants more prominence:

| Option | Pros | Cons |
|---|---|---|
| **Keep current** | Already live; users have it | Easy to miss next to other secondary tiles |
| Promote to Compliance row, beside Compliance Score | Topical proximity; comparison legible | Crowds the row |
| New "Regulatory Readiness" hero band (RRB + EPC C 2028 + Awaab) | Editorial weight; differentiator framing | Larger build; needs EPC-C and Awaab readiness scorers (don't exist) |

Recommendation: keep current unless David wants to merchandise it harder.

---

### 4. Automated checklist — gap

**The portfolio page has a sub-score chip table, not a checklist.** Per-property surface is currently just the deep-link target (`/properties-v2/:id`), which has no RRB tab/section.

Two ways to add the "automated 4–6 item checklist that auto-updates as compliance resolves":

| Option | Where | Build size |
|---|---|---|
| **C1** New `<RRBChecklistCard>` on PropertyDetailV2 (e.g. Compliance tab footer) — driven by `useRRBReadinessProperty(id).missingData` | Per-property | Small |
| **C2** Add a "Per-property drilldown" panel on `/renters-rights` itself with a property selector — same checklist component | Portfolio page | Small-medium |

`missingData[]` already returns human-readable items from the engine (e.g. "missing compliance certificate: gas", "missing deposit protection: tenancy <id>"). Auto-update is free — TanStack Query `staleTime: 5min`, invalidate on compliance/tenancy mutations (likely already invalidated for V2 matrix).

---

### 5. Ship sequence

| # | Prompt | Size | STOP-and-asks |
|---|---|---|---|
| **a** | Per-property RRB checklist card on PropertyDetailV2 (option C1) — wraps `useRRBReadinessProperty`, renders 5 sub-scores as checkboxes (✓ if score == max for that band) + `missingData` as remediation list with deep-links to compliance/tenancy/deposit forms | **Small** | None expected; component is a thin wrapper |
| **b** | (Optional) Polish: replace `missingData` strings with structured `{key, label, href, status}` objects in `score.ts` so the checklist can deep-link cleanly to the right form (e.g. tenancy id → `/tenancies/:id` for deposit fix) | **Medium** | Touches pure-function signature → bumps `score.test.ts` snapshots; verify chain risk. Worth doing once if C1 ships |
| **c** | (Optional) Re-place dashboard KPI per Q5 | **Small** | Only if David wants promotion |

(a) is the only actual gap closure. (b) and (c) are polish.

---

### 6. Open product Qs — David's call

1. **Tenancy migration status** — current heuristic regexes `agreement_text` for "fixed-term" without "break". The Bill abolishes ASTs entirely on commencement — should we instead score on `tenancy_agreements.tenancy_type = 'periodic_assured'` (or whatever the post-Bill enum is) and treat any AST as 0? Today an AST with a break clause scores 20.
2. **Written terms presence** — plan lists this as a separate input. Engine doesn't check it. Add a 6th sub-score (e.g. `agreement_document_id IS NOT NULL`)? Or fold into Tenancy Terms?
3. **Rent-increase cap** — engine flags **frequency** (>1 increase in 12mo). The Bill's actual rule is once-per-12-months **and** capped at market rate (Section 13 process). Do we want to:
   - keep frequency-only (current),
   - add a market-rate cap check (needs comparable rent data per property), or
   - just flag any increase that doesn't follow Section 13 notice (needs notice tracking we don't have)?
4. **HMO `licence_type_matches`** — hardcoded `true` in the hook. Should we score down if licence type ≠ property type (mandatory vs additional vs selective)? Needs new column on `properties_v2`.
5. **Score weighting** — currently flat 20-each. Bill-criticality varies (deposit protection = statutory penalty up to 3× deposit; HMO no-licence = unlimited fine; tenancy migration = future-state only). Re-weight or keep flat? E.g. 25/25/15/20/15.
6. **Threshold bands** — green ≥80, amber ≥60, red <60. Confirm or shift (RRB consequences are severe → maybe green ≥90).
7. **Dashboard placement** — keep current secondary slot or promote (§3)?

**Recommendation:** ship (a) as-is on current scoring; tackle Qs 1–5 as a single follow-up "scoring v2" once David has answered. Don't churn the engine twice.

---

### Files that would change in ship (a)

- New: `src/components/rrb/RRBPropertyChecklistCard.tsx` (~80 lines)
- Edit: `src/pages/PropertyDetail/…` (mount card on Compliance tab — 1 import + 1 JSX line)
- New: `src/components/rrb/__tests__/RRBPropertyChecklistCard.test.tsx`
- No DB, no hook, no engine changes.

**No STOP-and-ask on the #60d structural assumption** — the folder module is intact and matches what the plan implied.
