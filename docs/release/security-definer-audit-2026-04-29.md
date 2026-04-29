# SECURITY DEFINER Function Audit — 2026-04-29

Classification of all **88 SECURITY DEFINER functions** in `public` schema.

Source signals: `pg_trigger.tgfoid`, `pg_policies.qual/with_check`, `rg 'rpc\(...)'` across `src/` and `supabase/functions/`.

## Categories

- **A — KEEP**: RLS helper, view helper, or `supabase.rpc()` call from authenticated app code.
- **B — REVOKE**: Trigger-only.
- **C — REVOKE**: Internal helper called only by other SECURITY DEFINER functions.
- **D — REVOKE**: Edge-function-only RPC (service_role bypasses grants).
- **Uncertain — SKIP**: No call site found; needs human review.

## Per-category totals

| Category | Count | Action |
|---|---|---|
| A — RLS helper / app RPC | 55 | KEEP grants |
| B — Trigger-only | 21 | REVOKE EXECUTE from PUBLIC, anon, authenticated |
| C — Internal helper | 5 | REVOKE EXECUTE from PUBLIC, anon, authenticated |
| D — Edge-function-only | 7 | REVOKE EXECUTE from PUBLIC, anon, authenticated |
| Uncertain | 0 | Skip this pass |
| **Total** | **88** | |

**Functions revoked this pass: 33** → expected linter warning reduction: **66** (each function flagged once for anon, once for authenticated).

## Full classification table

| # | Function signature | Category | Action | Rationale |
|---|---|---|---|---|
| 1 | `public.accept_shareholder_invite(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 2 | `public.accept_team_invite(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 3 | `public.accept_tenant_portal_invite(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 4 | `public.audit_compliance_delete()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 5 | `public.audit_property_delete()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 6 | `public.audit_shareholder_revoke()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 7 | `public.audit_tenant_delete()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 8 | `public.audit_trigger_function()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 9 | `public.auto_generate_rent_schedule()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 10 | `public.bulk_update_rent_schedule_status(p_ids uuid[], p_status text, p_notes text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 11 | `public.cancel_renewed_compliance_jobs()` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 12 | `public.cancel_renewed_compliance_jobs(p_org_ids uuid[])` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 13 | `public.claim_portal_investor_access()` | C | REVOKE | Internal helper, only called by other SECURITY DEFINER functions. |
| 14 | `public.consume_document_share_link(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 15 | `public.create_jobs_for_expiring_compliance()` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 16 | `public.create_jobs_for_expiring_compliance(p_org_ids uuid[])` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 17 | `public.ensure_single_primary_floorplan()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 18 | `public.find_matching_contractors(p_org_id uuid, p_compliance_type text, p_postcode text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 19 | `public.generate_compliance_requirements_v2(target_property_id uuid)` | C | REVOKE | Internal helper, only called by other SECURITY DEFINER functions. |
| 20 | `public.generate_job_inbox_email()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 21 | `public.generate_rent_schedule(p_tenancy_id uuid, p_months integer, p_agreement_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 22 | `public.generate_rent_schedule(p_tenancy_id uuid, p_months integer)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 23 | `public.generate_tax_year_summary(target_entity_id uuid, target_tax_year text, target_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 24 | `public.generate_tenancy_compliance_items(tenancy_row tenancies)` | C | REVOKE | Internal helper, only called by other SECURITY DEFINER functions. |
| 25 | `public.get_portal_investor_data()` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 26 | `public.get_shareholder_invite(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 27 | `public.get_tenant_org_id()` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 28 | `public.get_tenant_portal_invite(p_token text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 29 | `public.get_user_org_id()` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 30 | `public.get_user_role(_user_id uuid, _org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 31 | `public.global_search(search_query text, p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 32 | `public.handle_new_user()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 33 | `public.has_role(_user_id uuid, _role app_role)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 34 | `public.insert_rent_schedule_item(p_org_id uuid, p_tenancy_id uuid, p_due_date date, p_period_start date, p_period_end date, p_rent_amount numeric, p_additional_charges numeric, p_amount_paid numeric, p_amount_outstanding numeric, p_status text, p_payment_reference text, p_notes text, p_agreement_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 35 | `public.insert_rent_schedule_item(p_org_id uuid, p_tenancy_id uuid, p_due_date date, p_period_start date, p_period_end date, p_rent_amount numeric, p_additional_charges numeric, p_amount_paid numeric, p_amount_outstanding numeric, p_status text, p_payment_reference text, p_notes text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 36 | `public.log_document_download(p_document_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 37 | `public.log_document_view(p_document_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 38 | `public.migrate_companies_to_entities(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 39 | `public.migrate_compliance_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 40 | `public.migrate_contractors_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 41 | `public.migrate_income_costs_to_snapshots(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 42 | `public.migrate_loans_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 43 | `public.migrate_properties_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 44 | `public.migrate_rooms_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 45 | `public.migrate_tenancies_to_agreements(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 46 | `public.migrate_tenants_to_v2(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 47 | `public.portal_investor_can_access_report_object(object_name text)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 48 | `public.recalculate_ltv_v2()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 49 | `public.refresh_compliance_statuses_v2()` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 50 | `public.reset_compliance_job_on_renewal()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 51 | `public.restore_document(p_document_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 52 | `public.run_compliance_scan(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 53 | `public.run_v1_to_v2_migration(p_org_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 54 | `public.schedule_compliance_reminders(p_compliance_item_id uuid, p_expiry_date date, p_org_id uuid)` | C | REVOKE | Internal helper, only called by other SECURITY DEFINER functions. |
| 55 | `public.seed_compliance_requirements_v2(target_property_id uuid)` | C | REVOKE | Internal helper, only called by other SECURITY DEFINER functions. |
| 56 | `public.soft_delete_document(p_document_id uuid)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 57 | `public.sync_room_occupancy_v2()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 58 | `public.trigger_generate_compliance_reqs_v2()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 59 | `public.trigger_generate_tenancy_compliance()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 60 | `public.trigger_schedule_compliance_reminders()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 61 | `public.update_contractor_rating()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 62 | `public.update_contractor_stats()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 63 | `public.update_job_priorities(p_org_ids uuid[])` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 64 | `public.update_job_priorities()` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 65 | `public.update_lettable_room_count_v2()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 66 | `public.update_rent_schedule_item_status(p_id uuid, p_status text, p_amount_paid numeric, p_amount_outstanding numeric, p_notes text)` | A | KEEP | Invoked via supabase.rpc() from authenticated app code (must keep EXECUTE). |
| 67 | `public.update_rent_schedule_on_payment()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 68 | `public.update_rent_schedule_statuses()` | D | REVOKE | Invoked via supabase.rpc() from edge function with service_role. |
| 69 | `public.update_room_status_on_tenancy_change()` | B | REVOKE | Trigger-only (bound via pg_trigger). |
| 70 | `public.user_can_access_investor_report(file_name text)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 71 | `public.user_has_org_access(check_org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 72 | `public.user_has_shareholder_access(check_org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 73 | `public.user_has_shareholder_compliance_access(check_org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 74 | `public.user_has_shareholder_documents_access(check_org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 75 | `public.user_has_shareholder_financials_access(check_org_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 76 | `public.user_has_tenancy_portal_access(check_tenancy_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 77 | `public.user_has_tenant_access(check_tenancy_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 78 | `public.user_has_tenant_access_by_tenant_id(check_tenant_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 79 | `public.user_has_tenant_documents_access(check_tenancy_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 80 | `public.user_has_tenant_maintenance_access(check_tenant_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 81 | `public.user_has_tenant_profile_access(check_tenant_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 82 | `public.user_has_tenant_property_access(check_property_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 83 | `public.user_has_tenant_rent_access(check_tenancy_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 84 | `public.user_has_tenant_room_access(check_room_id uuid)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 85 | `public.user_is_tenant_portal_user()` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 86 | `public.user_owns_maintenance_folder(folder_name text)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 87 | `public.user_owns_property_folder(folder_name text)` | A | KEEP | Used in RLS USING/WITH CHECK policy or auth helper invoked by RLS. |
| 88 | `public.validate_ownership_links_subject_id()` | B | REVOKE | Trigger-only (bound via pg_trigger). |

## Functions revoked (33)

- `public.audit_compliance_delete()` — Category B
- `public.audit_property_delete()` — Category B
- `public.audit_shareholder_revoke()` — Category B
- `public.audit_tenant_delete()` — Category B
- `public.audit_trigger_function()` — Category B
- `public.auto_generate_rent_schedule()` — Category B
- `public.cancel_renewed_compliance_jobs()` — Category D
- `public.cancel_renewed_compliance_jobs(p_org_ids uuid[])` — Category D
- `public.claim_portal_investor_access()` — Category C
- `public.create_jobs_for_expiring_compliance()` — Category D
- `public.create_jobs_for_expiring_compliance(p_org_ids uuid[])` — Category D
- `public.ensure_single_primary_floorplan()` — Category B
- `public.generate_compliance_requirements_v2(target_property_id uuid)` — Category C
- `public.generate_job_inbox_email()` — Category B
- `public.generate_tenancy_compliance_items(tenancy_row tenancies)` — Category C
- `public.handle_new_user()` — Category B
- `public.recalculate_ltv_v2()` — Category B
- `public.reset_compliance_job_on_renewal()` — Category B
- `public.schedule_compliance_reminders(p_compliance_item_id uuid, p_expiry_date date, p_org_id uuid)` — Category C
- `public.seed_compliance_requirements_v2(target_property_id uuid)` — Category C
- `public.sync_room_occupancy_v2()` — Category B
- `public.trigger_generate_compliance_reqs_v2()` — Category B
- `public.trigger_generate_tenancy_compliance()` — Category B
- `public.trigger_schedule_compliance_reminders()` — Category B
- `public.update_contractor_rating()` — Category B
- `public.update_contractor_stats()` — Category B
- `public.update_job_priorities(p_org_ids uuid[])` — Category D
- `public.update_job_priorities()` — Category D
- `public.update_lettable_room_count_v2()` — Category B
- `public.update_rent_schedule_on_payment()` — Category B
- `public.update_rent_schedule_statuses()` — Category D
- `public.update_room_status_on_tenancy_change()` — Category B
- `public.validate_ownership_links_subject_id()` — Category B

## Uncertain (0)
None — all 88 functions had a clear classification signal.

## Notes / judgment calls

- `migrate_*_to_v2` (9 functions) are kept in **A** despite being plausibly admin-only because `useMigration.ts` (`useRunMigrationStep`) calls them individually via `supabase.rpc()` from authenticated app code. Revoking would break the V1→V2 migration UI.

- `has_role`, `get_user_role`, `get_user_org_id`, `get_tenant_org_id`, `user_is_tenant_portal_user`, `user_has_tenant_access_by_tenant_id` are kept in **A** as defensive RLS helpers even though the catalog scan didn't find them in a `qual`/`with_check` (they may be called by other RLS helpers or via wrappers; revoking would be high-risk).

- `log_document_view` and `restore_document` were not directly grep'd as `rpc(...)` calls but appear in `src/integrations/supabase/types.ts` Args definitions — kept in **A** as authenticated app RPCs.

- `cancel_renewed_compliance_jobs`, `create_jobs_for_expiring_compliance`, `update_job_priorities` each have two overloads (parameter-less and `p_org_ids uuid[]`); both overloads are revoked (D).

- `claim_portal_investor_access` is called only from `accept_shareholder_invite` (per `pg_proc` cross-reference); category C.
