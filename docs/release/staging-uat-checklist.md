# Staging UAT Checklist

Use realistic staging users and seeded records. Record pass/fail and owner for each section.

## Core Admin Workflows

- [ ] Sign in, sign out, password reset, and email verification behave correctly.
- [ ] Dashboard loads with the selected organization and does not show data from another org.
- [ ] Organization switching refreshes dashboard, reporting, lenders, documents, and tasks correctly.
- [ ] Property create, edit, and detail flows work.
- [ ] Entity create, edit, and ownership-related flows work.

## Tenancy And Rent

- [ ] Create a tenancy and verify the tenancy detail view loads expected linked data.
- [ ] Rent collection, tenancy ledger, and reconciliation views load org-correct data.
- [ ] Rent reminder send flow works with staging-safe recipients.
- [ ] Tenancy expiry reminders can be previewed or tested safely.

## Maintenance And Compliance

- [ ] Maintenance request creation, comment/update flows, and work orders behave correctly.
- [ ] Compliance upload, review, reminders, and document access flows work.
- [ ] Compliance jobs and any automated/manual compliance pipeline actions run only for the intended org.

## Portals And Sharing

- [ ] Tenant invite create and accept flows work end-to-end.
- [ ] Tenant portal home, rent, documents, and maintenance visibility reflect assigned permissions.
- [ ] Shareholder invite send, resend, and accept flows work end-to-end.
- [ ] Investor portal access email, claim flow, dashboard, and statement downloads work end-to-end.
- [ ] Shared document links honor validity and show the expected access/error states.

## Documents, Files, And Storage

- [ ] Document uploads store and reopen correctly through signed URLs.
- [ ] Compliance files render and download correctly.
- [ ] Photo uploads render correctly from the private storage path model.
- [ ] Floorplans and any other storage-backed media still load in staging.

## Billing And Integrations

- [ ] Checkout flow works against the correct Stripe environment.
- [ ] Customer portal launch works.
- [ ] FreeAgent connection, callback, and scoped reads/writes work for the selected org.
- [ ] Companies House and any other external lookup flows still succeed.

## Operational Checks

- [ ] Sentry is receiving staging errors/releases.
- [ ] Edge function logs are visible for the tested actions.
- [ ] Email delivery is confirmed for invite and reminder flows.
- [ ] Cron-protected/manual-protected endpoints reject unauthorized access.
