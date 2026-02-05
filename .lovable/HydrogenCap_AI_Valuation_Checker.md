# HydrogenCap Implementation Specification
## Phase 4.3: AI Property Valuation Checker

Automatically track property valuations using Land Registry data and AI estimates, identify refinancing opportunities, and alert when values significantly change.

---

# Overview

**What We're Building:**
1. **Automated Valuation Estimates** - Monthly automated valuations using Land Registry sold prices + AI adjustment
2. **Value Change Alerts** - Notifications when estimated value differs >10% from recorded value
3. **Refinancing Opportunity Detector** - Identify properties where equity release is possible
4. **Portfolio Value Tracking** - Historical charts showing portfolio value over time
5. **Comparable Sales View** - See recent sales near your properties

---

# Data Sources

## Primary: HM Land Registry Price Paid Data
- **Free, official data** - All property sales in England & Wales
- **Updated monthly** - ~2 week delay from completion
- **API Available** - SPARQL endpoint at landregistry.data.gov.uk
- **Coverage** - Back to 1995, millions of records

## Secondary: Zoopla/Rightmove Estimates (Optional Enhancement)
- Requires paid API access
- Better for current market conditions
- More accurate for specific properties

## Our Approach
1. Pull comparable sales from Land Registry (free)
2. Use AI to adjust for property differences (beds, condition, improvements)
3. Store monthly snapshots for trending
4. Alert on significant changes

---

# Database Migrations

```sql
-- Migration: Property Valuation Tracking
-- File: supabase/migrations/YYYYMMDD_property_valuations.sql

-- ============================================
-- VALUATION ESTIMATES TABLE
-- ============================================

CREATE TABLE public.property_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Valuation data
  estimated_value_gbp INTEGER NOT NULL,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  
  -- Source tracking
  valuation_method TEXT NOT NULL CHECK (valuation_method IN (
    'land_registry_comparable', 'manual', 'surveyor', 'ai_estimate', 'rightmove', 'zoopla'
  )),
  
  -- Comparable data used
  comparables_count INTEGER,
  comparables_avg_price INTEGER,
  comparables_min_price INTEGER,
  comparables_max_price INTEGER,
  
  -- AI adjustment factors
  adjustment_factors JSONB DEFAULT '{}',
  -- e.g., { "beds_adjustment": 15000, "condition_adjustment": -5000, "extension_adjustment": 25000 }
  
  -- Metadata
  valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one valuation per property per month
  UNIQUE(property_id, valuation_date)
);

ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage valuations"
ON public.property_valuations
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_valuations_property ON public.property_valuations(property_id, valuation_date DESC);
CREATE INDEX idx_valuations_date ON public.property_valuations(valuation_date);

-- ============================================
-- COMPARABLE SALES TABLE
-- ============================================

CREATE TABLE public.comparable_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Property this comparable relates to
  source_property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Sale details (from Land Registry)
  address TEXT NOT NULL,
  postcode TEXT NOT NULL,
  price_paid INTEGER NOT NULL,
  sale_date DATE NOT NULL,
  property_type TEXT, -- 'D' detached, 'S' semi, 'T' terrace, 'F' flat
  new_build BOOLEAN DEFAULT false,
  tenure TEXT, -- 'F' freehold, 'L' leasehold
  
  -- Location
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_meters INTEGER,
  
  -- Land Registry unique ID
  transaction_id TEXT UNIQUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparable_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view comparables"
ON public.comparable_sales
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_comparables_postcode ON public.comparable_sales(postcode);
CREATE INDEX idx_comparables_source ON public.comparable_sales(source_property_id);
CREATE INDEX idx_comparables_date ON public.comparable_sales(sale_date DESC);

-- ============================================
-- REFINANCING OPPORTUNITIES TABLE
-- ============================================

CREATE TABLE public.refinancing_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Current state
  current_value_gbp INTEGER NOT NULL,
  current_mortgage_gbp INTEGER NOT NULL,
  current_ltv DECIMAL(5, 2) NOT NULL,
  
  -- Opportunity details
  target_ltv DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
  potential_release_gbp INTEGER NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN (
    'identified', 'under_review', 'in_progress', 'completed', 'dismissed'
  )),
  
  -- Tracking
  identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refinancing_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage opportunities"
ON public.refinancing_opportunities
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- VALUATION ALERTS TABLE
-- ============================================

CREATE TABLE public.valuation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'value_increase', 'value_decrease', 'refinance_opportunity', 'comparable_sale'
  )),
  
  -- Values
  recorded_value_gbp INTEGER,
  estimated_value_gbp INTEGER,
  change_percent DECIMAL(5, 2),
  
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  
  -- Message
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage alerts"
ON public.valuation_alerts
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_valuation_alerts_unread ON public.valuation_alerts(org_id, is_read) WHERE is_read = false;

-- ============================================
-- ADD TRACKING COLUMNS TO PROPERTIES
-- ============================================

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS last_valuation_date DATE,
ADD COLUMN IF NOT EXISTS last_valuation_estimate INTEGER,
ADD COLUMN IF NOT EXISTS valuation_confidence TEXT,
ADD COLUMN IF NOT EXISTS value_change_percent DECIMAL(5, 2);

-- ============================================
-- HELPER FUNCTION: Calculate refinancing potential
-- ============================================

CREATE OR REPLACE FUNCTION calculate_refinancing_potential(
  p_property_id UUID,
  p_target_ltv DECIMAL DEFAULT 75.00
)
RETURNS TABLE (
  current_value INTEGER,
  current_mortgage INTEGER,
  current_ltv DECIMAL,
  max_mortgage_at_target INTEGER,
  potential_release INTEGER,
  is_opportunity BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_value INTEGER;
  v_mortgage INTEGER;
  v_current_ltv DECIMAL;
  v_max_mortgage INTEGER;
  v_potential_release INTEGER;
BEGIN
  -- Get current value (use latest estimate or recorded value)
  SELECT COALESCE(p.last_valuation_estimate, p.current_value_gbp)
  INTO v_current_value
  FROM properties p
  WHERE p.id = p_property_id;
  
  -- Get current mortgage
  SELECT COALESCE(l.current_balance, l.original_amount, 0)
  INTO v_mortgage
  FROM loans l
  WHERE l.property_id = p_property_id
  AND l.status = 'active'
  LIMIT 1;
  
  IF v_current_value IS NULL OR v_current_value = 0 THEN
    RETURN;
  END IF;
  
  v_current_ltv := (v_mortgage::DECIMAL / v_current_value) * 100;
  v_max_mortgage := (v_current_value * p_target_ltv / 100)::INTEGER;
  v_potential_release := v_max_mortgage - v_mortgage;
  
  RETURN QUERY SELECT
    v_current_value,
    v_mortgage,
    v_current_ltv,
    v_max_mortgage,
    v_potential_release,
    v_potential_release > 10000 AND v_current_ltv < p_target_ltv;
END;
$$;
```

---

# Edge Functions

## supabase/functions/fetch-land-registry-comparables/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Land Registry SPARQL endpoint
const LAND_REGISTRY_ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query';

interface ComparableSale {
  address: string;
  postcode: string;
  price_paid: number;
  sale_date: string;
  property_type: string;
  new_build: boolean;
  tenure: string;
  transaction_id: string;
}

async function fetchComparables(postcode: string, months: number = 24): Promise<ComparableSale[]> {
  // Extract postcode district (e.g., "GL50" from "GL50 2HH")
  const postcodeDistrict = postcode.split(' ')[0];
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const sparqlQuery = `
    PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
    
    SELECT ?paon ?saon ?street ?town ?postcode ?amount ?date ?propertyType ?newBuild ?tenure ?transactionId
    WHERE {
      ?transx lrppi:pricePaid ?amount ;
              lrppi:transactionDate ?date ;
              lrppi:propertyAddress ?addr ;
              lrppi:transactionId ?transactionId .
      
      ?addr lrcommon:postcode ?postcode .
      
      OPTIONAL { ?addr lrcommon:paon ?paon }
      OPTIONAL { ?addr lrcommon:saon ?saon }
      OPTIONAL { ?addr lrcommon:street ?street }
      OPTIONAL { ?addr lrcommon:town ?town }
      OPTIONAL { ?transx lrppi:propertyType ?propertyType }
      OPTIONAL { ?transx lrppi:newBuild ?newBuild }
      OPTIONAL { ?transx lrppi:estateType ?tenure }
      
      FILTER(STRSTARTS(?postcode, "${postcodeDistrict}"))
      FILTER(?date >= "${startDate.toISOString().split('T')[0]}"^^xsd:date)
      FILTER(?date <= "${endDate.toISOString().split('T')[0]}"^^xsd:date)
    }
    ORDER BY DESC(?date)
    LIMIT 100
  `;

  try {
    const response = await fetch(LAND_REGISTRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
      },
      body: `query=${encodeURIComponent(sparqlQuery)}`,
    });

    if (!response.ok) {
      throw new Error(`Land Registry API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.results.bindings.map((row: any) => {
      const parts = [
        row.saon?.value,
        row.paon?.value,
        row.street?.value,
        row.town?.value,
      ].filter(Boolean);
      
      return {
        address: parts.join(', '),
        postcode: row.postcode?.value || '',
        price_paid: parseInt(row.amount?.value || '0'),
        sale_date: row.date?.value || '',
        property_type: row.propertyType?.value?.split('/').pop() || 'unknown',
        new_build: row.newBuild?.value === 'true',
        tenure: row.tenure?.value?.split('/').pop() || 'unknown',
        transaction_id: row.transactionId?.value || '',
      };
    });
  } catch (error) {
    console.error('Error fetching from Land Registry:', error);
    return [];
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

serve(async (req) => {
  try {
    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'propertyId required' }), { status: 400 });
    }

    // Get property details
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, org_id, postcode, latitude, longitude, property_type, beds')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404 });
    }

    if (!property.postcode) {
      return new Response(JSON.stringify({ error: 'Property has no postcode' }), { status: 400 });
    }

    // Fetch comparables from Land Registry
    const comparables = await fetchComparables(property.postcode, 24);
    
    console.log(`Found ${comparables.length} comparables for ${property.postcode}`);

    // Store comparables in database
    const comparablesToInsert = comparables.map(comp => ({
      org_id: property.org_id,
      source_property_id: property.id,
      address: comp.address,
      postcode: comp.postcode,
      price_paid: comp.price_paid,
      sale_date: comp.sale_date,
      property_type: comp.property_type,
      new_build: comp.new_build,
      tenure: comp.tenure,
      transaction_id: comp.transaction_id,
    }));

    // Upsert comparables (avoid duplicates)
    const { error: insertError } = await supabase
      .from('comparable_sales')
      .upsert(comparablesToInsert, {
        onConflict: 'transaction_id',
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error('Error inserting comparables:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      comparables_found: comparables.length,
      postcode: property.postcode,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

## supabase/functions/generate-ai-valuation/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

interface Property {
  id: string;
  org_id: string;
  address_line: string;
  postcode: string;
  property_type: string;
  beds: number;
  current_value_gbp: number;
  purchase_price_gbp: number;
  purchase_date: string;
}

interface Comparable {
  address: string;
  postcode: string;
  price_paid: number;
  sale_date: string;
  property_type: string;
}

async function generateAIValuation(
  property: Property,
  comparables: Comparable[]
): Promise<{
  estimated_value: number;
  confidence: 'high' | 'medium' | 'low';
  adjustments: Record<string, number>;
  reasoning: string;
}> {
  
  const comparablesSummary = comparables.slice(0, 10).map(c => 
    `- ${c.address}, ${c.postcode}: £${c.price_paid.toLocaleString()} (${c.sale_date}, ${c.property_type})`
  ).join('\n');

  const avgPrice = comparables.length > 0
    ? Math.round(comparables.reduce((sum, c) => sum + c.price_paid, 0) / comparables.length)
    : 0;

  const prompt = `You are a UK property valuation expert. Estimate the current market value of this property based on comparable sales data.

SUBJECT PROPERTY:
- Address: ${property.address_line}, ${property.postcode}
- Type: ${property.property_type || 'Unknown'}
- Bedrooms: ${property.beds || 'Unknown'}
- Purchase Price: £${property.purchase_price_gbp?.toLocaleString() || 'Unknown'}
- Purchase Date: ${property.purchase_date || 'Unknown'}
- Owner's Current Estimate: £${property.current_value_gbp?.toLocaleString() || 'Not set'}

COMPARABLE SALES (last 24 months in area):
${comparablesSummary || 'No comparables found'}

Average comparable price: £${avgPrice.toLocaleString()}
Number of comparables: ${comparables.length}

Provide your valuation in the following JSON format only, no other text:
{
  "estimated_value": <number>,
  "confidence": "<high|medium|low>",
  "adjustments": {
    "base_comparable_avg": <number>,
    "beds_adjustment": <number>,
    "property_type_adjustment": <number>,
    "condition_assumption": <number>,
    "market_trend_adjustment": <number>
  },
  "reasoning": "<brief explanation of your valuation approach>"
}

Consider:
1. Property type differences (detached vs semi vs terrace vs flat)
2. Bedroom count differences
3. Recent market trends
4. Location within postcode area
5. Age and condition assumptions

Be conservative and realistic. If insufficient data, set confidence to "low".`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      estimated_value: Math.round(result.estimated_value),
      confidence: result.confidence,
      adjustments: result.adjustments,
      reasoning: result.reasoning,
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', responseText);
    
    // Fallback to simple average if AI fails
    return {
      estimated_value: avgPrice || property.current_value_gbp || 0,
      confidence: 'low',
      adjustments: { base_comparable_avg: avgPrice },
      reasoning: 'Fallback to comparable average due to parsing error',
    };
  }
}

serve(async (req) => {
  try {
    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'propertyId required' }), { status: 400 });
    }

    // Get property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404 });
    }

    // Get comparables
    const { data: comparables } = await supabase
      .from('comparable_sales')
      .select('*')
      .eq('source_property_id', propertyId)
      .order('sale_date', { ascending: false })
      .limit(20);

    // Generate AI valuation
    const valuation = await generateAIValuation(property, comparables || []);

    // Calculate change from recorded value
    const recordedValue = property.current_value_gbp || 0;
    const changePercent = recordedValue > 0
      ? ((valuation.estimated_value - recordedValue) / recordedValue) * 100
      : 0;

    // Store valuation
    const { data: savedValuation, error: saveError } = await supabase
      .from('property_valuations')
      .upsert({
        property_id: propertyId,
        org_id: property.org_id,
        estimated_value_gbp: valuation.estimated_value,
        confidence_level: valuation.confidence,
        valuation_method: 'ai_estimate',
        comparables_count: comparables?.length || 0,
        comparables_avg_price: comparables?.length 
          ? Math.round(comparables.reduce((s, c) => s + c.price_paid, 0) / comparables.length)
          : null,
        adjustment_factors: valuation.adjustments,
        notes: valuation.reasoning,
        valuation_date: new Date().toISOString().split('T')[0],
      }, {
        onConflict: 'property_id,valuation_date',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving valuation:', saveError);
    }

    // Update property with latest estimate
    await supabase
      .from('properties')
      .update({
        last_valuation_date: new Date().toISOString().split('T')[0],
        last_valuation_estimate: valuation.estimated_value,
        valuation_confidence: valuation.confidence,
        value_change_percent: Math.round(changePercent * 100) / 100,
      })
      .eq('id', propertyId);

    // Create alert if significant change
    if (Math.abs(changePercent) >= 10) {
      await supabase.from('valuation_alerts').insert({
        property_id: propertyId,
        org_id: property.org_id,
        alert_type: changePercent > 0 ? 'value_increase' : 'value_decrease',
        recorded_value_gbp: recordedValue,
        estimated_value_gbp: valuation.estimated_value,
        change_percent: Math.round(changePercent * 100) / 100,
        title: `${changePercent > 0 ? '📈' : '📉'} Value ${changePercent > 0 ? 'Increase' : 'Decrease'} Detected`,
        message: `${property.address_line} estimated at £${valuation.estimated_value.toLocaleString()} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% vs recorded £${recordedValue.toLocaleString()})`,
      });
    }

    // Check refinancing opportunity
    const { data: refinanceCheck } = await supabase
      .rpc('calculate_refinancing_potential', { p_property_id: propertyId });

    if (refinanceCheck?.[0]?.is_opportunity) {
      const opp = refinanceCheck[0];
      
      // Check if opportunity already exists
      const { data: existingOpp } = await supabase
        .from('refinancing_opportunities')
        .select('id')
        .eq('property_id', propertyId)
        .eq('status', 'identified')
        .maybeSingle();

      if (!existingOpp) {
        await supabase.from('refinancing_opportunities').insert({
          property_id: propertyId,
          org_id: property.org_id,
          current_value_gbp: opp.current_value,
          current_mortgage_gbp: opp.current_mortgage,
          current_ltv: opp.current_ltv,
          potential_release_gbp: opp.potential_release,
        });

        await supabase.from('valuation_alerts').insert({
          property_id: propertyId,
          org_id: property.org_id,
          alert_type: 'refinance_opportunity',
          estimated_value_gbp: opp.current_value,
          title: '💰 Refinancing Opportunity',
          message: `${property.address_line} could release £${opp.potential_release.toLocaleString()} at 75% LTV`,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      valuation: {
        estimated_value: valuation.estimated_value,
        confidence: valuation.confidence,
        change_percent: Math.round(changePercent * 100) / 100,
        comparables_used: comparables?.length || 0,
        reasoning: valuation.reasoning,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

## supabase/functions/run-monthly-valuations/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    // Get all properties that need valuation (haven't been valued this month)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, postcode, last_valuation_date')
      .eq('lifecycle_type', 'core_rental')
      .not('postcode', 'is', null);

    if (error) throw error;

    const propertiesToValue = properties?.filter(p => {
      if (!p.last_valuation_date) return true;
      return !p.last_valuation_date.startsWith(currentMonth);
    }) || [];

    console.log(`Processing ${propertiesToValue.length} properties for valuation`);

    const results = [];

    for (const property of propertiesToValue) {
      try {
        // First fetch comparables
        await fetch(`${SUPABASE_URL}/functions/v1/fetch-land-registry-comparables`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ propertyId: property.id }),
        });

        // Then generate AI valuation
        const valuationResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-ai-valuation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ propertyId: property.id }),
        });

        const result = await valuationResponse.json();
        results.push({ propertyId: property.id, success: true, ...result });

        // Rate limit to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        console.error(`Error valuing property ${property.id}:`, err);
        results.push({ propertyId: property.id, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

# Frontend Components

## src/hooks/usePropertyValuations.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PropertyValuation {
  id: string;
  property_id: string;
  estimated_value_gbp: number;
  confidence_level: 'high' | 'medium' | 'low';
  valuation_method: string;
  comparables_count: number;
  comparables_avg_price: number;
  adjustment_factors: Record<string, number>;
  valuation_date: string;
  notes: string;
}

export interface ComparableSale {
  id: string;
  address: string;
  postcode: string;
  price_paid: number;
  sale_date: string;
  property_type: string;
  new_build: boolean;
  tenure: string;
  distance_meters: number;
}

export interface ValuationAlert {
  id: string;
  property_id: string;
  alert_type: 'value_increase' | 'value_decrease' | 'refinance_opportunity' | 'comparable_sale';
  recorded_value_gbp: number;
  estimated_value_gbp: number;
  change_percent: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  property?: {
    address_line: string;
  };
}

export interface RefinancingOpportunity {
  id: string;
  property_id: string;
  current_value_gbp: number;
  current_mortgage_gbp: number;
  current_ltv: number;
  potential_release_gbp: number;
  status: 'identified' | 'under_review' | 'in_progress' | 'completed' | 'dismissed';
  property?: {
    address_line: string;
    postcode: string;
  };
}

// Get valuation history for a property
export function usePropertyValuationHistory(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-valuations', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('property_valuations')
        .select('*')
        .eq('property_id', propertyId)
        .order('valuation_date', { ascending: false });
      
      if (error) throw error;
      return data as PropertyValuation[];
    },
    enabled: !!propertyId,
  });
}

// Get comparables for a property
export function usePropertyComparables(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-comparables', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('comparable_sales')
        .select('*')
        .eq('source_property_id', propertyId)
        .order('sale_date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as ComparableSale[];
    },
    enabled: !!propertyId,
  });
}

// Get all valuation alerts
export function useValuationAlerts() {
  return useQuery({
    queryKey: ['valuation-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('valuation_alerts')
        .select(`
          *,
          property:properties(address_line)
        `)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ValuationAlert[];
    },
  });
}

// Get unread alert count
export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ['valuation-alerts-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('valuation_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('is_dismissed', false);
      
      if (error) throw error;
      return count || 0;
    },
  });
}

// Get refinancing opportunities
export function useRefinancingOpportunities() {
  return useQuery({
    queryKey: ['refinancing-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refinancing_opportunities')
        .select(`
          *,
          property:properties(address_line, postcode)
        `)
        .in('status', ['identified', 'under_review'])
        .order('potential_release_gbp', { ascending: false });
      
      if (error) throw error;
      return data as RefinancingOpportunity[];
    },
  });
}

// Trigger valuation for a property
export function useTriggerValuation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      // First fetch comparables
      const compResponse = await supabase.functions.invoke('fetch-land-registry-comparables', {
        body: { propertyId },
      });
      
      if (compResponse.error) throw compResponse.error;

      // Then generate valuation
      const valResponse = await supabase.functions.invoke('generate-ai-valuation', {
        body: { propertyId },
      });
      
      if (valResponse.error) throw valResponse.error;
      
      return valResponse.data;
    },
    onSuccess: (data, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ['property-valuations', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-comparables', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });
      
      toast({
        title: 'Valuation Complete',
        description: `Estimated value: £${data.valuation.estimated_value.toLocaleString()} (${data.valuation.confidence} confidence)`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Valuation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Mark alert as read
export function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('valuation_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['valuation-alerts-unread-count'] });
    },
  });
}

// Dismiss alert
export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('valuation_alerts')
        .update({ is_dismissed: true })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['valuation-alerts-unread-count'] });
    },
  });
}

// Update refinancing opportunity status
export function useUpdateRefinancingStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'under_review') updates.reviewed_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      if (notes) updates.notes = notes;

      const { error } = await supabase
        .from('refinancing_opportunities')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refinancing-opportunities'] });
      toast({ title: 'Status updated' });
    },
  });
}
```

## src/components/valuations/PropertyValuationCard.tsx

```tsx
import React from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePropertyValuationHistory, useTriggerValuation } from '@/hooks/usePropertyValuations';
import { formatGBP, formatPercent } from '@/lib/calculations';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PropertyValuationCardProps {
  propertyId: string;
  recordedValue: number;
  lastEstimate?: number;
  lastValuationDate?: string;
  changePercent?: number;
  confidence?: string;
}

export function PropertyValuationCard({
  propertyId,
  recordedValue,
  lastEstimate,
  lastValuationDate,
  changePercent,
  confidence,
}: PropertyValuationCardProps) {
  const { data: history, isLoading: historyLoading } = usePropertyValuationHistory(propertyId);
  const triggerValuation = useTriggerValuation();

  const latestValuation = history?.[0];
  const displayEstimate = lastEstimate || latestValuation?.estimated_value_gbp;
  const displayChange = changePercent ?? (recordedValue && displayEstimate 
    ? ((displayEstimate - recordedValue) / recordedValue) * 100 
    : 0);
  const displayConfidence = confidence || latestValuation?.confidence_level;
  const displayDate = lastValuationDate || latestValuation?.valuation_date;

  const handleRefresh = () => {
    triggerValuation.mutate(propertyId);
  };

  const confidenceColors = {
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            AI Valuation Estimate
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Estimated using Land Registry comparable sales and AI analysis. Updated monthly.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={triggerValuation.isPending}
          >
            {triggerValuation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {displayEstimate ? (
          <div className="space-y-4">
            {/* Main estimate */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{formatGBP(displayEstimate)}</span>
                {displayConfidence && (
                  <Badge className={cn('text-xs', confidenceColors[displayConfidence as keyof typeof confidenceColors])}>
                    {displayConfidence} confidence
                  </Badge>
                )}
              </div>
              {displayDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {formatDistanceToNow(new Date(displayDate), { addSuffix: true })}
                </p>
              )}
            </div>

            {/* Comparison to recorded value */}
            {recordedValue > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">vs Recorded Value</p>
                  <p className="text-sm font-medium">{formatGBP(recordedValue)}</p>
                </div>
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded',
                  displayChange > 0 ? 'bg-emerald-100 text-emerald-700' : 
                  displayChange < 0 ? 'bg-red-100 text-red-700' : 
                  'bg-gray-100 text-gray-700'
                )}>
                  {displayChange > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : displayChange < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : null}
                  <span className="text-sm font-medium">
                    {displayChange > 0 ? '+' : ''}{displayChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Comparables info */}
            {latestValuation?.comparables_count && (
              <p className="text-xs text-muted-foreground">
                Based on {latestValuation.comparables_count} comparable sales
                {latestValuation.comparables_avg_price && (
                  <> (avg {formatGBP(latestValuation.comparables_avg_price)})</>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No valuation estimate yet</p>
            <Button onClick={handleRefresh} disabled={triggerValuation.isPending}>
              {triggerValuation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                'Generate Estimate'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## src/components/valuations/ComparableSalesTable.tsx

```tsx
import React from 'react';
import { format } from 'date-fns';
import { ExternalLink, Home, Building2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { usePropertyComparables } from '@/hooks/usePropertyValuations';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface ComparableSalesTableProps {
  propertyId: string;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  'D': 'Detached',
  'S': 'Semi-Detached',
  'T': 'Terraced',
  'F': 'Flat',
  'O': 'Other',
};

const PROPERTY_TYPE_ICONS: Record<string, React.ElementType> = {
  'D': Home,
  'S': Home,
  'T': Home,
  'F': Building2,
};

export function ComparableSalesTable({ propertyId }: ComparableSalesTableProps) {
  const { data: comparables, isLoading } = usePropertyComparables(propertyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparable Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!comparables?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparable Sales</CardTitle>
          <CardDescription>Recent sales in the area</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No comparable sales found. Try refreshing the valuation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const avgPrice = Math.round(comparables.reduce((s, c) => s + c.price_paid, 0) / comparables.length);
  const minPrice = Math.min(...comparables.map(c => c.price_paid));
  const maxPrice = Math.max(...comparables.map(c => c.price_paid));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparable Sales</CardTitle>
        <CardDescription>
          {comparables.length} sales in the last 24 months • Avg: {formatGBP(avgPrice)}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 border-b">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Lowest</p>
            <p className="text-sm font-semibold">{formatGBP(minPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-sm font-semibold text-primary">{formatGBP(avgPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Highest</p>
            <p className="text-sm font-semibold">{formatGBP(maxPrice)}</p>
          </div>
        </div>

        {/* Sales list */}
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {comparables.map((sale) => {
              const Icon = PROPERTY_TYPE_ICONS[sale.property_type] || Home;
              const typeLabel = PROPERTY_TYPE_LABELS[sale.property_type] || sale.property_type;
              
              return (
                <div key={sale.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{sale.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {typeLabel}
                          </Badge>
                          {sale.new_build && (
                            <Badge variant="secondary" className="text-xs">New Build</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {sale.tenure === 'F' ? 'Freehold' : 'Leasehold'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{formatGBP(sale.price_paid)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sale.sale_date), 'MMM yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

## src/components/valuations/ValuationAlertsPanel.tsx

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, TrendingUp, TrendingDown, PiggyBank, X, Check, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useValuationAlerts, useMarkAlertRead, useDismissAlert } from '@/hooks/usePropertyValuations';
import { formatGBP } from '@/lib/calculations';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const ALERT_ICONS = {
  value_increase: TrendingUp,
  value_decrease: TrendingDown,
  refinance_opportunity: PiggyBank,
  comparable_sale: Bell,
};

const ALERT_COLORS = {
  value_increase: 'text-emerald-600 bg-emerald-100',
  value_decrease: 'text-red-600 bg-red-100',
  refinance_opportunity: 'text-blue-600 bg-blue-100',
  comparable_sale: 'text-amber-600 bg-amber-100',
};

export function ValuationAlertsPanel() {
  const { data: alerts, isLoading } = useValuationAlerts();
  const markRead = useMarkAlertRead();
  const dismiss = useDismissAlert();

  const unreadAlerts = alerts?.filter(a => !a.is_read) || [];
  const readAlerts = alerts?.filter(a => a.is_read) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Valuation Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!alerts?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Valuation Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No valuation alerts</p>
            <p className="text-sm">You'll be notified when property values change significantly.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderAlert = (alert: typeof alerts[0]) => {
    const Icon = ALERT_ICONS[alert.alert_type];
    const colorClass = ALERT_COLORS[alert.alert_type];

    return (
      <div
        key={alert.id}
        className={cn(
          "p-4 rounded-lg border transition-colors",
          !alert.is_read && "bg-primary/5 border-primary/20"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-full shrink-0", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                {alert.property && (
                  <Link
                    to={`/properties/${alert.property_id}`}
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    View Property <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {!alert.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => markRead.mutate(alert.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => dismiss.mutate(alert.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Valuation Alerts
            {unreadAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadAlerts.length} new
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 p-4">
            {unreadAlerts.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  New
                </p>
                {unreadAlerts.map(renderAlert)}
              </>
            )}
            
            {readAlerts.length > 0 && (
              <>
                {unreadAlerts.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4 mb-2">
                    Earlier
                  </p>
                )}
                {readAlerts.map(renderAlert)}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

## src/components/valuations/RefinancingOpportunitiesCard.tsx

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, ChevronRight, TrendingUp, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRefinancingOpportunities, useUpdateRefinancingStatus } from '@/hooks/usePropertyValuations';
import { formatGBP, formatPercent } from '@/lib/calculations';

export function RefinancingOpportunitiesCard() {
  const { data: opportunities, isLoading } = useRefinancingOpportunities();
  const updateStatus = useUpdateRefinancingStatus();

  const totalPotentialRelease = opportunities?.reduce((sum, o) => sum + o.potential_release_gbp, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Refinancing Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!opportunities?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Refinancing Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No refinancing opportunities identified</p>
            <p className="text-sm mt-1">Properties with equity above 25% LTV will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-primary" />
              Refinancing Opportunities
            </CardTitle>
            <CardDescription>
              {opportunities.length} properties • {formatGBP(totalPotentialRelease)} potential release
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {formatGBP(totalPotentialRelease)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {opportunities.slice(0, 5).map((opp) => (
          <div
            key={opp.id}
            className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/properties/${opp.property_id}`}
                  className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                >
                  {opp.property?.address_line}
                </Link>
                <p className="text-xs text-muted-foreground">{opp.property?.postcode}</p>
              </div>
              <Badge
                variant={opp.status === 'identified' ? 'default' : 'secondary'}
                className="shrink-0"
              >
                {opp.status === 'identified' ? 'New' : 'Under Review'}
              </Badge>
            </div>

            {/* LTV Progress Bar */}
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current LTV</span>
                <span className="font-medium">{formatPercent(opp.current_ltv)} → 75%</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-primary/30 rounded-full"
                  style={{ width: '75%' }}
                />
                <div
                  className="absolute h-full bg-primary rounded-full"
                  style={{ width: `${opp.current_ltv}%` }}
                />
              </div>
            </div>

            {/* Values */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-sm font-medium">{formatGBP(opp.current_value_gbp)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mortgage</p>
                <p className="text-sm font-medium">{formatGBP(opp.current_mortgage_gbp)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Release</p>
                <p className="text-sm font-semibold text-primary">{formatGBP(opp.potential_release_gbp)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {opp.status === 'identified' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => updateStatus.mutate({ id: opp.id, status: 'under_review' })}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Review
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus.mutate({ id: opp.id, status: 'dismissed' })}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/properties/${opp.property_id}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}

        {opportunities.length > 5 && (
          <Button variant="outline" className="w-full" asChild>
            <Link to="/refinancing">
              View All {opportunities.length} Opportunities
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

## src/components/valuations/PortfolioValueChart.tsx

```tsx
import React, { useMemo } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatGBP } from '@/lib/calculations';

interface PortfolioValueChartProps {
  className?: string;
}

export function PortfolioValueChart({ className }: PortfolioValueChartProps) {
  const [timeRange, setTimeRange] = React.useState('12');

  const { data: valuationData, isLoading } = useQuery({
    queryKey: ['portfolio-value-history', timeRange],
    queryFn: async () => {
      const startDate = subMonths(new Date(), parseInt(timeRange));
      
      const { data, error } = await supabase
        .from('property_valuations')
        .select('valuation_date, estimated_value_gbp')
        .gte('valuation_date', startDate.toISOString().split('T')[0])
        .order('valuation_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const chartData = useMemo(() => {
    if (!valuationData?.length) return [];

    // Group by month and sum values
    const monthlyData = new Map<string, number>();
    
    valuationData.forEach(v => {
      const monthKey = v.valuation_date.slice(0, 7); // YYYY-MM
      const current = monthlyData.get(monthKey) || 0;
      monthlyData.set(monthKey, current + v.estimated_value_gbp);
    });

    // Convert to array and fill gaps
    const result: { month: string; value: number; label: string }[] = [];
    const months = parseInt(timeRange);
    
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yy');
      
      // Use the latest available data for this month, or carry forward
      let value = monthlyData.get(monthKey);
      if (!value && result.length > 0) {
        value = result[result.length - 1].value;
      }
      
      if (value) {
        result.push({ month: monthKey, value, label });
      }
    }

    return result;
  }, [valuationData, timeRange]);

  const latestValue = chartData[chartData.length - 1]?.value || 0;
  const earliestValue = chartData[0]?.value || 0;
  const changePercent = earliestValue > 0 ? ((latestValue - earliestValue) / earliestValue) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Portfolio Value Trend
            </CardTitle>
            <CardDescription>
              Estimated total portfolio value over time
            </CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 1 ? (
          <>
            <div className="flex items-baseline gap-4 mb-6">
              <div>
                <p className="text-3xl font-bold">{formatGBP(latestValue)}</p>
                <p className="text-sm text-muted-foreground">Current estimate</p>
              </div>
              <div className={changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                <p className="text-lg font-semibold">
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                </p>
                <p className="text-xs">vs {timeRange} months ago</p>
              </div>
            </div>

            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `£${(value / 1000000).toFixed(1)}M`}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatGBP(value), 'Portfolio Value']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fill="url(#valueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Not enough data for chart</p>
              <p className="text-sm">Valuations will appear as they're generated monthly.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

# Cron Job Setup

```sql
-- Schedule monthly valuations (1st of each month at 3am UTC)
SELECT cron.schedule(
  'run-monthly-valuations',
  '0 3 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-monthly-valuations',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  );
  $$
);
```

---

# Integration Points

## Add to PropertyDetail page

```tsx
import { PropertyValuationCard } from '@/components/valuations/PropertyValuationCard';
import { ComparableSalesTable } from '@/components/valuations/ComparableSalesTable';

// In the property detail tabs or sidebar:
<PropertyValuationCard
  propertyId={property.id}
  recordedValue={property.current_value_gbp}
  lastEstimate={property.last_valuation_estimate}
  lastValuationDate={property.last_valuation_date}
  changePercent={property.value_change_percent}
  confidence={property.valuation_confidence}
/>

<ComparableSalesTable propertyId={property.id} />
```

## Add to Dashboard

```tsx
import { ValuationAlertsPanel } from '@/components/valuations/ValuationAlertsPanel';
import { RefinancingOpportunitiesCard } from '@/components/valuations/RefinancingOpportunitiesCard';
import { PortfolioValueChart } from '@/components/valuations/PortfolioValueChart';

// In dashboard layout:
<PortfolioValueChart />
<ValuationAlertsPanel />
<RefinancingOpportunitiesCard />
```

---

# Implementation Checklist

## Week 1: Database & Backend
- [ ] Run database migration
- [ ] Deploy fetch-land-registry-comparables edge function
- [ ] Deploy generate-ai-valuation edge function
- [ ] Deploy run-monthly-valuations edge function
- [ ] Set up ANTHROPIC_API_KEY in environment
- [ ] Configure monthly cron job
- [ ] Test Land Registry API queries

## Week 2: Frontend
- [ ] Create usePropertyValuations hooks
- [ ] Create PropertyValuationCard component
- [ ] Create ComparableSalesTable component
- [ ] Create ValuationAlertsPanel component
- [ ] Create RefinancingOpportunitiesCard component
- [ ] Create PortfolioValueChart component
- [ ] Integrate into PropertyDetail page
- [ ] Integrate into Dashboard

---

# Environment Variables Required

```env
# Edge Functions
ANTHROPIC_API_KEY=sk-ant-xxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

---

# Cost Considerations

1. **Land Registry API** - FREE (public SPARQL endpoint)
2. **Anthropic API** - ~$0.01-0.03 per valuation (Claude Sonnet)
3. **Monthly cost for 30 properties** - ~$0.30-0.90/month

---

*Ready for Lovable.dev implementation*
