
# Top 10 Gaps & Fixes

Prioritised from highest user-pain to nice-to-have. Each item lists the symptom, root cause area, and the fix.

## 1. Cold-start performance is brutal
- **Symptom**: Console shows TTFB 17s, FCP 28s, LCP 40s on first load. Users think the app is broken.
- **Cause**: Heavy initial bundle, eager Supabase auth calls, no skeleton on shell.
- **Fix**: Split the App.tsx route tree more aggressively (lazy ActivitySidebar, Sentry, jspdf, recharts); add a real shell skeleton; defer `useUnreadCount` and `useOnboardingStatus` until after first paint; preconnect Supabase in `index.html`.

## 2. Auth lock orphaning blocks every query for 5s
- **Symptom**: Repeated `"lock:sb-...auth-token" was not released within 5000ms` warnings; queries (onboarding, section visibility, subscription) all stall.
- **Cause**: StrictMode double-mount + multiple parallel `getSession()` calls.
- **Fix**: Centralise a single `useSession()` provider that calls `getSession` once, share via context — remove redundant `_getAccessToken` calls in the three hooks identified in the logs.

## 3. Compliance Inbox still has orphaned/failed docs with no triage UI
- **Symptom**: 27 docs stuck in `extraction_status=failed` from early April.
- **Fix**: Add a "Failed" tab to `/inbox` with per-doc Retry, Manual classify, and Delete actions; surface the extractor error message; nightly cron to auto-retry < 3 attempts.

## 4. "Confirm All" / bulk accept is fragile
- **Symptom**: Bulk accept silently no-ops when any one doc fails (missing property match, low confidence, etc.).
- **Fix**: Partial-success semantics — process per-doc, show a per-row result toast, keep failures in the list with the reason inline. Add a confidence threshold slider.

## 5. Bulk Upload → Inbox handoff is invisible
- **Symptom**: After bulk upload users don't know what happened; uploads don't appear in inbox without refresh (now partly fixed via realtime).
- **Fix**: Post-upload success screen with "View in Inbox (n)" CTA, live progress per file (queued → extracting → ready), and a persistent toast linking to inbox until acknowledged.

## 6. Missing-info / data-quality nudges are scattered
- **Symptom**: Dashboard widget, passport completeness, and property card all use different rules; users can't see one ranked list of "fix this next".
- **Fix**: Single `/data-quality` page that aggregates: missing mortgage, valuation, EPC, gas/EICR, ownership %, rent, tenancy end date — sorted by impact, click to deep-link into the right form.

## 7. Compliance status on property cards still inconsistent
- **Symptom**: Some cards show placeholder green/grey even when `compliance_matrix_v2` says expired (called out in `docs/product-excellence-roadmap.md`).
- **Fix**: Replace placeholder logic in `PropertyCard` with a single `usePropertyComplianceStatus(propertyId)` hook reading the V2 matrix; invalidate it on cert upload/delete.

## 8. Entity pages aren't operational yet
- **Symptom**: Legal entity page lists properties but not their value, debt, rent, cashflow, filing health — so it's a list not a management view.
- **Fix**: Reuse `usePortfolioKPIs` filtered by entity; add an entity-health strip (overdue accounts, missing CH number, ownership gaps).

## 9. Navigation drift: dead/duplicated links, mobile parity
- **Symptom**: Several routes exist but aren't in the sidebar (Inbox was the recent example); mobile bottom nav is missing key destinations; some sidebar groups expand to empty.
- **Fix**: Generate sidebar items from a single `navConfig.ts` shared by `AppSidebar` and `MobileBottomNav`; add a route-existence test in CI; remove section groups whose children are all hidden by `section_visibility`.

## 10. Error visibility is poor — silent failures everywhere
- **Symptom**: Failed extractions, failed edge functions, failed bulk actions all just… disappear. Same pattern that hid the Stert St gas cert.
- **Fix**: Standardise an `errors_log` table written by every edge function on catch; expose a "System Health" panel under Settings → Admin; ensure every mutation hook surfaces `onError` toast with a Copy Details button.

---

## Suggested ordering
1. Quick wins (1 day each): #1 preconnect + skeleton, #2 session provider, #9 navConfig dedup.
2. High-value (2-3 days): #3 Failed tab, #4 partial-success bulk accept, #10 errors log.
3. Strategic (1 week+): #6 unified data-quality page, #7 compliance status hook, #8 entity operating view, #5 upload handoff polish.

Tell me which of these you want me to start on and I'll write a focused implementation plan.
