/**
 * Portfolio Financials Hook (AA3b)
 * Aggregates P&L data across ALL properties using the same calculation engine as AA3a.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { calculatePropertyPnL, type PropertyFinancials, type MonthlyPnL } from '@/lib/propertyPnL';

export interface PropertyFinancialSummary {
  propertyId: string;
  address: string;
  entityName: string;
  monthlyIncome: number;
  monthlyCosts: number;
  noi: number;
  cashflow: number;
  netYield: number;
  grossYield: number;
  ltv: number;
  valuation: number;
  status: 'positive' | 'breakeven' | 'negative';
}

export interface PortfolioFinancials {
  totalValuation: number;
  totalDebt: number;
  totalEquity: number;
  portfolioLTV: number;
  monthlyIncome: number;
  monthlyCosts: number;
  monthlyMortgage: number;
  monthlyNOI: number;
  monthlyCashflow: number;
  grossYield: number;
  netYield: number;
  properties: PropertyFinancialSummary[];
  monthlyTrend: { month: string; income: number; costs: number; cashflow: number; mortgage: number }[];
  costBreakdown: { name: string; value: number }[];
}

export function usePortfolioFinancials() {
  return useQuery({
    queryKey: ['portfolio-financials-live'],
    queryFn: async (): Promise<PortfolioFinancials> => {
      const twelveMonthsAgo = format(subMonths(new Date(), 11), 'yyyy-MM-01');

      // 1. Fetch all core properties
      const { data: properties } = await supabase
        .from('properties_v2')
        .select('id, address_line_1, city, postcode, current_valuation, entity_id, lifecycle_stage')
        .in('lifecycle_stage', ['stabilised', 'letting']);

      if (!properties?.length) {
        return emptyPortfolio();
      }

      const propertyIds = properties.map(p => p.id);

      // 2. Parallel fetch all data sources
      const [entitiesRes, roomsRes, agreementsRes, loansRes, maintenanceRes, capexRes] = await Promise.all([
        supabase.from('legal_entities').select('id, entity_name'),
        supabase.from('rooms_v2').select('property_id, current_rent_pcm, is_lettable').in('property_id', propertyIds),
        supabase.from('tenancy_agreements').select('id, property_id').in('property_id', propertyIds),
        supabase.from('loan_facilities').select('property_id, current_balance, interest_rate, monthly_payment').in('property_id', propertyIds).eq('status', 'active'),
        supabase.from('work_orders').select('property_id, paid_amount, paid_date').in('property_id', propertyIds).not('paid_amount', 'is', null).gte('paid_date', twelveMonthsAgo),
        supabase.from('capex_projects').select('property_id, capex_line_items(actual_gbp, paid_date, created_at)').in('property_id', propertyIds),
      ]);

      // 3. Fetch rent payments for all agreements
      const allAgreementIds = (agreementsRes.data || []).map(a => a.id);
      let allRentPayments: { agreement_id: string; amount: number; payment_date: string }[] = [];
      if (allAgreementIds.length > 0) {
        // Batch in chunks of 100 to avoid URL length limits
        for (let i = 0; i < allAgreementIds.length; i += 100) {
          const chunk = allAgreementIds.slice(i, i + 100);
          const { data } = await supabase
            .from('rent_payments')
            .select('agreement_id, amount, payment_date')
            .in('agreement_id', chunk)
            .gte('payment_date', twelveMonthsAgo);
          if (data) allRentPayments.push(...data);
        }
      }

      // Build lookup maps
      const entityMap = new Map((entitiesRes.data || []).map(e => [e.id, e.entity_name]));
      const agreementsByProperty = new Map<string, string[]>();
      for (const a of (agreementsRes.data || [])) {
        const existing = agreementsByProperty.get(a.property_id) || [];
        existing.push(a.id);
        agreementsByProperty.set(a.property_id, existing);
      }

      const paymentsByAgreement = new Map<string, typeof allRentPayments>();
      for (const p of allRentPayments) {
        const existing = paymentsByAgreement.get(p.agreement_id) || [];
        existing.push(p);
        paymentsByAgreement.set(p.agreement_id, existing);
      }

      const roomsByProperty = new Map<string, typeof roomsRes.data>();
      for (const r of (roomsRes.data || [])) {
        const existing = roomsByProperty.get(r.property_id) || [];
        existing.push(r);
        roomsByProperty.set(r.property_id, existing);
      }

      const loansByProperty = new Map<string, typeof loansRes.data>();
      for (const l of (loansRes.data || [])) {
        const existing = loansByProperty.get(l.property_id) || [];
        existing.push(l);
        loansByProperty.set(l.property_id, existing);
      }

      const maintenanceByProperty = new Map<string, any[]>();
      for (const m of ((maintenanceRes.data || []) as any[])) {
        const existing = maintenanceByProperty.get(m.property_id) || [];
        existing.push(m);
        maintenanceByProperty.set(m.property_id, existing);
      }

      const capexByProperty = new Map<string, any[]>();
      for (const c of (capexRes.data || [])) {
        const items = (c as any).capex_line_items || [];
        const existing = capexByProperty.get(c.property_id) || [];
        existing.push(...items);
        capexByProperty.set(c.property_id, existing);
      }

      // 4. Calculate P&L for each property
      const propertyPnLs: { property: typeof properties[0]; pnl: PropertyFinancials }[] = [];

      for (const prop of properties) {
        const rooms = roomsByProperty.get(prop.id) || [];
        const expectedRentPcm = rooms
          .filter(r => r.is_lettable)
          .reduce((sum, r) => sum + (r.current_rent_pcm || 0), 0);

        const agreementIds = agreementsByProperty.get(prop.id) || [];
        const rentPayments = agreementIds.flatMap(aid => 
          (paymentsByAgreement.get(aid) || []).map(p => ({ amount: p.amount, payment_date: p.payment_date }))
        );

        const loans = (loansByProperty.get(prop.id) || []).map(l => ({
          current_balance: l.current_balance || 0,
          interest_rate: l.interest_rate || 0,
          monthly_payment: l.monthly_payment,
        }));

        const maintenance = (maintenanceByProperty.get(prop.id) || []).map(m => ({
          paid_amount: m.paid_amount,
          paid_date: m.paid_date,
        }));

        const capex = (capexByProperty.get(prop.id) || []).map((c: any) => ({
          actual_gbp: c.actual_gbp || 0,
          paid_date: c.paid_date || null,
          created_at: c.created_at || '',
        }));

        const pnl = calculatePropertyPnL(
          prop.id,
          prop.current_valuation,
          expectedRentPcm,
          rentPayments,
          loans,
          maintenance,
          capex,
        );

        propertyPnLs.push({ property: prop, pnl });
      }

      // 5. Aggregate
      let totalValuation = 0, totalDebt = 0;
      let annualIncome = 0, annualCosts = 0, annualNOI = 0, annualCashflow = 0;
      const aggCosts = { mortgage: 0, maintenance: 0, management: 0, insurance: 0, compliance: 0, other: 0 };

      const propertySummaries: PropertyFinancialSummary[] = propertyPnLs.map(({ property, pnl }) => {
        totalValuation += pnl.currentValuation;
        totalDebt += pnl.totalDebt;
        annualIncome += pnl.annualGrossIncome;
        annualCosts += pnl.annualCosts;
        annualNOI += pnl.annualNOI;
        annualCashflow += pnl.annualCashflow;

        // Accumulate cost categories
        for (const m of pnl.months) {
          aggCosts.mortgage += m.mortgagePayment;
          aggCosts.maintenance += m.maintenance;
          aggCosts.management += m.managementFees;
          aggCosts.insurance += m.insurance;
          aggCosts.compliance += m.compliance;
          aggCosts.other += m.otherCosts;
        }

        const monthlyIncome = pnl.annualGrossIncome / 12;
        const monthlyCosts = pnl.annualCosts / 12;
        const monthlyNOI = pnl.annualNOI / 12;
        const monthlyCashflow = pnl.annualCashflow / 12;

        return {
          propertyId: property.id,
          address: `${property.address_line_1}${property.city ? `, ${property.city}` : ''}`,
          entityName: entityMap.get(property.entity_id) || 'Unknown',
          monthlyIncome,
          monthlyCosts,
          noi: monthlyNOI,
          cashflow: monthlyCashflow,
          netYield: pnl.netYield,
          grossYield: pnl.grossYield,
          ltv: pnl.ltv,
          valuation: pnl.currentValuation,
          status: monthlyCashflow > 50 ? 'positive' : monthlyCashflow >= -50 ? 'breakeven' : 'negative',
        };
      });

      // 6. Build monthly trend (aggregate across all properties)
      const trendMap = new Map<string, { income: number; costs: number; cashflow: number; mortgage: number }>();
      for (const { pnl } of propertyPnLs) {
        for (const m of pnl.months) {
          const existing = trendMap.get(m.month) || { income: 0, costs: 0, cashflow: 0, mortgage: 0 };
          existing.income += m.grossIncome;
          existing.costs += m.maintenance + m.managementFees + m.otherCosts + m.insurance + m.compliance;
          existing.cashflow += m.netCashflow;
          existing.mortgage += m.mortgagePayment;
          trendMap.set(m.month, existing);
        }
      }

      const monthlyTrend = Array.from(trendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

      const totalEquity = totalValuation - totalDebt;
      const annualMortgage = aggCosts.mortgage;

      const costBreakdown = [
        { name: 'Mortgage', value: aggCosts.mortgage },
        { name: 'Maintenance', value: aggCosts.maintenance },
        { name: 'Management', value: aggCosts.management },
        { name: 'Insurance', value: aggCosts.insurance },
        { name: 'Compliance', value: aggCosts.compliance },
        { name: 'Other', value: aggCosts.other },
      ].filter(c => c.value > 0);

      return {
        totalValuation,
        totalDebt,
        totalEquity,
        portfolioLTV: totalValuation > 0 ? (totalDebt / totalValuation) * 100 : 0,
        monthlyIncome: annualIncome / 12,
        monthlyCosts: annualCosts / 12,
        monthlyMortgage: annualMortgage / 12,
        monthlyNOI: annualNOI / 12,
        monthlyCashflow: annualCashflow / 12,
        grossYield: totalValuation > 0 ? (annualIncome / totalValuation) * 100 : 0,
        netYield: totalValuation > 0 ? (annualNOI / totalValuation) * 100 : 0,
        properties: propertySummaries.sort((a, b) => b.netYield - a.netYield),
        monthlyTrend,
        costBreakdown,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

function emptyPortfolio(): PortfolioFinancials {
  return {
    totalValuation: 0, totalDebt: 0, totalEquity: 0, portfolioLTV: 0,
    monthlyIncome: 0, monthlyCosts: 0, monthlyMortgage: 0, monthlyNOI: 0, monthlyCashflow: 0,
    grossYield: 0, netYield: 0,
    properties: [], monthlyTrend: [], costBreakdown: [],
  };
}
