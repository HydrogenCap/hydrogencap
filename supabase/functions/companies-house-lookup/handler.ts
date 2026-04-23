/**
 * Testable core of the companies-house-lookup edge function.
 *
 * No top-level esm.sh imports, no Deno.env reads — all dependencies injected
 * via `deps`. `index.ts` owns the runtime wiring (real supabase client, env,
 * real fetch).
 */

// deno-lint-ignore no-explicit-any
export type SupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface HandleDeps {
  supabase: SupabaseLike;
  fetch: FetchLike;
  corsHeaders: Record<string, string>;
  apiKey: string | undefined;
}

interface CompaniesHouseCompany {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  accounts?: {
    next_due?: string;
    next_accounts?: { period_end_on?: string; due_on?: string };
    last_accounts?: { made_up_to?: string; period_end_on?: string };
  };
  confirmation_statement?: {
    next_due?: string;
    last_made_up_to?: string;
    next_made_up_to?: string;
  };
}

interface FilingHistoryItem {
  date: string;
  type: string;
  description: string;
  category: string;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Format the registered office address as a comma-separated string. */
export function formatRegisteredAddress(addr?: CompaniesHouseCompany["registered_office_address"]): string | null {
  if (!addr) return null;
  const parts = [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Pick the accounts-due date with the documented fallback order. */
export function pickAccountsDueDate(accounts?: CompaniesHouseCompany["accounts"]): string | null {
  return accounts?.next_due ?? accounts?.next_accounts?.due_on ?? null;
}

export function pickAccountsPeriodEnd(accounts?: CompaniesHouseCompany["accounts"]): string | null {
  return accounts?.next_accounts?.period_end_on ?? accounts?.last_accounts?.period_end_on ?? null;
}

/** Find the most recent accounts filing in a filing history list. */
export function findAccountsFiling(items: FilingHistoryItem[]): FilingHistoryItem | undefined {
  return items.find((f) =>
    f.category === "accounts" ||
    f.type.toLowerCase().includes("accounts") ||
    f.description.toLowerCase().includes("accounts")
  );
}

/** Find the most recent confirmation statement filing. */
export function findConfirmationStatementFiling(items: FilingHistoryItem[]): FilingHistoryItem | undefined {
  return items.find((f) =>
    f.category === "confirmation-statement" ||
    f.type.toLowerCase().includes("confirmation") ||
    f.description.toLowerCase().includes("confirmation statement")
  );
}

export async function handleCompaniesHouseLookup(req: Request, deps: HandleDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: deps.corsHeaders });
  }

  try {
    // Auth check.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }
    const { data: userData, error: authError } = await deps.supabase.auth.getUser();
    if (authError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401, deps.corsHeaders);
    }

    if (!deps.apiKey) {
      return json({ error: "Companies House API key not configured" }, 500, deps.corsHeaders);
    }

    const body = await req.json();
    const { action, companyNumber, searchQuery } = body as {
      action?: string;
      companyNumber?: string;
      searchQuery?: string;
    };

    const chAuthHeader = `Basic ${btoa(deps.apiKey + ":")}`;

    // ─── Search path ───
    if (action === "search" && searchQuery) {
      const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchQuery)}&items_per_page=10`;
      const response = await deps.fetch(searchUrl, { headers: { Authorization: chAuthHeader } });

      if (!response.ok) {
        return json({ error: `Companies House API error: ${response.status}` }, response.status, deps.corsHeaders);
      }

      const data = await response.json();
      return json({
        companies: (data.items || []).map((item: Record<string, unknown>) => ({
          company_number: item.company_number,
          company_name: item.title,
          company_status: item.company_status,
          date_of_creation: item.date_of_creation,
          address_snippet: item.address_snippet,
        })),
      }, 200, deps.corsHeaders);
    }

    // ─── Lookup path ───
    if (action === "lookup" && companyNumber) {
      const base = `https://api.company-information.service.gov.uk/company/${companyNumber}`;
      const profileResponse = await deps.fetch(base, { headers: { Authorization: chAuthHeader } });

      if (!profileResponse.ok) {
        return json({ error: `Company not found: ${companyNumber}` }, profileResponse.status, deps.corsHeaders);
      }

      const company: CompaniesHouseCompany = await profileResponse.json();

      // Officers, PSCs, and filing history are best-effort — failures are logged
      // but don't abort the response.
      interface RawOfficer { name: string; officer_role: string; appointed_on: string; resigned_on?: string }
      interface RawPsc {
        name?: string;
        name_elements?: { forename?: string; surname?: string; title?: string };
        kind: string;
        natures_of_control?: string[];
        notified_on: string;
        ceased_on?: string;
      }

      let officers: RawOfficer[] = [];
      try {
        const r = await deps.fetch(`${base}/officers`, { headers: { Authorization: chAuthHeader } });
        if (r.ok) {
          const d = await r.json();
          officers = (d.items || []).filter((o: RawOfficer) => !o.resigned_on);
        }
      } catch (e) { console.warn("Failed to fetch officers:", e); }

      let pscs: RawPsc[] = [];
      try {
        const r = await deps.fetch(`${base}/persons-with-significant-control`, { headers: { Authorization: chAuthHeader } });
        if (r.ok) {
          const d = await r.json();
          pscs = (d.items || []).filter((p: RawPsc) => !p.ceased_on);
        }
      } catch (e) { console.warn("Failed to fetch PSCs:", e); }

      let lastAccountsFiled: string | null = null;
      let lastConfirmationStatementFiled: string | null = null;
      try {
        const r = await deps.fetch(`${base}/filing-history?items_per_page=50`, { headers: { Authorization: chAuthHeader } });
        if (r.ok) {
          const d = await r.json();
          const items: FilingHistoryItem[] = d.items || [];
          const accountsFiling = findAccountsFiling(items);
          if (accountsFiling) lastAccountsFiled = accountsFiling.date;
          const csFiling = findConfirmationStatementFiling(items);
          if (csFiling) lastConfirmationStatementFiled = csFiling.date;
        }
      } catch (e) { console.warn("Failed to fetch filing history:", e); }

      return json({
        company: {
          company_number: company.company_number,
          company_name: company.company_name,
          company_status: company.company_status,
          company_type: company.company_type,
          date_of_creation: company.date_of_creation,
          registered_address: formatRegisteredAddress(company.registered_office_address),
        },
        officers: officers.map((o) => ({
          name: o.name,
          role: o.officer_role,
          appointed_on: o.appointed_on,
        })),
        significant_controllers: pscs.map((p) => ({
          name: p.name || `${p.name_elements?.forename || ""} ${p.name_elements?.surname || ""}`.trim(),
          kind: p.kind,
          natures_of_control: p.natures_of_control || [],
          notified_on: p.notified_on,
        })),
        compliance: {
          accounts_due_date: pickAccountsDueDate(company.accounts),
          accounts_period_end: pickAccountsPeriodEnd(company.accounts),
          accounts_last_filed_date: lastAccountsFiled,
          confirmation_statement_due_date: company.confirmation_statement?.next_due || null,
          confirmation_statement_last_made_up_to: company.confirmation_statement?.last_made_up_to || null,
          confirmation_statement_last_filed_date: lastConfirmationStatementFiled,
        },
      }, 200, deps.corsHeaders);
    }

    return json({ error: 'Invalid action. Use "search" with searchQuery or "lookup" with companyNumber' }, 400, deps.corsHeaders);
  } catch (error) {
    console.error("Companies House lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return json({ error: errorMessage }, 500, deps.corsHeaders);
  }
}
