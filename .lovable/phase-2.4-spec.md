# HydrogenCap — NEXT Phase 2.4: Companies House API Integration

## Context

HydrogenCap manages properties through multiple SPVs. We have a `legal_entities` table with company numbers, directors, and shareholders — all manually entered. Manual data entry means manual errors, stale data, and no verification. An investor looking at HydrogenCap has no way of knowing whether the company number is correct, whether the directors listed match Companies House, or whether a confirmation statement is overdue.

Companies House provides a free REST API that returns company profiles, officer lists, filing history, and company status. Integrating this gives HydrogenCap:
- **Verification**: prove that SPV data in the system matches the official register
- **Auto-population**: pull company details instead of typing them
- **Monitoring**: detect overdue filings, director changes, or company status changes
- **Credibility**: investors trust a system that cross-references official sources

The Companies House API is free, requires only a simple API key, and has generous rate limits (600 requests per 5 minutes). This is one of the lowest-effort, highest-credibility integrations available.

## Important: API Key Configuration

The Companies House API requires an API key. The user must register at https://developer.company-information.service.gov.uk/ and create an application to get a key. This key will be stored in the app's settings.

**Note for Lovable:** Since Lovable apps use Supabase as the backend, API calls to Companies House should be made via a Supabase Edge Function (Deno) to keep the API key server-side and avoid exposing it in the frontend. If Edge Functions are not available, the API key can be stored in a settings table and calls made client-side — Companies House API supports CORS for browser requests with basic auth.

## Database Tables

### `companies_house_cache`

Cache API responses to reduce calls and provide offline access:

```sql
create table public.companies_house_cache (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.legal_entities(id) on delete cascade,
  company_number text not null,
  data_type text not null check (data_type in ('profile', 'officers', 'filing_history', 'registered_office')),
  response_data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now(),
  unique(entity_id, data_type)
);

create index idx_ch_cache_entity on public.companies_house_cache(entity_id);
create index idx_ch_cache_company on public.companies_house_cache(company_number);
create index idx_ch_cache_expires on public.companies_house_cache(expires_at);
```

### `companies_house_sync_log`

Track sync history and detect changes:

```sql
create table public.companies_house_sync_log (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.legal_entities(id) on delete cascade,
  company_number text not null,
  sync_type text not null check (sync_type in ('manual', 'auto', 'verification')),
  status text not null check (status in ('success', 'failed', 'not_found', 'rate_limited')),
  changes_detected jsonb,
  error_message text,
  synced_at timestamptz default now()
);

create index idx_ch_sync_entity on public.companies_house_sync_log(entity_id);
create index idx_ch_sync_date on public.companies_house_sync_log(synced_at);
```

### `app_settings`

A general settings table for storing configuration like API keys (if not already created):

```sql
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text,
  is_encrypted boolean default false,
  description text,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;
create policy "Authenticated access" on public.app_settings for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### RLS Policies

```sql
alter table public.companies_house_cache enable row level security;
alter table public.companies_house_sync_log enable row level security;

create policy "Authenticated access" on public.companies_house_cache for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.companies_house_sync_log for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Companies House Verification View

Create a view that compares local entity data with cached Companies House data to flag discrepancies:

```sql
create or replace view public.entity_verification_status as
select
  le.id as entity_id,
  le.entity_name,
  le.entity_type,
  le.company_number,
  le.status as local_status,
  le.incorporation_date as local_incorporation_date,
  le.registered_address as local_registered_address,
  chc.response_data->>'company_name' as ch_company_name,
  chc.response_data->>'company_status' as ch_company_status,
  chc.response_data->>'date_of_creation' as ch_incorporation_date,
  chc.response_data->'registered_office_address'->>'address_line_1' as ch_address_line_1,
  chc.response_data->'registered_office_address'->>'postal_code' as ch_postcode,
  chc.response_data->'accounts'->>'next_due' as ch_accounts_next_due,
  chc.response_data->'confirmation_statement'->>'next_due' as ch_confirmation_next_due,
  chc.response_data->>'has_charges' as ch_has_charges,
  chc.fetched_at as last_synced,
  -- Verification flags
  case
    when chc.response_data is null then 'not_synced'
    when le.company_number is null then 'no_company_number'
    when chc.response_data->>'company_status' = 'dissolved' and le.status != 'dissolved' then 'status_mismatch'
    when chc.response_data->>'company_status' != 'active' and le.status = 'active' then 'status_mismatch'
    else 'verified'
  end as verification_status,
  -- Filing alerts
  case
    when chc.response_data->'accounts'->>'next_due' is not null
      and (chc.response_data->'accounts'->>'next_due')::date < current_date
    then 'overdue'
    when chc.response_data->'accounts'->>'next_due' is not null
      and (chc.response_data->'accounts'->>'next_due')::date < current_date + interval '30 days'
    then 'due_soon'
    else 'ok'
  end as accounts_filing_status,
  case
    when chc.response_data->'confirmation_statement'->>'next_due' is not null
      and (chc.response_data->'confirmation_statement'->>'next_due')::date < current_date
    then 'overdue'
    when chc.response_data->'confirmation_statement'->>'next_due' is not null
      and (chc.response_data->'confirmation_statement'->>'next_due')::date < current_date + interval '30 days'
    then 'due_soon'
    else 'ok'
  end as confirmation_filing_status
from public.legal_entities le
left join public.companies_house_cache chc
  on chc.entity_id = le.id and chc.data_type = 'profile'
where le.entity_type = 'spv';
```

---

## Supabase Edge Function — Companies House API Client

Create a Supabase Edge Function that proxies requests to Companies House. This keeps the API key server-side.

**If Lovable supports Supabase Edge Functions**, create the following. **If not**, implement the API calls client-side using the API key from app_settings, sent as HTTP Basic Auth (API key as username, empty password).

### Edge Function: `companies-house`

```typescript
// supabase/functions/companies-house/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CH_API_BASE = 'https://api.company-information.service.gov.uk'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, company_number, entity_id } = await req.json()

    // Get API key from app_settings
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'companies_house_api_key')
      .single()

    if (!settings?.setting_value) {
      return new Response(
        JSON.stringify({ error: 'Companies House API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = settings.setting_value
    const authHeader = 'Basic ' + btoa(apiKey + ':')

    let endpoint = ''
    let dataType = ''

    switch (action) {
      case 'profile':
        endpoint = `/company/${company_number}`
        dataType = 'profile'
        break
      case 'officers':
        endpoint = `/company/${company_number}/officers`
        dataType = 'officers'
        break
      case 'filing_history':
        endpoint = `/company/${company_number}/filing-history?items_per_page=10`
        dataType = 'filing_history'
        break
      case 'search':
        endpoint = `/search/companies?q=${encodeURIComponent(company_number)}&items_per_page=10`
        dataType = 'profile'
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const response = await fetch(`${CH_API_BASE}${endpoint}`, {
      headers: { Authorization: authHeader }
    })

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limited by Companies House. Try again in a few minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (response.status === 404) {
      // Log not found
      if (entity_id) {
        await supabase.from('companies_house_sync_log').insert({
          entity_id, company_number, sync_type: 'manual', status: 'not_found',
          error_message: 'Company not found on Companies House register'
        })
      }
      return new Response(
        JSON.stringify({ error: 'Company not found', company_number }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    // Cache the response
    if (entity_id && action !== 'search') {
      await supabase.from('companies_house_cache').upsert({
        entity_id,
        company_number,
        data_type: dataType,
        response_data: data,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'entity_id,data_type' })

      // Log successful sync
      await supabase.from('companies_house_sync_log').insert({
        entity_id, company_number, sync_type: 'manual', status: 'success'
      })
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Client-Side Fallback (if Edge Functions unavailable)

If Lovable cannot deploy Edge Functions, create a utility module that calls the Companies House API directly from the browser:

```typescript
// src/lib/companiesHouse.ts

const CH_API_BASE = 'https://api.company-information.service.gov.uk';

export async function fetchCompanyProfile(apiKey: string, companyNumber: string) {
  const response = await fetch(`${CH_API_BASE}/company/${companyNumber}`, {
    headers: {
      Authorization: 'Basic ' + btoa(apiKey + ':'),
    },
  });
  if (!response.ok) throw new Error(`Companies House API error: ${response.status}`);
  return response.json();
}

export async function fetchCompanyOfficers(apiKey: string, companyNumber: string) {
  const response = await fetch(`${CH_API_BASE}/company/${companyNumber}/officers`, {
    headers: {
      Authorization: 'Basic ' + btoa(apiKey + ':'),
    },
  });
  if (!response.ok) throw new Error(`Companies House API error: ${response.status}`);
  return response.json();
}

export async function searchCompanies(apiKey: string, query: string) {
  const response = await fetch(`${CH_API_BASE}/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`, {
    headers: {
      Authorization: 'Basic ' + btoa(apiKey + ':'),
    },
  });
  if (!response.ok) throw new Error(`Companies House API error: ${response.status}`);
  return response.json();
}

export async function fetchFilingHistory(apiKey: string, companyNumber: string) {
  const response = await fetch(`${CH_API_BASE}/company/${companyNumber}/filing-history?items_per_page=10`, {
    headers: {
      Authorization: 'Basic ' + btoa(apiKey + ':'),
    },
  });
  if (!response.ok) throw new Error(`Companies House API error: ${response.status}`);
  return response.json();
}
```

---

## UI — Settings: Companies House Configuration

Add a **Companies House** section within Settings:

### API Key Configuration

- **API Key** (password input, masked — show last 4 characters only)
- "Save API Key" button — stores in app_settings with key = 'companies_house_api_key'
- "Test Connection" button — makes a test API call (fetch a known company, e.g. "00000006" which is a test company). Shows success/failure message.
- Help text: "Get your free API key from developer.company-information.service.gov.uk. Registration takes 2 minutes."
- Status indicator: green "Connected" if key is saved and last test was successful, red "Not Configured" if no key.

---

## UI — Entity Detail Page: Companies House Integration

Enhance the Entity Detail page for SPV entities with Companies House data.

### Verification Banner

At the top of the Entity Detail page, below the header, show a verification banner:

**If not synced:**
- Blue info banner: "This entity has not been verified against Companies House. [Sync Now] button"

**If verified and matching:**
- Green banner with checkmark: "Verified against Companies House — Last synced [relative time]. [Re-sync] button"

**If verification issues detected:**
- Amber/red banner with warning: "Discrepancies detected between local data and Companies House. Review below. [Re-sync] button"

### Companies House Data Panel

A collapsible panel titled "Companies House Data" on the Entity Detail page. Only visible for entities with entity_type = 'spv' and a company_number.

**Company Profile Section:**

When synced, show a two-column comparison:

| Field | HydrogenCap | Companies House | Status |
|-------|-------------|-----------------|--------|
| Company Name | [local entity_name] | [ch company_name] | ✅ Match / ⚠️ Mismatch |
| Status | [local status] | [ch company_status] | ✅ / ⚠️ |
| Incorporation Date | [local] | [ch date_of_creation] | ✅ / ⚠️ |
| Registered Address | [local] | [ch address] | ✅ / ⚠️ |

For each row:
- Green tick if values match (case-insensitive comparison, fuzzy on address)
- Amber warning if values differ
- "Update Local" button on mismatched rows — one click to overwrite local value with Companies House data

**Filing Status Section:**

Show upcoming filing deadlines:

- **Annual Accounts**: Next due [date]. Status badge: green if >30 days away, amber if ≤30 days, red if overdue.
- **Confirmation Statement**: Next due [date]. Same colour coding.
- **Last filed**: [description of most recent filing] on [date]

If either filing is overdue, show a prominent red alert: "OVERDUE FILING: [filing type] was due on [date]. This may result in Companies House striking off the company."

**Officers Section:**

Show the officers list from Companies House API alongside the local entity_directors:

| Officer (Companies House) | Role | Appointed | Local Match |
|---------------------------|------|-----------|-------------|
| [name] | Director | [date] | ✅ Found / ⚠️ Not in local records |

And vice versa:

| Director (Local) | Appointed | CH Match |
|------------------|-----------|----------|
| [name] | [date] | ✅ Found / ⚠️ Not on Companies House |

**Actions:**
- "Import Officers from CH" button — adds any Companies House officers not already in entity_directors
- "Import All Company Data" button — populates entity_name, incorporation_date, registered_address, and directors from Companies House in one action

**Filing History Section (collapsed by default):**

Table showing the last 10 filings from Companies House:
- Date
- Description (e.g. "Confirmation statement made on 15 January 2026")
- Type

---

## UI — Add Entity: Company Number Lookup

Enhance the Add Entity modal (from section 1.1) with Companies House lookup:

When entity_type = 'spv' is selected and the user types a company number:

1. After the user finishes typing (debounce 500ms) or clicks a "Lookup" button next to the company number field
2. Call the Companies House API with the company number
3. If found, show a preview card below the field:
   - Company name, status, incorporation date, registered address
   - "Auto-fill from Companies House" button
4. If clicked, auto-populate: entity_name, incorporation_date, registered_address from the API response
5. If not found, show a red message: "Company number not found on Companies House register. Check the number and try again."

### Company Search

Alternatively, add a "Search by Name" option:

- Text input for company name search
- Calls the Companies House search API
- Shows results as a dropdown list: company name, number, status, incorporation date
- Clicking a result auto-fills the company number and triggers the lookup above

---

## UI — Entities List Page: Verification Status

Update the Entities list page to show verification status:

Add a **CH Status** column to the entities table:
- Green tick "Verified" if entity_verification_status = 'verified'
- Amber "Not Synced" if 'not_synced'
- Red "Mismatch" if 'status_mismatch'
- Grey "N/A" if entity_type is not 'spv'

Add a **Filings** column:
- Green tick if both accounts and confirmation statement are not overdue
- Amber clock if either is due within 30 days
- Red exclamation if either is overdue
- Grey "N/A" if not SPV

### Bulk Sync Button

Add a "Sync All SPVs" button on the Entities list page that:
1. Iterates through all SPV entities with company numbers
2. Calls the Companies House profile API for each
3. Updates the cache
4. Shows a summary: "Synced X entities. Y discrepancies found. Z filings overdue."
5. Rate limit consideration: with 600 requests per 5 minutes, even 50 SPVs can be synced in one batch. Add a 500ms delay between requests to be respectful.

---

## UI — Update Executive Command Centre

Add Companies House alerts to the "Items Needing Attention" panel:

- Overdue filings: "[entity_name] — Annual accounts overdue since [date]"
- Upcoming filings: "[entity_name] — Confirmation statement due in [X] days"
- Status mismatches: "[entity_name] — Companies House status does not match local records"

---

## UI — Update Compliance Dashboard

Add a "Corporate Compliance" section or tab to the Compliance Dashboard showing the filing status of all SPVs:

Table:
- Entity Name
- Company Number
- Accounts Next Due (date + status badge)
- Confirmation Statement Next Due (date + status badge)
- Last Synced (relative time)
- Verification Status badge

This gives the compliance officer a single view of both property compliance (gas certs, EPCs, etc.) and corporate compliance (CH filings). Both can result in legal penalties if missed.

---

## Error Handling

### API Key Not Configured
If the user tries to sync without configuring an API key, show a friendly prompt:
"Companies House integration is not configured. Go to Settings > Companies House to add your API key."

### Rate Limiting
If the API returns 429, show:
"Companies House rate limit reached. The API allows 600 requests per 5 minutes. Please wait a few minutes and try again."

### Company Not Found
If a company number returns 404:
"Company number [XXXXXXXX] was not found on the Companies House register. This could mean: the number is incorrect, the company has been dissolved and removed from the register, or the company is registered in Scotland or Northern Ireland (different registries). Check the number and try again."

### Network Errors
If the API is unreachable:
"Could not connect to Companies House. Cached data from [date] is being shown. Try again later."
Fall back to cached data in companies_house_cache if available.

---

## Companies House API Response Mapping

Key fields from the Companies House company profile response:

```typescript
interface CompaniesHouseProfile {
  company_name: string;
  company_number: string;
  company_status: string; // 'active', 'dissolved', 'liquidation', etc.
  type: string; // 'ltd', 'plc', 'llp', etc.
  date_of_creation: string; // 'YYYY-MM-DD'
  registered_office_address: {
    address_line_1: string;
    address_line_2?: string;
    locality: string;
    region?: string;
    postal_code: string;
    country?: string;
  };
  accounts: {
    next_due: string; // 'YYYY-MM-DD'
    last_accounts?: {
      made_up_to: string;
      type: string;
    };
    accounting_reference_date: {
      month: string;
      day: string;
    };
  };
  confirmation_statement: {
    next_due: string;
    last_made_up_to?: string;
    next_made_up_to: string;
  };
  has_charges: boolean;
  has_been_liquidated: boolean;
  has_insolvency_history: boolean;
  sic_codes: string[];
}

interface CompaniesHouseOfficer {
  name: string;
  officer_role: string; // 'director', 'secretary', etc.
  appointed_on: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
  address: {
    address_line_1: string;
    locality: string;
    postal_code: string;
  };
}
```

---

## Design

- The verification comparison table is the centrepiece. Green ticks and amber warnings at a glance tell the operator whether their data is trustworthy. The "Update Local" one-click fix on mismatches removes friction.
- Filing deadline alerts should feel as urgent as compliance document expiries. A missed confirmation statement leads to a £5,000 fine and potential strike-off. Companies House compliance is corporate compliance — it belongs alongside property compliance.
- The company search on the Add Entity modal is a critical UX improvement. Instead of typing a company number from memory, the operator types "Hydrogen" and picks from the results. Auto-fill eliminates data entry errors on the most important entity fields.
- Cached data with "last synced" timestamps builds trust. The operator knows the data was verified against the official register at a specific time, not just typed in by someone.
- The comparison between local directors and Companies House officers catches a common problem: a director resigns but nobody updates the system, or a new director is appointed by the accountant but the operator does not know. The cross-reference surfaces these discrepancies automatically.

## TypeScript

Generate types for: companies_house_cache, companies_house_sync_log, app_settings. Type the entity_verification_status view. Create typed interfaces for the Companies House API responses: `CompaniesHouseProfile`, `CompaniesHouseOfficer`, `CompaniesHouseSearchResult`, `CompaniesHouseFilingHistoryItem`. Create a `VerificationStatus` union type.
