import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

import { withInvocationLog } from "../_shared/logger.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
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

// ─── Types ─────────────────────────────────────────────────────────

interface Property {
  id: string;
  address_line: string;
  postcode: string | null;
  org_id: string;
  lifecycle_type: string | null;
}

interface ComplianceItem {
  id: string;
  property_id: string;
  compliance_type: string;
  expiry_date: string | null;
  notes: string | null;
}

interface ComplianceGroup {
  property: Property;
  items: Array<ComplianceItem & { status: 'overdue' | 'due_soon' | 'unknown' }>;
}

interface LoanRow {
  id: string;
  property_id: string | null;
  lender: string | null;
  rate_expiry_date: string | null;
  current_balance: number | null;
  interest_rate: number | null;
}

interface VoidRow {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  estimated_monthly_cost: number | null;
}

interface RegulatoryAlertRow {
  id: string;
  title: string;
  category: string;
  severity: string;
  summary: string;
  effective_date: string | null;
  created_at: string;
  source_url: string | null;
}

interface RentSummary {
  due: number;
  collected: number;
  overdue: number;
  itemsDue: number;
  itemsPaid: number;
}

interface NotificationPrefsRow {
  user_id: string;
  org_id: string;
  email_enabled: boolean;
  email_address: string | null;
  weekly_digest_enabled: boolean;
  weekly_digest_day: number;
  notify_expired: boolean;
  notify_expiring_soon: boolean;
  notify_rate_expiry: boolean;
  notify_negative_cashflow: boolean;
  notify_rent_collection: boolean;
  notify_voids: boolean;
  notify_regulatory_changes: boolean;
  notify_recommended_actions: boolean;
}

interface PrefsSubset {
  notify_expiring_soon: boolean;
  notify_rate_expiry: boolean;
  notify_rent_collection: boolean;
  notify_voids: boolean;
  notify_regulatory_changes: boolean;
  notify_recommended_actions: boolean;
}

interface DigestData {
  overdueGroups: ComplianceGroup[];
  dueSoonGroups: ComplianceGroup[];
  rateExpiries: LoanRow[];
  rentSummary: RentSummary;
  voids: VoidRow[];
  regulatoryAlerts: RegulatoryAlertRow[];
  recommendedActions: Array<{ label: string; detail: string; href: string }>;
  propertyMap: Map<string, Property>;
  kpis: {
    activeProperties: number;
    overdueCount: number;
    dueSoonCount: number;
    rateExpiryCount: number;
    voidsCount: number;
    rentShortfall: number;
  };
}

interface RequestAuthorization {
  mode: "cron" | "user";
  manageableOrgIds: string[] | null;
  userId: string | null;
  userEmail: string | null;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// ─── Auth ──────────────────────────────────────────────────────────

async function authorizeRequest(req: Request): Promise<RequestAuthorization> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { mode: "cron", manageableOrgIds: null, userId: null, userEmail: null };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized");

  const { data: memberships, error: membershipError } = await supabaseAuth
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id);
  if (membershipError) throw membershipError;

  const manageableOrgIds = [...new Set((memberships || []).map((m) => m.org_id))];
  if (manageableOrgIds.length === 0) throw new Error("Access denied");

  return { mode: "user", manageableOrgIds, userId: user.id, userEmail: user.email ?? null };
}

// ─── Helpers ───────────────────────────────────────────────────────

function getWeeklyRunKey(suffix = ""): string {
  const now = new Date();
  const year = now.getFullYear();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `weekly_${year}-${month}-${day}${suffix ? '_' + suffix : ''}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatGBP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
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
  return 'unknown';
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Build digest data for a set of orgs ──────────────────────────

async function buildDigestData(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgIds: string[],
): Promise<DigestData> {
  // 1. Properties (core_rental scope)
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address_line, postcode, lifecycle_type, org_id")
    .in("org_id", orgIds)
    .eq("lifecycle_type", "core_rental");

  const props = (properties || []) as Property[];
  const propIds = props.map((p) => p.id);
  const propertyMap = new Map<string, Property>(props.map((p) => [p.id, p]));

  // 2. Compliance items
  let overdueGroups: ComplianceGroup[] = [];
  let dueSoonGroups: ComplianceGroup[] = [];
  let overdueCount = 0;
  let dueSoonCount = 0;

  if (propIds.length > 0) {
    const { data: compItems } = await supabase
      .from("compliance_items")
      .select("id, property_id, compliance_type, expiry_date, notes")
      .in("property_id", propIds)
      .or("is_required.eq.true,is_required.is.null")
      .eq("is_manually_excluded", false);

    const overdue: Array<ComplianceItem & { status: 'overdue' }> = [];
    const dueSoon: Array<ComplianceItem & { status: 'due_soon' }> = [];
    ((compItems || []) as ComplianceItem[]).forEach((c) => {
      const status = getComplianceStatus(c.expiry_date);
      if (status === 'overdue') overdue.push({ ...c, status: 'overdue' });
      else if (status === 'due_soon') dueSoon.push({ ...c, status: 'due_soon' });
    });
    overdueCount = overdue.length;
    dueSoonCount = dueSoon.length;

    const groupByProp = <T extends ComplianceItem & { status: ComplianceGroup['items'][number]['status'] }>(items: T[]): ComplianceGroup[] => {
      const map = new Map<string, T[]>();
      for (const item of items) {
        const arr = map.get(item.property_id) || [];
        arr.push(item);
        map.set(item.property_id, arr);
      }
      const groups: ComplianceGroup[] = [];
      map.forEach((items, propertyId) => {
        const property = propertyMap.get(propertyId);
        if (property) groups.push({ property, items });
      });
      return groups.sort((a, b) => a.property.address_line.localeCompare(b.property.address_line));
    };
    overdueGroups = groupByProp(overdue);
    dueSoonGroups = groupByProp(dueSoon);
  }

  // 3. Upcoming fixed-rate ends (next 180 days)
  const today = new Date();
  const horizon = new Date(); horizon.setDate(today.getDate() + 180);
  let rateExpiries: LoanRow[] = [];
  try {
    const { data: loans } = await supabase
      .from("loan_facilities")
      .select("id, property_id, lender, rate_expiry_date, current_balance, interest_rate, org_id")
      .in("org_id", orgIds)
      .not("rate_expiry_date", "is", null)
      .gte("rate_expiry_date", today.toISOString().split("T")[0])
      .lte("rate_expiry_date", horizon.toISOString().split("T")[0])
      .order("rate_expiry_date", { ascending: true });
    rateExpiries = (loans || []) as LoanRow[];
  } catch (err) {
    console.warn("rate expiries query failed:", err);
  }

  // 4. Rent collected vs due (last 7 days)
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 7);
  const rentSummary: RentSummary = { due: 0, collected: 0, overdue: 0, itemsDue: 0, itemsPaid: 0 };
  try {
    const { data: scheduleRows } = await supabase
      .from("rent_schedule")
      .select("rent_amount, additional_charges, amount_paid, amount_outstanding, status, due_date, org_id")
      .in("org_id", orgIds)
      .gte("due_date", sevenDaysAgo.toISOString().split("T")[0])
      .lte("due_date", today.toISOString().split("T")[0]);
    type ScheduleRow = {
      rent_amount: number | string;
      additional_charges: number | string | null;
      amount_paid: number | string | null;
      amount_outstanding: number | string | null;
      status: string;
    };
    ((scheduleRows || []) as ScheduleRow[]).forEach((r) => {
      const due = Number(r.rent_amount || 0) + Number(r.additional_charges || 0);
      const paid = Number(r.amount_paid || 0);
      const outstanding = Number(r.amount_outstanding || 0);
      rentSummary.due += due;
      rentSummary.collected += paid;
      rentSummary.itemsDue++;
      if (paid >= due) rentSummary.itemsPaid++;
      if (r.status === 'overdue' || (outstanding > 0 && r.status !== 'upcoming')) {
        rentSummary.overdue += outstanding;
      }
    });
  } catch (err) {
    console.warn("rent summary query failed:", err);
  }

  // 5. Open voids
  let voids: VoidRow[] = [];
  if (propIds.length > 0) {
    try {
      const { data: voidRows } = await supabase
        .from("void_periods")
        .select("id, property_id, start_date, end_date, estimated_monthly_cost")
        .in("property_id", propIds)
        .is("end_date", null);
      voids = (voidRows || []) as VoidRow[];
    } catch (err) {
      console.warn("voids query failed:", err);
    }
  }

  // 6. New regulatory alerts (since last digest)
  let regulatoryAlerts: RegulatoryAlertRow[] = [];
  try {
    const { data: alertRows } = await supabase
      .from("regulatory_alerts")
      .select("id, title, category, severity, summary, effective_date, created_at, source_url, dismissed, org_id")
      .in("org_id", orgIds)
      .eq("dismissed", false)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    regulatoryAlerts = (alertRows || []) as RegulatoryAlertRow[];
  } catch (err) {
    console.warn("regulatory_alerts query skipped:", err);
  }

  // 7. Top 3 recommended actions (computed from above)
  const recommendedActions: DigestData['recommendedActions'] = [];
  if (overdueCount > 0) {
    recommendedActions.push({
      label: `Resolve ${overdueCount} overdue compliance item${overdueCount > 1 ? 's' : ''}`,
      detail: 'Renew certificates flagged as expired to stay on the right side of the regulator.',
      href: '/compliance',
    });
  }
  const imminentRate = rateExpiries.filter((l) => {
    const d = daysUntil(l.rate_expiry_date);
    return d !== null && d <= 90;
  });
  if (imminentRate.length > 0) {
    recommendedActions.push({
      label: `Plan refinance for ${imminentRate.length} loan${imminentRate.length > 1 ? 's' : ''} with rate expiring within 90 days`,
      detail: 'Lock in a new product before reverting to the lender SVR.',
      href: '/refinancing-opportunities',
    });
  }
  if (rentSummary.overdue > 0) {
    recommendedActions.push({
      label: `Chase ${formatGBP(rentSummary.overdue)} of outstanding rent`,
      detail: 'Open the rent collection workspace to send reminders or notices.',
      href: '/rent',
    });
  }
  if (voids.length > 0) {
    recommendedActions.push({
      label: `Re-let ${voids.length} void unit${voids.length > 1 ? 's' : ''}`,
      detail: 'Start a new lettings campaign to reduce lost rental income.',
      href: '/lettings',
    });
  }
  if (dueSoonCount > 0) {
    recommendedActions.push({
      label: `Book ${dueSoonCount} compliance renewal${dueSoonCount > 1 ? 's' : ''} due in 30 days`,
      detail: 'Schedule contractors now to avoid last-minute expiries.',
      href: '/compliance',
    });
  }
  if (regulatoryAlerts.some((a) => a.severity === 'critical' || a.severity === 'warning')) {
    recommendedActions.push({
      label: 'Review new UK regulatory changes',
      detail: 'New housing-law updates may affect your portfolio.',
      href: '/regulatory',
    });
  }

  return {
    overdueGroups,
    dueSoonGroups,
    rateExpiries,
    rentSummary,
    voids,
    regulatoryAlerts,
    recommendedActions: recommendedActions.slice(0, 3),
    propertyMap,
    kpis: {
      activeProperties: props.length,
      overdueCount,
      dueSoonCount,
      rateExpiryCount: rateExpiries.length,
      voidsCount: voids.length,
      rentShortfall: Math.max(rentSummary.due - rentSummary.collected, 0),
    },
  };
}

// ─── HTML rendering ────────────────────────────────────────────────

function renderComplianceSection(title: string, groups: ComplianceGroup[], color: string): string {
  if (groups.length === 0) return '';
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: ${color}; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid ${color}; padding-bottom: 8px;">
        ${escapeHtml(title)} (${total})
      </h2>
      ${groups.map(group => `
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f2937;">
            📍 ${escapeHtml(group.property.address_line)}${group.property.postcode ? `, ${escapeHtml(group.property.postcode)}` : ''}
          </h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${group.items.map(item => `
              <li style="color: #4b5563; font-size: 13px; margin-bottom: 4px;">
                <strong>${escapeHtml(item.compliance_type)}</strong> – Due: ${escapeHtml(formatDate(item.expiry_date))}
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRateExpiries(rateExpiries: LoanRow[], propertyMap: Map<string, Property>): string {
  if (rateExpiries.length === 0) return '';
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #7c3aed; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
        💼 Upcoming Fixed-Rate Ends (${rateExpiries.length})
      </h2>
      <table style="width:100%; border-collapse: collapse; font-size: 13px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="text-align:left; padding:8px;">Property</th>
          <th style="text-align:left; padding:8px;">Lender</th>
          <th style="text-align:right; padding:8px;">Balance</th>
          <th style="text-align:right; padding:8px;">Rate</th>
          <th style="text-align:right; padding:8px;">Expires</th>
        </tr></thead>
        <tbody>
          ${rateExpiries.map((l) => {
            const prop = l.property_id ? propertyMap.get(l.property_id) : null;
            return `<tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px;">${escapeHtml(prop?.address_line || '—')}</td>
              <td style="padding:8px;">${escapeHtml(l.lender || '—')}</td>
              <td style="padding:8px; text-align:right;">${escapeHtml(formatGBP(l.current_balance))}</td>
              <td style="padding:8px; text-align:right;">${l.interest_rate !== null ? escapeHtml(`${Number(l.interest_rate).toFixed(2)}%`) : '—'}</td>
              <td style="padding:8px; text-align:right;">${escapeHtml(formatDate(l.rate_expiry_date))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRentSummary(rent: RentSummary): string {
  const collectionRate = rent.due > 0 ? Math.round((rent.collected / rent.due) * 100) : 100;
  const rateColor = collectionRate >= 95 ? '#16a34a' : collectionRate >= 80 ? '#d97706' : '#dc2626';
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #0891b2; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #0891b2; padding-bottom: 8px;">
        💷 Rent Collected vs Due (last 7 days)
      </h2>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:140px; background:#f0f9ff; border-radius:8px; padding:14px;">
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Due</div>
          <div style="font-size:20px; font-weight:bold;">${escapeHtml(formatGBP(rent.due))}</div>
        </div>
        <div style="flex:1; min-width:140px; background:#f0fdf4; border-radius:8px; padding:14px;">
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Collected</div>
          <div style="font-size:20px; font-weight:bold;">${escapeHtml(formatGBP(rent.collected))}</div>
        </div>
        <div style="flex:1; min-width:140px; background:#fef2f2; border-radius:8px; padding:14px;">
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Outstanding</div>
          <div style="font-size:20px; font-weight:bold;">${escapeHtml(formatGBP(rent.overdue))}</div>
        </div>
        <div style="flex:1; min-width:140px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:14px;">
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Collection rate</div>
          <div style="font-size:20px; font-weight:bold; color:${rateColor};">${collectionRate}%</div>
        </div>
      </div>
      <p style="margin:8px 0 0; font-size:12px; color:#6b7280;">
        ${rent.itemsPaid} of ${rent.itemsDue} scheduled payments fully received.
      </p>
    </div>
  `;
}

function renderVoids(voids: VoidRow[], propertyMap: Map<string, Property>): string {
  if (voids.length === 0) return '';
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #b45309; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #b45309; padding-bottom: 8px;">
        🏚️ Open Voids (${voids.length})
      </h2>
      <ul style="margin:0; padding-left:20px;">
        ${voids.map((v) => {
          const prop = propertyMap.get(v.property_id);
          const since = daysUntil(v.start_date);
          const days = since !== null ? Math.abs(since) : null;
          return `<li style="color:#4b5563; font-size:13px; margin-bottom:6px;">
            <strong>${escapeHtml(prop?.address_line || 'Unknown property')}</strong>
            ${days !== null ? ` — vacant ${days} day${days === 1 ? '' : 's'}` : ''}
            ${v.estimated_monthly_cost ? ` <span style="color:#9ca3af;">(${escapeHtml(formatGBP(Number(v.estimated_monthly_cost)))}/mo lost)</span>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderRegulatoryAlerts(alerts: RegulatoryAlertRow[]): string {
  if (alerts.length === 0) return '';
  const sevColor = (s: string) => s === 'critical' ? '#dc2626' : s === 'warning' ? '#d97706' : '#2563eb';
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #4338ca; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #4338ca; padding-bottom: 8px;">
        📜 New Regulatory Changes (${alerts.length})
      </h2>
      ${alerts.map((a) => `
        <div style="background:#f9fafb; border-left:4px solid ${sevColor(a.severity)}; padding:12px 14px; margin-bottom:10px; border-radius:6px;">
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <strong style="font-size:13px; color:#111827;">${escapeHtml(a.title)}</strong>
            <span style="font-size:11px; text-transform:uppercase; color:${sevColor(a.severity)};">${escapeHtml(a.severity)}</span>
          </div>
          <p style="margin:6px 0 0; font-size:12px; color:#4b5563;">${escapeHtml(a.summary)}</p>
          ${a.effective_date ? `<p style="margin:4px 0 0; font-size:11px; color:#6b7280;">Effective ${escapeHtml(formatDate(a.effective_date))}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecommendedActions(actions: DigestData['recommendedActions'], baseUrl: string): string {
  if (actions.length === 0) return '';
  return `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #047857; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #047857; padding-bottom: 8px;">
        ⭐ Top ${actions.length} Recommended Action${actions.length === 1 ? '' : 's'}
      </h2>
      <ol style="margin:0; padding-left:20px;">
        ${actions.map((a) => `
          <li style="margin-bottom:10px; font-size:13px; color:#1f2937;">
            <a href="${escapeHtml(baseUrl + a.href)}" style="color:#047857; text-decoration:none; font-weight:600;">${escapeHtml(a.label)}</a>
            <div style="font-size:12px; color:#6b7280; margin-top:2px;">${escapeHtml(a.detail)}</div>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

function generateEmailHtml(data: DigestData, prefs: PrefsSubset, baseUrl: string): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const showCompliance = prefs.notify_expiring_soon;
  const showRate = prefs.notify_rate_expiry;
  const showRent = prefs.notify_rent_collection;
  const showVoids = prefs.notify_voids;
  const showRegulatory = prefs.notify_regulatory_changes;
  const showActions = prefs.notify_recommended_actions;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly Portfolio Digest</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f3f4f6; margin:0; padding:20px;">
  <div style="max-width:720px; margin:0 auto; background:white; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%); color:white; padding:32px; border-radius:12px 12px 0 0;">
      <h1 style="margin:0 0 8px; font-size:24px;">📊 Weekly Portfolio Digest</h1>
      <p style="margin:0; opacity:0.9; font-size:14px;">${escapeHtml(dateStr)}</p>
    </div>

    <div style="display:flex; padding:20px; gap:12px; background:#f9fafb; border-bottom:1px solid #e5e7eb; flex-wrap:wrap;">
      ${[
        { label: 'Active Properties', value: data.kpis.activeProperties, color: '#1f2937' },
        { label: 'Overdue', value: data.kpis.overdueCount, color: data.kpis.overdueCount > 0 ? '#dc2626' : '#1f2937' },
        { label: 'Due Soon (30d)', value: data.kpis.dueSoonCount, color: data.kpis.dueSoonCount > 0 ? '#d97706' : '#1f2937' },
        { label: 'Rate Expiries (180d)', value: data.kpis.rateExpiryCount, color: data.kpis.rateExpiryCount > 0 ? '#7c3aed' : '#1f2937' },
        { label: 'Open Voids', value: data.kpis.voidsCount, color: data.kpis.voidsCount > 0 ? '#b45309' : '#1f2937' },
      ].map((k) => `
        <div style="flex:1; min-width:120px; text-align:center; padding:14px; background:white; border-radius:8px; border:1px solid #e5e7eb;">
          <div style="font-size:24px; font-weight:bold; color:${k.color};">${k.value}</div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">${escapeHtml(k.label)}</div>
        </div>
      `).join('')}
    </div>

    <div style="padding:24px;">
      ${showActions ? renderRecommendedActions(data.recommendedActions, baseUrl) : ''}
      ${showCompliance ? renderComplianceSection('🔴 Overdue Compliance', data.overdueGroups, '#dc2626') : ''}
      ${showCompliance ? renderComplianceSection('🟠 Due Soon (Next 30 Days)', data.dueSoonGroups, '#d97706') : ''}
      ${showRate ? renderRateExpiries(data.rateExpiries, data.propertyMap) : ''}
      ${showRent ? renderRentSummary(data.rentSummary) : ''}
      ${showVoids ? renderVoids(data.voids, data.propertyMap) : ''}
      ${showRegulatory ? renderRegulatoryAlerts(data.regulatoryAlerts) : ''}
    </div>

    <div style="background:#f9fafb; padding:20px; text-align:center; border-radius:0 0 12px 12px; border-top:1px solid #e5e7eb;">
      <p style="margin:0; color:#6b7280; font-size:12px;">
        Automated portfolio digest from Tenure IQ.<br>
        <a href="${escapeHtml(baseUrl)}/settings/notifications" style="color:#2563eb;">Manage preferences</a> ·
        <a href="${escapeHtml(baseUrl)}/" style="color:#2563eb;">Open dashboard</a>
      </p>
    </div>
  </div>
</body></html>`;
}

function generatePlainText(data: DigestData, prefs: PrefsSubset): string {
  const dateStr = new Date().toLocaleDateString('en-GB');
  let text = `WEEKLY PORTFOLIO DIGEST\n${dateStr}\n${'='.repeat(50)}\n\n`;
  text += `Active Properties: ${data.kpis.activeProperties}\n`;
  text += `Overdue: ${data.kpis.overdueCount} | Due Soon (30d): ${data.kpis.dueSoonCount}\n`;
  text += `Rate Expiries (180d): ${data.kpis.rateExpiryCount} | Open Voids: ${data.kpis.voidsCount}\n\n`;

  if (prefs.notify_recommended_actions && data.recommendedActions.length > 0) {
    text += `TOP RECOMMENDED ACTIONS\n${'-'.repeat(30)}\n`;
    data.recommendedActions.forEach((a, i) => { text += `${i + 1}. ${a.label}\n   ${a.detail}\n`; });
    text += '\n';
  }
  if (prefs.notify_expiring_soon && data.overdueGroups.length > 0) {
    text += `OVERDUE COMPLIANCE\n${'-'.repeat(30)}\n`;
    data.overdueGroups.forEach((g) => { g.items.forEach((i) => { text += `• ${g.property.address_line} — ${i.compliance_type} (due ${formatDate(i.expiry_date)})\n`; }); });
    text += '\n';
  }
  if (prefs.notify_rate_expiry && data.rateExpiries.length > 0) {
    text += `UPCOMING FIXED-RATE ENDS\n${'-'.repeat(30)}\n`;
    data.rateExpiries.forEach((l) => { text += `• ${l.lender ?? '—'} — ${formatGBP(l.current_balance)} expires ${formatDate(l.rate_expiry_date)}\n`; });
    text += '\n';
  }
  if (prefs.notify_rent_collection) {
    text += `RENT (LAST 7 DAYS)\n${'-'.repeat(30)}\n`;
    text += `Due: ${formatGBP(data.rentSummary.due)} | Collected: ${formatGBP(data.rentSummary.collected)} | Outstanding: ${formatGBP(data.rentSummary.overdue)}\n\n`;
  }
  if (prefs.notify_voids && data.voids.length > 0) {
    text += `OPEN VOIDS\n${'-'.repeat(30)}\n`;
    data.voids.forEach((v) => { text += `• ${data.propertyMap.get(v.property_id)?.address_line ?? 'Unknown'} (since ${formatDate(v.start_date)})\n`; });
    text += '\n';
  }
  if (prefs.notify_regulatory_changes && data.regulatoryAlerts.length > 0) {
    text += `NEW REGULATORY CHANGES\n${'-'.repeat(30)}\n`;
    data.regulatoryAlerts.forEach((a) => { text += `• [${a.severity.toUpperCase()}] ${a.title}\n  ${a.summary}\n`; });
  }
  return text;
}

// ─── Subscriber resolution & send loop ─────────────────────────────

interface Subscriber {
  userId: string;
  email: string;
  orgIds: string[];
  prefs: PrefsSubset;
}

async function resolveSubscribers(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  filter: { userId?: string; orgIds?: string[]; respectDay?: boolean },
): Promise<Subscriber[]> {
  let query = supabase
    .from("notification_preferences")
    .select("user_id, org_id, email_enabled, email_address, weekly_digest_enabled, weekly_digest_day, notify_expiring_soon, notify_rate_expiry, notify_rent_collection, notify_voids, notify_regulatory_changes, notify_recommended_actions")
    .eq("weekly_digest_enabled", true)
    .eq("email_enabled", true);

  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.orgIds && filter.orgIds.length > 0) query = query.in("org_id", filter.orgIds);

  const { data, error } = await query;
  if (error) throw error;

  const today = new Date().getDay();
  const rows = (data || []) as NotificationPrefsRow[];

  // Group by user, merge orgs, take a single PrefsSubset per user (first row wins)
  const byUser = new Map<string, Subscriber>();
  for (const r of rows) {
    if (filter.respectDay && r.weekly_digest_day !== today) continue;

    if (!byUser.has(r.user_id)) {
      // Resolve email: explicit address or auth.users email
      let email = r.email_address;
      if (!email) {
        const { data: authUser } = await supabase.auth.admin.getUserById(r.user_id);
        email = authUser?.user?.email ?? null;
      }
      if (!email) continue;
      byUser.set(r.user_id, {
        userId: r.user_id,
        email,
        orgIds: [r.org_id],
        prefs: {
          notify_expiring_soon: r.notify_expiring_soon,
          notify_rate_expiry: r.notify_rate_expiry,
          notify_rent_collection: r.notify_rent_collection,
          notify_voids: r.notify_voids,
          notify_regulatory_changes: r.notify_regulatory_changes,
          notify_recommended_actions: r.notify_recommended_actions,
        },
      });
    } else {
      byUser.get(r.user_id)!.orgIds.push(r.org_id);
    }
  }
  return [...byUser.values()];
}

// ─── Main handler ──────────────────────────────────────────────────

serve(withInvocationLog("send-weekly-compliance-email", async (req, _invocationLog) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const authorization = await authorizeRequest(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let isTestSend = false;
    let forceResend = false;
    let previewOnly = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        isTestSend = body.test === true;
        forceResend = body.force === true;
        previewOnly = body.preview === true;
      } catch { /* no body */ }
    }

    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://tenureiq.com";

    // ── User mode: build preview / one-off send for the calling user
    if (authorization.mode === "user") {
      const orgIds = authorization.manageableOrgIds || [];
      const data = await buildDigestData(supabase, orgIds);

      // Load this user's prefs (any org); fall back to "all on".
      const { data: prefRows } = await supabase
        .from("notification_preferences")
        .select("notify_expiring_soon, notify_rate_expiry, notify_rent_collection, notify_voids, notify_regulatory_changes, notify_recommended_actions")
        .eq("user_id", authorization.userId)
        .limit(1);
      const userPrefs: PrefsSubset = (prefRows && prefRows[0]) || {
        notify_expiring_soon: true,
        notify_rate_expiry: true,
        notify_rent_collection: true,
        notify_voids: true,
        notify_regulatory_changes: true,
        notify_recommended_actions: true,
      };

      const html = generateEmailHtml(data, userPrefs, baseUrl);
      const text = generatePlainText(data, userPrefs);
      const subject = `Weekly Portfolio Digest — ${new Date().toISOString().split("T")[0]}`;

      if (previewOnly) {
        return new Response(
          JSON.stringify({ success: true, preview: true, html, text, subject, kpis: data.kpis }),
          { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const recipient = authorization.userEmail || Deno.env.get("COMPLIANCE_EMAIL_RECIPIENT");
      if (!recipient) throw new Error("No recipient email available");

      const { data: result, error: sendErr } = await resend.emails.send({
        from: "Tenure IQ <no-reply@resend.dev>",
        to: [recipient],
        subject,
        html,
        text,
      });
      if (sendErr) throw sendErr;

      return new Response(
        JSON.stringify({ success: true, recipient, provider_message_id: result?.id, kpis: data.kpis }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── Cron mode: fan out to every opted-in user, respecting weekly_digest_day
    const subscribers = await resolveSubscribers(supabase, { respectDay: !isTestSend && !forceResend });
    console.log(`Sending weekly digest to ${subscribers.length} subscriber(s)`);

    let sent = 0;
    let failed = 0;
    for (const sub of subscribers) {
      const runKey = getWeeklyRunKey(sub.userId);
      if (!isTestSend && !forceResend) {
        const { data: existing } = await supabase
          .from("scheduled_email_runs")
          .select("id, status")
          .eq("run_key", runKey)
          .maybeSingle();
        if (existing && existing.status === "sent") continue;
      }

      const data = await buildDigestData(supabase, sub.orgIds);
      const html = generateEmailHtml(data, sub.prefs, baseUrl);
      const text = generatePlainText(data, sub.prefs);
      const subject = `Weekly Portfolio Digest — ${new Date().toISOString().split("T")[0]}`;

      const { data: runRecord } = await supabase
        .from("scheduled_email_runs")
        .insert({
          run_key: runKey,
          scheduled_for: new Date().toISOString(),
          status: "queued",
          recipient_email: sub.email,
          email_subject: subject,
          org_id: sub.orgIds[0] ?? null,
        })
        .select()
        .single();

      try {
        const { data: result, error: sendErr } = await resend.emails.send({
          from: "Tenure IQ <no-reply@resend.dev>",
          to: [sub.email],
          subject,
          html,
          text,
        });
        if (sendErr) throw sendErr;
        sent++;
        if (runRecord) {
          await supabase
            .from("scheduled_email_runs")
            .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result?.id })
            .eq("id", runRecord.id);
        }
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed sending digest to ${sub.email}:`, message);
        if (runRecord) {
          await supabase
            .from("scheduled_email_runs")
            .update({ status: "failed", error: message })
            .eq("id", runRecord.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, subscribers: subscribers.length, sent, failed }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-weekly-compliance-email:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const status = message === "Unauthorized" ? 401 : message === "Access denied" ? 403 : 500;
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
}));
