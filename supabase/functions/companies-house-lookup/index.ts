import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');
    if (!apiKey) {
      console.error('COMPANIES_HOUSE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Companies House API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, companyNumber, searchQuery } = await req.json();
    console.log(`Companies House lookup: action=${action}, companyNumber=${companyNumber}, searchQuery=${searchQuery}`);

    const authHeader = `Basic ${btoa(apiKey + ':')}`;

    if (action === 'search' && searchQuery) {
      // Search for companies by name
      const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchQuery)}&items_per_page=10`;
      console.log(`Searching companies: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: { 'Authorization': authHeader }
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
        headers: { 'Authorization': authHeader }
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

      // Get officers
      let officers: CompaniesHouseOfficer[] = [];
      try {
        const officersUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
        const officersResponse = await fetch(officersUrl, {
          headers: { 'Authorization': authHeader }
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
          headers: { 'Authorization': authHeader }
        });
        if (pscsResponse.ok) {
          const pscsData = await pscsResponse.json();
          pscs = pscsData.items?.filter((p: any) => !p.ceased_on) || [];
          console.log(`Found ${pscs.length} active PSCs`);
        }
      } catch (e) {
        console.warn('Failed to fetch PSCs:', e);
      }

      // Format registered address
      const addr = company.registered_office_address;
      const registeredAddress = addr 
        ? [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code, addr.country]
            .filter(Boolean).join(', ')
        : null;

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
