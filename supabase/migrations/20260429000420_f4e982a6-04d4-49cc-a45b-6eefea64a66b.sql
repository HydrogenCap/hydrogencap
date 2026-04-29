
-- FK index coverage hardening — see docs/release/index-audit-2026-04-29.md

CREATE INDEX IF NOT EXISTS idx_capex_projects_org_id ON public.capex_projects (org_id);
CREATE INDEX IF NOT EXISTS idx_capex_projects_property_id ON public.capex_projects (property_id);

CREATE INDEX IF NOT EXISTS idx_documents_ai_suggested_property_id ON public.documents (ai_suggested_property_id);
CREATE INDEX IF NOT EXISTS idx_documents_previous_version_id ON public.documents (previous_version_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_linked_request_id ON public.maintenance_requests (linked_request_id);

CREATE INDEX IF NOT EXISTS idx_properties_v2_legal_owner_company_id ON public.properties_v2 (legal_owner_company_id);
CREATE INDEX IF NOT EXISTS idx_properties_v2_legal_owner_party_id ON public.properties_v2 (legal_owner_party_id);

CREATE INDEX IF NOT EXISTS idx_rent_payments_bank_transaction_id ON public.rent_payments (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_rent_schedule_id ON public.rent_payments (rent_schedule_id);
-- Composite: dashboard rent feeds filter by org and order/window by payment_date DESC
CREATE INDEX IF NOT EXISTS idx_rent_payments_org_payment_date ON public.rent_payments (org_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_maintenance_request_id ON public.work_orders (maintenance_request_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_room_id ON public.work_orders (room_id);
