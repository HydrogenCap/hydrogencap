import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { propertyId } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'Property ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch property data
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      console.error('Property fetch error:', propError);
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch passport data if available
    const { data: passport } = await supabase
      .from('property_passport')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();

    // Build context for AI
    const propertyContext = {
      address: property.address_line,
      addressLine2: property.address_line2,
      postcode: property.postcode,
      townCity: property.town_city,
      county: property.county,
      areaName: property.area_name,
      propertyType: property.property_type,
      tenure: property.tenure,
      epcRating: property.epc_rating,
      beds: property.beds,
      bathrooms: property.bathrooms,
      constructionType: passport?.construction_type,
      councilTaxBand: passport?.council_tax_band,
      numberOfStoreys: passport?.number_of_storeys,
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a UK property expert specializing in estimating construction dates of residential properties. 
You will analyze property details and provide your best estimate of when the property was likely built.

Consider these factors when estimating:
- Street names and estate naming conventions (e.g., "Close", "Drive", "Walk" often indicate post-war development)
- Postcode areas and their development history
- Property types (Victorian terraces, Edwardian semis, 1930s semis, post-war council, 1960s-70s estates, modern developments)
- Construction type if known (solid wall = pre-1930s, cavity wall = post-1930s typically)
- Number of storeys and room counts
- Area names and their historical development patterns
- UK housing development patterns:
  * Pre-1900: Victorian terraces, large houses
  * 1900-1919: Edwardian, early council housing
  * 1920-1939: Semi-detached boom, early estates
  * 1945-1964: Post-war reconstruction, council estates
  * 1965-1980: High-rise, brutalist estates, new towns
  * 1980-1999: Private estates, starter homes
  * 2000+: Modern developments, apartments

Return your estimate as a construction date band and approximate year.`;

    const userPrompt = `Analyze this UK property and estimate when it was likely built:

${JSON.stringify(propertyContext, null, 2)}

Provide your response using the suggest_construction_date function.`;

    console.log('Calling AI for construction year estimate:', propertyContext);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_construction_date',
              description: 'Provide construction date estimate for a property',
              parameters: {
                type: 'object',
                properties: {
                  estimated_year: {
                    type: 'number',
                    description: 'Best guess for the year the property was built (e.g., 1935, 1972)',
                  },
                  construction_date_band: {
                    type: 'string',
                    enum: ['Pre-1900', '1900-1929', '1930-1949', '1950-1966', '1967-1975', '1976-1982', '1983-1990', '1991-1995', '1996-2002', '2003-2006', '2007 onwards', 'Unknown'],
                    description: 'The EPC-standard construction date band',
                  },
                  confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Confidence level in the estimate',
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief explanation of why this date was estimated (max 100 words)',
                  },
                },
                required: ['estimated_year', 'construction_date_band', 'confidence', 'reasoning'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_construction_date' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    console.log('AI response:', JSON.stringify(aiResponse, null, 2));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_construction_date') {
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    console.log('Parsed suggestion:', suggestion);

    return new Response(JSON.stringify({
      success: true,
      suggestion: {
        estimatedYear: suggestion.estimated_year,
        constructionDateBand: suggestion.construction_date_band,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in estimate-construction-year:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
