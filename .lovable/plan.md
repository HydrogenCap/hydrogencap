# Compliance, rethought for portfolio landlords

You ticked every focus area and asked for a full rethink. I'm not going to ship 40 small tweaks — I'll consolidate the four current pages into one **Compliance Hub** and layer real workflow on top. Three phases, each shippable on its own.

The audit shows we currently have four loosely-connected surfaces:

```text
/compliance-v2        Matrix (the register)
/compliance-actions   Triage list of expired / missing
/compliance-tasks     Renewal pipeline kanban
/compliance-calendar  Month grid
```

A portfolio landlord ricochets between them and loses context. This plan collapses them into one navigable workspace with consistent state.

---

## Phase 1 — Unified Compliance Hub

Replace the four-page split with one `/compliance` route that contains four **view modes** sharing the same filter bar, search, and selection state.

```text
┌─ Compliance ────────────────────────────────────────────────────┐
│  Score 87%   12 issues   3 due this month   Next: EICR · 9 Jun  │
├──────────────────────────────────────────────────────────────────┤
│  [Today]  [Register]  [Calendar]  [Pipeline]   Filters · Search  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Active view renders here                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

- **Today** (new) — single prioritised list: "What needs doing in the next 14/30/60 days", grouped by property, with one-click actions (Upload · Mark not required · Snooze · Assign contractor). This is what a landlord opens first.
- **Register** — the existing matrix, kept, but with the "Why missing?" diagnostics we just built becoming the default cell behaviour.
- **Calendar** — the existing month grid, sharing the same filter chips.
- **Pipeline** — the existing renewals kanban, but each card links back to the property's Register row in one click.

Filter state (status, property type, search, entity) lives in the URL and persists across view switches.

Old routes (`/compliance-v2`, `/compliance-actions`, `/compliance-tasks`, `/compliance-calendar`) become 301 redirects to `/compliance?view=…` so nothing breaks.

## Phase 2 — Sharper Register + Property drill-down

The matrix is dense but flat. Improvements:

- **Property row header**: shows the property's compliance score, count of issues, and a one-tap "Open property compliance tab". Sticky on horizontal scroll.
- **Smart sort**: default sorts properties by *risk-weighted urgency* (expired > critical > expiring_soon × days_remaining, weighted by occupancy). Today's order is alphabetical-ish.
- **Inline cell actions**: hover/long-press a missing cell to surface *Upload · Why missing? · Mark not required · Snooze · Assign*. No round-trip to a modal for routine moves.
- **"Focus this month" pill**: filters to anything due, expiring, or already broken in the current calendar month. Plain-English, one click.
- **Bulk select**: tick multiple cells (e.g. "all EICRs expiring in Q3") → bulk assign to a contractor, bulk snooze, or bulk request quotes.

Per-property drill-down (`/properties/:id?tab=compliance`):

- Replace the current grid-of-cards with a **vertical timeline** showing every cert renewal, expiry, contractor visit, and document upload in chronological order. This is what an agent needs to answer "when did we last test the alarms?" in 2 seconds.
- Header strip: compliance score, next 3 expiries, current FRA/Gas/EICR status as traffic lights.

## Phase 3 — Real workflow (the part that's actually missing)

Right now compliance is a *record*. We make it a *system*.

- **One-click "Renew"**: from any matrix cell or Today row → opens a sheet that (a) picks a contractor from the saved address book, (b) drafts a work order with the right scope, (c) schedules the cert deadline, (d) sends the contractor a branded request email. The returned cert auto-files against the cell via the AI pipeline we already have.
- **Contractor address book** (new lightweight table): name, trade (Gas/Electrical/Fire/etc.), email, phone, certifications, properties they've worked on. Surfaces as "Suggested" when starting a renewal of a type they previously did.
- **Reminder cadence, per landlord preference**: a settings panel where they pick the reminder rhythm (default 60/30/14/7 days) and channel (email, in-app, both). Currently hardcoded.
- **Weekly digest upgrade**: the existing `send-weekly-compliance-email` becomes a real digest — *"5 due in next 30 days, 2 chased contractors awaiting reply, 1 cert filed this week"* — with deep links into the Hub views.
- **Tenant-facing receipts**: when a new Gas/EICR is filed, optionally surface a "Latest safety certificate" entry in the tenant portal so landlords get audit credit automatically.
- **"What does the law say?" sidecar**: every requirement type carries a one-paragraph plain-English explainer (HHSRS, Smoke & CO Regs 2022, Awaab's Law, etc.) with a "Why this matters" tooltip. Already half-done in `compliance_templates`; we expose it everywhere a status is shown.

---

## Out of scope (intentionally)

- Mobile native app — desktop and responsive web only.
- Contractor self-serve portal (logging in, uploading certs themselves) — punted to a later phase; v3 still goes via email + Inbox.
- Tenant compliance acknowledgements with e-signature.
- Local-authority licensing automation (HMO renewals submitted to councils).

## What I need from you before building

This is a **3-phase plan**. Each phase is independently shippable. I'd recommend doing Phase 1 + Phase 2 together (one design pass, mostly frontend), then Phase 3 separately because it needs new tables (contractor address book, reminder preferences) and edge function changes.

Reply with:
1. **Phases to build now** — all three, just 1+2, or only one of them.
2. **Anything to cut** from the bullets above (e.g. "skip the timeline", "no bulk select", "we don't want contractor emails sent for us").
3. **Anything missing** that you wanted included.

Once I have that, I'll move to build mode and implement the chosen scope without further questions.
