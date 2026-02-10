# HydrogenCap Pre-Launch Review
## Staff Engineer + QA Lead + Security Audit

**Date:** 10 Feb 2026  
**Codebase:** hydrogencap-main (Vite + React + TS + Supabase)  
**Verdict:** ❌ NOT READY FOR PAID CUSTOMERS — 6 Blockers, 8 High, multiple Medium/Low

---

## EXECUTIVE SUMMARY

Your RLS foundation on core tables (properties, loans, income, costs, documents) is solid — org-based isolation via `user_has_org_access()` is correctly applied across CRUD operations. That's good news and means the core app is safe for single-org use.

However, there are **6 launch blockers** that would either leak data between tenants, break critical features entirely, or expose you to legal liability. The shareholder portal and shared document features are non-functional due to missing RLS policies. Storage buckets allow cross-tenant file access. There are no legal pages, no billing integration, and no rate limiting.

**Fix the 6 blockers and you can soft-launch. The 8 Highs should be resolved within 2 weeks of launch.**

---

## A) ARCHITECTURE MAP

### Domains & Tables

| Domain | Core Tables | Key Flows |
|--------|------------|-----------|
| **Properties** | `properties`, `loans`, `income`, `costs`, `property_passport`, `photos`, `floorplans` | CRUD, import CSV, passport autofill, batch update |
| **Companies** | `companies`, `company_secrets`, `parties`, `shareholdings`, `share_classes` | Companies House sync, secrets encryption, ownership tree |
| **Compliance** | `compliance_items`, `compliance_documents`, `certificate_type_mappings` | Expiry tracking, AI doc processing, reminders |
| **Documents** | `documents`, `document_categories`, `document_share_links`, `document_activity` | Upload → AI classify → match to property, share links |
| **Tenants** | `tenants`, `tenancies`, `rooms`, `tenancy_compliance_items` | Tenant lifecycle, room management, HMO compliance |
| **Rent** | `rent_schedule`, `rent_payments`, `payment_reminders` | Schedule generation, payment tracking, reminders |
| **Contractors/Jobs** | `contractors`, `contractor_jobs`, `job_notes`, `job_follow_ups` | Job creation, tracking, compliance job auto-creation |
| **Ownership** | `ownership_entities`, `ownership_links`, `ownership_groups`, `beneficial_groups` | Ownership tree, lookthrough, beneficial ownership |
| **Portal** | `shareholder_invites`, `shareholder_access` | Invite → accept → portal dashboard |
| **Marketing** | `demo_requests` | Landing pages, demo request form |
| **Notifications** | `notification_preferences`, `notification_log`, `scheduled_notifications` | Email reminders, compliance alerts |
| **Auth/Org** | `organizations`, `memberships`, `profiles` | Sign up → auto-create org → membership |

### Key Data Flows

1. **Sign Up:** `auth.users` trigger → create `organization` + `profile` + `membership(role=owner)`
2. **Property CRUD:** Client → RLS (`user_has_org_access(org_id)`) → properties table
3. **Document Upload:** Upload to storage → insert `documents` row → invoke `process-document` edge fn → AI extraction → update row
4. **Compliance Tracking:** `compliance_items` per property → AI doc matching → `compliance_documents` attachment
5. **Share Link:** Create `document_share_links` → generate token → `/shared/:token` public page
6. **Portal:** Admin creates `shareholder_invites` → recipient visits `/portal/accept/:token` → creates `shareholder_access` → portal pages

---

## B) SECURITY BLOCKER CHECK

### BLOCKER #1: Storage Buckets — Cross-Tenant File Access
**Severity: 🔴 BLOCKER**

**Problem:** Storage bucket policies only check `auth.role() = 'authenticated'` — they do NOT check org membership. Any authenticated user (Tenant B) can read/delete documents from Tenant A's storage.

**Affected buckets:**
- `documents` (private bucket, but policies don't filter by org)
- `compliance` (private bucket, same issue)
- `photos` (PUBLIC bucket — anyone on the internet can enumerate and view all property photos)
- `floorplans` (PUBLIC bucket — same issue)

**Reproduction:**
1. User A uploads a document to `documents/orgA/file.pdf`
2. User B (different org) calls `supabase.storage.from('documents').list('orgA/')` — succeeds
3. User B downloads any file — succeeds

**Fix — storage policies must include org path validation:**

```sql
-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Users can view their org documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- New policies: enforce org_id path prefix
CREATE POLICY "Users can view their org documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (SELECT get_user_org_id()::text)
);

CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (SELECT get_user_org_id()::text)
);

CREATE POLICY "Users can delete their org documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (SELECT get_user_org_id()::text)
);
```

**ALSO:** Change `photos` and `floorplans` buckets from `public: true` to `public: false` and add org-scoped policies. Use signed URLs for photo display.

**Frontend change required:** All file uploads must use the path pattern `{org_id}/{filename}`. Audit every `supabase.storage.from(...).upload(...)` call.

---

### BLOCKER #2: Shared Document Page — Completely Broken
**Severity: 🔴 BLOCKER**

**Problem:** The `/shared/:token` page queries `document_share_links` using the anonymous Supabase client. But the only RLS policy on that table is `user_has_org_access(org_id)` which requires the viewer to be an authenticated org member. For an unauthenticated or external user, the query returns empty — the feature silently fails.

**Reproduction:**
1. Admin creates a share link (works fine, they have org access)
2. Admin sends the link to an external party
3. External party opens `/shared/abc123` — sees "Share link not found or has been revoked"

**Fix — add an anon-accessible SELECT policy scoped to token lookup:**

```sql
-- Allow anyone to read a share link BY TOKEN (for the shared document viewer)
CREATE POLICY "Anyone can view share links by token"
ON public.document_share_links
FOR SELECT
USING (true);
-- Note: The SharedDocument component already validates is_active, expires_at, view_count.
-- The token itself is the secret (256-bit random). Listing all links requires knowing tokens.

-- Also allow the SharedDocument page to increment view_count:
CREATE POLICY "Anyone can update view count on share links"
ON public.document_share_links
FOR UPDATE
USING (true)
WITH CHECK (true);
```

**Better alternative:** Move share link validation to an edge function that uses the service role key, so the token validation happens server-side and you never expose the `document_share_links` table to anonymous access.

---

### BLOCKER #3: Shareholder Portal — Invite Acceptance Broken
**Severity: 🔴 BLOCKER**

**Problem:** The `AcceptInvite` page and `useAcceptShareholderInvite` hook query `shareholder_invites` table. The only RLS policy is "Admins can manage shareholder invites" which requires org admin membership. A new user receiving an invite **cannot read the invite** to accept it.

Additionally, `shareholder_access.insert` also requires admin membership. The invite recipient cannot create their own access row.

**Reproduction:**
1. Admin creates invite for `partner@example.com`
2. Partner receives email, clicks link to `/portal/accept/{token}`
3. Page shows "Invalid or expired invitation" because RLS blocks the SELECT

**Fix:**

```sql
-- Allow anyone to read their own invite by token (for acceptance flow)
CREATE POLICY "Invite recipients can view invites by token"
ON public.shareholder_invites
FOR SELECT
USING (
  -- Allow reading by token (for acceptance) or by admin
  token IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = shareholder_invites.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

-- Allow the acceptance flow to mark invite as accepted
CREATE POLICY "Users can accept their own invite"
ON public.shareholder_invites
FOR UPDATE
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow users to create their own shareholder_access from an invite
CREATE POLICY "Users can create their own shareholder access"
ON public.shareholder_access
FOR INSERT
WITH CHECK (user_id = auth.uid());
```

**Better alternative:** Move the entire invite acceptance flow to an edge function using the service role key.

---

### BLOCKER #4: Shareholder Portal — Data Access Broken
**Severity: 🔴 BLOCKER**

**Problem:** Portal pages query `properties`, `compliance_items`, `loans`, `income`, `costs`, `photos` — all scoped by `org_id` from `shareholder_access`. But RLS on these tables only checks `user_has_org_access()` which queries `memberships`. Shareholders are NOT in `memberships` — they're in `shareholder_access`. All portal data queries return empty results.

**Reproduction:**
1. Shareholder logs in, navigates to `/portal`
2. Dashboard shows 0 properties, 0 compliance items, £0 portfolio value

**Fix — update `user_has_org_access` to also check shareholder_access:**

```sql
CREATE OR REPLACE FUNCTION public.user_has_org_access(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND org_id = check_org_id
  )
  OR EXISTS (
    SELECT 1 FROM public.shareholder_access
    WHERE user_id = auth.uid() AND org_id = check_org_id AND revoked_at IS NULL
  )
$$;
```

**CAUTION:** This gives shareholders READ access to all tables that use `user_has_org_access`. You need to also ensure shareholders cannot WRITE. Consider using separate read-only policies or checking the role within write policies.

---

### BLOCKER #5: No Terms of Service / Privacy Policy / Legal Pages
**Severity: 🔴 BLOCKER**

**Problem:** You're collecting personal data (names, emails, property addresses, financial information, tenant details) and have no visible Terms of Service, Privacy Policy, or Cookie Policy. UK GDPR requires this. Launching without these exposes you to ICO enforcement.

**Fix:**
1. Commission a solicitor-reviewed Privacy Policy and Terms of Service
2. Add `/terms` and `/privacy` routes to the marketing site
3. Add consent checkbox at sign-up: "I agree to the Terms of Service and Privacy Policy"
4. Add cookie consent banner (you use localStorage for auth persistence)
5. Implement data export and deletion API for GDPR subject access requests

---

### BLOCKER #6: No Billing Integration
**Severity: 🔴 BLOCKER**

**Problem:** You have pricing tiers in your business plan (£29/£79/£199/month) but no billing infrastructure. No Stripe integration, no subscription management, no trial period logic, no feature gating by plan.

**Fix (minimum viable):**
1. Integrate Stripe Checkout + Billing Portal
2. Add `subscription_status`, `plan_tier`, `trial_ends_at` to `organizations` table
3. Create a Stripe webhook edge function to sync subscription state
4. Gate features by plan tier (property count limits, feature flags)
5. Add billing settings page

---

## C) TOP 20 ISSUES (Prioritized)

| # | Severity | Issue | Domain |
|---|----------|-------|--------|
| 1 | 🔴 BLOCKER | Storage buckets: cross-tenant file access | Security |
| 2 | 🔴 BLOCKER | Shared document page: broken for external users | Feature |
| 3 | 🔴 BLOCKER | Portal invite acceptance: broken (RLS blocks) | Feature |
| 4 | 🔴 BLOCKER | Portal data: empty (shareholders not in memberships) | Feature |
| 5 | 🔴 BLOCKER | No Terms of Service / Privacy Policy | Legal |
| 6 | 🔴 BLOCKER | No billing integration | SaaS |
| 7 | 🟠 HIGH | CORS: all edge functions use `Access-Control-Allow-Origin: *` | Security |
| 8 | 🟠 HIGH | `company-secrets` bulk_set: double `req.json()` read crashes | Bug |
| 9 | 🟠 HIGH | Membership query uses `.single()` — fails for multi-org users | Bug |
| 10 | 🟠 HIGH | No rate limiting on auth endpoints or edge functions | Security |
| 11 | 🟠 HIGH | `portfolio-api` edge fn: `getClaims()` is not a valid Supabase method | Bug |
| 12 | 🟠 HIGH | SharedDocument: `file_url` exposed directly — may leak signed URLs or raw storage paths | Security |
| 13 | 🟠 HIGH | No email verification enforcement at sign-up | Security |
| 14 | 🟠 HIGH | Portal: no write-protection — shareholders could write if `user_has_org_access` is updated | Security |
| 15 | 🟡 MEDIUM | `photos` bucket is public: anyone can enumerate property photos by URL | Privacy |
| 16 | 🟡 MEDIUM | No audit log for destructive actions (delete property, revoke access) | Ops |
| 17 | 🟡 MEDIUM | No error boundaries in React — unhandled throw crashes entire app | UX |
| 18 | 🟡 MEDIUM | `useProperties()` fetches ALL properties with ALL loans/income/costs — N+1 potential | Perf |
| 19 | 🟡 MEDIUM | No input validation/sanitization on text fields (address, notes) | Security |
| 20 | 🟡 MEDIUM | `QueryClient` retry: 1 with no backoff — hammers failing endpoints | Perf |

### Detailed Issue Descriptions (7–14)

**#7 — CORS wildcard on all edge functions**
Every edge function returns `Access-Control-Allow-Origin: *`. This means any website can make authenticated requests to your API if a user's session token is available. For a SaaS handling financial data, restrict to your domain.

```typescript
// Fix in every edge function:
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://app.hydrogencap.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

**#8 — company-secrets bulk_set double body read**
In `company-secrets/index.ts`, the request body is read at line ~100 (`const { action, company_id, auth_code, utr } = await req.json()`) and then again inside the `bulk_set` branch (`const { secrets: bulkSecrets } = await req.json()`). The second read will fail because the body stream is already consumed.

```typescript
// Fix: read body once at the top and destructure what you need
const body = await req.json();
const { action, company_id, auth_code, utr, secrets: bulkSecrets } = body;
```

**#9 — Membership `.single()` fails for multi-org users**
`useUserOrg.ts` and `useOrganization.ts` query memberships with `.maybeSingle()` or `.single()`. When you add multi-org support (which your SaaS plan implies), users in multiple orgs will get a `PGRST116` error (more than one row returned). The `company-secrets` edge function also uses `.single()` for the same reason.

```typescript
// Fix: use .limit(1).maybeSingle() consistently, and add org switching UI
```

**#10 — No rate limiting**
Anyone can spam sign-up, password reset, edge function invocations. Supabase has built-in rate limiting for auth but your edge functions have none.

Fix: Enable Supabase's built-in rate limiting in `config.toml`, and add per-user throttling in edge functions.

**#11 — `portfolio-api` uses non-existent `getClaims()`**
`supabase.auth.getClaims(token)` is not a method in the Supabase JS client. This function will always throw.

```typescript
// Fix: use getUser() instead
const { data: { user }, error } = await supabase.auth.getUser();
```

**#12 — SharedDocument exposes raw `file_url`**
The `file_url` stored in the `documents` table is passed directly to the browser as an `<iframe src>` or `<img src>`. If these are Supabase storage URLs, they may be long-lived or permanent, bypassing the share link's expiry and view limits. The URL lives in the DOM even after the share link expires.

Fix: Use short-lived signed URLs generated server-side, returned only after validating the share token.

**#13 — No email verification enforcement**
`signUp` sends a verification email (`emailRedirectTo`) but the app never checks `email_confirmed_at`. Unverified users get full access. This enables:
- Fake account spam
- Using others' email addresses

Fix: Check `user.email_confirmed_at` in the `ProtectedRoute` component and show a "verify your email" page if null.

**#14 — Portal write protection gap**
If you apply the Blocker #4 fix (adding `shareholder_access` to `user_has_org_access`), shareholders gain write access to properties, compliance items, etc. The RLS policies use the same function for INSERT/UPDATE/DELETE as for SELECT.

Fix: Create separate read-only policies for shareholders:

```sql
-- Example for properties: shareholders get SELECT only
CREATE POLICY "Shareholders can view properties"
ON public.properties FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shareholder_access sa
    WHERE sa.org_id = properties.org_id
    AND sa.user_id = auth.uid()
    AND sa.revoked_at IS NULL
  )
);
-- Keep existing policies for memberships-based write access
```

---

## D) QA TEST MATRIX

### Critical Path: Authentication

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Sign up happy path | Happy | Enter email/password/name → submit | Account created, verification email sent, redirect to dashboard |
| Sign up duplicate email | Edge | Re-register same email | Error: "User already registered" |
| Sign in valid | Happy | Enter valid credentials | Dashboard loads, session persists on refresh |
| Sign in wrong password | Edge | Enter wrong password 5 times | Account locked or rate limited |
| Password reset | Happy | Request reset → click link → enter new password | Password changed, can sign in |
| Session expiry | Edge | Wait for token expiry → interact with app | Redirect to `/auth`, no stale data shown |
| Email verification | Abuse | Sign up but don't verify → access dashboard | Should be blocked (CURRENTLY FAILS) |

### Critical Path: Properties

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Create property | Happy | Fill all fields → save | Property appears in list, org_id set automatically |
| Create property minimal | Edge | Only required fields → save | Property created with nulls for optional fields |
| Edit property | Happy | Change value, address → save | Updated in list, activity log entry created |
| Delete property | Happy | Delete property with loans/income/photos | Cascade deletes all related records |
| View property detail | Happy | Click property → check tabs | All tabs load: Overview, Financials, Compliance, Documents |
| Cross-tenant isolation | Abuse | User A creates property → User B queries by ID | User B gets empty result (RLS blocks) |
| SQL injection in address | Abuse | Enter `'; DROP TABLE properties; --` in address | Stored as literal text, no injection |
| XSS in notes field | Abuse | Enter `<script>alert(1)</script>` in notes | Rendered as text, not executed |

### Critical Path: Compliance

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Upload compliance doc | Happy | Upload PDF → AI processes → matches to property | Document attached to compliance item, expiry extracted |
| Expired compliance alert | Happy | Set expiry date to yesterday | Shows in "expired" count, dashboard alert |
| AI doc classification | Happy | Upload gas safety certificate | Classified as "Gas Safety Certificate (CP12)" |
| AI wrong match | Edge | Upload cert for address not in portfolio | Shows as "review needed", manual assignment possible |
| Bulk upload | Happy | Upload 5 certificates at once | All processed, progress shown |

### Critical Path: Document Sharing

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Create share link | Happy | Select doc → create link with 7-day expiry | Link generated, copyable |
| Access shared document | Happy | Open link in incognito browser | Document displayed, view count incremented |
| Expired share link | Edge | Open link after expiry date | "Share link has expired" message |
| Max views reached | Edge | Open link after max_views consumed | "Maximum view limit reached" message |
| Deactivate share link | Happy | Admin deactivates link → someone opens it | "Link has been deactivated" |
| Token brute force | Abuse | Try random tokens at `/shared/{random}` | "Share link not found", no information leakage |

### Critical Path: Shareholder Portal

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Send invite | Happy | Admin invites partner@email.com | Invite record created, email sent |
| Accept invite (new user) | Happy | Click link → sign up → accept | Shareholder access granted, portal accessible |
| Accept invite (existing user) | Happy | Click link → sign in → accept | Access granted |
| Expired invite | Edge | Click link after 7 days | "Invitation expired" message |
| Revoked access | Edge | Admin revokes → shareholder refreshes portal | Redirected to auth page |
| Portal read-only | Abuse | Shareholder tries to edit property via API | RLS blocks write operation |
| Portal data scoping | Happy | Shareholder views dashboard | Only sees org's properties, correct financial totals |

### Critical Path: Storage Security

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Upload document | Happy | Upload PDF to documents bucket | File stored at `{org_id}/{filename}` |
| Cross-tenant file access | Abuse | User B tries `storage.list('orgA/')` | Empty result / access denied |
| Public photo access | Abuse | Unauthenticated GET to photos bucket | Access denied (after fix) |
| Delete other org's file | Abuse | User B tries to delete User A's file | Denied by storage policy |
| Signed URL expiry | Edge | Generate signed URL → wait 1 hour → access | URL expired, 403 response |

### Critical Path: Edge Functions

| Test | Type | Steps | Expected |
|------|------|-------|----------|
| Process document — no auth | Abuse | Call without Authorization header | 401 Unauthorized |
| Process document — wrong org | Abuse | Pass property_id from different org | 403 or empty result |
| Company secrets — reveal | Happy | Admin clicks reveal → correct values shown | Decrypted secrets displayed |
| Company secrets — non-admin | Abuse | Viewer role tries to reveal secrets | 403 Insufficient permissions |
| Bulk EPC enrich | Happy | Trigger on 10 properties | All enriched, rate limiting respected |

---

## E) SECURITY CHECKLIST & RLS POLICY AUDIT

### RLS Status: All Tables

| Table | RLS Enabled | Policy Correct | Issue |
|-------|------------|---------------|-------|
| `organizations` | ✅ | ✅ | — |
| `profiles` | ✅ | ✅ | Scoped to `auth.uid()` |
| `memberships` | ✅ | ⚠️ | Users can INSERT own membership — could self-add to any org |
| `properties` | ✅ | ✅ | Via `user_has_org_access` |
| `loans` | ✅ | ✅ | Via property → org join |
| `income` | ✅ | ✅ | Via property → org join |
| `costs` | ✅ | ✅ | Via property → org join |
| `documents` | ✅ | ✅ | Direct org_id check |
| `photos` | ✅ | ✅ | Via property → org join |
| `compliance_items` | ✅ | ✅ | Direct org_id check |
| `compliance_documents` | ✅ | ✅ | Via compliance_item → org join |
| `companies` | ✅ | ✅ | Direct org_id check |
| `company_secrets` | ✅ | ✅ | Via company → org join |
| `contractors` | ✅ | ✅ | Direct org_id check |
| `contractor_jobs` | ✅ | ✅ | Direct org_id or via contractor |
| `tenants` | ✅ | ✅ | Direct org_id check |
| `tenancies` | ✅ | ✅ | Via property → org |
| `rooms` | ✅ | ✅ | Via property → org |
| `rent_schedule` | ✅ | ✅ | Via tenancy → property → org |
| `rent_payments` | ✅ | ✅ | Via schedule → tenancy → org |
| `shareholder_invites` | ✅ | ❌ | **Admin only — blocks invite acceptance** |
| `shareholder_access` | ✅ | ❌ | **Admin only — blocks self-access creation** |
| `document_share_links` | ✅ | ❌ | **Org member only — blocks shared page** |
| `demo_requests` | ✅ | ⚠️ | Needs anon INSERT for marketing form |

### Storage Bucket Audit

| Bucket | Public | Policy Scope | Issue |
|--------|--------|-------------|-------|
| `documents` | false | `authenticated` only | ❌ No org isolation |
| `photos` | **true** | Anyone can SELECT | ❌ World-readable |
| `floorplans` | **true** | Anyone can SELECT | ❌ World-readable |
| `compliance` | false | `authenticated` only | ❌ No org isolation |

### Membership INSERT Concern

The `memberships` INSERT policy is:
```sql
CREATE POLICY "Users can insert own memberships"
ON public.memberships FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

This means any authenticated user can INSERT a membership for themselves into ANY org_id. They just need to know (or guess) an org UUID. **This is a HIGH severity privilege escalation.**

**Fix:**

```sql
-- Drop the permissive policy
DROP POLICY "Users can insert own memberships" ON public.memberships;

-- Only allow membership creation via the signup trigger (SECURITY DEFINER)
-- If manual membership management is needed, do it through an edge function
```

---

## F) PERFORMANCE & RELIABILITY

### Expensive Queries

1. **`useProperties()`** — Fetches ALL properties with ALL loans, income, and costs in a single nested select. For a user with 200+ properties and 5 years of history each, this is thousands of rows. Add pagination or virtual scrolling.

2. **`useShareholderPortfolioData()`** — `photos` query has no org_id filter, fetches ALL cover photos across all orgs (relies on RLS which does a join per row).

3. **`usePortfolioRisks()`** and **`useMissingInfo()`** (24KB each) — These hooks appear to do complex client-side computation on the full property set. Consider moving to database views or edge functions.

### Missing Loading/Error States

- `SharedDocument.tsx`: Has loading and error states ✅
- `PortalDashboard.tsx`: Has loading state ✅
- Most hooks use React Query which provides `isLoading`/`error` — but many page components don't display error states, only loading spinners. On failure, the user sees an infinite spinner.
- **No global error boundary** — An unhandled error in any component crashes the entire app to a white screen.

**Fix:** Add React Error Boundary at the route level:

```tsx
// Add to App.tsx wrapping each ProtectedRoute
<ErrorBoundary fallback={<ErrorPage />}>
  <Dashboard />
</ErrorBoundary>
```

### Race Conditions

- **`useAcceptShareholderInvite()`**: Reads invite, creates access, then updates invite — no transaction. If the process fails mid-way, you get orphaned access records or double acceptance. Move to a single edge function.

- **`view_count` increment** in SharedDocument: Read-then-increment is not atomic. Two concurrent viewers could both read count=4, both write count=5, meaning you lose a view. Use `view_count + 1` in the UPDATE or use Postgres `INCREMENT`.

---

## G) SAAS READINESS GAPS

| Feature | Status | Priority |
|---------|--------|----------|
| Billing (Stripe) | ❌ Missing | Blocker |
| Terms of Service | ❌ Missing | Blocker |
| Privacy Policy | ❌ Missing | Blocker |
| Cookie consent | ❌ Missing | High |
| Email verification enforcement | ❌ Missing | High |
| Feature gating by plan | ❌ Missing | High |
| Onboarding flow / tutorial | ❌ Missing | High |
| Support/help widget | ❌ Missing | Medium |
| Admin dashboard (user management) | ❌ Missing | Medium |
| Monitoring/alerting (Sentry, etc.) | ❌ Missing | Medium |
| Uptime page / status page | ❌ Missing | Medium |
| Data export (GDPR) | ❌ Missing | Medium |
| Account deletion (GDPR) | ❌ Missing | Medium |
| Backup strategy documentation | ❌ Missing | Medium |
| Changelog / release notes | ❌ Missing | Low |
| API documentation (for portfolio-api) | ❌ Missing | Low |

---

## H) ROADMAP: NOW / NEXT / LATER

### 🔴 NOW (Before launch — Week 1)

1. Fix storage bucket policies (Blocker #1)
2. Move shared document validation to edge function (Blocker #2)
3. Move invite acceptance to edge function (Blocker #3)
4. Add shareholder SELECT-only policies to core tables (Blocker #4)
5. Add Terms of Service / Privacy Policy pages (Blocker #5)
6. Integrate Stripe billing (Blocker #6)
7. Fix membership INSERT escalation (High #9 in checklist)
8. Lock CORS to your domain (High #7)
9. Fix `company-secrets` double body read (High #8)
10. Fix `portfolio-api` getClaims (High #11)

### 🟠 NEXT (Week 2–3, post soft-launch)

11. Enforce email verification
12. Add rate limiting to edge functions
13. Add React Error Boundary
14. Make photos/floorplans buckets private, use signed URLs
15. Add cookie consent banner
16. Add input validation (zod schemas) on all form submissions
17. Add onboarding flow for new users
18. Add monitoring (Sentry for errors, Supabase dashboard for metrics)
19. Property list pagination (for portfolios > 50)
20. Add data export endpoint (GDPR)

### 🟢 LATER (Month 2+)

21. Multi-org support (org switcher)
22. Feature gating by subscription tier
23. Admin panel for user management
24. Account deletion flow
25. API key management for portfolio-api
26. Automated E2E test suite (Playwright)
27. Performance optimization (database views, caching)
28. Mobile responsive audit
29. Accessibility audit (WCAG 2.1)
30. SOC2 preparation (if targeting enterprise)

---

## Summary

The core of HydrogenCap is well-architected. Your RLS model is fundamentally sound — every table has RLS enabled and most policies correctly scope to the org. The multi-entity data model (organizations → memberships → properties → related data) is clean and extensible.

The blockers are all fixable in 1–2 weeks of focused work. The most critical are the storage bucket policies and the shareholder portal RLS gaps. Once those are resolved, you have a solid foundation for a soft launch with hand-picked beta users.

**My recommendation: Fix blockers 1–4 and 7–11 this week. Ship to 5 beta users with a manual billing arrangement (invoice them). Use the beta period to build proper Stripe integration and legal pages before opening to the public.**
