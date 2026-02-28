import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://hydrogencap.com",
  "https://www.hydrogencap.com",
  "https://hydrogencapital.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN"),
].filter(Boolean) as string[];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
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
    next_accounts?: {
      period_end_on?: string;
      due_on?: string;
    };
    last_accounts?: {
      made_up_to?: string;
      period_end_on?: string;
    };
    accounting_reference_date?: {
      day?: string;
      month?: string;
    };
  };
  confirmation_statement?: {
    next_due?: string;
    last_made_up_to?: string;
    next_made_up_to?: string;
  };
}

interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
}

interface CompaniesHousePSC {
  name?: string;
  name_elements?: {
    forename?: string;
    surname?: string;
    title?: string;
  };
  kind: string;
  natures_of_control: string[];
  notified_on: string;
  ceased_on?: string;
}

interface FilingHistoryItem {
  date: string;
  type: string;
  description: string;
  category: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's JWT for authentication verification
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Companies House lookup for user ${userData.user.id}`);

    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY')?.trim();
    if (!apiKey) {
      console.error('COMPANIES_HOUSE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Companies House API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, companyNumber, searchQuery } = await req.json();
    console.log(`Companies House lookup: action=${action}, companyNumber=${companyNumber}, searchQuery=${searchQuery}`);

    // Companies House API uses HTTP Basic Auth with API key as username, empty password
    const chAuthHeader = `Basic ${btoa(apiKey + ':')}`;
    console.log(`CH Auth header length: ${chAuthHeader.length}, API key length: ${apiKey.length}`);

    if (action === 'search' && searchQuery) {
      // Search for companies by name
      const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchQuery)}&items_per_page=10`;
      console.log(`Searching companies: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: { 'Authorization': chAuthHeader }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Companies House search error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Companies House API error: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} companies`);
      
      return new Response(
        JSON.stringify({
          companies: data.items?.map((item: any) => ({
            company_number: item.company_number,
            company_name: item.title,
            company_status: item.company_status,
            date_of_creation: item.date_of_creation,
            address_snippet: item.address_snippet,
          })) || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'lookup' && companyNumber) {
      // Get full company profile
      const profileUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}`;
      console.log(`Looking up company: ${profileUrl}`);
      
      const profileResponse = await fetch(profileUrl, {
        headers: { 'Authorization': chAuthHeader }
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error(`Companies House lookup error: ${profileResponse.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Company not found: ${companyNumber}` }),
          { status: profileResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const company: CompaniesHouseCompany = await profileResponse.json();
      console.log(`Found company: ${company.company_name}`);
      console.log(`Accounts data:`, JSON.stringify(company.accounts));
      console.log(`Confirmation statement data:`, JSON.stringify(company.confirmation_statement));

      // Get officers
      let officers: CompaniesHouseOfficer[] = [];
      try {
        const officersUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
        const officersResponse = await fetch(officersUrl, {
          headers: { 'Authorization': chAuthHeader }
        });
        if (officersResponse.ok) {
          const officersData = await officersResponse.json();
          officers = officersData.items?.filter((o: any) => !o.resigned_on) || [];
          console.log(`Found ${officers.length} active officers`);
        }
      } catch (e) {
        console.warn('Failed to fetch officers:', e);
      }

      // Get Persons with Significant Control (shareholders)
      let pscs: CompaniesHousePSC[] = [];
      try {
        const pscsUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/persons-with-significant-control`;
        const pscsResponse = await fetch(pscsUrl, {
          headers: { 'Authorization': chAuthHeader }
        });
        if (pscsResponse.ok) {
          const pscsData = await pscsResponse.json();
          pscs = pscsData.items?.filter((p: any) => !p.ceased_on) || [];
          console.log(`Found ${pscs.length} active PSCs`);
        }
      } catch (e) {
        console.warn('Failed to fetch PSCs:', e);
      }

      // Get filing history for last filed dates
      let lastAccountsFiled: string | null = null;
      let lastConfirmationStatementFiled: string | null = null;
      try {
        const filingUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/filing-history?items_per_page=50`;
        const filingResponse = await fetch(filingUrl, {
          headers: { 'Authorization': chAuthHeader }
        });
        if (filingResponse.ok) {
          const filingData = await filingResponse.json();
          const items: FilingHistoryItem[] = filingData.items || [];
          
          // Find most recent accounts filing
          const accountsFiling = items.find((f: FilingHistoryItem) => 
            f.category === 'accounts' || 
            f.type.toLowerCase().includes('accounts') ||
            f.description.toLowerCase().includes('accounts')
          );
          if (accountsFiling) {
            lastAccountsFiled = accountsFiling.date;
          }

          // Find most recent confirmation statement filing
          const csFiling = items.find((f: FilingHistoryItem) => 
            f.category === 'confirmation-statement' ||
            f.type.toLowerCase().includes('confirmation') ||
            f.description.toLowerCase().includes('confirmation statement')
          );
          if (csFiling) {
            lastConfirmationStatementFiled = csFiling.date;
          }
          
          console.log(`Filing history: accounts filed=${lastAccountsFiled}, CS filed=${lastConfirmationStatementFiled}`);
        }
      } catch (e) {
        console.warn('Failed to fetch filing history:', e);
      }

      // Format registered address
      const addr = company.registered_office_address;
      const registeredAddress = addr 
        ? [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code, addr.country]
            .filter(Boolean).join(', ')
        : null;

      // Extract compliance dates
      const accountsDueDate = company.accounts?.next_due || 
                              company.accounts?.next_accounts?.due_on || 
                              null;
      const accountsPeriodEnd = company.accounts?.next_accounts?.period_end_on || 
                                 company.accounts?.last_accounts?.period_end_on ||
                                 null;
      const confirmationStatementDueDate = company.confirmation_statement?.next_due || null;
      const confirmationStatementLastMadeUpTo = company.confirmation_statement?.last_made_up_to || null;

      console.log(`Extracted dates: accounts_due=${accountsDueDate}, cs_due=${confirmationStatementDueDate}`);

      return new Response(
        JSON.stringify({
          company: {
            company_number: company.company_number,
            company_name: company.company_name,
            company_status: company.company_status,
            company_type: company.company_type,
            date_of_creation: company.date_of_creation,
            registered_address: registeredAddress,
          },
          officers: officers.map((o: any) => ({
            name: o.name,
            role: o.officer_role,
            appointed_on: o.appointed_on,
          })),
          significant_controllers: pscs.map((p: any) => ({
            name: p.name || `${p.name_elements?.forename || ''} ${p.name_elements?.surname || ''}`.trim(),
            kind: p.kind,
            natures_of_control: p.natures_of_control || [],
            notified_on: p.notified_on,
          })),
          // New compliance data
          compliance: {
            accounts_due_date: accountsDueDate,
            accounts_period_end: accountsPeriodEnd,
            accounts_last_filed_date: lastAccountsFiled,
            confirmation_statement_due_date: confirmationStatementDueDate,
            confirmation_statement_last_made_up_to: confirmationStatementLastMadeUpTo,
            confirmation_statement_last_filed_date: lastConfirmationStatementFiled,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "search" with searchQuery or "lookup" with companyNumber' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Companies House lookup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
