import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  LOAN_FACILITY_SELECT,
  loanFacilityToLegacyShape,
  warnIfPropertyIdSpaceMismatch,
} from "../_shared/loanFacility.ts";

type ToolArgs = Record<string, unknown>;

export async function executeTool(
  supabase: SupabaseClient,
  orgId: string,
  toolName: string,
  args: ToolArgs
): Promise<string> {
  switch (toolName) {
    case "get_property_details":
      return getPropertyDetails(supabase, orgId, args);
    case "create_compliance_task":
      return createComplianceTask(supabase, orgId, args);
    case "calculate_portfolio_metrics":
      return calculatePortfolioMetrics(supabase, orgId, args);
    case "search_properties":
      return searchProperties(supabase, orgId, args);
    case "generate_report":
      return generateReport(supabase, orgId, args);
    case "schedule_reminder":
      return scheduleReminder(supabase, orgId, args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── get_property_details ────────────────────────────────────────────────────

async function getPropertyDetails(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  const propertyId = args.property_id as string;
  const include = (args.include as string[] | undefined) ?? ["all"];
  const wantAll = include.includes("all");

  // V2: properties_v2 (Prompt §7.C hot-fix). Remap: address_line→address_line_1,
  // current_value_gbp→current_valuation, purchase_price_gbp→purchase_price,
  // lifecycle_type→lifecycle_stage, has_gas→has_gas_supply. V1 `beds` has no
  // V2 scalar equivalent (lives in rooms_v2) — surfaced as null + warning.
  const { data: propertyRaw, error } = await supabase
    .from("properties_v2")
    .select("id, address_line_1, postcode, property_type, current_valuation, purchase_price, epc_rating, lifecycle_stage, tenure, has_gas_supply")
    .eq("id", propertyId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!propertyRaw) return JSON.stringify({ error: "Property not found" });

  const property = {
    id: propertyRaw.id,
    address_line: propertyRaw.address_line_1,
    postcode: propertyRaw.postcode,
    property_type: propertyRaw.property_type,
    beds: null as number | null,
    current_value_gbp: propertyRaw.current_valuation,
    purchase_price_gbp: propertyRaw.purchase_price,
    epc_rating: propertyRaw.epc_rating,
    lifecycle_type: propertyRaw.lifecycle_stage,
    tenure: propertyRaw.tenure,
    has_gas: propertyRaw.has_gas_supply,
  };
  console.warn(JSON.stringify({
    ts: new Date().toISOString(),
    fn: "portfolio-chat:get_property_details",
    outcome: "v1_column_unavailable_in_v2",
    property_id: propertyId,
    column: "beds",
    message: "properties_v2 has no scalar `beds` — returning null.",
  }));

  const result: Record<string, unknown> = {
    id: property.id,
    address: property.address_line,
    postcode: property.postcode,
    property_type: property.property_type,
    beds: property.beds,
    current_value: property.current_value_gbp,
    purchase_price: property.purchase_price_gbp,
    epc_rating: property.epc_rating,
    lifecycle: property.lifecycle_type,
    tenure: property.tenure,
    has_gas: property.has_gas,
  };

  const fetches: PromiseLike<void>[] = [];

  if (wantAll || include.includes("loans")) {
    fetches.push(
      supabase
        .from("loan_facilities")
        .select(LOAN_FACILITY_SELECT)
        .eq("property_id", propertyId)
        .then(({ data }) => {
          const mapped = (data ?? []).map(loanFacilityToLegacyShape);
          result.loans = mapped.map((l) => ({
            lender: l.lender,
            balance: l.current_mortgage_balance_gbp,
            interest_rate: l.interest_rate_percent,
            mortgage_type: l.mortgage_type,
            term_end: l.fixed_rate_end_date,
          }));
        })
    );
  }

  if (wantAll || include.includes("financials")) {
    const currentYear = new Date().getFullYear();
    fetches.push(
      Promise.all([
        supabase
          .from("income")
          .select("*")
          .eq("property_id", propertyId)
          .eq("year", currentYear)
          .maybeSingle(),
        supabase
          .from("costs")
          .select("*")
          .eq("property_id", propertyId)
          .eq("year", currentYear)
          .maybeSingle(),
      ]).then(([incomeRes, costsRes]) => {
        const income = incomeRes.data;
        const costs = costsRes.data;
        result.financials = {
          annual_rent: income?.annual_rent_gbp ?? 0,
          monthly_rent: income ? (income.annual_rent_gbp ?? 0) / 12 : 0,
          management_cost: costs?.management_gbp ?? 0,
          bills: costs?.bills_gbp ?? 0,
          insurance: costs?.insurance_gbp ?? 0,
          maintenance: costs?.maintenance_gbp ?? 0,
          compliance_cost: costs?.compliance_gbp ?? 0,
          other_costs: costs?.other_gbp ?? 0,
        };
      })
    );
  }

  if (wantAll || include.includes("compliance")) {
    fetches.push(
      supabase
        .from("compliance_items")
        .select("*")
        .eq("property_id", propertyId)
        .then(({ data }) => {
          const now = new Date();
          result.compliance = (data ?? []).map((c) => {
            const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
            let status = "valid";
            if (expiry && expiry < now) status = "expired";
            else if (expiry && expiry < new Date(now.getTime() + 90 * 86400000))
              status = "expiring_soon";
            return {
              type: c.compliance_type,
              expiry_date: c.expiry_date,
              status,
              responsible_party: c.responsible_party,
            };
          });
        })
    );
  }

  if (wantAll || include.includes("rooms")) {
    fetches.push(
      supabase
        .from("rooms")
        .select("*")
        .eq("property_id", propertyId)
        .then(({ data }) => {
          result.rooms = (data ?? []).map((r) => ({
            name: r.room_name,
            type: r.room_type,
            rent: r.target_rent_pcm,
            status: r.status,
            floor: r.floor,
          }));
        })
    );
  }

  if (wantAll || include.includes("tenants")) {
    fetches.push(
      supabase
        .from("rooms")
        .select("id")
        .eq("property_id", propertyId)
        .then(async ({ data: rooms }) => {
          if (!rooms || rooms.length === 0) {
            result.tenants = [];
            return;
          }
          const roomIds = rooms.map((r) => r.id);
          const { data: tenancies } = await supabase
            .from("tenancies")
            .select("*, tenants(*)")
            .in("room_id", roomIds)
            .eq("status", "active");
          result.tenants = (tenancies ?? []).map((t) => ({
            name: t.tenants
              ? `${t.tenants.first_name} ${t.tenants.last_name}`
              : "Unknown",
            rent: t.rent_pcm,
            start_date: t.start_date,
            end_date: t.end_date,
            room_id: t.room_id,
          }));
        })
    );
  }

  await Promise.all(fetches);
  return JSON.stringify(result);
}

// ─── create_compliance_task ──────────────────────────────────────────────────

async function createComplianceTask(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      org_id: orgId,
      property_id: args.property_id as string,
      title: args.title as string,
      task_type: (args.task_type as string) ?? "follow_up",
      due_date: args.due_date as string,
      priority: (args.priority as string) ?? "medium",
      description: (args.description as string) ?? null,
      status: "open",
      source: "manual",
    })
    .select("id, title, due_date, priority, status")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, task: data });
}

// ─── calculate_portfolio_metrics ─────────────────────────────────────────────

async function calculatePortfolioMetrics(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  const metric = args.metric as string;
  const propertyIds = args.property_ids as string[] | undefined;
  const currentYear = new Date().getFullYear();

  let propsQuery = supabase.from("properties").select("*").eq("org_id", orgId);
  if (propertyIds?.length) propsQuery = propsQuery.in("id", propertyIds);
  const { data: properties } = await propsQuery;
  if (!properties || properties.length === 0)
    return JSON.stringify({ error: "No properties found" });

  const propIds = properties.map((p) => p.id);

  const [loansRes, incomeRes, costsRes] = await Promise.all([
    supabase.from("loan_facilities").select(LOAN_FACILITY_SELECT).in("property_id", propIds),
    supabase
      .from("income")
      .select("*")
      .in("property_id", propIds)
      .eq("year", currentYear),
    supabase
      .from("costs")
      .select("*")
      .in("property_id", propIds)
      .eq("year", currentYear),
  ]);

  warnIfPropertyIdSpaceMismatch("portfolio-chat:get_property_financials", (loansRes.data ?? []) as Array<{id:string;property_id:string}>, propIds);
  const loans = ((loansRes.data ?? []) as Parameters<typeof loanFacilityToLegacyShape>[0][]).map(loanFacilityToLegacyShape);
  const incomes = incomeRes.data ?? [];
  const costs = costsRes.data ?? [];

  const totalValue = properties.reduce(
    (s, p) => s + (p.current_value_gbp ?? 0),
    0
  );
  const totalDebt = loans.reduce(
    (s, l) => s + (l.current_mortgage_balance_gbp ?? 0),
    0
  );
  const totalRent = incomes.reduce(
    (s, i) => s + (i.annual_rent_gbp ?? 0),
    0
  );
  const totalCosts = costs.reduce(
    (s, c) =>
      s +
      (c.management_gbp ?? 0) +
      (c.bills_gbp ?? 0) +
      (c.insurance_gbp ?? 0) +
      (c.maintenance_gbp ?? 0) +
      (c.compliance_gbp ?? 0) +
      (c.other_gbp ?? 0),
    0
  );

  const totalMortgagePayments = loans.reduce((s, l) => {
    const balance = l.current_mortgage_balance_gbp ?? 0;
    const rate = (l.interest_rate_percent ?? 0) / 100;
    return s + balance * rate;
  }, 0);

  const metrics: Record<string, unknown> = {};

  const wantAll = metric === "all";

  if (wantAll || metric === "gross_yield") {
    metrics.gross_yield = {
      value: totalValue > 0 ? ((totalRent / totalValue) * 100).toFixed(2) : "0",
      label: "Gross Yield (%)",
      total_rent: totalRent,
      total_value: totalValue,
    };
  }

  if (wantAll || metric === "net_yield") {
    const netIncome = totalRent - totalCosts;
    metrics.net_yield = {
      value:
        totalValue > 0 ? ((netIncome / totalValue) * 100).toFixed(2) : "0",
      label: "Net Yield (%)",
      net_income: netIncome,
      total_value: totalValue,
    };
  }

  if (wantAll || metric === "ltv") {
    metrics.ltv = {
      value:
        totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(2) : "0",
      label: "Loan to Value (%)",
      total_debt: totalDebt,
      total_value: totalValue,
    };
  }

  if (wantAll || metric === "equity") {
    metrics.equity = {
      value: totalValue - totalDebt,
      label: "Total Equity (GBP)",
      total_value: totalValue,
      total_debt: totalDebt,
    };
  }

  if (wantAll || metric === "cashflow") {
    const annualCashflow = totalRent - totalCosts - totalMortgagePayments;
    metrics.cashflow = {
      annual: annualCashflow,
      monthly: annualCashflow / 12,
      label: "Net Cashflow (GBP)",
      breakdown: {
        rent: totalRent,
        costs: totalCosts,
        mortgage_payments: totalMortgagePayments,
      },
    };
  }

  if (wantAll || metric === "roi") {
    const totalPurchasePrice = properties.reduce(
      (s, p) => s + (p.purchase_price_gbp ?? 0),
      0
    );
    const totalEquity = totalValue - totalDebt;
    const netIncome = totalRent - totalCosts - totalMortgagePayments;
    metrics.roi = {
      on_equity:
        totalEquity > 0 ? ((netIncome / totalEquity) * 100).toFixed(2) : "0",
      on_purchase:
        totalPurchasePrice > 0
          ? ((netIncome / totalPurchasePrice) * 100).toFixed(2)
          : "0",
      label: "Return on Investment (%)",
    };
  }

  return JSON.stringify({
    property_count: properties.length,
    period: (args.period as string) ?? "annual",
    metrics,
  });
}

// ─── search_properties ───────────────────────────────────────────────────────

async function searchProperties(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  const query = args.query as string | undefined;
  const filters = (args.filters as Record<string, unknown>) ?? {};

  let q = supabase
    .from("properties")
    .select("id, address_line, postcode, property_type, beds, current_value_gbp, epc_rating, lifecycle_type, tenure")
    .eq("org_id", orgId);

  if (query) {
    q = q.or(
      `address_line.ilike.%${query}%,postcode.ilike.%${query}%`
    );
  }

  if (filters.property_type) q = q.eq("property_type", filters.property_type);
  if (filters.min_value) q = q.gte("current_value_gbp", filters.min_value);
  if (filters.max_value) q = q.lte("current_value_gbp", filters.max_value);
  if (filters.min_beds) q = q.gte("beds", filters.min_beds);
  if (filters.lifecycle) q = q.eq("lifecycle_type", filters.lifecycle);

  const { data, error } = await q.order("address_line").limit(20);
  if (error) return JSON.stringify({ error: error.message });

  let results = data ?? [];

  // Post-filter by compliance status if requested
  if (filters.compliance_status) {
    const propIds = results.map((p) => p.id);
    if (propIds.length > 0) {
      const { data: compliance } = await supabase
        .from("compliance_items")
        .select("property_id, expiry_date")
        .in("property_id", propIds);

      const now = new Date();
      const soon = new Date(now.getTime() + 90 * 86400000);

      const statusMap = new Map<string, string>();
      for (const c of compliance ?? []) {
        const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
        const current = statusMap.get(c.property_id) ?? "compliant";
        if (expiry && expiry < now) {
          statusMap.set(c.property_id, "expired");
        } else if (expiry && expiry < soon && current !== "expired") {
          statusMap.set(c.property_id, "expiring");
        }
      }

      results = results.filter((p) => {
        const status = statusMap.get(p.id) ?? "compliant";
        return status === filters.compliance_status;
      });
    }
  }

  return JSON.stringify({
    count: results.length,
    properties: results.map((p) => ({
      id: p.id,
      address: p.address_line,
      postcode: p.postcode,
      type: p.property_type,
      beds: p.beds,
      value: p.current_value_gbp,
      epc: p.epc_rating,
      lifecycle: p.lifecycle_type,
    })),
  });
}

// ─── generate_report ─────────────────────────────────────────────────────────

async function generateReport(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  const reportType = args.report_type as string;
  const propertyIds = args.property_ids as string[] | undefined;
  const format = (args.format as string) ?? "text";

  let propsQuery = supabase.from("properties").select("*").eq("org_id", orgId);
  if (propertyIds?.length) propsQuery = propsQuery.in("id", propertyIds);
  const { data: properties } = await propsQuery;
  if (!properties || properties.length === 0)
    return JSON.stringify({ error: "No properties found" });

  const propIds = properties.map((p) => p.id);

  switch (reportType) {
    case "compliance_summary": {
      const { data: items } = await supabase
        .from("compliance_items")
        .select("*")
        .in("property_id", propIds);

      const now = new Date();
      const soon = new Date(now.getTime() + 90 * 86400000);
      const expired: unknown[] = [];
      const expiring: unknown[] = [];
      const valid: unknown[] = [];

      for (const c of items ?? []) {
        const prop = properties.find((p) => p.id === c.property_id);
        const entry = {
          property: prop?.address_line,
          type: c.compliance_type,
          expiry: c.expiry_date,
        };
        const expiry = c.expiry_date ? new Date(c.expiry_date) : null;
        if (expiry && expiry < now) expired.push(entry);
        else if (expiry && expiry < soon) expiring.push(entry);
        else valid.push(entry);
      }

      return JSON.stringify({
        report: "Compliance Summary",
        total_items: (items ?? []).length,
        expired: { count: expired.length, items: expired },
        expiring_within_90_days: { count: expiring.length, items: expiring },
        valid: { count: valid.length },
        property_count: properties.length,
      });
    }

    case "financial_overview": {
      const currentYear = new Date().getFullYear();
      const [loansRes, incomeRes, costsRes] = await Promise.all([
        supabase.from("loan_facilities").select(LOAN_FACILITY_SELECT).in("property_id", propIds),
        supabase.from("income").select("*").in("property_id", propIds).eq("year", currentYear),
        supabase.from("costs").select("*").in("property_id", propIds).eq("year", currentYear),
      ]);

      warnIfPropertyIdSpaceMismatch("portfolio-chat:portfolio_summary", (loansRes.data ?? []) as Array<{id:string;property_id:string}>, propIds);
      const totalValue = properties.reduce((s, p) => s + (p.current_value_gbp ?? 0), 0);
      const totalDebt = ((loansRes.data ?? []) as Parameters<typeof loanFacilityToLegacyShape>[0][]).map(loanFacilityToLegacyShape).reduce((s, l) => s + (l.current_mortgage_balance_gbp ?? 0), 0);
      const totalRent = (incomeRes.data ?? []).reduce((s, i) => s + (i.annual_rent_gbp ?? 0), 0);
      const totalCosts = (costsRes.data ?? []).reduce(
        (s, c) =>
          s + (c.management_gbp ?? 0) + (c.bills_gbp ?? 0) + (c.insurance_gbp ?? 0) +
          (c.maintenance_gbp ?? 0) + (c.compliance_gbp ?? 0) + (c.other_gbp ?? 0),
        0
      );

      return JSON.stringify({
        report: "Financial Overview",
        year: currentYear,
        portfolio_value: totalValue,
        total_debt: totalDebt,
        equity: totalValue - totalDebt,
        ltv_percent: totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : "0",
        annual_rent: totalRent,
        annual_costs: totalCosts,
        net_income: totalRent - totalCosts,
        gross_yield: totalValue > 0 ? ((totalRent / totalValue) * 100).toFixed(2) : "0",
        property_count: properties.length,
      });
    }

    case "rent_roll": {
      const currentYear = new Date().getFullYear();
      const { data: incomes } = await supabase
        .from("income")
        .select("*")
        .in("property_id", propIds)
        .eq("year", currentYear);

      const rows = properties.map((p) => {
        const income = (incomes ?? []).find((i) => i.property_id === p.id);
        return {
          property: p.address_line,
          postcode: p.postcode,
          annual_rent: income?.annual_rent_gbp ?? 0,
          monthly_rent: income ? (income.annual_rent_gbp ?? 0) / 12 : 0,
        };
      });

      const totalAnnual = rows.reduce((s, r) => s + r.annual_rent, 0);

      return JSON.stringify({
        report: "Rent Roll",
        year: currentYear,
        properties: rows,
        total_annual_rent: totalAnnual,
        total_monthly_rent: totalAnnual / 12,
      });
    }

    case "portfolio_snapshot": {
      const currentYear = new Date().getFullYear();
      const [loansRes, incomeRes, complianceRes] = await Promise.all([
        supabase.from("loan_facilities").select(LOAN_FACILITY_SELECT).in("property_id", propIds),
        supabase.from("income").select("*").in("property_id", propIds).eq("year", currentYear),
        supabase.from("compliance_items").select("*").in("property_id", propIds),
      ]);

      warnIfPropertyIdSpaceMismatch("portfolio-chat:risk_summary", (loansRes.data ?? []) as Array<{id:string;property_id:string}>, propIds);
      const totalValue = properties.reduce((s, p) => s + (p.current_value_gbp ?? 0), 0);
      const totalDebt = ((loansRes.data ?? []) as Parameters<typeof loanFacilityToLegacyShape>[0][]).map(loanFacilityToLegacyShape).reduce((s, l) => s + (l.current_mortgage_balance_gbp ?? 0), 0);
      const totalRent = (incomeRes.data ?? []).reduce((s, i) => s + (i.annual_rent_gbp ?? 0), 0);
      const now = new Date();
      const expiredCount = (complianceRes.data ?? []).filter(
        (c) => c.expiry_date && new Date(c.expiry_date) < now
      ).length;

      return JSON.stringify({
        report: "Portfolio Snapshot",
        date: now.toISOString().slice(0, 10),
        properties: properties.length,
        total_value: totalValue,
        total_debt: totalDebt,
        equity: totalValue - totalDebt,
        ltv: totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : "0",
        annual_rent: totalRent,
        gross_yield: totalValue > 0 ? ((totalRent / totalValue) * 100).toFixed(2) : "0",
        expired_compliance_items: expiredCount,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown report type: ${reportType}` });
  }
}

// ─── schedule_reminder ───────────────────────────────────────────────────────

async function scheduleReminder(
  supabase: SupabaseClient,
  orgId: string,
  args: ToolArgs
): Promise<string> {
  // Use compliance_tasks as a lightweight reminder mechanism with follow_up type
  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      org_id: orgId,
      property_id: (args.property_id as string) ?? null,
      title: args.title as string,
      description: (args.description as string) ?? null,
      task_type: "follow_up",
      due_date: (args.remind_at as string).slice(0, 10),
      priority: "medium",
      status: "open",
      source: "manual",
    })
    .select("id, title, due_date")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, reminder: data });
}
