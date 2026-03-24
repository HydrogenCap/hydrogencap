import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

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

function getComplianceStoragePath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.includes("/storage/v1/object/")) {
    return fileUrl;
  }

  try {
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/compliance\/(.+)/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { tenantId, tenancyId, propertyId, complianceTypes } = await req.json();
    if (!tenantId || !propertyId || !complianceTypes?.length) {
      throw new Error("Missing required fields: tenantId, propertyId, complianceTypes");
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, org_id, address_line, postcode")
      .eq("id", propertyId)
      .single();
    if (propertyError || !property) throw new Error("Property not found");

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("org_id", property.org_id)
      .maybeSingle();

    if (!membership?.org_id) throw new Error("Access denied");
    if (membership.role === "viewer") throw new Error("Viewers cannot send tenant certificates");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, org_id, first_name, last_name, email, company_name, tenant_type, company_contact_email, compliance_contact_name, compliance_contact_email")
      .eq("id", tenantId)
      .single();
    if (tenantError || !tenant) throw new Error("Tenant not found");
    if (tenant.org_id !== membership.org_id) throw new Error("Access denied");

    if (tenancyId) {
      const { data: tenancy, error: tenancyError } = await supabase
        .from("tenancies")
        .select("id, org_id, tenant_id, property_id")
        .eq("id", tenancyId)
        .single();
      if (tenancyError || !tenancy) throw new Error("Tenancy not found");
      if (tenancy.org_id !== membership.org_id) throw new Error("Access denied");
      if (tenancy.tenant_id !== tenantId || tenancy.property_id !== propertyId) {
        throw new Error("Tenancy does not match tenant and property");
      }
    }

    const recipientEmail = tenant.compliance_contact_email ||
      (tenant.tenant_type === "company" ? (tenant.company_contact_email || tenant.email) : tenant.email);
    if (!recipientEmail) throw new Error("Tenant has no email address");

    const tenantName = tenant.tenant_type === "company"
      ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`)
      : `${tenant.first_name} ${tenant.last_name}`;
    const propertyAddress = `${property.address_line}${property.postcode ? `, ${property.postcode}` : ""}`;

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

    const attachments: { filename: string; content: string }[] = [];
    for (const doc of complianceDocs) {
      try {
        const storagePath = getComplianceStoragePath(doc.file_url);
        if (!storagePath) {
          console.error(`Could not parse storage path from value: ${doc.file_url}`);
          continue;
        }

        const { data: fileData, error: downloadError } = await supabase.storage
          .from("compliance")
          .download(storagePath);

        if (downloadError) {
          console.error(`Storage download error for ${doc.original_file_name}:`, downloadError);
          continue;
        }

        const buffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        attachments.push({
          filename: doc.original_file_name,
          content: btoa(binary),
        });
      } catch (error) {
        console.error(`Failed to download ${doc.original_file_name}:`, error);
      }
    }

    if (!attachments.length) throw new Error("Could not download any certificates for attachment");

    const typeMap = new Map(complianceItems.map((ci) => [ci.id, ci.compliance_type]));
    const sentTypes = complianceDocs
      .map((doc) => typeMap.get(doc.compliance_item_id) || "Certificate")
      .filter((value, index, array) => array.indexOf(value) === index);
    const typeList = sentTypes.join(" & ");

    const emailResult = await resend.emails.send({
      from: "Tenure IQ <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `${typeList} - ${propertyAddress}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Compliance Certificates</h2>
          <p>Dear ${tenantName},</p>
          <p>Please find attached the following compliance certificate(s) for <strong>${propertyAddress}</strong>:</p>
          <ul>
            ${sentTypes.map((type) => `<li>${type}</li>`).join("")}
          </ul>
          <p>Please retain these documents for your records. If you have any questions, please do not hesitate to contact us.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">This email was sent automatically by Tenure IQ property management.</p>
        </div>
      `,
      attachments,
    });

    const proofContent = [
      "CERTIFICATE EMAIL PROOF",
      "========================",
      `Date: ${format(new Date(), "dd MMM yyyy HH:mm:ss")}`,
      `Sent by: ${user.email}`,
      `Recipient: ${tenantName} <${recipientEmail}>`,
      `Property: ${propertyAddress}`,
      "",
      "Certificates sent:",
      ...sentTypes.map((type) => `  - ${type}`),
      "",
      "Attachments:",
      ...attachments.map((attachment) => `  - ${attachment.filename}`),
      "",
      "Email provider: Resend",
      `Email ID: ${emailResult?.data?.id || "unknown"}`,
      "Status: Sent successfully",
    ].join("\n");

    const proofFileName = `${membership.org_id}/email-proofs/${Date.now()}_certificate_email_proof.txt`;
    await supabase.storage
      .from("documents")
      .upload(proofFileName, new TextEncoder().encode(proofContent), {
        contentType: "text/plain",
      });

    await supabase.from("documents").insert({
      org_id: membership.org_id,
      property_id: propertyId,
      tenant_id: tenantId,
      tenancy_id: tenancyId || null,
      original_file_name: `Certificate_Email_Proof_${format(new Date(), "yyyy-MM-dd_HHmm")}.txt`,
      display_name: `Certificates emailed to ${tenantName}`,
      file_url: proofFileName,
      doc_type: "email_proof",
      category: "tenancy",
      description: `${typeList} emailed to ${recipientEmail} on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}. Resend ID: ${emailResult?.data?.id || "unknown"}`,
      review_status: "approved",
      uploaded_by: user.id,
    });

    await supabase.from("activity_log").insert({
      org_id: membership.org_id,
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

    return new Response(
      JSON.stringify({
        success: true,
        sentTo: recipientEmail,
        certificatesSent: sentTypes,
        resendId: emailResult?.data?.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
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
