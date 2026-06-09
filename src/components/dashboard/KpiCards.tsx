import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, TrendingUp, Percent, AlertTriangle, ShieldCheck, Wallet, DoorOpen, Clock, CircleDot } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DualKpiCard } from '@/components/dashboard/DualKpiCard';
import { KpiBreakdownPopover } from '@/components/common/KpiBreakdownPopover';
import { formatGBP, formatPercent } from '@/lib/calculations';
import type { RiskItem } from '@/hooks/usePortfolioRisks';

interface PortfolioMetrics {
  totalValue: number;
  totalDebt: number;
  totalEquity: number;
  weightedLTV: number;
  annualRent: number;
  annualCashflow: number;
  monthlyCashflow: number;
  netYieldPct: number | null;
  dscr: number | null;
  propertyCount: number;
  annualMortgagePayments: number;
}

interface PortfolioKPIs {
  gross: PortfolioMetrics;
  attributable: PortfolioMetrics;
  groupParentName: string;
  properties: unknown[];
}

interface RentalStats {
  activeTenancies: number;
  totalMonthlyRent: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  waultMonths: number | null;
}

interface SnapshotKPIs {
  monthlyCashPosition: number | null;
  latestMonthLabel: string | null;
}

type MetricKey = 'equity' | 'value' | 'debt' | 'cashflow' | 'rent' | 'noi' | 'net_yield' | 'ltv' | 'dscr' | 'health';

interface KpiCardsProps {
  portfolioKPIs: PortfolioKPIs;
  risks: RiskItem[];
  criticalCount: number;
  rentalStats: RentalStats;
  snapshotKPIs: SnapshotKPIs;
  voidRateData: { voidRate: number; voidRooms: number; totalRooms: number } | undefined;
  onMetricClick: (key: MetricKey) => void;
}

export function KpiCards({
  portfolioKPIs,
  risks,
  criticalCount,
  rentalStats,
  snapshotKPIs,
  voidRateData,
  onMetricClick,
}: KpiCardsProps) {
  const navigate = useNavigate();
  const [cashflowPeriod, setCashflowPeriod] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      {/* Top KPI row — Value / Equity / Cashflow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <DualKpiCard
          label="Portfolio Value"
          grossValue={formatGBP(portfolioKPIs.gross.totalValue)}
          attrValue={formatGBP(portfolioKPIs.attributable.totalValue)}
          groupParentName={portfolioKPIs.groupParentName}
          subtitle={`${portfolioKPIs.gross.propertyCount} properties`}
          icon={TrendingUp}
          iconClassName="text-primary"
          grossClassName="text-primary"
          attrClassName="text-primary"
          onClick={() => onMetricClick('value')}
          headerAction={<KpiBreakdownPopover explainerId="portfolio_value" currentValue={formatGBP(portfolioKPIs.gross.totalValue)} />}
        />
        <DualKpiCard
          label="Equity"
          grossValue={formatGBP(portfolioKPIs.gross.totalEquity)}
          attrValue={formatGBP(portfolioKPIs.attributable.totalEquity)}
          groupParentName={portfolioKPIs.groupParentName}
          subtitle={`Debt: ${formatGBP(portfolioKPIs.gross.totalDebt)}`}
          icon={TrendingUp}
          iconClassName="text-primary"
          grossClassName="text-primary"
          attrClassName="text-primary"
          onClick={() => onMetricClick('equity')}
          headerAction={<KpiBreakdownPopover explainerId="equity" currentValue={formatGBP(portfolioKPIs.gross.totalEquity)} />}
        />
        <DualKpiCard
          label={cashflowPeriod === 'monthly' ? 'Monthly Cashflow' : 'Annual Cashflow'}
          grossValue={formatGBP(
            cashflowPeriod === 'monthly'
              ? portfolioKPIs.gross.monthlyCashflow
              : portfolioKPIs.gross.annualCashflow
          )}
          attrValue={formatGBP(
            cashflowPeriod === 'monthly'
              ? portfolioKPIs.attributable.monthlyCashflow
              : portfolioKPIs.attributable.annualCashflow
          )}
          groupParentName={portfolioKPIs.groupParentName}
          subtitle="After debt service"
          icon={PoundSterling}
          iconClassName="text-success"
          grossClassName={portfolioKPIs.gross.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}
          attrClassName={portfolioKPIs.attributable.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}
          onClick={() => onMetricClick('cashflow')}
          headerAction={
            <button
              className="text-xs px-2 py-1 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground transition-colors font-medium"
              onClick={(e) => { e.stopPropagation(); setCashflowPeriod(p => p === 'monthly' ? 'annual' : 'monthly'); }}
            >
              {cashflowPeriod === 'monthly' ? '/mo' : '/yr'}
            </button>
          }
        />
      </div>

      {/* Second KPI row — LTV / DSCR / Yield / Rent / Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <DualKpiCard
          label="Weighted LTV"
          grossValue={formatPercent(portfolioKPIs.gross.weightedLTV)}
          attrValue={formatPercent(portfolioKPIs.attributable.weightedLTV)}
          groupParentName={portfolioKPIs.groupParentName}
          icon={Percent}
          grossClassName={
            portfolioKPIs.gross.weightedLTV > 85 ? 'text-destructive' :
            portfolioKPIs.gross.weightedLTV > 75 ? 'text-warning' : ''
          }
          attrClassName={
            portfolioKPIs.attributable.weightedLTV > 85 ? 'text-destructive' :
            portfolioKPIs.attributable.weightedLTV > 75 ? 'text-warning' : ''
          }
          onClick={() => onMetricClick('ltv')}
          headerAction={<KpiBreakdownPopover explainerId="ltv" currentValue={formatPercent(portfolioKPIs.gross.weightedLTV)} />}
        />
        <DualKpiCard
          label="DSCR"
          grossValue={portfolioKPIs.gross.dscr !== null ? `${portfolioKPIs.gross.dscr.toFixed(2)}x` : '—'}
          attrValue={portfolioKPIs.attributable.dscr !== null ? `${portfolioKPIs.attributable.dscr.toFixed(2)}x` : '—'}
          groupParentName={portfolioKPIs.groupParentName}
          subtitle="NOI ÷ Debt Service"
          icon={ShieldCheck}
          grossClassName={
            portfolioKPIs.gross.dscr !== null && portfolioKPIs.gross.dscr < 1 ? 'text-destructive' :
            portfolioKPIs.gross.dscr !== null && portfolioKPIs.gross.dscr < 1.25 ? 'text-warning' : 'text-success'
          }
          attrClassName={
            portfolioKPIs.attributable.dscr !== null && portfolioKPIs.attributable.dscr < 1 ? 'text-destructive' :
            portfolioKPIs.attributable.dscr !== null && portfolioKPIs.attributable.dscr < 1.25 ? 'text-warning' : 'text-success'
          }
          onClick={() => onMetricClick('dscr')}
          headerAction={<KpiBreakdownPopover explainerId="dscr" currentValue={portfolioKPIs.gross.dscr !== null ? `${portfolioKPIs.gross.dscr.toFixed(2)}x` : '—'} />}
        />
        <DualKpiCard
          label="Net Yield"
          grossValue={portfolioKPIs.gross.netYieldPct !== null ? formatPercent(portfolioKPIs.gross.netYieldPct) : '—'}
          attrValue={portfolioKPIs.attributable.netYieldPct !== null ? formatPercent(portfolioKPIs.attributable.netYieldPct) : '—'}
          groupParentName={portfolioKPIs.groupParentName}
          subtitle="Annual NOI ÷ Value"
          icon={TrendingUp}
          onClick={() => onMetricClick('net_yield')}
          headerAction={<KpiBreakdownPopover explainerId="net_yield" currentValue={portfolioKPIs.gross.netYieldPct !== null ? formatPercent(portfolioKPIs.gross.netYieldPct) : '—'} />}
        />
        <DualKpiCard
          label="Annual Rent"
          grossValue={formatGBP(portfolioKPIs.gross.annualRent)}
          attrValue={formatGBP(portfolioKPIs.attributable.annualRent)}
          groupParentName={portfolioKPIs.groupParentName}
          icon={Wallet}
          iconClassName="text-primary"
          onClick={() => onMetricClick('rent')}
          headerAction={<KpiBreakdownPopover explainerId="annual_rent" currentValue={formatGBP(portfolioKPIs.gross.annualRent)} />}
        />
        <KpiCard
          label="Action Required"
          value={risks.length === 0 ? '✓' : String(risks.length)}
          subtitle={risks.length === 0 ? 'All clear' : `${criticalCount} critical`}
          icon={AlertTriangle}
          iconClassName={risks.length > 0 ? 'text-warning' : 'text-success'}
          valueClassName={risks.length > 0 ? 'text-warning' : 'text-success'}
          onClick={() => navigate('/actions')}
          className={risks.length > 0 ? 'border-warning/40' : 'border-success/40'}
        />
      </div>

      {/* Rental KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
        <KpiCard
          label="Monthly Rent Roll"
          value={formatGBP(rentalStats.totalMonthlyRent)}
          animatedValue={rentalStats.totalMonthlyRent}
          animatedPrefix="£"
          subtitle={`${rentalStats.activeTenancies} active tenancies`}
          icon={Wallet}
          iconClassName="text-primary"
          valueClassName="text-primary"
          onClick={() => onMetricClick('rent')}
        />
        <KpiCard
          label="Occupancy Rate"
          value={formatPercent(rentalStats.occupancyRate)}
          subtitle={`${rentalStats.occupiedRooms} of ${rentalStats.totalRooms} bedrooms let`}
          icon={DoorOpen}
          iconClassName={rentalStats.occupancyRate >= 90 ? 'text-success' : rentalStats.occupancyRate >= 75 ? 'text-warning' : 'text-destructive'}
          valueClassName={rentalStats.occupancyRate >= 90 ? 'text-success' : rentalStats.occupancyRate >= 75 ? 'text-warning' : 'text-destructive'}
          headerAction={<KpiBreakdownPopover explainerId="occupancy" currentValue={formatPercent(rentalStats.occupancyRate)} />}
        />
        <KpiCard
          label="WAULT"
          value={rentalStats.waultMonths !== null ? `${rentalStats.waultMonths.toFixed(1)} mo` : '—'}
          subtitle={rentalStats.waultMonths !== null
            ? rentalStats.waultMonths >= 12 ? 'Healthy lease length' : rentalStats.waultMonths >= 6 ? 'Moderate — renewals due' : 'Short — action needed'
            : 'No lease end dates'
          }
          icon={Clock}
          iconClassName={
            rentalStats.waultMonths === null ? '' :
            rentalStats.waultMonths >= 12 ? 'text-success' : rentalStats.waultMonths >= 6 ? 'text-warning' : 'text-destructive'
          }
          valueClassName={
            rentalStats.waultMonths === null ? '' :
            rentalStats.waultMonths >= 12 ? 'text-success' : rentalStats.waultMonths >= 6 ? 'text-warning' : 'text-destructive'
          }
          headerAction={<KpiBreakdownPopover explainerId="wault" currentValue={rentalStats.waultMonths !== null ? `${rentalStats.waultMonths.toFixed(1)} mo` : '—'} />}
        />
        <KpiCard
          label="Void Rate"
          value={voidRateData ? `${voidRateData.voidRate}%` : '—'}
          subtitle={voidRateData ? `${voidRateData.voidRooms} of ${voidRateData.totalRooms} rooms void` : 'Loading...'}
          icon={CircleDot}
          iconClassName={
            !voidRateData ? '' :
            voidRateData.voidRate <= 5 ? 'text-success' : voidRateData.voidRate <= 15 ? 'text-warning' : 'text-destructive'
          }
          valueClassName={
            !voidRateData ? '' :
            voidRateData.voidRate <= 5 ? 'text-success' : voidRateData.voidRate <= 15 ? 'text-warning' : 'text-destructive'
          }
          onClick={() => navigate('/voids')}
          headerAction={<KpiBreakdownPopover explainerId="void_rate" currentValue={voidRateData ? `${voidRateData.voidRate}%` : '—'} />}
        />
        <KpiCard
          label="Portfolio Net Yield"
          value={portfolioKPIs.gross.netYieldPct !== null && portfolioKPIs.gross.netYieldPct !== undefined ? formatPercent(portfolioKPIs.gross.netYieldPct) : '—'}
          subtitle={portfolioKPIs.gross.netYieldPct !== null ? 'Annual NOI / valuation' : 'No data yet'}
          icon={TrendingUp}
          iconClassName="text-primary"
          onClick={() => navigate('/financials')}
        />
        <KpiCard
          label="Monthly Cash Position"
          value={snapshotKPIs.monthlyCashPosition !== null ? formatGBP(snapshotKPIs.monthlyCashPosition) : '—'}
          animatedValue={snapshotKPIs.monthlyCashPosition ?? undefined}
          animatedPrefix="£"
          subtitle={snapshotKPIs.latestMonthLabel ? `As of ${snapshotKPIs.latestMonthLabel}` : 'No snapshot data yet'}
          icon={PoundSterling}
          iconClassName={snapshotKPIs.monthlyCashPosition !== null && snapshotKPIs.monthlyCashPosition >= 0 ? 'text-success' : 'text-destructive'}
          valueClassName={snapshotKPIs.monthlyCashPosition !== null && snapshotKPIs.monthlyCashPosition >= 0 ? 'text-success' : 'text-destructive'}
          onClick={() => navigate('/financials')}
        />
      </div>
    </>
  );
}
