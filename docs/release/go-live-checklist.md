# Go-Live Checklist

Use this checklist for every release candidate and production rollout.

## Stage 0: Release Baseline

- [ ] Confirm GitHub `main` or the approved release branch is the source of truth.
- [ ] Create a release candidate branch and tag the candidate commit.
- [ ] Freeze non-launch feature work until rollout completes.
- [ ] Confirm staging and production owners for:
  - frontend hosting
  - Supabase database
  - edge functions
  - monitoring/on-call
- [ ] Confirm required frontend environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_STRIPE_*`
  - `VITE_SENTRY_DSN`
- [ ] Confirm required edge function secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `COMPANIES_HOUSE_API_KEY`
  - `CRON_SECRET`
  - `FREEAGENT_CLIENT_ID`
  - `FREEAGENT_CLIENT_SECRET`
  - `COMPANY_SECRETS_KEY`

## Stage 1: Staging Deploy

- [ ] Apply the latest launch-critical migrations to staging from [`supabase/migrations`](/C:/Users/david/Documents/New%20project/tenureiq/hydrogencap-zip-review/supabase/migrations).
- [ ] Deploy updated edge functions from [`supabase/functions`](/C:/Users/david/Documents/New%20project/tenureiq/hydrogencap-zip-review/supabase/functions).
- [ ] Confirm staging storage buckets match the app's private-path signing assumptions.
- [ ] Confirm invite, portal, sharing, and document paths are using the latest RPC and edge-function code.

## Stage 2: Automated Release Gates

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run check:edge`
- [ ] `npm run e2e:smoke`
- [ ] `npm audit --omit=dev --audit-level=high`
- [ ] Review any accepted residual dependency risk and record the reason.

## Stage 3: Manual Staging Smoke

- [ ] Tenant invite accept path works.
- [ ] Shareholder invite accept and resend path works.
- [ ] Investor portal sign-in and claim path works.
- [ ] Shared document consume path works.
- [ ] Tenant portal route permissions are enforced.
- [ ] Reminder, certificate, and job-request functions work with staging-safe data.
- [ ] Organization switching updates visible data and actions correctly.
- [ ] Storage-backed preview/download works for at least:
  - documents
  - compliance files
  - photos

## Stage 4: UAT And Rollback Readiness

- [ ] Complete the staging UAT checklist in [`docs/release/staging-uat-checklist.md`](/C:/Users/david/Documents/New%20project/tenureiq/hydrogencap-zip-review/docs/release/staging-uat-checklist.md).
- [ ] Confirm Sentry release tracking and alert routing.
- [ ] Confirm function failure monitoring and email delivery checks.
- [ ] Confirm cron visibility for reminder and automation functions.
- [ ] Confirm rollback targets:
  - frontend deployment rollback
  - edge function redeploy rollback
  - database forward-fix plan for non-reversible migrations
- [ ] Assign a named smoke owner for post-deploy checks.

## Stage 5: Production Rollout

- [ ] Run internal production validation.
- [ ] Roll out to a limited pilot cohort.
- [ ] Monitor for 24-48 hours before full rollout.
- [ ] Watch:
  - auth failures
  - portal invite failures
  - edge function error rates
  - storage/signing failures
  - cross-org anomalies
  - payment and email delivery issues
- [ ] Hold a post-launch review and convert watch items into tracked backlog work.
