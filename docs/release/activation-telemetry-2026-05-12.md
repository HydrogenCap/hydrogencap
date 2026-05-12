# Activation telemetry shipped — 2026-05-12

Plan §4.1 — surface existing onboarding signals as ops metrics on the Platform
Admin dashboard. No new tables, no schema changes, RLS-bypass via existing
service-role admin client (gated by `super_admin` platform role check).

## Queries

All run service-side in `supabase/functions/admin-stats` under the
`activation_funnel` action. Computed in JS after a single round-trip per table.

```text
firsts(o) = MIN(child.created_at) per organization_id
delta_hours = (firsts.first_X - org.created_at) / 3600 seconds

stage(X) = {
  count       = orgs with X recorded,
  median_hours = p50 of delta_hours,
  p75_hours    = p75 of delta_hours,
}
```

Three child sources (all gated by `org_id` denormalisation, so a single
service-role select per table is sufficient):

- **first_property** → `MIN(properties_v2.created_at) WHERE org_id = o.id`
- **first_cert** → `MIN(compliance_documents_v2.created_at) WHERE org_id = o.id`
- **first_payment** → `MIN(rent_payments.created_at) WHERE org_id = o.id`

Funnel counters: `signed_up = count(orgs)`, `has_X = orgs with at least one X`.

## UI

New section on `/admin` between "Charts Row" and "All Users" table:

1. **3 KPI tiles** — median time-to-first-X with p75 sub-line and conversion
   `count/total (pct%)`. Format: minutes (`<1h`), hours (`<48h`), or days.
2. **Stacked progress bars** — 4 horizontal bars (Signed up / 1+ property /
   1+ certificate / 1+ payment), each scaled against `signed_up` so the
   stage-by-stage drop-off is visible at a glance.

Skeleton shown while `useActivationFunnel` is in flight.

## Intended use

Operator metrics **before scaling acquisition spend**:

- If `time → first property` median > 24h, onboarding wizard is leaking.
- If `signed_up → has_property` drop > 40%, first-run nudges underperforming.
- If `has_property → has_cert` drop > 60%, compliance UX is too friction-heavy.
- If `has_cert → has_payment` drop > 50%, payment activation flow needs work.

Track weekly. Revisit `dashboard-activation-checklist` thresholds against
these medians; consider in-app nudges when an org sits in `signed_up` >7 days.

## Files changed

- `supabase/functions/admin-stats/index.ts` — added `activation_funnel` action + `getActivationFunnel()` + `pctile()` helper.
- `src/hooks/useActivationFunnel.ts` — new hook + `fetchActivationFunnel` + `ActivationFunnelData`/`ActivationStage` types.
- `src/pages/admin/AdminDashboard.tsx` — new `ActivationFunnelSection` + `ActivationKPI` + `formatDuration` components.
- `src/__tests__/useActivationFunnel.test.ts` — vitest with mocked `supabase.functions.invoke` (3 cases: shape, error, empty).
