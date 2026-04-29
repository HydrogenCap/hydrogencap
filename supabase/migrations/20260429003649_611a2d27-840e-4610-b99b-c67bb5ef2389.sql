-- Stage A.2 of Supabase lint hardening (2026-04-29)
-- Buckets: 0028 (anon SECURITY DEFINER) + 0029 (authenticated SECURITY DEFINER)
-- Revokes EXECUTE on 33 SECURITY DEFINER functions in public schema:
--   - Category B (21): trigger-only functions
--   - Category C (5): internal helpers (only called by other SDF)
--   - Category D (7): edge-function-only RPCs (service_role bypasses revokes)
-- Service_role keeps EXECUTE implicitly (it bypasses object grants).
-- Idempotent: REVOKE on already-revoked is a no-op.
-- See docs/release/security-definer-audit-2026-04-29.md for full classification.

-- [B] Trigger-only
REVOKE EXECUTE ON FUNCTION public.audit_compliance_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_property_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_shareholder_revoke() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_tenant_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_function() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_generate_rent_schedule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_primary_floorplan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_job_inbox_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_ltv_v2() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_compliance_job_on_renewal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_room_occupancy_v2() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_generate_compliance_reqs_v2() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_generate_tenancy_compliance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_schedule_compliance_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contractor_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contractor_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lettable_room_count_v2() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rent_schedule_on_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_room_status_on_tenancy_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_ownership_links_subject_id() FROM PUBLIC, anon, authenticated;

-- [C] Internal helper (called only by other SECURITY DEFINER functions)
REVOKE EXECUTE ON FUNCTION public.claim_portal_investor_access() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_compliance_requirements_v2(target_property_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tenancy_compliance_items(tenancy_row tenancies) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_compliance_reminders(p_compliance_item_id uuid, p_expiry_date date, p_org_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_compliance_requirements_v2(target_property_id uuid) FROM PUBLIC, anon, authenticated;

-- [D] Edge-function-only RPC (service_role bypasses revokes)
REVOKE EXECUTE ON FUNCTION public.cancel_renewed_compliance_jobs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_renewed_compliance_jobs(p_org_ids uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_jobs_for_expiring_compliance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_jobs_for_expiring_compliance(p_org_ids uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_priorities() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_priorities(p_org_ids uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rent_schedule_statuses() FROM PUBLIC, anon, authenticated;