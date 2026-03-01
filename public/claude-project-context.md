# TenureIQ – Project Context for Claude

> **Generated**: 2026-03-01  
> **Stack**: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + Supabase (Lovable Cloud)  
> **Package name**: `tenureiq`

---

## 1. What is TenureIQ?

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

## 2. Key Differentiators

- **Compliance focus**: Deep coverage of UK property compliance (HMO, gas, electric, fire)
- **Entity model**: Flexible ownership structures via legal entities & ownership links
- **Investor portal**: White-label portal for investor reporting
- **AI features**: Integrated AI for insights, valuations, document processing

## 3. Data Model Highlights

- **Properties V2**: New property schema with flexible room configurations
- **Compliance V2**: New compliance system with documents, requirements, tasks
- **Tenants V2**: New tenant & tenancy schema
- **Legal Entities**: Companies, trusts, SPVs, individuals
- **Ownership Links**: Connect properties to legal entities
- **Rent Schedule**: Recurring rent schedule for tenancies
- **Rent Payments**: Records of rent payments received
- **Bank Transactions**: Imported bank transactions for reconciliation
- **Loan Facilities**: Loan facilities from lenders
- **Loans**: Individual loans against facilities

## 4. Authentication

- **Supabase Auth**: Standard Supabase auth for users
- **Row Level Security (RLS)**: Enforces multi-tenancy & access control
- **Shareholder Access**: Separate auth for investor portal
- **Tenant Portal Sessions**: Separate auth for tenant portal

## 5. Compliance System (V2)

- **Compliance**: Main compliance table with status, due dates
- **Compliance Documents**: Uploaded documents for compliance items
- **Compliance Requirements**: Requirements for compliance items
- **Compliance Tasks**: Tasks to complete requirements
- **Compliance Templates**: Templates for common compliance types
- **Contractors**: List of contractors for compliance work

## 6. AI Features

- **Compliance Checking**: AI checks compliance documents for issues
- **Valuations**: AI estimates property values
- **Portfolio Insights**: AI provides insights on portfolio performance
- **Document Processing**: AI extracts data from documents

## 7. Marketing Site

- **Pages**: `/`, `/product`, `/portfolio`, `/case-studies`, `/about`, `/contact`, `/demo`
- **Components**: MarketingNav, MarketingFooter, SEO
- **Layout**: MarketingLayout

## 8. Key Components

- **Dashboard**: Main dashboard with portfolio overview
- **PropertyList**: List of properties with filters & actions
- **PropertyDetails**: Details page for a single property
- **ComplianceList**: List of compliance items with filters & actions
- **ComplianceDetails**: Details page for a single compliance item
- **TenantList**: List of tenants with filters & actions
- **TenantDetails**: Details page for a single tenant
- **LegalEntityList**: List of legal entities with filters & actions
- **LegalEntityDetails**: Details page for a single legal entity

## 9. Supabase Functions

- **stripe_webhook**: Handles Stripe webhook events for subscriptions
- **generate_tenant_portal_session**: Generates tenant portal session for auth

## 10. Storage Buckets

- **compliance**: Stores compliance documents
- **compliance-documents**: Stores original uploaded compliance documents

## 11. Environment Variables

- `VITE_SUPABASE_URL`: Supabase URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side)
- `STRIPE_SECRET_KEY`: Stripe secret key (server-side)

## 12. Important Conventions

1. **Never edit**: `src/integrations/supabase/types.ts`, `src/integrations/supabase/client.ts`, `.env`, `supabase/config.toml`, `supabase/migrations/`
2. **Org scoping**: Always include `org_id` in inserts; RLS policies enforce access
3. **Query keys**: Follow pattern `['table_name', id?]`
4. **Imports**: Use `@/` path alias for all imports
5. **Lazy loading**: All pages are lazy-loaded in App.tsx
6. **Storage**: Use `compliance` and `compliance-documents` buckets with org-scoped folder paths
