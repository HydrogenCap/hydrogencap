-- =====================================================================
-- SECURITY DEFINER function execute-grant audit
-- =====================================================================
-- Postgres grants EXECUTE on functions to PUBLIC by default. For
-- SECURITY DEFINER functions that means any anonymous or signed-in
-- caller can invoke them with the function-owner's privileges, which
-- the security scanner flags. This migration:
--   (1) Revokes EXECUTE from PUBLIC and anon on every SECURITY DEFINER
--       function in the public schema.
--   (2) Re-grants EXECUTE to `authenticated` only for functions that
--       are legitimately called from the client via supabase.rpc(...)
--       or used inside RLS policy expressions evaluated as the
--       calling role.
--   (3) Leaves server-only / migration / admin helpers with no client
--       grants — `service_role` retains EXECUTE via its existing role
--       grants and the function owner.
--
-- Function bodies are NOT modified.
-- The ordering below mirrors the inventory taken from pg_proc.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TRIGGER FUNCTIONS (returns trigger)
-- Decision: revoke from PUBLIC, anon, authenticated.
-- Trigger functions are invoked by the executor when a row event
-- fires, not by clients. Removing EXECUTE for client roles does NOT
-- break trigger firing — triggers run with table-owner privileges.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.audit_compliance_delete()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_property_delete()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_shareholder_revoke()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_tenant_delete()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_function()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_generate_rent_schedule()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_compliance_document_to_requirement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_waive_smoke_co_on_fire_alarm()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_demo_request_rate_limit()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_primary_floorplan()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_job_inbox_email()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_platform_role_change()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_ltv_v2()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_compliance_job_on_renewal()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_room_occupancy_v2()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_generate_compliance_reqs_v2()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_generate_tenancy_compliance()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_schedule_compliance_reminders()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contractor_rating()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contractor_stats()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lettable_room_count_v2()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rent_schedule_on_payment()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_room_status_on_tenancy_change()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.v1_freeze_guard()                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_ownership_links_subject_id()        FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS / POLICY HELPER FUNCTIONS
-- Decision: revoke from PUBLIC and anon; GRANT to authenticated.
-- These are invoked inside USING / WITH CHECK clauses while Postgres
-- evaluates RLS as the calling role. The calling role must hold
-- EXECUTE or the policy errors out. They are not exposed as RPCs.
-- (Functions whose policies also evaluate for anon get an extra anon
--  grant — none today: all org / tenant / shareholder helpers are
--  auth-scoped.)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)                     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_org_id()                            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_org_id()                            TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid, uuid)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_role(uuid, uuid)                    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_tenant_org_id()                          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_tenant_org_id()                          TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_org_access(uuid)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_org_access(uuid)                    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_shareholder_access(uuid)            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_shareholder_access(uuid)            TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_shareholder_compliance_access(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_shareholder_compliance_access(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_shareholder_documents_access(uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_shareholder_documents_access(uuid)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_shareholder_financials_access(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_shareholder_financials_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_tenancy_portal_access(uuid)         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenancy_portal_access(uuid)         TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_access(uuid)                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_access(uuid)                 TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_access_by_tenant_id(uuid)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_access_by_tenant_id(uuid)    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_documents_access(uuid)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_documents_access(uuid)       TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_maintenance_access(uuid)     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_maintenance_access(uuid)     TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_profile_access(uuid)         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_profile_access(uuid)         TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_property_access(uuid)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_property_access(uuid)        TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_rent_access(uuid)            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_rent_access(uuid)            TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_tenant_room_access(uuid)            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_tenant_room_access(uuid)            TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_is_tenant_portal_user()                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_is_tenant_portal_user()                 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_can_access_investor_report(text)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_can_access_investor_report(text)        TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_maintenance_folder(text)           FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_owns_maintenance_folder(text)           TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_property_folder(text)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_owns_property_folder(text)              TO authenticated;
REVOKE EXECUTE ON FUNCTION public.portal_investor_can_access_report_object(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.portal_investor_can_access_report_object(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.realtime_topic_authorized(text)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.realtime_topic_authorized(text)              TO authenticated;

-- ---------------------------------------------------------------------
-- PUBLIC-TOKEN RPCs (anonymous + authenticated callers)
-- Decision: revoke PUBLIC; GRANT to anon AND authenticated.
-- These are explicitly designed to be called without a logged-in
-- session, using a single-use token. Authorization is enforced
-- inside the function body by validating the token.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_shareholder_invite(text)                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_shareholder_invite(text)                 TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_tenant_portal_invite(text)               FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_tenant_portal_invite(text)               TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_document_share_link(text)            FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.consume_document_share_link(text)            TO anon, authenticated;

-- ---------------------------------------------------------------------
-- AUTHENTICATED CLIENT RPCs (called from src/ via supabase.rpc)
-- Decision: revoke from PUBLIC, anon; GRANT to authenticated.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.accept_shareholder_invite(text)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_shareholder_invite(text)              TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_team_invite(text)                     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_team_invite(text)                     TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_tenant_portal_invite(text)            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_tenant_portal_invite(text)            TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_rent_schedule_status(uuid[], text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bulk_update_rent_schedule_status(uuid[], text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_portal_investor_access()               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_portal_investor_access()               TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization(text)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_organization(text)                    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.find_matching_contractors(uuid, text, text)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_matching_contractors(uuid, text, text)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_rent_schedule(uuid, integer)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_rent_schedule(uuid, integer)        TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_rent_schedule(uuid, integer, uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_rent_schedule(uuid, integer, uuid)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tax_year_summary(uuid, text, uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_tax_year_summary(uuid, text, uuid)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_investor_data()                   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_portal_investor_data()                   TO authenticated;
REVOKE EXECUTE ON FUNCTION public.global_search(text, uuid)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.global_search(text, uuid)                    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_rent_schedule_item(uuid, uuid, date, date, date, numeric, numeric, numeric, numeric, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.insert_rent_schedule_item(uuid, uuid, date, date, date, numeric, numeric, numeric, numeric, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_rent_schedule_item(uuid, uuid, date, date, date, numeric, numeric, numeric, numeric, text, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.insert_rent_schedule_item(uuid, uuid, date, date, date, numeric, numeric, numeric, numeric, text, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_document_download(uuid)                  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_document_download(uuid)                  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_compliance_statuses_v2()             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.refresh_compliance_statuses_v2()             TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_compliance_scan(uuid)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.run_compliance_scan(uuid)                    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_v1_to_v2_migration(uuid)                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.run_v1_to_v2_migration(uuid)                 TO authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_document(uuid)                   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_document(uuid)                   TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rent_schedule_item_status(uuid, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_rent_schedule_item_status(uuid, text, numeric, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------
-- SERVER-ONLY / EDGE-FUNCTION / ADMIN HELPERS
-- Decision: revoke from PUBLIC, anon, authenticated.
-- These are invoked by edge functions using the service-role key, by
-- pg_cron jobs, or by other SECURITY DEFINER functions internally.
-- service_role retains EXECUTE via its built-in role grants (it is
-- never affected by REVOKE ... FROM PUBLIC/anon/authenticated).
-- ---------------------------------------------------------------------

-- Called by scheduled / cron edge functions:
REVOKE EXECUTE ON FUNCTION public.cancel_renewed_compliance_jobs()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_renewed_compliance_jobs(uuid[])       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_jobs_for_expiring_compliance()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_jobs_for_expiring_compliance(uuid[])  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_priorities()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_priorities(uuid[])                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rent_schedule_statuses()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_compliance_reminders(uuid, date, uuid) FROM PUBLIC, anon, authenticated;

-- Invoked internally by run_v1_to_v2_migration (which is the only
-- entry point exposed to the client). Each migrate_* is service-role
-- only when called directly.
REVOKE EXECUTE ON FUNCTION public.migrate_companies_to_entities(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_compliance_to_v2(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_contractors_to_v2(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_income_costs_to_snapshots(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_loans_to_v2(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_properties_to_v2(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_rooms_to_v2(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_tenancies_to_agreements(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_tenants_to_v2(uuid)                  FROM PUBLIC, anon, authenticated;

-- Seed / generator helpers invoked from triggers and other SECDEF
-- functions; never called directly from the client.
REVOKE EXECUTE ON FUNCTION public.generate_compliance_requirements_v2(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_compliance_requirements_v2(uuid)        FROM PUBLIC, anon, authenticated;

-- Admin-only document operations (not in any client RPC path):
REVOKE EXECUTE ON FUNCTION public.log_document_view(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_document(uuid)                       FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- End of SECURITY DEFINER grant audit.
-- =====================================================================