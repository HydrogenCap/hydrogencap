const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { type, records } = await req.json();

    if (!type || !records?.length) {
      return new Response(JSON.stringify({ error: 'type and records are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'properties') {
      systemPrompt = `You are a UK property data expert. Given a list of properties with some missing fields, suggest realistic values based on the address, postcode, and any existing data. 

Rules:
- council_name: The local authority responsible for the area (e.g. "Birmingham City Council")
- council_area: The broader area/county (e.g. "West Midlands")  
- year_built: Estimate based on address, area character, and postcode. Use your knowledge of UK housing stock.
- has_gas_supply: Most UK properties have gas. Default true unless the area is known for off-grid properties.
- total_floors: Estimate based on property type if known
- Do NOT guess financial values (current_valuation, purchase_price) - leave those null
- Only suggest values for fields that are currently null

Return a JSON array of objects with id and only the fields you can fill. Do not include fields you cannot reasonably estimate.`;

      const simplified = records.map((r: any) => ({
        id: r.id,
        address: r.address_line_1,
        postcode: r.postcode,
        property_type: r.property_type,
        has_gas_supply: r.has_gas_supply,
        year_built: r.year_built,
        total_floors: r.total_floors,
        council_name: r.council_name,
        council_area: r.council_area,
      }));

      userPrompt = `Here are properties with missing data (null values need filling):\n\n${JSON.stringify(simplified, null, 2)}`;
    } else if (type === 'rooms') {
      systemPrompt = `You are a UK property rental expert. Given a list of rooms with some missing fields, suggest realistic values.

Rules:
- target_rent_pcm: If current_rent_pcm exists, suggest target as current + 5-10% rounded to nearest £25
- floor: Default to 0 (ground floor) for single-storey, or estimate based on room name
- Do NOT guess has_ensuite - leave null if unknown
- Only suggest values for fields that are currently null

Return a JSON array of objects with id and only the fields you can fill.`;

      const simplified = records.map((r: any) => ({
        id: r.id,
        room_name: r.room_name,
        property_address: r.property_address,
        room_type: r.room_type,
        current_rent_pcm: r.current_rent_pcm,
        target_rent_pcm: r.target_rent_pcm,
        floor: r.floor,
      }));

      userPrompt = `Here are rooms with missing data:\n\n${JSON.stringify(simplified, null, 2)}`;
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported type. Use "properties" or "rooms".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_gap_fills',
              description: 'Return suggested values for missing fields',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Record UUID' },
                        council_name: { type: 'string' },
                        council_area: { type: 'string' },
                        year_built: { type: 'number' },
                        has_gas_supply: { type: 'boolean' },
                        total_floors: { type: 'number' },
                        target_rent_pcm: { type: 'number' },
                        floor: { type: 'number' },
                      },
                      required: ['id'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['suggestions'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_gap_fills' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Usage limit reached. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No suggestions returned from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ suggestions: parsed.suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-gap-fill error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
