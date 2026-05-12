## Onboarding wizard end-to-end — audit (read-only)

**Headline finding:** §4.1 is **~100% already shipped**, third audit in a row to come back this way (RRB tracker, Bulk scanner, now Onboarding). Welcome overlay, activation checklist widget, first-run detection, and the wizard chain all exist on `/dashboard` today. Nothing to build.

---

### 1. Current state

**`Wizards.tsx`** (`src/pages/Wizards.tsx`, 64 lines): Hub page that lists the available wizards (`AddPropertyWizard`, `AddEntityWizard`, `AddComplianceWizard`) with launch CTAs — these wizards live as **dedicated routes** (`src/pages/AddPropertyWizard.tsx`, `AddComplianceWizard.tsx`, `AddEntityWizard.tsx`), not modals.

**`OnboardingWizard.tsx`** (`src/components/onboarding/OnboardingWizard.tsx`, 392 lines): The 6-step new-org wizard from memory `mem://auth/team-and-organization-management` — Welcome → AboutYou → Goals → Organization → FirstProperty → DemoData → Completion. Triggered from the post-signup flow, not from `/dashboard`.

**`useActivationChecklist`** (`src/hooks/useActivationChecklist.ts`, 131 lines): Tracks the live signal set used by the dashboard widget. Per memory `mem://features/dashboard-activation-checklist` — milestones include first property, invite teammate (marked complete on send), upload first compliance doc, etc.; permanently dismissible.

**`useGoLiveChecklist`** (`src/hooks/useGoLiveChecklist.ts`): Per-property "Go Live" checklist — different surface (mounted on PropertyDetail via `<GoLiveChecklist>`).

---

### 2. First-run wiring — **DONE**

Detection signal lives on **`profiles.welcome_seen_at`** (NULL → first-run). Driven by `useWelcomeOverlay` (`src/hooks/useWelcomeOverlay.ts`):
- `shouldShow = welcome_seen_at IS NULL`
- `markSeen()` on dismissal/completion writes timestamp
- `setBand(portfolio_size_band)` records `'1' | '2-5' | '6-20' | '21+'` for analytics segmentation

Signup flow → `OnboardingWizard` → `/dashboard`. On dashboard, `<WelcomeOverlay />` self-shows for users with NULL `welcome_seen_at`.

---

### 3. Dashboard activation widget — **DONE**

`<ActivationChecklist />` is mounted at `Dashboard.tsx:273` (one line below `<WelcomeOverlay />` at line 270). Behaviour:

- Hidden when `isLoading` or `dismissed === true`
- Shows progress bar (`completedCount/totalItems`), per-item rows with route deep-links ("Do this →")
- At 100% (`allRequiredComplete`) → swaps to a celebratory "Setup complete!" green card with `<PartyPopper>` icon
- Dismiss button (×) writes the dismissed flag → component returns null forever after

This **is** the persistent widget from §5.6 + §4.1. The Wave-2 ListState reference and §5.6 widget are the **same surface** — there is no second one to build.

---

### 4. Welcome overlay (§5.6 three-step) — **DONE**

`<WelcomeOverlay />` (`src/components/onboarding/WelcomeOverlay.tsx`, 351 lines) is a **4-step modal** (one more than the §5.6 spec, which is an improvement):

| Step | Content |
|---|---|
| 0 | Portfolio size band picker (`1` / `2-5` / `6-20` / `21+`) — writes to `profiles.portfolio_size_band` |
| 1 | First property — address-only quick capture (matches "we'll fill in the details" promise) |
| 2 | Upload a compliance certificate — accepts gas / EICR / EPC, AI classifies |
| 3 | "You're ready!" — points user at the activation checklist below |

Step counter at top (`Step N of 4`). Each step writes its own progress, so a user dropping off mid-flow resumes at the right step on next session via the same `welcome_seen_at` gate (until they hit step 3, which calls `markSeen`).

---

### 5. Ship sequence — **nothing required**

| Plan item | Status |
|---|---|
| (a) First-run detection + route wiring | Already shipped (`welcome_seen_at`, `useWelcomeOverlay`) |
| (b) Welcome overlay (3-step → actually 4-step) | Already shipped |
| (c) Persistent activation widget tracking to 100% | Already shipped (`<ActivationChecklist>`, `<PartyPopper>` at completion) |

**Optional polish candidates** (only if David wants them):

| # | Polish | Size |
|---|---|---|
| P1 | Telemetry: log time-from-signup → step-3-completion, surface in the §4.1 Activation funnel section already on AdminDashboard | Small |
| P2 | "Resume where you left off" toast on dashboard if user closed overlay mid-flow but step-3 not reached | Small |
| P3 | A/B test the portfolio-size question — currently mandatory; some users may bounce | Small |
| P4 | Localise step copy (currently uses curly apostrophes — UK English ✓ but no i18n layer yet — see Q4) | Medium |
| P5 | Add "Skip for now, I'll do this later" CTA on overlay step 1 (currently must complete to advance) — reduces drop-off | Small |
| P6 | Mark the activation widget non-dismissible until 50% complete (currently any user can × it on day one) | Small — STOP-and-ask |

---

### 6. Open product Qs — David's call

1. **Portfolio-size band granularity** — current bands `1 / 2-5 / 6-20 / 21+`. Confirm or shift (e.g. add `100+` for institutional)?
2. **10-minute path enforcement** — plan says "under 10 minutes". Should we measure (P1) and surface a "you took N minutes — tell others!" share moment, or just leave it as an internal SLO?
3. **Dismiss-before-100% policy** — should the activation widget block dismiss until at least property + first compliance done? Currently × always works (per §3 Hidden when dismissed).
4. **Welcome-overlay copy voice** — currently chatty ("How big is your portfolio?", "Just an address — we'll fill in the details", "Drop in a recent gas safety…"). Memory `mem://core` says "fintech-grade" tone — is this on-brand or too casual?
5. **Demo data step** — `OnboardingWizard.tsx` has a `DemoDataStep` (per `src/pages/.lovable/AE2_Demo_Data.md`). Should the Welcome Overlay also offer "Try with demo data first" so users without a real property can still hit step 2? Currently they must type a real address.
6. **Step-3 destination** — overlay closes and user lands on dashboard with `<ActivationChecklist>` at 50% (property + cert done). Is that the right "you're ready!" moment, or should we deep-link to the property detail page they just created so they see the value of the AI extraction?
7. **"Greeted by empty charts" framing** — the empty-state today is the activation widget (good). Confirm there are no other empty surfaces (charts on dashboard with `<NoDataState>`) that still feel desolate for first-run users? (Could audit separately.)

---

### Files referenced (no edits)

- `src/pages/Dashboard.tsx` (lines 270, 273 mount overlay + checklist)
- `src/components/onboarding/WelcomeOverlay.tsx` (351 lines, 4-step)
- `src/components/dashboard/ActivationChecklist.tsx` (108 lines)
- `src/hooks/useWelcomeOverlay.ts`
- `src/hooks/useActivationChecklist.ts` (131 lines)
- `src/hooks/useGoLiveChecklist.ts`
- `src/components/onboarding/OnboardingWizard.tsx` (392 lines, 6-step org wizard)
- `src/pages/Wizards.tsx` (64 lines, hub)
- `src/pages/AddPropertyWizard.tsx`, `AddComplianceWizard.tsx`, `AddEntityWizard.tsx` (full wizard routes)

**Recommendation:** Close §4.1 as Done. Pattern across this audit batch is that the plan document lags reality — worth a separate pass to mark §4.1 NOW items as ✅ Shipped so we stop re-scoping completed work. If David wants any single follow-up, P1 (telemetry) is the highest-leverage because it converts the existing flow into a measurable funnel against the already-live AdminDashboard activation tiles.
