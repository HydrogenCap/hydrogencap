# HydrogenCap — Product Audit, QA Report & Roadmap

**Date:** 11 February 2026
**Auditor:** Senior Product Engineer / QA Lead / UX Reviewer
**Codebase:** ~88,800 lines TypeScript/React across 48 pages, 70+ hooks, 27 edge functions
**Stack:** React 18 + TypeScript, Supabase (Postgres + Auth + Storage + Edge Functions), TanStack Query, Tailwind CSS, shadcn/ui, Lovable.dev deployment

---

## Key User Journeys Identified

1. **Auth → Dashboard** — Sign up / sign in, land on portfolio overview with KPIs
2. **Property CRUD** — Add property → edit details → view detail page → delete
3. **Compliance lifecycle** — Track certificates → get alerts on expiry → upload renewal → auto-create jobs
4. **Rent collection** — Generate monthly schedule → record payments → chase arrears → export
5. **Tenant management** — Add tenant → create tenancy → assign to room → manage documents
6. **Job management** — Create job from compliance expiry → assign contractor → track to completion
7. **Document management** — Upload → categorise → view inline → share via link
8. **Ownership & companies** — Map SPV structures → beneficial ownership → shareholder attribution
9. **Reporting** — Generate bank presentation pack → export PDF → share
10. **Shareholder portal** — Invite shareholder → they accept → view limited portfolio data
11. **Import** — CSV/passport import → map fields → bulk create/update

---

## 5 Biggest Risks to Launch

| # | Risk | Impact | Likelihood |
|---|------|--------|------------|
| 1 | **Edge functions with `verify_jwt = false` and service-role keys** — 27 functions bypass JWT verification and use service-role keys internally. If any has an auth bypass bug, an attacker gets full DB access. | Critical | Medium |
| 2 | **No session expiry handling** — No `TOKEN_REFRESHED` or `SIGNED_OUT` event listeners. If token expires mid-session, all mutations silently fail with 401s that aren't surfaced to the user. | High | High |
| 3 | **PDF viewer broken** — Core document viewing feature doesn't work (confirmed by screenshot). Users can't verify uploaded compliance certificates. | High | Confirmed |
| 4 | **6-character password minimum** — Below OWASP minimum (8 chars). No complexity requirements. Financial data behind weak passwords. | High | High |
| 5 | **No test coverage** — 3 test files (2 unit tests + 1 example). 88,800 lines of untested code. Any refactor risks regression. | High | Certain |

---

## A) Executive Summary

### What's Working

The application has an impressive breadth of functionality for a prototype. The core data model is sound — properties, companies, loans, income, costs, compliance items, tenancies, and rooms are all well-structured with proper foreign keys. RLS is enabled on all 70 tables, which is a strong foundation. The dashboard is data-rich with KPIs, maps, and drill-down widgets. Lazy loading across all 48 pages keeps initial bundle size manageable. The shareholder portal with separate auth guard is a genuinely differentiated feature. The Go-Live Checklist per property is an excellent onboarding pattern.

### What's Broken

PDF document viewer fails to render (Supabase `Content-Disposition: attachment` headers). Compliance, Inbox, and Calendar are buried in a collapsible sidebar submenu despite being mission-critical. The Rent Collection page shows arrears but offers no bulk actions to act on them. The Refinance Calendar duplicates data already in the Compliance Calendar.

### What's Risky

All 27 edge functions set `verify_jwt = false` in `config.toml` with a comment saying auth is done "in code". Functions like `auto-send-rent-reminders` and `create-compliance-jobs` use service-role keys with `CORS: *` — if there's any path that skips auth validation, the entire database is exposed. Password policy is only 6 characters with no complexity. No session refresh handling means expired tokens cause silent failures. Many insert operations across hooks don't set `org_id`, relying entirely on RLS — but if a policy has a gap, data leaks between organisations.

### What's Missing

No automated tests beyond 2 unit tests. Zero offline handling. No session expiry UX. No rate limiting on client-side API calls. Only 3 aria-labels across all pages (severe accessibility gap). No GDPR/privacy pages. No audit trail export. No billing/subscription system for SaaS launch. No onboarding wizard for new users.

### Top 10 Highest-Impact Fixes

| # | Fix | Category | Effort |
|---|-----|----------|--------|
| 1 | Fix PDF viewer with blob-based rendering | Bug | S |
| 2 | Add session expiry detection + re-auth prompt | Security | S |
| 3 | Strengthen password policy to 8+ chars with complexity | Security | S |
| 4 | Audit all edge functions for auth bypass paths | Security | M |
| 5 | Flatten sidebar — promote Compliance/Inbox/Calendar | UX | S |
| 6 | Add rent bulk actions (mark paid, send reminders) | UX | M |
| 7 | Merge Refinance Calendar into Operations Calendar | UX | S |
| 8 | Add dashboard calendar widget | UX | S |
| 9 | Add ErrorBoundary to all pages (not just Dashboard widgets) | Stability | S |
| 10 | Add E2E test suite for critical paths | Quality | L |

---

## B) QA + Debug Report

### BUG-001: PDF Viewer Renders Blank

- **Severity:** Critical
- **Where:** `DocumentViewerModal.tsx` (compliance docs), `DocumentViewer.tsx` (general docs), `SharedDocument.tsx` (public share)
- **Steps to reproduce:** Upload any PDF compliance certificate → Click "View" button → Modal opens → PDF area shows grey/blank with document icon
- **Expected:** PDF renders inline in the iframe
- **Actual:** Blank grey area, no PDF content visible
- **Root cause:** `<iframe src={signedUrl}>` fails because Supabase signed URLs return `Content-Disposition: attachment` header, which forces download rather than inline rendering. Additionally, the DB stores `file_type` as `pdf` (not `application/pdf`), so MIME type detection fails.
- **Fix plan:** Create shared `usePdfBlobUrl` hook that fetches the PDF, wraps it in `new Blob([data], { type: 'application/pdf' })`, and creates a `blob:` URL for the iframe. Apply to all 3 viewer components. Full spec already produced: `hydrogencap-fix-pdf-viewer.md`.
- **Acceptance criteria:** PDF compliance certificates render inline in the modal viewer. The loading spinner shows during fetch. If fetch fails, a "Download Instead" fallback button appears.

### BUG-002: Silent Auth Failures on Token Expiry

- **Severity:** Critical
- **Where:** All mutation hooks, entire application
- **Steps to reproduce:** Log in → Leave tab open for >1 hour (token expires) → Try to record a payment or update a property → Mutation fails silently or shows generic error
- **Expected:** User is prompted to re-authenticate, or token is refreshed automatically
- **Actual:** `autoRefreshToken: true` is set on the Supabase client, but there are zero `onAuthStateChange` event handlers that respond to `SIGNED_OUT` or `TOKEN_REFRESHED` events with user-facing behaviour. The `AuthContext` sets state but doesn't handle edge cases like refresh failure.
- **Root cause:** `AuthContext.tsx` listens to `onAuthStateChange` only for setting `user` state. No global error interceptor catches 401 responses to show a re-auth prompt.
- **Fix plan:** Add a global query error handler to `QueryClient` that detects 401/403 errors and triggers a re-auth modal. Add an `onAuthStateChange` handler for `SIGNED_OUT` that redirects to `/auth`.
- **Acceptance criteria:** When a session expires, the user sees a modal saying "Your session has expired — please sign in again" with a button. No data loss occurs.

### BUG-003: Compliance Items Buried in Sidebar

- **Severity:** Major
- **Where:** `AppSidebar.tsx` — Compliance collapsible under Operations
- **Steps to reproduce:** Look at sidebar → Compliance Register, Inbox, and Calendar are hidden inside a collapsible that defaults to closed
- **Expected:** Mission-critical compliance links are immediately visible
- **Actual:** User must click "Compliance" to expand, then click the specific sub-item. The 🔴 70 badge on the collapsible parent doesn't tell you where the issues are.
- **Root cause:** Navigation designed with hierarchy that doesn't match usage priority.
- **Fix plan:** Flatten to 3 top-level items in Operations: Compliance, Inbox, Calendar — each with their own badge. Full spec: `hydrogencap-sidebar-dashboard-calendar.md`.
- **Acceptance criteria:** All 3 links visible without clicking to expand. Each has independent badge count.

### BUG-004: Rent Collection Page Not Actionable

- **Severity:** Major
- **Where:** `RentCollection.tsx`
- **Steps to reproduce:** Navigate to Rent → See list of 29+ tenant rent items → Try to mark multiple as paid → No selection mechanism exists
- **Expected:** Checkboxes, select all, bulk mark as paid
- **Actual:** Each payment must be recorded individually via a dialog — 30-50 clicks on rent day
- **Root cause:** Feature not yet built.
- **Fix plan:** Add selection state, floating bulk toolbar, 6 bulk actions. Full spec: `hydrogencap-rent-bulk-actions.md`.
- **Acceptance criteria:** Can select all "Due" items with one click, then "Mark Paid" in a single action with confirmation dialog.

### BUG-005: Refinance Calendar Duplicates Compliance Calendar

- **Severity:** Minor
- **Where:** `RefinanceCalendar.tsx` (17KB), linked from Intelligence sidebar
- **Steps to reproduce:** Navigate to Intelligence → Refinance → See mortgage events. Navigate to Operations → Compliance → Calendar → See same mortgage events.
- **Expected:** Single unified calendar
- **Actual:** Two separate pages showing overlapping data with different UIs
- **Root cause:** Built as separate features at different times.
- **Fix plan:** Add refinance targets to `useCalendarEvents`, redirect `/refinance-calendar` → `/compliance-calendar`, delete `RefinanceCalendar.tsx`. Covered in `hydrogencap-sidebar-dashboard-calendar.md`.
- **Acceptance criteria:** `/refinance-calendar` redirects. All mortgage events appear in the unified calendar. Sidebar has no "Refinance" link under Intelligence.

### BUG-006: SharedDocument Page Exposes PDF Directly

- **Severity:** Major
- **Where:** `SharedDocument.tsx` line 183
- **Steps to reproduce:** Share a compliance document via link → Open link → Download button links directly to `document.file_url` (Supabase storage URL)
- **Expected:** Share links serve through a controlled proxy or short-lived signed URL
- **Actual:** The `file_url` stored in the DB may be a long-lived public URL. Once obtained, it bypasses the view count and expiry checks on the share link.
- **Root cause:** Share link validates access, then hands over the raw storage URL which can be bookmarked and reused.
- **Fix plan:** Generate a fresh signed URL (1 hour expiry) at access time instead of using the stored `file_url`. The signed URL should be generated server-side after validation.
- **Acceptance criteria:** Downloaded files use time-limited signed URLs. Bookmarking the download URL doesn't work after expiry.

### BUG-007: No Loading State on Settings Page

- **Severity:** Minor
- **Where:** `Settings.tsx`
- **Steps to reproduce:** Navigate to Settings on slow connection → Page renders with empty/broken state before data loads
- **Expected:** Skeleton or spinner while data loads
- **Actual:** Immediate render without waiting for data
- **Root cause:** Missing `isLoading` check.
- **Fix plan:** Add loading check around Settings content with `<Skeleton>` placeholders.
- **Acceptance criteria:** Settings page shows skeletons until data loads.

---

## C) Repair Plan (Patch List)

### 1. Stability & Bugs

| # | Item | Effort | Risk | Deps | Definition of Done |
|---|------|--------|------|------|--------------------|
| S1 | Fix PDF viewer (blob-based rendering) | S | Low | None | PDFs render inline in all 3 viewer components. Fallback to download on error. |
| S2 | Add ErrorBoundary wrappers to all page-level components | S | Low | None | Every `<Route>` renders inside an `<ErrorBoundary>`. Crash on one page doesn't take down the app. |
| S3 | Add global React Query error handler | S | Low | None | 401/403 errors trigger re-auth modal. Network errors show toast. |
| S4 | Fix loading states on Settings, Import, ImportPassport pages | S | Low | None | All pages show skeleton/spinner during data fetch. |
| S5 | Add empty states for DashboardMap when no properties have coordinates | S | Low | None | Clear message with "Add coordinates" CTA instead of blank map. |
| S6 | Clean up 45 console.log/error statements in hooks and components | S | Low | None | Replace with structured logging or remove. Zero console.log in production build. |

### 2. Security & Auth

| # | Item | Effort | Risk | Deps | Definition of Done |
|---|------|--------|------|------|--------------------|
| A1 | Add session expiry detection + re-auth prompt | S | High | None | When `onAuthStateChange` fires `SIGNED_OUT`, show modal. Global 401 interceptor in QueryClient. |
| A2 | Strengthen password policy to 8+ chars with uppercase + number | S | Med | None | Zod schemas on Auth.tsx, ResetPassword.tsx, AcceptInvite.tsx, SecuritySettings.tsx all enforce 8+ chars + complexity. |
| A3 | Audit all 27 edge functions for auth bypass paths | M | High | None | Document each function's auth mechanism. Ensure cron-only functions can't be invoked from browser. Add explicit `Authorization` header check to user-facing functions. |
| A4 | Fix SharedDocument to use fresh signed URLs | S | Med | None | Share page generates short-lived signed URL after validation. Raw `file_url` never exposed to end user. |
| A5 | Add CORS origin whitelist to edge functions | S | Med | A3 | Replace `Access-Control-Allow-Origin: *` with explicit domain(s) on user-facing functions. |
| A6 | Verify RLS policies cover all CRUD operations per table | L | High | None | Write test script that attempts cross-org reads/writes/deletes for each table. Zero data leaks. |

### 3. Performance

| # | Item | Effort | Risk | Deps | Definition of Done |
|---|------|--------|------|------|--------------------|
| P1 | Split oversized page components (PropertyEdit 42KB, Properties 42KB, TenantDetail 40KB) | M | Med | None | Each page <20KB. Extract tab content into separate lazy-loaded components. |
| P2 | Add pagination to `useProperties()` for portfolios >100 properties | M | Med | None | Properties page uses cursor-based pagination. Dashboard uses summary RPCs instead of fetching all properties. |
| P3 | Add debounce to all search/filter inputs | S | Low | None | All text filter inputs debounce by 300ms. No excessive re-renders or queries. |
| P4 | Implement optimistic updates for common mutations (record payment, toggle checklist) | M | Low | None | UI updates instantly, rolls back on error. Uses TanStack Query `onMutate` pattern. |

### 4. UX/UI & Conversion

| # | Item | Effort | Risk | Deps | Definition of Done |
|---|------|--------|------|------|--------------------|
| U1 | Flatten sidebar — Compliance, Inbox, Calendar as top-level items | S | Low | None | No collapsible. 3 items with independent badges. Per spec. |
| U2 | Add dashboard calendar widget | S | Low | U3 | 14-day mini calendar + upcoming events list on Today tab. |
| U3 | Merge Refinance Calendar into Operations Calendar | S | Low | None | Single calendar page. Redirect old URL. Delete RefinanceCalendar.tsx. |
| U4 | Rent collection bulk actions | M | Med | None | Selection, floating toolbar, 6 bulk operations. Per spec. |
| U5 | Add onboarding wizard for new users | M | Med | None | After first sign-up: guided flow to add first company → first property → upload first certificate. |
| U6 | Add keyboard shortcuts (Ctrl+K command palette) | M | Low | None | Quick navigation to any page, property, or company by typing. |
| U7 | Improve accessibility (aria-labels, focus management, screen reader support) | L | Med | None | All interactive elements have labels. Focus trapped in modals. Score >90 on Lighthouse Accessibility. |

### 5. Data Integrity & Edge Cases

| # | Item | Effort | Risk | Deps | Definition of Done |
|---|------|--------|------|------|--------------------|
| D1 | Add org_id to all insert operations that currently omit it | S | High | None | Every `.insert()` call includes `org_id`. Defence-in-depth alongside RLS. |
| D2 | Add cascade delete protection | S | Med | None | Deleting a property warns about and handles linked tenancies, compliance items, documents, rooms. |
| D3 | Resolve property ↔ property_passport data duplication | M | Med | None | Fields like `construction_type`, `county` exist in both tables. Single source of truth established. Migration script moves data. |
| D4 | Add input validation on all forms (not just 11 forms with Zod) | M | Med | None | Every form input has server-side validation via Zod schemas. No raw `.insert()` with unvalidated user data. |
| D5 | Add unique constraint enforcement on duplicate-prone fields | S | Med | None | E.g., prevent two tenancies for the same room in overlapping date ranges. |

---

## D) Product Improvements

### Must-Have SaaS Elements (Not Yet Built)

| Feature | Why It Matters | Implementation (High Level) |
|---------|---------------|----------------------------|
| **Onboarding wizard** | New users see an empty dashboard with no guidance. Drop-off risk is very high. | Multi-step dialog after first login: name org → add first company → add first property → upload first cert. Track completion in `go_live_checklists`. |
| **Billing & subscription** | No revenue mechanism. Required before SaaS launch. | Stripe integration with 3 tiers per business doc. Supabase webhook for subscription status. Middleware that checks plan limits (property count, company count). |
| **Email notifications** | Users must manually check the app for expiring compliance. | Expand existing Resend integration. Weekly digest email showing upcoming deadlines, rent arrears, and action items. User-configurable preferences (already have `notification_preferences` table). |
| **Audit log export** | Accountability for multi-user access. Required for bank presentations. | Already have `activity_log` table. Add CSV/PDF export, date range filter, and per-property filtering. |
| **GDPR / privacy pages** | Legal requirement for UK SaaS processing personal data. | Marketing site needs Privacy Policy and Terms of Service pages. App needs data export and data deletion functions per GDPR Article 17. |
| **Backup & restore** | Single point of failure in Supabase. | Enable Supabase Point-in-Time Recovery. Add manual export function (full portfolio as JSON/CSV). |
| **Role-based access control** | Currently single-user. Multi-user requires permissions. | Extend `memberships` table with `role` column (admin/manager/viewer). Add permission checks to hooks. Gate mutations behind role checks. |
| **Support / help system** | No way for users to get help or report issues. | Add in-app feedback widget (Intercom/Crisp/simple form). Add help tooltips to complex features. |

### Feature Suggestions Based on App Goal

| Feature | Why | How |
|---------|-----|-----|
| **Bank export PDF polish** | The business doc explicitly calls this a key differentiator. The current `reportPdfGenerator.ts` (38KB) generates reports but they need professional design to impress lenders. | Invest in a professionally designed PDF template. Add cover page with branding, executive summary, property-by-property breakdown, compliance status summary. |
| **Automated rent reconciliation** | Manually recording each payment is the biggest time drain. | Open Banking integration (TrueLayer/Plaid UK) to match bank transactions to expected rent payments automatically. |
| **Tenant self-service portal** | Reduces admin overhead for maintenance requests and document sharing. | Extend existing portal architecture (already have `PortalProtectedRoute`). Add maintenance request submission, rent payment history view, document access. |
| **Contractor review system** | `contractor_reviews` table exists but no UI. Helps choose the right contractor for jobs. | Add review/rating form after job completion. Show average rating on contractor cards. Sort by rating when suggesting contractors. |
| **Mortgage rate comparison** | Users need to know when to refinance. | Integrate with a mortgage rate API or allow manual rate tracking. Show "potential saving" if refinanced at current best rates vs current rate. |

---

## E) Roadmap (Done vs To-Do)

### What's Already Done

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (email/password, sign up, reset) | ✅ Done | Works but weak password policy |
| Dashboard with KPIs (equity, cashflow, LTV, arrears) | ✅ Done | 8 KPI cards, 3 sub-tabs |
| Properties CRUD with full detail pages | ✅ Done | 42KB PropertyEdit — needs splitting |
| Property Passport (extended property data) | ✅ Done | Separate table, autofill suggestions |
| Companies & SPV management | ✅ Done | Companies House API integration |
| Ownership structure mapping | ✅ Done | Complex beneficial ownership chain |
| Compliance register with 70+ item tracking | ✅ Done | Multiple compliance types, status tracking |
| Compliance calendar | ✅ Done | Calendar view with event types |
| Compliance inbox for incoming certs | ✅ Done | Pending count badge |
| Document upload & management | ✅ Done | Categories, metadata, share links |
| Contractor management | ✅ Done | Add/edit contractors, link to jobs |
| Job management with detail pages | ✅ Done | Create from compliance, track to completion |
| Tenant & tenancy management | ✅ Done | Add tenants, create tenancies, room assignment |
| Room management per property | ✅ Done | HMO room tracking |
| Rent collection with monthly schedule | ✅ Done | Generate schedule, record individual payments |
| Map view (Google Maps) | ✅ Done | Property pins, geocoding |
| Shareholder portal (separate auth) | ✅ Done | Accept invite, limited view |
| Report generation (PDF) | ✅ Done | Bank presentation, mortgage broker pack |
| Portfolio insights & analytics | ✅ Done | AI-powered insights, area exposure |
| Timeline / activity log | ✅ Done | Portfolio events history |
| Data import (CSV, passport) | ✅ Done | Field mapping, bulk create |
| Marketing site (7 pages) | ✅ Done | Home, Product, Portfolio, Case Studies, About, Contact, Demo |
| Dark mode | ✅ Done | Theme context, CSS variables |
| Go-Live Checklist per property | ✅ Done | Excellent onboarding feature |
| 27 edge functions | ✅ Done | AI compliance, geocoding, email, etc. |
| RLS on all 70 tables | ✅ Done | Strong foundation |
| Lazy loading on all 48 pages | ✅ Done | Good performance baseline |

### What's Still To Do

#### Phase 0: Hotfixes (1–3 days)

| Deliverable | Acceptance Criteria | Outcome |
|-------------|--------------------|---------| 
| Fix PDF viewer with blob-based rendering | PDFs render inline. Fallback works. All 3 viewers fixed. | Core feature restored |
| Add session expiry detection + re-auth prompt | Modal appears on token expiry. No silent failures. | Zero silent 401 errors |
| Strengthen password to 8+ chars + complexity | All 4 password forms enforce new policy. | Meets OWASP baseline |
| Flatten sidebar (Compliance/Inbox/Calendar top-level) | 3 items visible without expanding. Independent badges. | <2 clicks to key features |
| Fix loading states on Settings, Import pages | Skeletons shown during load. | No broken empty renders |

**Measurable outcomes:** 0 critical bugs, all compliance docs viewable, all sessions handled gracefully.

#### Phase 1: MVP Hardening (1–2 weeks)

| Deliverable | Acceptance Criteria | Outcome |
|-------------|--------------------|---------| 
| Rent collection bulk actions | Select all → Mark paid in one action. 6 bulk operations. | Rent day: 2 clicks not 50 |
| Merge calendars + dashboard widget | Single calendar page. Widget on dashboard. | Unified operations view |
| Edge function security audit | Document all auth paths. Fix any bypass. CORS tightened. | No unprotected endpoints |
| Add ErrorBoundary to all routes | Crash in one page doesn't take down app. | Zero white-screen crashes |
| Add org_id to all insert operations | Defence-in-depth alongside RLS. | Data isolation guaranteed |
| SharedDocument signed URL fix | Fresh signed URLs. No persistent public URLs. | Documents expire properly |
| Split oversized components | PropertyEdit, Properties, TenantDetail all <20KB. | Faster page loads |

**Measurable outcomes:** <2s page load on 3G, 0 critical security gaps, rent processing time cut 90%.

#### Phase 2: SaaS Launch Readiness (2–4 weeks)

| Deliverable | Acceptance Criteria | Outcome |
|-------------|--------------------|---------| 
| Stripe billing integration | 3 plans, upgrade/downgrade, usage limits enforced. | Revenue enabled |
| Onboarding wizard | New user → first property in <5 minutes. Completion tracked. | <30% first-day drop-off |
| RBAC (admin/manager/viewer roles) | Permissions enforced on all mutations. UI adapts per role. | Multi-user ready |
| Email notification system | Weekly digest, configurable per user. Expiry alerts sent. | Compliance never missed |
| GDPR pages + data export/deletion | Privacy policy live. User can export/delete all data. | Legal compliance |
| Accessibility pass | Lighthouse Accessibility >90. All forms have labels. | Inclusive product |
| E2E test suite (critical paths) | Auth, property CRUD, compliance upload, rent recording, payment. | Regression safety net |
| Audit log export | CSV/PDF export with date range and property filters. | Accountability trail |

**Measurable outcomes:** Stripe charges working, 10 beta users onboarded, 0 GDPR gaps, >90 Lighthouse score.

#### Phase 3: Growth & Scale (Ongoing)

| Deliverable | Acceptance Criteria | Outcome |
|-------------|--------------------|---------| 
| Open Banking rent reconciliation | Auto-match bank transactions to rent schedule. | Near-zero manual payment recording |
| Legal Pack AI Analyser | Upload ZIP → AI extracts restrictions, flags issues, generates solicitor questions. | Headline marketing feature |
| Tenant self-service portal | Tenants submit maintenance, view rent history, access documents. | Reduced admin overhead |
| Mobile app (React Native or PWA) | Core features work on mobile. Offline property viewing. | Check properties on-site |
| Contractor review system | Rate after job completion. Sort by rating. | Better contractor selection |
| Portfolio scenario planner | "What if rates rise 2%?" / "What if I buy 3 more?" | Strategic decision tool |
| API for third-party integrations | REST API with API keys. Rate limited. Documentation. | Platform extensibility |

**Measurable outcomes:** 50 paying customers, <5% monthly churn, £4,000 MRR by month 12.

---

## F) Implementation Guidance

### Folder / File Recommendations

```
src/
├── components/
│   ├── auth/
│   │   └── SessionExpiryModal.tsx          ← NEW: re-auth prompt
│   ├── common/
│   │   ├── ErrorBoundary.tsx               ← EXISTS: extend usage
│   │   └── GlobalErrorHandler.tsx          ← NEW: 401 interceptor
│   ├── rent/
│   │   ├── BulkActionToolbar.tsx           ← NEW: floating toolbar
│   │   ├── BulkMarkPaidDialog.tsx          ← NEW
│   │   ├── BulkSendReminderDialog.tsx      ← NEW
│   │   ├── BulkWriteOffDialog.tsx          ← NEW
│   │   └── BulkAddNoteDialog.tsx           ← NEW
│   └── dashboard/
│       └── DashboardCalendarWidget.tsx     ← NEW: calendar widget
├── hooks/
│   ├── usePdfBlobUrl.ts                    ← NEW: blob-based PDF viewing
│   └── useSessionMonitor.ts               ← NEW: auth state monitoring
├── lib/
│   └── queryErrorHandler.ts               ← NEW: global query error logic
```

### Data Model Improvements

**1. Resolve property ↔ passport duplication**

Fields `construction_type`, `county` exist in both `properties` and `property_passports`. Pick one table as the source of truth:

```sql
-- Migration: move overlapping fields to property_passports only
-- Then drop from properties table after data migration
ALTER TABLE properties DROP COLUMN IF EXISTS construction_type;
-- Keep county in properties (address data), remove from passport
ALTER TABLE property_passports DROP COLUMN IF EXISTS county;
```

**2. Add role to memberships**

```sql
ALTER TABLE memberships ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'manager', 'viewer'));
```

**3. Add subscription tracking**

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  property_limit INT NOT NULL DEFAULT 10,
  company_limit INT NOT NULL DEFAULT 2,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
```

### API / State Management

**Global error handler pattern:**

```typescript
// src/lib/queryErrorHandler.ts
import { QueryCache, MutationCache } from '@tanstack/react-query';

export const queryCache = new QueryCache({
  onError: (error: any) => {
    if (error?.status === 401 || error?.message?.includes('JWT')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  }
});

export const mutationCache = new MutationCache({
  onError: (error: any) => {
    if (error?.status === 401 || error?.message?.includes('JWT')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  }
});
```

```typescript
// In App.tsx — pass caches to QueryClient
const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: { /* existing options */ }
});
```

```typescript
// src/hooks/useSessionMonitor.ts
export function useSessionMonitor() {
  const [expired, setExpired] = useState(false);
  
  useEffect(() => {
    const handler = () => setExpired(true);
    window.addEventListener('session-expired', handler);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setExpired(true);
    });
    
    return () => {
      window.removeEventListener('session-expired', handler);
      subscription.unsubscribe();
    };
  }, []);
  
  return { expired, clearExpired: () => setExpired(false) };
}
```

### Error Handling & Logging

**Replace console.log with structured approach:**

```typescript
// src/lib/logger.ts
const isDev = import.meta.env.DEV;

export const logger = {
  info: (msg: string, data?: any) => isDev && console.log(`[INFO] ${msg}`, data),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data),
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`, error);
    // Future: send to Sentry/LogRocket
  }
};
```

### Test Plan

**Recommended tools:**
- Unit: Vitest (already configured)
- Component: Vitest + React Testing Library
- E2E: Playwright (best for Supabase + React apps)

**Priority test cases (Phase 2):**

| Test | Type | Why |
|------|------|-----|
| Auth flow (sign in, sign up, reset password) | E2E | Gate to everything |
| Property CRUD (create, edit, view, delete) | E2E | Core data operation |
| Compliance upload + status change | E2E | Mission-critical feature |
| Rent schedule generation + payment recording | E2E | Revenue feature |
| Tenant creation + tenancy assignment | E2E | Tenancy lifecycle |
| RLS isolation (cross-org access attempt) | Integration | Security validation |
| `calculations.ts` financial formulas | Unit | Money must be correct |
| `complianceRequirements.ts` status logic | Unit | Compliance status must be correct |
| PDF blob URL hook | Unit | Recently broken feature |
| Bulk payment recording | Integration | New complex feature |

**Target coverage:** 80% on `/lib` and `/hooks`, E2E for all 11 user journeys.

---

## Open Questions (Max 10)

1. **Are there Supabase RLS policies we can inspect?** The migrations enable RLS but I can't verify the policy logic without seeing the `CREATE POLICY` statements in detail. Is the Supabase dashboard accessible for a policy audit?
2. **Are the cron-triggered edge functions (auto-send-rent-reminders, create-compliance-jobs, send-weekly-compliance-email) invoked via Supabase cron, or can they be called from the browser?** If browser-callable, they need auth checks.
3. **What's the current deployment pipeline?** Is this deployed via Lovable.dev's built-in hosting, or separately to Vercel/Netlify? This affects how environment variables and CORS are managed.
4. **Is there a staging environment?** Or is development happening directly against production data?
5. **How many active users are currently using the system?** This affects priority of multi-tenancy hardening.
6. **Are the Resend email functions actually sending, or are they in development mode?** (Affects urgency of the email notification roadmap item.)
7. **Is the Google Maps API key restricted by domain?** The key is fetched via an edge function — is it locked to your domain to prevent abuse?
8. **What's the current Supabase plan?** Free tier has limits on storage, edge function invocations, and database size that could affect scaling.
9. **Are you comfortable with the property ↔ passport data duplication, or should we merge?** This affects several hooks and could be a breaking change.
10. **Do you want to target a specific SaaS launch date?** This would help prioritise the Phase 2 items.
