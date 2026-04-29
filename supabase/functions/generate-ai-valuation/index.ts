 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 import { z } from "https://esm.sh/zod@3.23.8";
 import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
 import { validateBody } from "../_shared/validate.ts";
 import { getCorsHeaders } from "../_shared/cors.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";

import { withInvocationLog } from "../_shared/logger.ts";
 const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
 const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
 
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
   confidence: "high" | "medium" | "low";
   adjustments: Record<string, number>;
   reasoning: string;
 }> {
   const comparablesSummary = comparables.slice(0, 10).map(c => 
     `- ${c.address}, ${c.postcode}: £${c.price_paid.toLocaleString()} (${c.sale_date}, ${c.property_type})`
   ).join("\n");
 
   const avgPrice = comparables.length > 0
     ? Math.round(comparables.reduce((sum, c) => sum + c.price_paid, 0) / comparables.length)
     : 0;
 
   const prompt = `You are a UK property valuation expert. Estimate the current market value of this property based on comparable sales data.
 
 SUBJECT PROPERTY:
 - Address: ${property.address_line}, ${property.postcode}
 - Type: ${property.property_type || "Unknown"}
 - Bedrooms: ${property.beds || "Unknown"}
 - Purchase Price: £${property.purchase_price_gbp?.toLocaleString() || "Unknown"}
 - Purchase Date: ${property.purchase_date || "Unknown"}
 - Owner's Current Estimate: £${property.current_value_gbp?.toLocaleString() || "Not set"}
 
 COMPARABLE SALES (last 24 months in area):
 ${comparablesSummary || "No comparables found"}
 
 Average comparable price: £${avgPrice.toLocaleString()}
 Number of comparables: ${comparables.length}
 
 Consider:
 1. Property type differences (detached vs semi vs terrace vs flat)
 2. Bedroom count differences
 3. Recent market trends
 4. Location within postcode area
 5. Age and condition assumptions
 
 Be conservative and realistic. If insufficient data, set confidence to "low".`;
 
   try {
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-2.5-flash",
         messages: [
           { role: "system", content: "You are a UK property valuation expert. Always respond with valid JSON only." },
           { role: "user", content: prompt },
         ],
         tools: [
           {
             type: "function",
             function: {
               name: "provide_valuation",
               description: "Provide the property valuation estimate with breakdown",
               parameters: {
                 type: "object",
                 properties: {
                   estimated_value: { type: "number", description: "Estimated property value in GBP" },
                   confidence: { type: "string", enum: ["high", "medium", "low"] },
                   adjustments: {
                     type: "object",
                     properties: {
                       base_comparable_avg: { type: "number" },
                       beds_adjustment: { type: "number" },
                       property_type_adjustment: { type: "number" },
                       condition_assumption: { type: "number" },
                       market_trend_adjustment: { type: "number" },
                     },
                   },
                   reasoning: { type: "string", description: "Brief explanation of valuation approach" },
                 },
                 required: ["estimated_value", "confidence", "adjustments", "reasoning"],
               },
             },
           },
         ],
         tool_choice: { type: "function", function: { name: "provide_valuation" } },
       }),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error("AI Gateway error:", response.status, errorText);
       throw new Error(`AI Gateway error: ${response.status}`);
     }
 
     const data = await response.json();
     const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
     
     if (toolCall?.function?.arguments) {
       const result = JSON.parse(toolCall.function.arguments);
       return {
         estimated_value: Math.round(result.estimated_value),
         confidence: result.confidence,
         adjustments: result.adjustments || {},
         reasoning: result.reasoning,
       };
     }
 
     throw new Error("No tool call in response");
   } catch (error) {
     console.error("AI valuation error:", error);
     
     // Fallback to simple average if AI fails
     return {
       estimated_value: avgPrice || property.current_value_gbp || 0,
       confidence: "low",
       adjustments: { base_comparable_avg: avgPrice },
       reasoning: "Fallback to comparable average due to AI error",
     };
   }
 }
 
 serve(withInvocationLog("generate-ai-valuation", async (req, log) => {
   const corsHeaders = getCorsHeaders(req);
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     // Authenticate the request
     const authHeader = req.headers.get("Authorization");
     if (!authHeader?.startsWith("Bearer ")) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }

     const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
       global: { headers: { Authorization: authHeader } },
     });

     const { data: userData, error: authError } = await supabaseAnon.auth.getUser();
     if (authError || !userData?.user) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }

      // Use service-role client for DB operations
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Subscription check
      const subCheck = await requireActiveSubscription(userData.user.id, corsHeaders);
      if (!subCheck.allowed) return subCheck.response;

      // Rate limit check
      const rateLimit = await checkRateLimit(userData.user.id, 'generate-ai-valuation', 10, 60);
      if (!rateLimit.allowed) {
        return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
      }

       const ValuationSchema = z.object({
         propertyId: z.string().uuid("Valid property ID required"),
       });

       const parsed = await validateBody(req, ValuationSchema, corsHeaders);
       if ("error" in parsed) return parsed.error;
       const { propertyId } = parsed.data;
 
     // Get property
     const { data: property, error: propError } = await supabase
       .from("properties")
       .select("*")
       .eq("id", propertyId)
       .single();
 
     if (propError || !property) {
       return new Response(JSON.stringify({ error: "Property not found" }), { 
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }

     const { data: membership } = await supabase
       .from("memberships")
       .select("id")
       .eq("user_id", userData.user.id)
       .eq("org_id", property.org_id)
       .in("role", ["owner", "admin"])
       .maybeSingle();

     if (!membership) {
       return new Response(JSON.stringify({ error: "Access denied" }), {
         status: 403,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Get comparables
     const { data: comparables } = await supabase
       .from("comparable_sales")
       .select("*")
       .eq("source_property_id", propertyId)
       .order("sale_date", { ascending: false })
       .limit(20);
 
     console.log(`Generating valuation for ${property.address_line} with ${comparables?.length || 0} comparables`);
 
     // Generate AI valuation
     const valuation = await generateAIValuation(property, comparables || []);
 
     // Calculate change from recorded value
     const recordedValue = property.current_value_gbp || 0;
     const changePercent = recordedValue > 0
       ? ((valuation.estimated_value - recordedValue) / recordedValue) * 100
       : 0;
 
     // Store valuation
     const { error: saveError } = await supabase
       .from("property_valuations")
       .upsert({
         property_id: propertyId,
         org_id: property.org_id,
         estimated_value_gbp: valuation.estimated_value,
         confidence_level: valuation.confidence,
         valuation_method: "ai_estimate",
         comparables_count: comparables?.length || 0,
         comparables_avg_price: comparables?.length 
           ? Math.round(comparables.reduce((s, c) => s + c.price_paid, 0) / comparables.length)
           : null,
         adjustment_factors: valuation.adjustments,
         notes: valuation.reasoning,
         valuation_date: new Date().toISOString().split("T")[0],
       }, {
         onConflict: "property_id,valuation_date",
       });
 
     if (saveError) {
       console.error("Error saving valuation:", saveError);
     }
 
     // Update property with latest estimate
     await supabase
       .from("properties")
       .update({
         last_valuation_date: new Date().toISOString().split("T")[0],
         last_valuation_estimate: valuation.estimated_value,
         valuation_confidence: valuation.confidence,
         value_change_percent: Math.round(changePercent * 100) / 100,
       })
       .eq("id", propertyId);
 
     // Create alert if significant change (>10%)
     if (Math.abs(changePercent) >= 10 && recordedValue > 0) {
       await supabase.from("valuation_alerts").insert({
         property_id: propertyId,
         org_id: property.org_id,
         alert_type: changePercent > 0 ? "value_increase" : "value_decrease",
         recorded_value_gbp: recordedValue,
         estimated_value_gbp: valuation.estimated_value,
         change_percent: Math.round(changePercent * 100) / 100,
         title: `${changePercent > 0 ? "📈" : "📉"} Value ${changePercent > 0 ? "Increase" : "Decrease"} Detected`,
         message: `${property.address_line} estimated at £${valuation.estimated_value.toLocaleString()} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% vs recorded £${recordedValue.toLocaleString()})`,
       });
     }
 
     // Check refinancing opportunity
     const { data: loans } = await supabase
       .from("loans")
       .select("current_mortgage_balance_gbp")
       .eq("property_id", propertyId)
       .limit(1);
 
     const currentMortgage = loans?.[0]?.current_mortgage_balance_gbp || 0;
     if (valuation.estimated_value > 0 && currentMortgage > 0) {
       const currentLtv = (currentMortgage / valuation.estimated_value) * 100;
       const targetLtv = 75;
       const maxMortgageAtTarget = (valuation.estimated_value * targetLtv) / 100;
       const potentialRelease = maxMortgageAtTarget - currentMortgage;
 
       if (potentialRelease > 10000 && currentLtv < targetLtv) {
         // Check if opportunity already exists
         const { data: existingOpp } = await supabase
           .from("refinancing_opportunities")
           .select("id")
           .eq("property_id", propertyId)
           .eq("status", "identified")
           .maybeSingle();
 
         if (!existingOpp) {
           await supabase.from("refinancing_opportunities").insert({
             property_id: propertyId,
             org_id: property.org_id,
             current_value_gbp: valuation.estimated_value,
             current_mortgage_gbp: currentMortgage,
             current_ltv: Math.round(currentLtv * 100) / 100,
             potential_release_gbp: Math.round(potentialRelease),
           });
 
           await supabase.from("valuation_alerts").insert({
             property_id: propertyId,
             org_id: property.org_id,
             alert_type: "refinance_opportunity",
             estimated_value_gbp: valuation.estimated_value,
             title: "💰 Refinancing Opportunity",
             message: `${property.address_line} could release £${Math.round(potentialRelease).toLocaleString()} at 75% LTV`,
           });
         }
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
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) },
      });
 
   } catch (error: any) {
     console.error("Error:", error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 }));
