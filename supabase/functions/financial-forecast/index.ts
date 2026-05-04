import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireActiveSubscription } from "../_shared/checkSubscription.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { createLogger, withInvocationLog } from "../_shared/logger.ts";
import {
  LOAN_FACILITY_SELECT,
  loanFacilityToLegacyShape,
  warnIfPropertyIdSpaceMismatch,
} from "../_shared/loanFacility.ts";
import {
  PROPERTY_COST_BUDGET_SELECT,
  propertyCostBudgetToLegacyShape,
  warnIfLegacyYearMissing,
} from "../_shared/propertyCostBudget.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ForecastRequest {
  forecast_type: "cashflow" | "stress_test" | "rate_scenario";
  time_horizon_months: number;
  assumptions: {
    rent_growth_pct: number;
    void_rate_pct: number;
    maintenance_pct: number;
    rate_change_bps: number;
  };
  name?: string;
}

interface PropertyData {
  id: string;
  address_line: string;
  current_value_gbp: number | null;
  purchase_price_gbp: number | null;
}

interface LoanData {
  property_id: string;
  interest_rate_percent: number | null;
  current_mortgage_balance_gbp: number | null;
  mortgage_payment_gbp: number | null;
  fixed_or_variable: string | null;
  fixed_rate_expires: string | null;
  reversion_rate_percent: number | null;
  capital_or_interest: string | null;
}

interface IncomeData {
  property_id: string;
  year: number;
  annual_rent_gbp: number;
}

interface CostData {
  property_id: string;
  year: number;
  management_gbp: number | null;
  insurance_gbp: number | null;
  maintenance_gbp: number | null;
  bills_gbp: number | null;
  compliance_gbp: number | null;
  other_gbp: number | null;
}

interface MonthlyProjection {
  month: number;
  date: string;
  gross_rent: number;
  void_loss: number;
  net_rent: number;
  mortgage_payment: number;
  maintenance: number;
  management: number;
  insurance: number;
  other_costs: number;
  net_cashflow: number;
  cumulative_cashflow: number;
  property_value: number;
  mortgage_balance: number;
  equity: number;
}

function calculateMonthlyProjections(
  properties: PropertyData[],
  loans: LoanData[],
  incomes: IncomeData[],
  costs: CostData[],
  assumptions: ForecastRequest["assumptions"],
  horizonMonths: number
): MonthlyProjection[] {
  const currentYear = new Date().getFullYear();
  const now = new Date();

  // Aggregate current portfolio totals
  let totalMonthlyRent = 0;
  let totalMonthlyMortgage = 0;
  let totalMonthlyMaintenance = 0;
  let totalMonthlyManagement = 0;
  let totalMonthlyInsurance = 0;
  let totalMonthlyOther = 0;
  let totalPropertyValue = 0;
  let totalMortgageBalance = 0;

  for (const prop of properties) {
    totalPropertyValue += prop.current_value_gbp || prop.purchase_price_gbp || 0;

    // Latest income for property
    const propIncomes = incomes
      .filter((i) => i.property_id === prop.id)
      .sort((a, b) => b.year - a.year);
    const latestIncome = propIncomes[0];
    if (latestIncome) {
      totalMonthlyRent += latestIncome.annual_rent_gbp / 12;
    }

    // Loans for property
    const propLoans = loans.filter((l) => l.property_id === prop.id);
    for (const loan of propLoans) {
      totalMonthlyMortgage += loan.mortgage_payment_gbp || 0;
      totalMortgageBalance += loan.current_mortgage_balance_gbp || 0;
    }

    // Latest costs for property
    const propCosts = costs
      .filter((c) => c.property_id === prop.id)
      .sort((a, b) => b.year - a.year);
    const latestCost = propCosts[0];
    if (latestCost) {
      totalMonthlyMaintenance += (latestCost.maintenance_gbp || 0) / 12;
      totalMonthlyManagement += (latestCost.management_gbp || 0) / 12;
      totalMonthlyInsurance += (latestCost.insurance_gbp || 0) / 12;
      totalMonthlyOther +=
        ((latestCost.bills_gbp || 0) +
          (latestCost.compliance_gbp || 0) +
          (latestCost.other_gbp || 0)) /
        12;
    }
  }

  // Check for upcoming rate resets across portfolio
  const rateResets: { monthIndex: number; rateDelta: number; paymentImpact: number }[] = [];
  for (const loan of loans) {
    if (loan.fixed_rate_expires && loan.reversion_rate_percent && loan.interest_rate_percent) {
      const expiryDate = new Date(loan.fixed_rate_expires);
      const monthsUntilExpiry = Math.max(
        0,
        (expiryDate.getFullYear() - now.getFullYear()) * 12 +
          (expiryDate.getMonth() - now.getMonth())
      );
      if (monthsUntilExpiry < horizonMonths) {
        const balance = loan.current_mortgage_balance_gbp || 0;
        const currentRate = loan.interest_rate_percent / 100;
        const reversionRate = loan.reversion_rate_percent / 100;
        const rateDelta = reversionRate - currentRate;

        // Approximate monthly interest impact
        const monthlyImpact = (balance * rateDelta) / 12;
        rateResets.push({
          monthIndex: monthsUntilExpiry,
          rateDelta,
          paymentImpact: monthlyImpact,
        });
      }
    }
  }

  const monthlyRentGrowth = Math.pow(1 + assumptions.rent_growth_pct / 100, 1 / 12) - 1;
  const annualAppreciation = assumptions.rent_growth_pct / 100; // proxy capital appreciation
  const monthlyAppreciation = Math.pow(1 + annualAppreciation, 1 / 12) - 1;
  const monthlyRateChange = (assumptions.rate_change_bps / 100 / 100) / 12;

  const projections: MonthlyProjection[] = [];
  let cumulativeCashflow = 0;
  let runningRent = totalMonthlyRent;
  let runningMortgage = totalMonthlyMortgage;
  let runningValue = totalPropertyValue;
  let runningBalance = totalMortgageBalance;
  let maintenanceAdjust = 1 + assumptions.maintenance_pct / 100 / 12;

  for (let m = 1; m <= horizonMonths; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);

    // Apply rent growth
    runningRent *= 1 + monthlyRentGrowth;

    // Apply rate resets at the right month
    for (const reset of rateResets) {
      if (reset.monthIndex === m) {
        runningMortgage += reset.paymentImpact;
      }
    }

    // Apply gradual rate changes from assumptions
    if (assumptions.rate_change_bps !== 0) {
      runningMortgage *= 1 + monthlyRateChange;
    }

    // Apply property appreciation
    runningValue *= 1 + monthlyAppreciation;

    // Mortgage paydown (simplified — interest-only keeps balance, repayment reduces it)
    const hasRepaymentLoans = loans.some((l) => l.capital_or_interest === "capital_repayment");
    if (hasRepaymentLoans && runningBalance > 0) {
      // Rough estimate: ~30% of payment goes to principal in mid-term
      const principalPortion = runningMortgage * 0.3;
      runningBalance = Math.max(0, runningBalance - principalPortion);
    }

    const voidLoss = runningRent * (assumptions.void_rate_pct / 100);
    const netRent = runningRent - voidLoss;
    const maintenance = totalMonthlyMaintenance * Math.pow(maintenanceAdjust, m);
    const management = totalMonthlyManagement;
    const insurance = totalMonthlyInsurance;
    const otherCosts = totalMonthlyOther;

    const netCashflow = netRent - runningMortgage - maintenance - management - insurance - otherCosts;
    cumulativeCashflow += netCashflow;

    projections.push({
      month: m,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      gross_rent: Math.round(runningRent * 100) / 100,
      void_loss: Math.round(voidLoss * 100) / 100,
      net_rent: Math.round(netRent * 100) / 100,
      mortgage_payment: Math.round(runningMortgage * 100) / 100,
      maintenance: Math.round(maintenance * 100) / 100,
      management: Math.round(management * 100) / 100,
      insurance: Math.round(insurance * 100) / 100,
      other_costs: Math.round(otherCosts * 100) / 100,
      net_cashflow: Math.round(netCashflow * 100) / 100,
      cumulative_cashflow: Math.round(cumulativeCashflow * 100) / 100,
      property_value: Math.round(runningValue),
      mortgage_balance: Math.round(runningBalance),
      equity: Math.round(runningValue - runningBalance),
    });
  }

  return projections;
}

function buildStressScenarios(
  properties: PropertyData[],
  loans: LoanData[],
  incomes: IncomeData[],
  costs: CostData[],
  baseAssumptions: ForecastRequest["assumptions"],
  horizonMonths: number
) {
  const base = calculateMonthlyProjections(
    properties, loans, incomes, costs, baseAssumptions, horizonMonths
  );

  const pessimistic = calculateMonthlyProjections(
    properties, loans, incomes, costs,
    {
      rent_growth_pct: baseAssumptions.rent_growth_pct - 5,
      void_rate_pct: baseAssumptions.void_rate_pct + 10,
      maintenance_pct: baseAssumptions.maintenance_pct + 3,
      rate_change_bps: baseAssumptions.rate_change_bps + 200,
    },
    horizonMonths
  );

  const optimistic = calculateMonthlyProjections(
    properties, loans, incomes, costs,
    {
      rent_growth_pct: baseAssumptions.rent_growth_pct + 3,
      void_rate_pct: Math.max(0, baseAssumptions.void_rate_pct - 2),
      maintenance_pct: Math.max(0, baseAssumptions.maintenance_pct - 1),
      rate_change_bps: baseAssumptions.rate_change_bps - 50,
    },
    horizonMonths
  );

  return { base, pessimistic, optimistic };
}

async function getAICommentary(
  projections: MonthlyProjection[],
  scenarios: { base: MonthlyProjection[]; pessimistic: MonthlyProjection[]; optimistic: MonthlyProjection[] } | null,
  forecastType: string,
  assumptions: ForecastRequest["assumptions"]
): Promise<string> {
  if (!LOVABLE_API_KEY) return "AI commentary unavailable — API key not configured.";

  const lastMonth = projections[projections.length - 1];
  const firstMonth = projections[0];
  const midMonth = projections[Math.floor(projections.length / 2)];

  const summaryData = {
    forecast_type: forecastType,
    assumptions,
    horizon_months: projections.length,
    start: { cashflow: firstMonth.net_cashflow, equity: firstMonth.equity },
    mid: { cashflow: midMonth.net_cashflow, equity: midMonth.equity },
    end: {
      cashflow: lastMonth.net_cashflow,
      cumulative_cashflow: lastMonth.cumulative_cashflow,
      equity: lastMonth.equity,
      property_value: lastMonth.property_value,
      mortgage_balance: lastMonth.mortgage_balance,
    },
    scenarios: scenarios
      ? {
          pessimistic_end_cashflow: scenarios.pessimistic[scenarios.pessimistic.length - 1].net_cashflow,
          pessimistic_end_equity: scenarios.pessimistic[scenarios.pessimistic.length - 1].equity,
          optimistic_end_cashflow: scenarios.optimistic[scenarios.optimistic.length - 1].net_cashflow,
          optimistic_end_equity: scenarios.optimistic[scenarios.optimistic.length - 1].equity,
        }
      : null,
  };

  const systemPrompt = `You are a UK property investment financial analyst for TenureIQ, a property portfolio management platform. Provide concise, actionable commentary on financial forecasts for buy-to-let (BTL) landlords.

Focus on:
- Key risks (rate resets, void periods, negative cashflow months)
- Portfolio resilience under stress scenarios
- Actionable recommendations (refinancing timing, rent reviews, reserve building)
- UK-specific considerations (Section 24 tax, EPC requirements, Renters' Rights Bill impact)

Keep your response to 3-4 paragraphs. Use GBP figures. Be specific about numbers.`;

  const userPrompt = `Analyse this financial forecast for a UK BTL property portfolio:\n\n${JSON.stringify(summaryData, null, 2)}`;

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      return "AI commentary temporarily unavailable.";
    }

    const data = await aiResponse.json();
    return data.choices?.[0]?.message?.content || "No commentary generated.";
  } catch (err) {
    console.error("AI commentary error:", err);
    return "AI commentary temporarily unavailable.";
  }
}

serve(withInvocationLog("financial-forecast", async (req, _invocationLog) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("financial-forecast", req);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.withUser(user.id);
    log.info("Financial forecast requested");

    // Subscription check
    const sub = await requireActiveSubscription(user.id, corsHeaders);
    if (!sub.allowed) return sub.response;

    // Rate limit: 10 forecasts per hour
    const rateLimit = await checkRateLimit(user.id, "financial-forecast", 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(corsHeaders, rateLimit.remaining, rateLimit.resetAt);
    }

    // Parse request
    const body: ForecastRequest = await req.json();
    const {
      forecast_type,
      time_horizon_months = 24,
      assumptions = { rent_growth_pct: 2, void_rate_pct: 5, maintenance_pct: 1, rate_change_bps: 0 },
      name,
    } = body;

    if (!["cashflow", "stress_test", "rate_scenario"].includes(forecast_type)) {
      return new Response(JSON.stringify({ error: "Invalid forecast_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validHorizons = [12, 24, 60];
    const horizon = validHorizons.includes(time_horizon_months) ? time_horizon_months : 24;

    // Get user's org
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = membership.org_id;

    // Fetch portfolio data in parallel
    const [propertiesRes, loansRes, incomeRes, costsRes] = await Promise.all([
      // V2: properties_v2 — column remap: address_line→address_line_1, current_value_gbp→current_valuation, purchase_price_gbp→purchase_price
      supabase
        .from("properties_v2")
        .select("id, address_line_1, current_valuation, purchase_price")
        .eq("org_id", orgId),
      supabase
        .from("loan_facilities")
        .select(LOAN_FACILITY_SELECT)
        .eq("org_id", orgId),
      supabase.from("income").select("property_id, year, annual_rent_gbp"),
      supabase
        .from("property_cost_budgets_v2")
        .select(PROPERTY_COST_BUDGET_SELECT),
    ]);

    const properties = ((propertiesRes.data || []) as Array<{ id: string; address_line_1: string | null; current_valuation: number | null; purchase_price: number | null }>).map((p) => ({
      id: p.id,
      address_line: p.address_line_1 ?? "",
      current_value_gbp: p.current_valuation,
      purchase_price_gbp: p.purchase_price,
    })) as PropertyData[];
    const facilityRows = (loansRes.data || []) as unknown as Array<{ id: string; property_id: string }>;
    warnIfPropertyIdSpaceMismatch(
      "financial-forecast",
      facilityRows,
      properties.map((p) => p.id),
    );
    const allLoans = ((loansRes.data || []) as unknown as Parameters<typeof loanFacilityToLegacyShape>[0][]).map(
      loanFacilityToLegacyShape,
    ) as unknown as LoanData[];
    const allIncome = (incomeRes.data || []) as IncomeData[];
    const rawCostRows = (costsRes.data || []) as unknown as Parameters<typeof propertyCostBudgetToLegacyShape>[0][];
    warnIfLegacyYearMissing("financial-forecast", rawCostRows);
    const allCosts = rawCostRows.map(propertyCostBudgetToLegacyShape) as unknown as CostData[];

    // Filter loans/income/costs to properties in this org
    const propertyIds = new Set(properties.map((p) => p.id));
    const loans = allLoans.filter((l) => propertyIds.has(l.property_id));
    const incomes = allIncome.filter((i) => propertyIds.has(i.property_id));
    const costs = allCosts.filter((c) => propertyIds.has(c.property_id));

    log.info("Portfolio data fetched", {
      properties: properties.length,
      loans: loans.length,
      incomes: incomes.length,
      costs: costs.length,
    });

    // Calculate projections
    let results: MonthlyProjection[];
    let scenarios: { base: MonthlyProjection[]; pessimistic: MonthlyProjection[]; optimistic: MonthlyProjection[] } | null = null;

    if (forecast_type === "stress_test") {
      scenarios = buildStressScenarios(properties, loans, incomes, costs, assumptions, horizon);
      results = scenarios.base;
    } else {
      results = calculateMonthlyProjections(properties, loans, incomes, costs, assumptions, horizon);
    }

    // Get AI commentary
    const aiCommentary = await getAICommentary(results, scenarios, forecast_type, assumptions);

    const forecastName =
      name ||
      `${forecast_type === "stress_test" ? "Stress Test" : forecast_type === "rate_scenario" ? "Rate Scenario" : "Cashflow Projection"} — ${horizon}mo`;

    // Save to DB using service role for insert
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: forecast, error: insertError } = await supabaseAdmin
      .from("financial_forecasts")
      .insert({
        org_id: orgId,
        forecast_type,
        name: forecastName,
        parameters: assumptions,
        results,
        scenarios,
        ai_commentary: aiCommentary,
        model_used: "google/gemini-2.5-flash",
      })
      .select()
      .single();

    if (insertError) {
      log.error("Failed to save forecast", { error: insertError.message });
      return new Response(JSON.stringify({ error: "Failed to save forecast" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.info("Forecast generated and saved", { forecastId: forecast.id });

    return new Response(JSON.stringify(forecast), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("Unexpected error", { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
