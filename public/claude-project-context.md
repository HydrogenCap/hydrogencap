# HydrogenCap – Project Context for Claude

> **Generated**: 2026-02-28  
> **Stack**: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + Supabase (Lovable Cloud)  
> **Package name**: `hydrogencap`

---

## 1. What is HydrogenCap?

A **UK property portfolio management SaaS** for HMO landlords and property companies. It covers:

- **Property & Room management** (V2 schema: `properties_v2`, `rooms_v2`)
- **Legal entity / ownership structures** (`legal_entities`, `ownership_links`, `parties`, `companies`)
- **Compliance tracking** (gas safety, EPC, EICR, fire risk, HMO licence – V2 system with documents, requirements, tasks, templates, contractors)
- **Tenant & tenancy management** (V2: `tenants_v2`, `tenancies_v2`)
- **Rent collection & reconciliation** (`rent_schedule`, `rent_payments`, `bank_transactions`)
- **Lending / loan facilities** (`loan_facilities`, `loans`)
- **Maintenance requests & work orders**
- **Investor / shareholder portal** (separate auth via `shareholder_access`)
- **Tenant portal** (separate auth via `tenant_portal_sessions`)
- **Subscription billing** via Stripe (webhook → `subscriptions` table, tiers: free / solo / portfolio / pro)
- **AI features**: compliance checking, valuations, portfolio insights, document processing (via Lovable AI models – no user API keys)
- **Marketing site** at `/`, `/product`, `/portfolio`, `/case-studies`, `/about`, `/contact`, `/demo`

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript |
| Styling | Tailwind CSS 3, shadcn/ui (Radix primitives), CVA |
| State | TanStack React Query v5, React Context |
| Routing | react-router-dom v6 (lazy-loaded pages) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet, Google Maps |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions + Realtime) |
| Payments | Stripe (checkout sessions, webhooks, customer portal) |
| PDF | jspdf + jspdf-autotable, pdf-lib |
| Testing | Vitest (unit), Playwright (e2e) |
| Error tracking | Sentry |

---

## 3. Project Structure

```
src/
├── App.tsx              # Route definitions, providers
├── main.tsx             # Entry point
├── index.css            # Tailwind + design tokens
├── contexts/
│   ├── AuthContext.tsx          # Supabase auth (email/password)
│   ├── SubscriptionContext.tsx  # Stripe subscription state
│   ├── LifecycleFilterContext.tsx
│   └── ThemeContext.tsx
├── hooks/               # ~120 custom hooks (data fetching, mutations)
├── pages/               # ~70 page components (lazy-loaded)
│   ├── marketing/       # Public marketing pages
│   ├── portal/          # Investor/shareholder portal
│   └── tenant-portal/   # Tenant self-service portal
├── components/          # ~50 component directories
│   ├── ui/              # shadcn/ui primitives
│   ├── layout/          # Shell, sidebar, nav
│   ├── properties-v2/   # V2 property components
│   ├── compliance-v2/   # V2 compliance components
│   ├── tenants-v2/      # V2 tenant components
│   └── ...
├── lib/                 # Business logic, calculations, types, CSV/PDF utils
├── integrations/supabase/
│   ├── client.ts        # Auto-generated Supabase client
│   └── types.ts         # Auto-generated DB types (10,175 lines)
├── types/               # Shared TypeScript types
└── utils/               # Utility functions

supabase/
├── config.toml          # Auto-managed config
├── migrations/          # SQL migrations (read-only)
└── functions/           # 41 Edge Functions
    ├── _shared/         # logger.ts, rateLimit.ts, validate.ts
    ├── stripe-webhook/
    ├── create-checkout/
    ├── customer-portal/
    ├── check-subscription/
    ├── ai-compliance-checker/
    ├── companies-house/
    ├── companies-house-lookup/
    ├── geocode-address/
    ├── process-document/
    ├── send-compliance-reminders/
    ├── portfolio-chat/
    ├── portfolio-insights/
    └── ... (41 total)
```

---

## 4. Database Schema (Key Tables)

### Core V2 Tables (current system)
- `properties_v2` – Property records with entity ownership
- `rooms_v2` – Room-level data per property
- `tenants_v2` – Tenant records
- `tenancies_v2` – Tenancy agreements linking tenants to rooms
- `legal_entities` – Companies, trusts, individuals that own properties
- `ownership_links` – Graph of ownership relationships

### Legacy V1 Tables (still in use by 17 hooks)
- `properties` – Original property table (still referenced by compliance, ownership, geocoding, import, passport, etc.)
- `loans`, `income`, `costs`, `tenancies` – V1 financial data

### Compliance V2
- `compliance_documents_v2` – Certificates with AI extraction
- `compliance_requirements_v2` – Per-property requirements
- `compliance_tasks` – Action items (renewals, inspections)
- `compliance_templates` – Master list of document types
- `compliance_contractors_v2` – Contractor database
- `compliance_notifications` – Alert system

### Financial
- `loan_facilities` – Lending facilities
- `rent_schedule` – Expected rent rows
- `rent_payments` – Actual payments received
- `bank_accounts` / `bank_transactions` – Banking data
- `subscriptions` – Stripe subscription state (webhook-managed)

### Other
- `organizations` / `memberships` – Multi-tenant org model
- `parties` / `companies` – Party registry
- `documents` – General document vault
- `activity_log` / `audit_log` – Activity tracking
- `app_settings` – Per-org settings
- `capex_projects` / `capex_line_items` – Capital expenditure

---

## 5. Auth & Multi-tenancy

- **Auth**: Supabase Auth with email/password (no auto-confirm)
- **Org model**: Users → `memberships` → `organizations`. Most tables have `org_id` column.
- **RLS**: Row Level Security on all tables. Policies check `auth.uid()` via `memberships` to scope data to org.
- **Subscription**: Stripe checkout → webhook writes to `subscriptions` table → realtime subscription in `SubscriptionContext`
- **Portals**: Investor portal (magic-link via `shareholder_access`), Tenant portal (via `tenant_portal_sessions`)

---

## 6. Key Patterns

### Data Fetching
```typescript
// All data fetching uses TanStack React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Org ID helper (used in mutations)
import { fetchUserOrgId } from '@/hooks/useUserOrg';
```

### Mutation Pattern
```typescript
export function useCreateSomething() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase.from('table').insert({...input, org_id: orgId}).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table'] });
    },
  });
}
```

### Error Handling
```typescript
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';
```

### Design System
- All colors via HSL CSS variables in `index.css`
- Tailwind semantic tokens: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, etc.
- shadcn/ui components with CVA variants
- Dark mode support via ThemeContext

---

## 7. Edge Functions (41 total)

| Function | Purpose |
|----------|---------|
| `stripe-webhook` | Handles Stripe events → writes `subscriptions` |
| `create-checkout` | Creates Stripe checkout session |
| `customer-portal` | Creates Stripe billing portal session |
| `check-subscription` | Manual subscription check fallback |
| `ai-compliance-checker` | AI document analysis |
| `process-document` | AI document extraction |
| `generate-ai-valuation` | AI property valuation |
| `portfolio-chat` | AI portfolio Q&A |
| `portfolio-insights` | AI portfolio analysis |
| `companies-house` / `companies-house-lookup` | Companies House API |
| `geocode-address` | Address geocoding |
| `send-compliance-reminders` | Email reminders |
| `send-job-request` / `send-job-reminders` | Contractor communications |
| `send-rent-reminder` | Rent reminder emails |
| `send-team-invite` | Team invitation emails |
| `portfolio-api` | External API access |
| `freeagent-*` | FreeAgent accounting integration |
| `bulk-epc-enrich` / `bulk-epc-enrich-v2` | EPC data enrichment |
| `bulk-price-paid-enrich` | Land Registry price paid data |
| `fetch-land-registry-comparables` | Comparable sales |

---

## 8. V1 → V2 Migration Status

The app has both V1 and V2 systems running in parallel:

**V2 (current/active)**:
- `properties_v2`, `rooms_v2`, `tenants_v2`, `tenancies_v2`
- `compliance_documents_v2`, `compliance_requirements_v2`, `compliance_tasks`
- Pages: `/properties-v2`, `/tenants-v2`, `/compliance-v2`

**V1 (legacy, still referenced)**:
- `properties` table still used by **17 hook files**: useProperties, useBeneficialGroups, useBulkPropertyUpdate, useCompanyLookthrough, useDocumentVault, useBatchImport, useGoLiveChecklist, useComplianceRequirements, useGeocoding, useBatchRenameDocuments, useOwnershipLinks, usePropertyPhotosV2, useCoreIdentity, usePassportPageData, useCompanyProperties, useMissingInfo, useOwnershipData
- V1 routes redirect to V2: `/properties/:id` → `/properties-v2/:id`

---

## 9. Subscription Tiers

| Tier | Properties | Key Features |
|------|-----------|-------------|
| Free | 2 | Basic access |
| Solo (£) | 10 | Compliance, tenants, contractors, basic reports |
| Portfolio (££) | 50 | + AI features, bank reports, ownership, analytics, shareable links |
| Pro (£££) | ∞ | + Shareholder portal, company secrets, passport autofill, API access, team roles |

---

## 10. File Counts

- **Pages**: ~70 `.tsx` files
- **Hooks**: ~120 `.ts` files  
- **Components**: ~50 directories with multiple files each
- **Edge Functions**: 41
- **DB Types**: 10,175 lines (auto-generated)
- **Lib utilities**: ~50 files

---

## 11. Key URLs

- Preview: `https://id-preview--921c381d-68a8-422e-836f-0fa87b53335d.lovable.app`
- Published: `https://hydrogencapital.lovable.app`

---

## 12. Important Conventions

1. **Never edit**: `src/integrations/supabase/types.ts`, `src/integrations/supabase/client.ts`, `.env`, `supabase/config.toml`, `supabase/migrations/`
2. **Org scoping**: Always include `org_id` in inserts; RLS policies enforce access
3. **Query keys**: Follow pattern `['table_name', id?]`
4. **Imports**: Use `@/` path alias for all imports
5. **Lazy loading**: All pages are lazy-loaded in App.tsx
6. **Storage**: Use `compliance` and `compliance-documents` buckets with org-scoped folder paths
