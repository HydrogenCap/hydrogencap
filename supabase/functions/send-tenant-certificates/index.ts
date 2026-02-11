import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { tenantId, tenancyId, propertyId, complianceTypes } = await req.json();

    if (!tenantId || !propertyId || !complianceTypes?.length) {
      throw new Error("Missing required fields: tenantId, propertyId, complianceTypes");
    }

    // Verify user belongs to an org and scope queries
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.org_id) throw new Error("User has no organization");

    // Get tenant details
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("first_name, last_name, email, company_name, tenant_type, company_contact_email, compliance_contact_name, compliance_contact_email")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) throw new Error("Tenant not found");

    const recipientEmail = tenant.compliance_contact_email
      || (tenant.tenant_type === "company" ? (tenant.company_contact_email || tenant.email) : tenant.email);

    if (!recipientEmail) throw new Error("Tenant has no email address");

    const tenantName = tenant.tenant_type === "company"
      ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`)
      : `${tenant.first_name} ${tenant.last_name}`;

    // Get property details
    const { data: property } = await supabase
      .from("properties")
      .select("address_line, postcode")
      .eq("id", propertyId)
      .single();

    const propertyAddress = property
      ? `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`
      : "the property";

    // Get compliance documents
    const { data: complianceItems } = await supabase
      .from("compliance_items")
      .select("id, compliance_type")
      .eq("property_id", propertyId)
      .in("compliance_type", complianceTypes);

    if (!complianceItems?.length) throw new Error("No compliance items found for this property");

    const complianceItemIds = complianceItems.map((ci) => ci.id);

    const { data: complianceDocs } = await supabase
      .from("compliance_documents")
      .select("id, file_url, original_file_name, compliance_item_id")
      .in("compliance_item_id", complianceItemIds)
      .eq("is_current", true);

    if (!complianceDocs?.length) throw new Error("No current certificates found to send");

    // Download attachments using service role (bucket is private)
    const attachments: { filename: string; content: string }[] = [];
    for (const doc of complianceDocs) {
      try {
        // Extract storage path from the full URL
        // URL format: .../storage/v1/object/public/compliance/{path}
        const urlObj = new URL(doc.file_url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/compliance\/(.+)/);
        
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          const { data: fileData, error: dlError } = await supabase.storage
            .from('compliance')
            .download(storagePath);
          
          if (dlError) {
            console.error(`Storage download error for ${doc.original_file_name}:`, dlError);
            continue;
          }
          
          const buffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          attachments.push({
            filename: doc.original_file_name,
            content: base64,
          });
        } else {
          console.error(`Could not parse storage path from URL: ${doc.file_url}`);
        }
      } catch (e) {
        console.error(`Failed to download ${doc.original_file_name}:`, e);
      }
    }

    if (!attachments.length) throw new Error("Could not download any certificates for attachment");

    // Build type labels
    const typeMap = new Map(complianceItems.map((ci) => [ci.id, ci.compliance_type]));
    const sentTypes = complianceDocs
      .map((d) => typeMap.get(d.compliance_item_id) || "Certificate")
      .filter((v, i, a) => a.indexOf(v) === i);

    const typeList = sentTypes.join(" & ");

    // Send email
    const emailResult = await resend.emails.send({
      from: "HydrogenCap <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `${typeList} — ${propertyAddress}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Compliance Certificates</h2>
          <p>Dear ${tenantName},</p>
          <p>Please find attached the following compliance certificate(s) for <strong>${propertyAddress}</strong>:</p>
          <ul>
            ${sentTypes.map((t) => `<li>${t}</li>`).join("")}
          </ul>
          <p>Please retain these documents for your records. If you have any questions, please don't hesitate to contact us.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">This email was sent automatically by HydrogenCap property management.</p>
        </div>
      `,
      attachments,
    });

    console.log("Email sent:", emailResult);

    // Use the org_id already verified from membership
    const orgId = membership.org_id;

    if (orgId) {
      // Record proof of sending in documents table
      const now = new Date().toISOString();
      const proofDoc = {
        org_id: orgId,
        property_id: propertyId,
        tenant_id: tenantId,
        tenancy_id: tenancyId || null,
        original_file_name: `Certificate_Email_Proof_${format(new Date(), "yyyy-MM-dd_HHmm")}.txt`,
        display_name: `Certificates emailed to ${tenantName}`,
        file_url: "",
        doc_type: "email_proof",
        category: "tenancy",
        description: `${typeList} emailed to ${recipientEmail} on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}. Resend ID: ${emailResult?.data?.id || "unknown"}`,
        review_status: "approved",
        uploaded_by: user.id,
      };

      // Create a simple text proof file and upload to storage
      const proofContent = [
        `CERTIFICATE EMAIL PROOF`,
        `========================`,
        `Date: ${format(new Date(), "dd MMM yyyy HH:mm:ss")}`,
        `Sent by: ${user.email}`,
        `Recipient: ${tenantName} <${recipientEmail}>`,
        `Property: ${propertyAddress}`,
        ``,
        `Certificates sent:`,
        ...sentTypes.map((t) => `  - ${t}`),
        ``,
        `Attachments:`,
        ...attachments.map((a) => `  - ${a.filename}`),
        ``,
        `Email provider: Resend`,
        `Email ID: ${emailResult?.data?.id || "unknown"}`,
        `Status: Sent successfully`,
      ].join("\n");

      const proofFileName = `${orgId}/email-proofs/${Date.now()}_certificate_email_proof.txt`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(proofFileName, new TextEncoder().encode(proofContent), {
          contentType: "text/plain",
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(proofFileName);

        proofDoc.file_url = urlData.publicUrl;
      }

      await supabase.from("documents").insert(proofDoc);

      // Also log in activity
      await supabase.from("activity_log").insert({
        org_id: orgId,
        property_id: propertyId,
        entry_type: "certificate_emailed",
        title: `${typeList} emailed to ${tenantName}`,
        body: `Certificates sent to ${recipientEmail}`,
        metadata: {
          tenant_id: tenantId,
          compliance_types: sentTypes,
          resend_id: emailResult?.data?.id,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentTo: recipientEmail,
        certificatesSent: sentTypes,
        resendId: emailResult?.data?.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function format(date: Date, fmt: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return fmt
    .replace("yyyy", date.getFullYear().toString())
    .replace("MM", pad(date.getMonth() + 1))
    .replace("dd", pad(date.getDate()))
    .replace("HH", pad(date.getHours()))
    .replace("mm", pad(date.getMinutes()))
    .replace("ss", pad(date.getSeconds()))
    .replace("MMM", months[date.getMonth()])
    .replace("'at'", "at");
}
