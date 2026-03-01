 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const ALLOWED_ORIGINS = [
   "https://tenureiq.com",
   "https://www.tenureiq.com",
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
 
 const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
 const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
 // Land Registry SPARQL endpoint
 const LAND_REGISTRY_ENDPOINT = "https://landregistry.data.gov.uk/landregistry/query";
 
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
   const postcodeDistrict = postcode.split(" ")[0];
   
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
       FILTER(?date >= "${startDate.toISOString().split("T")[0]}"^^xsd:date)
       FILTER(?date <= "${endDate.toISOString().split("T")[0]}"^^xsd:date)
     }
     ORDER BY DESC(?date)
     LIMIT 100
   `;
 
   try {
     console.log(`Fetching comparables for postcode district: ${postcodeDistrict}`);
     
     const response = await fetch(LAND_REGISTRY_ENDPOINT, {
       method: "POST",
       headers: {
         "Content-Type": "application/x-www-form-urlencoded",
         "Accept": "application/sparql-results+json",
       },
       body: `query=${encodeURIComponent(sparqlQuery)}`,
     });
 
     if (!response.ok) {
       console.error(`Land Registry API error: ${response.status}`);
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
         address: parts.join(", "),
         postcode: row.postcode?.value || "",
         price_paid: parseInt(row.amount?.value || "0"),
         sale_date: row.date?.value || "",
         property_type: row.propertyType?.value?.split("/").pop() || "unknown",
         new_build: row.newBuild?.value === "true",
         tenure: row.tenure?.value?.split("/").pop() || "unknown",
         transaction_id: row.transactionId?.value || "",
       };
     });
   } catch (error) {
     console.error("Error fetching from Land Registry:", error);
     return [];
   }
 }
 
 serve(async (req) => {
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

     const { propertyId } = await req.json();
      
     if (!propertyId) {
       return new Response(JSON.stringify({ error: "propertyId required" }), { 
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Get property details
     const { data: property, error: propError } = await supabase
       .from("properties")
       .select("id, org_id, postcode, latitude, longitude, property_type, beds")
       .eq("id", propertyId)
       .single();
 
     if (propError || !property) {
       console.error("Property not found:", propError);
       return new Response(JSON.stringify({ error: "Property not found" }), { 
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     if (!property.postcode) {
       return new Response(JSON.stringify({ error: "Property has no postcode" }), { 
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
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
 
     if (comparablesToInsert.length > 0) {
       // Upsert comparables (avoid duplicates)
       const { error: insertError } = await supabase
         .from("comparable_sales")
         .upsert(comparablesToInsert, {
           onConflict: "transaction_id",
           ignoreDuplicates: true,
         });
 
       if (insertError) {
         console.error("Error inserting comparables:", insertError);
       }
     }
 
     return new Response(JSON.stringify({
       success: true,
       comparables_found: comparables.length,
       postcode: property.postcode,
     }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
 
   } catch (error: any) {
     console.error("Error:", error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });