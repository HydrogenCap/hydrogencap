# Loans → Loan Facilities Reconciliation Audit — Report Plan

The read-only audit is complete. I'm in plan mode, so I can't write the deliverable (`docs/release/loans-reconciliation-plan-2026-05-02.md`) until you approve. Approving this plan flips to build mode and commits the report verbatim — **no src/, migration, or schema changes**.

## Headline findings (preview)

- **Pairing:** 23/24 V1↔V2 loans pair cleanly via address bridge; the lone outlier is "25 Arle Gardens" (likely a city-suffix drift, not real loss).
- **Data loss risk:** ~zero. V1-only columns (`notes`, `broker_name`, `broker_contact`, `payment_override_gbp`, `loan_term_months`, `refinance_target_date`) are populated 0/24. Only `term_years` (3/24) needs trivial conversion.
- **V1 writers still alive:** `useProperties.ts` (`useCreateLoan`/`useUpdateLoan`), `useBulkPropertyUpdate.ts`, `useBatchImport.ts`, `PropertyNew.tsx`, `PropertyEdit.tsx`, `MissingInfoPropertyRow.tsx`.
- **Edge functions still reading V1:** `financial-forecast`, `portfolio-chat/tool-executor` (×4), `generate-investor-report`, `analyse-acquisition`, `generate-ai-valuation`. All read-only — would silently go stale on freeze.
- **V2 already powers** `/dashboard`, `/lending`, `/refinancing`, `/properties-v2/:id`, V2 wizard, tax engine, P&L, ownership attribution, portfolio-api edge function.
- **RLS:** V1 uses property-join pattern; V2 uses direct `org_id` + shareholder role. No lockstep rewrite needed when V1 is dropped.
- **Freeze-guard:** `v1_freeze_guard()` trigger exists but is NOT attached to `loans` (Stage A skipped it). One-line ALTER once writers are redirected.
- **Verdict:** Closer to "freeze + drop" than reconciliation. V2 plumbing is already live; V1 is quasi-vestigial.

## Report structure (~10KB markdown, single file)

1. **Executive summary** — restates the §32 reframe + 6 surprises.
2. **§1 Schema diff** — column tables (8 shared / 13 renamed-equivalent / 7 V1-only / 15 V2-only), data-loss risk per V1-only column.
3. **§2 Per-row mapping** — strategy table (id 0%, triple 92%, balance+property 96%, property-only 96%); the single Arle Gardens outlier with both row IDs.
4. **§3 Consumer audit (src/)** — file:line table for V1 (9 sites) and V2 (35+ sites), categorised read/write/both.
5. **§4 Edge function audit** — V1 readers (5 funcs, 8 sites) + V2 readers (1 func, 3 sites).
6. **§5 RLS comparison** — V1's 4 property-join policies vs V2's 5 direct-org policies.
7. **§6 Freeze-guard status** — confirms `v1_freeze_guard` trigger is on `properties/rooms/tenants` only.
8. **§7 Build prompt sequence** — 5 follow-up prompts (A: backfill outlier, small / B: redirect hooks, medium / C: redirect edge functions, medium / D: attach freeze guard, small / E: drop `loans` after soak, small) + optional Prompt F to repeat the playbook for income/costs/tenancies.
9. **§8 Risk notes** — lender-name whitespace drift, V1 page reachability, MissingInfo lockstep requirement.

## What approving this plan does

- Switches to build mode.
- Writes `docs/release/loans-reconciliation-plan-2026-05-02.md` with the full audit content drafted above.
- **Does not** touch src/, supabase/migrations/, supabase/functions/, or types.ts.
- **Does not** run `npm run verify` (no code changed).
