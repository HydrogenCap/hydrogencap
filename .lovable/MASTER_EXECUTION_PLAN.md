# Master Execution Plan — Batches AE, AB, AF, AG

## All Prompts

| # | Prompt | What It Delivers | Depends On | Tier Gate |
|---|--------|-----------------|------------|-----------|
| **AE1** | Onboarding V2 + Activation Checklist | Upgraded wizard (V2 tables, 6 steps incl. About You + Goals), persistent dashboard checklist tracking 6 setup milestones, contextual empty states | AA0 (V2 tables) | Free |
| **AE2** | Demo Portfolio Seed | 3 realistic UK properties with rooms, tenants, compliance, rent history, voids, maintenance. Load/remove with one click. | AE1 (onboarding integration) | Free |
| **AB1** | Tax & Section 24 Engine | SA105 data calculator, Section 24 mortgage interest relief, per-property and per-entity tax summaries, manual expense entry, CSV/PDF export | AA3a (P&L data) | Portfolio+ |
| **AB2** | Investor Portal V2 + Distributions | Migrate portal to V2 tables, `distributions` + `distribution_allocations` tables, quarterly distribution workflow, per-shareholder statements, statement PDF | AA0 (V2 tables) | Pro |
| **AF1** | Mobile Responsive Fix | Bottom nav bar, stacked KPIs, table→card view on mobile, horizontal scroll tables, Sheet modals on mobile, touch targets, compliance matrix vertical mode | Nothing | All |
| **AF2** | Tenant Portal V2 + Maintenance Submit | Migrate all tenant portal queries to V2, tenant maintenance submission form with photo upload, certificate download access | AA0, AC2a (photos) | All |
| **AG1** | Document Template Generator | 7 pre-filled legal document templates (S21, S8, S13, guarantor, inventory, How to Rent, reference request), PDF generation, compliance pre-flight checks, document history | AA0 (V2 data) | Portfolio+ |
| **AG2** | Bulk Document Scanner UI | Drag-drop up to 50 files, AI classification via existing edge functions, property auto-matching, review/confirm table, bulk file to compliance records | AA0 (V2 tables) | Portfolio+ |

## Recommended Execution Order

### Priority 1: Activation & Retention (do these first)

```
AE1 → AE2
```

**Why first:** New users currently see an empty dashboard with no guidance. Every sign-up that doesn't add a property in the first session is likely lost. The onboarding upgrade + demo data dramatically improve first-session activation.

### Priority 2: Mobile (do alongside Priority 1)

```
AF1 (no dependencies — can start immediately)
```

**Why now:** Landlords are on-site constantly. If the app is unusable on mobile, they won't use it for compliance checks or maintenance logging — the two highest-frequency use cases.

### Priority 3: Revenue Features (after AA-series V2 migration)

```
AB1 (Tax) — standalone after AA3a
AB2 (Investor Portal V2) — standalone after AA0
AG1 (Doc Templates) — standalone after AA0
AG2 (Bulk Scanner) — standalone after AA0
AF2 (Tenant Portal V2) — after AA0 + ideally AC2a
```

These can run in parallel since they're independent. Prioritise based on which drives the most upgrades:
- **AB1 (Tax)** if your users are approaching January self-assessment
- **AG2 (Bulk Scanner)** if users are onboarding with existing portfolios (reduces data entry friction)
- **AG1 (Doc Templates)** if users are actively managing tenancies
- **AB2 (Distributions)** if you have Pro tier subscribers

## Parallel Execution Map

```
Week 1-2: AE1 + AF1 (in parallel — zero overlap)
Week 2-3: AE2 (depends on AE1)
Week 3+:  AB1, AB2, AF2, AG1, AG2 (all in parallel after AA0 complete)
```

## What Already Exists (don't rebuild)

| Feature | Status | Prompt Upgrades |
|---------|--------|-----------------|
| Onboarding wizard | ✅ Exists (V1 tables, 4 steps) | AE1 migrates to V2, adds 2 steps |
| EmptyState component | ✅ Exists | AE1 adds contextual copy |
| Report generator | ✅ 5 templates (compliance, broker pack, insurance, tenant schedule) | No changes needed |
| Mortgage broker pack PDF | ✅ Full implementation | No changes needed |
| Tenant portal | ✅ 5 pages (843 lines, V1 tables) | AF2 migrates to V2 |
| Investor portal | ✅ 373 lines (V1 tables) | AB2 migrates to V2 |
| `categorise-documents` edge fn | ✅ 763 lines | AG2 builds UI on top |
| `process-document` edge fn | ✅ Exists | AG2 uses as-is |
| `process-tenancy-agreement` edge fn | ✅ Exists | Not touched |

## Total New Prompts: 8

Combined with previous batches:
- AA-series: 13 prompts (V2 migration + core features)
- AC-series: 5 prompts (operations automation)
- AD0-series: 2 prompts (admin panel)
- WZ-series: 2 prompts (property wizard)
- UX audit: 1 document
- **AE/AB/AF/AG: 8 prompts** (this batch)

**Grand total: 31 Lovable-ready feature prompts**
