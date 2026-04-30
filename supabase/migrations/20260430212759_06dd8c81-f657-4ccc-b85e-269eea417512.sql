-- Cosmetic-bucket FK re-point: V1 → V2 (zero rows affected)
-- Source: docs/release/v1-v2-fk-drift-2026-04-30.md §5.8

BEGIN;

-- =========================================================================
-- Preflight: assert zero drift on every FK before swapping. If any from-row
-- references a value that does not exist in the V2 sibling, abort the entire
-- transaction loudly.
-- =========================================================================
DO $preflight$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.maintenance_requests
    WHERE property_id IS NOT NULL AND property_id NOT IN (SELECT id FROM public.properties_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: maintenance_requests.property_id has % rows that would orphan against properties_v2', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.maintenance_requests
    WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (SELECT id FROM public.tenants_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: maintenance_requests.tenant_id has % rows that would orphan against tenants_v2', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.maintenance_requests
    WHERE room_id IS NOT NULL AND room_id NOT IN (SELECT id FROM public.rooms_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: maintenance_requests.room_id has % rows that would orphan against rooms_v2', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.company_metric_snapshots
    WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM public.legal_entities);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: company_metric_snapshots.company_id has % rows that would orphan against legal_entities', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.freeagent_connections
    WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM public.legal_entities);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: freeagent_connections.company_id has % rows that would orphan against legal_entities', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.tenant_portal_access
    WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (SELECT id FROM public.tenants_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: tenant_portal_access.tenant_id has % rows that would orphan against tenants_v2', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.tenant_portal_invites
    WHERE tenant_id IS NOT NULL AND tenant_id NOT IN (SELECT id FROM public.tenants_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: tenant_portal_invites.tenant_id has % rows that would orphan against tenants_v2', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.document_share_links
    WHERE compliance_document_id IS NOT NULL AND compliance_document_id NOT IN (SELECT id FROM public.compliance_documents_v2);
  IF v_count > 0 THEN RAISE EXCEPTION 'preflight: document_share_links.compliance_document_id has % rows that would orphan against compliance_documents_v2', v_count; END IF;
END
$preflight$;

-- =========================================================================
-- 1. maintenance_requests.property_id → properties_v2(id) ON DELETE RESTRICT
-- =========================================================================
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_property_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_property_id_fkey') THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- =========================================================================
-- 2. maintenance_requests.tenant_id → tenants_v2(id) (NO ACTION = default)
-- =========================================================================
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_tenant_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_tenant_id_fkey') THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants_v2(id);
  END IF;
END $$;

-- =========================================================================
-- 3. maintenance_requests.room_id → rooms_v2(id) (NO ACTION = default)
-- =========================================================================
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_room_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_room_id_fkey') THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES public.rooms_v2(id);
  END IF;
END $$;

-- =========================================================================
-- 4. company_metric_snapshots.company_id → legal_entities(id) ON DELETE CASCADE
-- =========================================================================
ALTER TABLE public.company_metric_snapshots
  DROP CONSTRAINT IF EXISTS company_metric_snapshots_company_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_metric_snapshots_company_id_fkey') THEN
    ALTER TABLE public.company_metric_snapshots
      ADD CONSTRAINT company_metric_snapshots_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.legal_entities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =========================================================================
-- 5. freeagent_connections.company_id → legal_entities(id) ON DELETE CASCADE
-- =========================================================================
ALTER TABLE public.freeagent_connections
  DROP CONSTRAINT IF EXISTS freeagent_connections_company_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freeagent_connections_company_id_fkey') THEN
    ALTER TABLE public.freeagent_connections
      ADD CONSTRAINT freeagent_connections_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.legal_entities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =========================================================================
-- 6. tenant_portal_access.tenant_id → tenants_v2(id) ON DELETE CASCADE
-- =========================================================================
ALTER TABLE public.tenant_portal_access
  DROP CONSTRAINT IF EXISTS tenant_portal_access_tenant_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_portal_access_tenant_id_fkey') THEN
    ALTER TABLE public.tenant_portal_access
      ADD CONSTRAINT tenant_portal_access_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =========================================================================
-- 7. tenant_portal_invites.tenant_id → tenants_v2(id) ON DELETE CASCADE
-- =========================================================================
ALTER TABLE public.tenant_portal_invites
  DROP CONSTRAINT IF EXISTS tenant_portal_invites_tenant_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_portal_invites_tenant_id_fkey') THEN
    ALTER TABLE public.tenant_portal_invites
      ADD CONSTRAINT tenant_portal_invites_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =========================================================================
-- 8. document_share_links.compliance_document_id → compliance_documents_v2(id) ON DELETE CASCADE
-- =========================================================================
ALTER TABLE public.document_share_links
  DROP CONSTRAINT IF EXISTS document_share_links_compliance_document_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_share_links_compliance_document_id_fkey') THEN
    ALTER TABLE public.document_share_links
      ADD CONSTRAINT document_share_links_compliance_document_id_fkey
      FOREIGN KEY (compliance_document_id) REFERENCES public.compliance_documents_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;