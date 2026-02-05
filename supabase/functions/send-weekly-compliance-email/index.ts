import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Property {
  id: string;
  address_line: string;
  postcode: string | null;
  town_city: string | null;
  lifecycle_type: string | null;
  org_id: string;
}

interface ComplianceItem {
  id: string;
  property_id: string;
  compliance_type: string;
  expiry_date: string | null;
  issue_date: string | null;
  notes: string | null;
}

interface ActivityLog {
  id: string;
  property_id: string | null;
  entry_type: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface ComplianceGroup {
  property: Property;
  items: Array<ComplianceItem & { status: 'overdue' | 'due_soon' | 'unknown' }>;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function getWeeklyRunKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `weekly_${year}-${month}-${day}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getComplianceStatus(expiryDate: string | null): 'overdue' | 'due_soon' | 'unknown' {
  if (!expiryDate) return 'unknown';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due_soon';
  return 'unknown'; // Valid items won't be included
}

function generateEmailHtml(
  overdueGroups: ComplianceGroup[],
  dueSoonGroups: ComplianceGroup[],
  unknownGroups: ComplianceGroup[],
  recentActivity: ActivityLog[],
  propertyMap: Map<string, Property>,
  kpis: { activeProperties: number; overdueCount: number; dueSoonCount: number }
): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const renderComplianceSection = (title: string, groups: ComplianceGroup[], color: string) => {
    if (groups.length === 0) return '';
    
    return `
      <div style="margin-bottom: 24px;">
        <h2 style="color: ${color}; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid ${color}; padding-bottom: 8px;">
          ${title} (${groups.reduce((sum, g) => sum + g.items.length, 0)} items)
        </h2>
        ${groups.map(group => `
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f2937;">
              📍 ${group.property.address_line}${group.property.postcode ? `, ${group.property.postcode}` : ''}
            </h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${group.items.map(item => `
                <li style="color: #4b5563; font-size: 13px; margin-bottom: 4px;">
                  <strong>${item.compliance_type}</strong> – Due: ${formatDate(item.expiry_date)}
                  ${item.notes ? `<br><span style="color: #6b7280; font-size: 12px;">${item.notes}</span>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  };

  const renderActivitySection = () => {
    if (recentActivity.length === 0) return '';
    
    // Group by property
    const grouped = new Map<string, ActivityLog[]>();
    recentActivity.forEach(activity => {
      const key = activity.property_id || 'general';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(activity);
    });

    return `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #2563eb; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
          📋 Last 7 Days Activity (${recentActivity.length} events)
        </h2>
        ${Array.from(grouped.entries()).slice(0, 10).map(([propertyId, activities]) => {
          const property = propertyMap.get(propertyId);
          const locationLabel = property 
            ? `${property.address_line}${property.postcode ? `, ${property.postcode}` : ''}`
            : 'General';
          
          return `
            <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e40af;">📍 ${locationLabel}</h4>
              <ul style="margin: 0; padding-left: 16px;">
                ${activities.slice(0, 5).map(a => `
                  <li style="color: #374151; font-size: 12px; margin-bottom: 2px;">
                    <strong>${a.title}</strong>
                    ${a.body ? ` – ${a.body.substring(0, 80)}${a.body.length > 80 ? '...' : ''}` : ''}
                    <span style="color: #9ca3af;"> (${new Date(a.created_at).toLocaleDateString('en-GB')})</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Compliance & Portfolio Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px;">📊 Weekly Compliance & Portfolio Update</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">${dateStr}</p>
    </div>

    <!-- KPIs -->
    <div style="display: flex; padding: 24px; gap: 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <div style="flex: 1; text-align: center; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div style="font-size: 28px; font-weight: bold; color: #1f2937;">${kpis.activeProperties}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Active Properties</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 16px; background: white; border-radius: 8px; border: 1px solid ${kpis.overdueCount > 0 ? '#fecaca' : '#e5e7eb'};">
        <div style="font-size: 28px; font-weight: bold; color: ${kpis.overdueCount > 0 ? '#dc2626' : '#1f2937'};">${kpis.overdueCount}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Overdue Items</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 16px; background: white; border-radius: 8px; border: 1px solid ${kpis.dueSoonCount > 0 ? '#fef3c7' : '#e5e7eb'};">
        <div style="font-size: 28px; font-weight: bold; color: ${kpis.dueSoonCount > 0 ? '#d97706' : '#1f2937'};">${kpis.dueSoonCount}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Due Soon (30d)</div>
      </div>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      
      ${kpis.overdueCount > 0 || kpis.dueSoonCount > 0 ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px;">⚠️ Top Risks</h3>
          <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 13px;">
            ${kpis.overdueCount > 0 ? `<li>${kpis.overdueCount} compliance item(s) are overdue and need immediate attention</li>` : ''}
            ${kpis.dueSoonCount > 0 ? `<li>${kpis.dueSoonCount} item(s) due in the next 30 days</li>` : ''}
          </ul>
        </div>
      ` : `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0; color: #166534; font-size: 14px;">✅ All Clear – No urgent compliance items this week</h3>
        </div>
      `}

      ${renderComplianceSection('🔴 Overdue', overdueGroups, '#dc2626')}
      ${renderComplianceSection('🟠 Due Soon (Next 30 Days)', dueSoonGroups, '#d97706')}
      ${renderComplianceSection('⚪ Unknown/Missing Dates', unknownGroups, '#6b7280')}
      ${renderActivitySection()}

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        This is an automated report from the Hydrogen Portfolio Dashboard.<br>
        <a href="https://hydrogencap.lovable.app/compliance" style="color: #2563eb;">View Full Compliance Dashboard</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function generatePlainText(
  overdueGroups: ComplianceGroup[],
  dueSoonGroups: ComplianceGroup[],
  unknownGroups: ComplianceGroup[],
  recentActivity: ActivityLog[],
  kpis: { activeProperties: number; overdueCount: number; dueSoonCount: number }
): string {
  const dateStr = new Date().toLocaleDateString('en-GB');
  
  let text = `WEEKLY COMPLIANCE & PORTFOLIO UPDATE\n${dateStr}\n${'='.repeat(50)}\n\n`;
  
  text += `PORTFOLIO SUMMARY\n`;
  text += `• Active Properties: ${kpis.activeProperties}\n`;
  text += `• Overdue Items: ${kpis.overdueCount}\n`;
  text += `• Due Soon (30 days): ${kpis.dueSoonCount}\n\n`;

  if (overdueGroups.length > 0) {
    text += `OVERDUE ITEMS\n${'-'.repeat(30)}\n`;
    overdueGroups.forEach(group => {
      text += `\n${group.property.address_line}\n`;
      group.items.forEach(item => {
        text += `  • ${item.compliance_type} – Due: ${formatDate(item.expiry_date)}\n`;
      });
    });
    text += '\n';
  }

  if (dueSoonGroups.length > 0) {
    text += `DUE SOON (NEXT 30 DAYS)\n${'-'.repeat(30)}\n`;
    dueSoonGroups.forEach(group => {
      text += `\n${group.property.address_line}\n`;
      group.items.forEach(item => {
        text += `  • ${item.compliance_type} – Due: ${formatDate(item.expiry_date)}\n`;
      });
    });
    text += '\n';
  }

  if (recentActivity.length > 0) {
    text += `RECENT ACTIVITY (LAST 7 DAYS)\n${'-'.repeat(30)}\n`;
    recentActivity.slice(0, 15).forEach(activity => {
      text += `• ${activity.title}${activity.body ? ` – ${activity.body.substring(0, 60)}` : ''}\n`;
    });
  }

  text += `\n\nView dashboard: https://hydrogencap.lovable.app/compliance`;
  
  return text;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let isTestSend = false;
    let forceResend = false;
    let previewOnly = false;
    
    if (req.method === "POST") {
      try {
        const body = await req.json();
        isTestSend = body.test === true;
        forceResend = body.force === true;
        previewOnly = body.preview === true;
      } catch {
        // No body or invalid JSON, that's fine
      }
    }

    const runKey = isTestSend ? `test_${Date.now()}` : getWeeklyRunKey();
    const recipientEmail = "office@oxygen.rocks";

    // Check for idempotency (skip for test sends and force resends)
    if (!isTestSend && !forceResend) {
      const { data: existingRun } = await supabase
        .from("scheduled_email_runs")
        .select("id, status")
        .eq("run_key", runKey)
        .maybeSingle();

      if (existingRun && existingRun.status === "sent") {
        console.log(`Email already sent for ${runKey}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Email already sent for this week",
            run_key: runKey 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch all CORE RENTAL properties only (development properties are excluded from compliance emails)
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, address_line, postcode, town_city, lifecycle_type, org_id")
      .eq("lifecycle_type", "core_rental");

    if (propError) throw propError;

    // Only include core rental properties in email
    const coreRentalProperties = (properties || []).filter(
      (p: Property) => (p.lifecycle_type ?? 'development') === 'core_rental'
    );

    const propertyMap = new Map<string, Property>();
    coreRentalProperties.forEach((p: Property) => propertyMap.set(p.id, p));
    
    // Create a set of core rental property IDs for filtering compliance items
    const coreRentalPropertyIds = new Set(coreRentalProperties.map(p => p.id));

    // Fetch all compliance items with is_required = true or not excluded
    const { data: complianceItems, error: compError } = await supabase
      .from("compliance_items")
      .select("id, property_id, compliance_type, expiry_date, issue_date, notes")
      .or("is_required.eq.true,is_required.is.null")
      .eq("is_manually_excluded", false);

    if (compError) throw compError;

    // Categorize compliance items - ONLY for core rental properties
    const overdueItems: Array<ComplianceItem & { status: 'overdue' }> = [];
    const dueSoonItems: Array<ComplianceItem & { status: 'due_soon' }> = [];
    const unknownItems: Array<ComplianceItem & { status: 'unknown' }> = [];

    (complianceItems || []).forEach((item: ComplianceItem) => {
      // Skip if property is not core rental
      if (!coreRentalPropertyIds.has(item.property_id)) return;
      
      const status = getComplianceStatus(item.expiry_date);
      if (status === 'overdue') {
        overdueItems.push({ ...item, status: 'overdue' });
      } else if (status === 'due_soon') {
        dueSoonItems.push({ ...item, status: 'due_soon' });
      } else if (!item.expiry_date) {
        unknownItems.push({ ...item, status: 'unknown' });
      }
    });

    // Group by property
    const groupByProperty = <T extends { property_id: string }>(items: T[]): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      items.forEach(item => {
        const existing = map.get(item.property_id) || [];
        existing.push(item);
        map.set(item.property_id, existing);
      });
      return map;
    };

    const createGroups = <T extends ComplianceItem & { status: 'overdue' | 'due_soon' | 'unknown' }>(
      items: T[]
    ): ComplianceGroup[] => {
      const grouped = groupByProperty(items);
      const groups: ComplianceGroup[] = [];
      grouped.forEach((propertyItems, propertyId) => {
        const property = propertyMap.get(propertyId);
        if (property) {
          groups.push({ property, items: propertyItems });
        }
      });
      return groups.sort((a, b) => a.property.address_line.localeCompare(b.property.address_line));
    };

    const overdueGroups = createGroups(overdueItems);
    const dueSoonGroups = createGroups(dueSoonItems);
    const unknownGroups = createGroups(unknownItems);

    // Fetch recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentActivity, error: actError } = await supabase
      .from("activity_log")
      .select("id, property_id, entry_type, title, body, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (actError) throw actError;

    // Calculate KPIs - only for core rental properties
    const kpis = {
      activeProperties: coreRentalProperties?.length || 0,
      overdueCount: overdueItems.length,
      dueSoonCount: dueSoonItems.length
    };

    // Generate email content
    const emailHtml = generateEmailHtml(
      overdueGroups,
      dueSoonGroups,
      unknownGroups,
      recentActivity || [],
      propertyMap,
      kpis
    );

    const emailText = generatePlainText(
      overdueGroups,
      dueSoonGroups,
      unknownGroups,
      recentActivity || [],
      kpis
    );

    const emailSubject = `Weekly Compliance & Portfolio Update – ${new Date().toISOString().split('T')[0]}`;

    // If preview only, return the HTML without sending
    if (previewOnly) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          preview: true,
          html: emailHtml,
          text: emailText,
          subject: emailSubject,
          kpis
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create run record
    const { data: runRecord, error: runInsertError } = await supabase
      .from("scheduled_email_runs")
      .insert({
        run_key: runKey,
        scheduled_for: new Date().toISOString(),
        status: "queued",
        recipient_email: recipientEmail,
        email_subject: emailSubject,
        org_id: coreRentalProperties[0]?.org_id || null
      })
      .select()
      .single();

    if (runInsertError) {
      console.error("Failed to create run record:", runInsertError);
      // Continue anyway for test sends
      if (!isTestSend) throw runInsertError;
    }

    // Send email via Resend
    console.log(`Sending email to ${recipientEmail}...`);
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Hydrogen Compliance <no-reply@resend.dev>",
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      
      // Update run record with error
      if (runRecord) {
        await supabase
          .from("scheduled_email_runs")
          .update({
            status: "failed",
            error: emailError.message || JSON.stringify(emailError)
          })
          .eq("id", runRecord.id);
      }
      
      throw emailError;
    }

    console.log("Email sent successfully:", emailResult);

    // Update run record with success
    if (runRecord) {
      await supabase
        .from("scheduled_email_runs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: emailResult?.id
        })
        .eq("id", runRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Weekly compliance email sent successfully",
        run_key: runKey,
        recipient: recipientEmail,
        provider_message_id: emailResult?.id,
        kpis
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-weekly-compliance-email:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
