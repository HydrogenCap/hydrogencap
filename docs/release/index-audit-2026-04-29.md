# Index Audit — Hot FK Coverage (2026-04-29)

Scope: foreign key columns on dashboard hot tables. A FK is considered "covered" if at least one btree index exists with that column as the **leading** key (a non-leading position in a composite does not satisfy FK lookups / `ON DELETE` checks).

## Coverage Table

| Table | FK Column | Indexed (leading)? | Action |
|---|---|---|---|
| audit_log | org_id | ✅ | — |
| capex_projects | org_id | ❌ | **ADD** `idx_capex_projects_org_id` |
| capex_projects | property_id | ❌ | **ADD** `idx_capex_projects_property_id` |
| costs | property_id | ✅ (composite `(property_id, year)`) | — |
| document_extractions | document_id | ✅ | — |
| documents | ai_suggested_property_id | ❌ | **ADD** `idx_documents_ai_suggested_property_id` |
| documents | company_id | ✅ | — |
| documents | compliance_item_id | ✅ | — |
| documents | contractor_job_id | ✅ | — |
| documents | org_id | ✅ | — |
| documents | previous_version_id | ❌ | **ADD** `idx_documents_previous_version_id` (version-history walks) |
| documents | property_id | ✅ | — |
| documents | tenancy_id | ✅ | — |
| documents | tenant_id | ✅ | — |
| financial_snapshots | entity_id, org_id, property_id | ✅ | — |
| income | property_id | ✅ | — |
| loans | property_id | ✅ | — |
| maintenance_requests | linked_request_id | ❌ | **ADD** `idx_maintenance_requests_linked_request_id` |
| maintenance_requests | org_id, property_id, property_v2_id, room_id, room_v2_id, tenant_id, tenant_v2_id | ✅ | — |
| memberships | org_id, user_id | ✅ | — |
| notifications | org_id | ✅ | — |
| properties_v2 | entity_id, org_id | ✅ | — |
| properties_v2 | legal_owner_company_id | ❌ | **ADD** `idx_properties_v2_legal_owner_company_id` |
| properties_v2 | legal_owner_party_id | ❌ | **ADD** `idx_properties_v2_legal_owner_party_id` |
| rent_payments | agreement_id, tenancy_id | ✅ | — |
| rent_payments | bank_transaction_id | ❌ | **ADD** `idx_rent_payments_bank_transaction_id` (reconciliation joins) |
| rent_payments | org_id | ❌ | **ADD composite** `idx_rent_payments_org_paid_at` `(org_id, paid_at DESC)` — every dashboard rent query filters by org and orders/filters by paid_at |
| rent_payments | recorded_by | ❌ | **SKIP** — low-cardinality audit field, never joined in hot paths |
| rent_payments | rent_schedule_id | ❌ | **ADD** `idx_rent_payments_rent_schedule_id` |
| rooms_v2 | property_id, unit_id | ✅ | — |
| tenancy_agreements | org_id, property_id, room_id, tenant_id | ✅ | — |
| tenants_v2 | org_id | ✅ | — |
| work_orders | approved_by | ❌ | **SKIP** — admin filter only, low cardinality, not in hot paths |
| work_orders | entity_id, org_id, property_id | ✅ | — |
| work_orders | maintenance_request_id | ❌ | **ADD** `idx_work_orders_maintenance_request_id` |
| work_orders | raised_by | ❌ | **SKIP** — same reasoning as `approved_by` |
| work_orders | room_id | ❌ | **ADD** `idx_work_orders_room_id` |

## Tables Out of Scope

| Table | Reason |
|---|---|
| `organization_members` | Does not exist in schema — superseded by `memberships`. |
| `compliance_checks` | Does not exist in schema — current model uses `compliance_requirements` / `documents`. |

## Composite Index Justifications

- **`(rent_payments.org_id, paid_at DESC)`**: every dashboard widget that lists rent activity filters by `org_id` (RLS-aligned) and orders by `paid_at` desc, or windows by paid_at for the "Last 12 months" P&L. A single composite removes a sort and avoids fetching org-id-only matches.

## Skip Reasoning Summary

- `rent_payments.recorded_by`, `work_orders.approved_by`, `work_orders.raised_by`: low-cardinality `auth.users` FKs only used for audit display, never on a hot read path. Index maintenance cost > benefit.

## Coverage Stats

- FKs inspected: **53**
- Already covered: **41**
- Indexes to add: **9** (incl. 1 composite)
- Deliberate skips: **3**
- Worst-coverage tables: `capex_projects` (0/2), `rent_payments` (2/6), `work_orders` (4/7).
