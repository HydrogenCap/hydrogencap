import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Building, Wallet, PiggyBank, Percent, Calendar } from 'lucide-react';
import { formatGBP, formatPercent, formatDateUK, getExpiryStatus, daysUntil, getEffectiveCosts, type EffectiveCosts } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface LoanData {
  lender?: string | null;
  current_mortgage_balance_gbp?: number | null;
  interest_rate_percent?: number | null;
  mortgage_payment_gbp?: number | null;
  mortgage_type?: string | null;
  capital_or_interest?: string | null;
  fixed_or_variable?: string | null;
  fixed_rate_expires?: string | null;
  reversion_rate_percent?: number | null;
  broker_name?: string | null;
}

interface FinanceSummaryCardProps {
  // Core values
  currentValue: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  annualRent: number | null;
  
  // Loan data
  loan: LoanData | null;
  
  // Costs
  effectiveCosts: EffectiveCosts;
  
  // Calculated metrics
  equity: number | null;
  ltv: number | null;
  netRent: number | null;
  monthlyCashflow: number | null;
  yieldPercent: number | null;
  roce: number | null;
}

// Shared clickable card styles
const clickableCardStyles = cn(
  "bg-card border-border transition-all duration-200 cursor-pointer",
  "hover:bg-muted/50 hover:border-primary/50",
  "active:scale-[0.98]"
);

// Separate clickable cashflow card component
function CashflowCard({ 
  monthlyCashflow, 
  annualCashflow 
}: { 
  monthlyCashflow: number | null; 
  annualCashflow: number;
}) {
  const [showAnnual, setShowAnnual] = useState(false);
  
  const displayValue = showAnnual ? annualCashflow : monthlyCashflow;
  const isPositive = displayValue !== null && displayValue >= 0;

  return (
    <Card 
      className={clickableCardStyles}
      onClick={() => setShowAnnual(!showAnnual)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowAnnual(!showAnnual);
        }
      }}
      aria-label={`Toggle between monthly and annual cashflow. Currently showing ${showAnnual ? 'annual' : 'monthly'}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          {showAnnual ? 'Annual' : 'Monthly'} Cashflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className={`text-2xl font-bold flex items-center gap-1 ${
            isPositive ? 'text-success' : 'text-destructive'
          }`}>
            {isPositive 
              ? <TrendingUp className="h-4 w-4" /> 
              : <TrendingDown className="h-4 w-4" />
            }
            {formatGBP(displayValue)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          After debt service • Click to toggle
        </p>
      </CardContent>
    </Card>
  );
}

// Income & Costs card with monthly/annual toggle
function IncomeCostsCard({
  annualRent,
  effectiveCosts,
  netRent,
}: {
  annualRent: number | null;
  effectiveCosts: EffectiveCosts;
  netRent: number | null;
}) {
  const [showAnnual, setShowAnnual] = useState(true);
  
  const divisor = showAnnual ? 1 : 12;
  
  const displayRent = annualRent ? annualRent / divisor : null;
  const displayManagement = effectiveCosts.management / divisor;
  const displayInsurance = effectiveCosts.insurance / divisor;
  const displayRepairs = effectiveCosts.repairs / divisor;
  const displayBills = effectiveCosts.bills / divisor;
  const displayCompliance = effectiveCosts.compliance / divisor;
  const displayOther = effectiveCosts.other / divisor;
  const displayTotal = effectiveCosts.total / divisor;
  const displayNOI = netRent ? netRent / divisor : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Income & Costs
          </CardTitle>
          <div className="flex rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setShowAnnual(false)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                !showAnnual 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              /mo
            </button>
            <button
              onClick={() => setShowAnnual(true)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                showAnnual 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              /yr
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gross Rent</span>
          <span className="font-medium">{formatGBP(displayRent)}</span>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Management</span>
            <div className="flex items-center gap-2">
              <span>{formatGBP(displayManagement)}</span>
              {effectiveCosts.managementSource === 'auto' && (
                <Badge variant="outline" className="text-xs">Auto</Badge>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Insurance</span>
            <div className="flex items-center gap-2">
              <span>{formatGBP(displayInsurance)}</span>
              {effectiveCosts.insuranceSource === 'auto' && (
                <Badge variant="outline" className="text-xs">Auto</Badge>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Repairs</span>
            <div className="flex items-center gap-2">
              <span>{formatGBP(displayRepairs)}</span>
              {effectiveCosts.repairsSource === 'auto' && (
                <Badge variant="outline" className="text-xs">Auto</Badge>
              )}
            </div>
          </div>
          {effectiveCosts.bills > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bills</span>
              <span>{formatGBP(displayBills)}</span>
            </div>
          )}
          {effectiveCosts.compliance > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compliance</span>
              <span>{formatGBP(displayCompliance)}</span>
            </div>
          )}
          {effectiveCosts.other > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Other</span>
              <span>{formatGBP(displayOther)}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex justify-between font-medium">
          <span>Total Costs</span>
          <span className="text-destructive">-{formatGBP(displayTotal)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Net Operating Income</span>
          <span className={displayNOI !== null && displayNOI >= 0 ? 'text-success' : 'text-destructive'}>
            {formatGBP(displayNOI)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceSummaryCard({
  currentValue,
  purchasePrice,
  purchaseDate,
  annualRent,
  loan,
  effectiveCosts,
  equity,
  ltv,
  netRent,
  monthlyCashflow,
  yieldPercent,
  roce,
}: FinanceSummaryCardProps) {
  const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
  const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
  const fixedRateStatus = loan?.fixed_rate_expires ? getExpiryStatus(loan.fixed_rate_expires) : null;
  const daysToExpiry = loan?.fixed_rate_expires ? daysUntil(loan.fixed_rate_expires) : null;
  const annualDebtService = mortgagePayment ? mortgagePayment * 12 : 0;
  const annualCashflow = (netRent || 0) - annualDebtService;

  return (
    <div className="space-y-4">
      {/* Key Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Value & Equity */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Value & Equity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Value</span>
              <span className="font-medium">{formatGBP(currentValue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mortgage</span>
              <span>{formatGBP(mortgageBalance)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Equity</span>
              <span className="font-bold text-primary">{formatGBP(equity)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Leverage */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Leverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">LTV</span>
              <span className={`text-2xl font-bold ${
                ltv && ltv > 85 ? 'text-destructive' :
                ltv && ltv > 75 ? 'text-warning' : ''
              }`}>
                {formatPercent(ltv)}
              </span>
            </div>
            {loan?.fixed_rate_expires && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Fixed Until</span>
                <span className="flex items-center gap-2">
                  {formatDateUK(loan.fixed_rate_expires)}
                  {fixedRateStatus && fixedRateStatus !== 'ok' && (
                    <Badge 
                      variant="outline"
                      className={
                        fixedRateStatus === 'expired' || fixedRateStatus === 'critical' 
                          ? 'status-danger border text-xs' 
                          : 'status-warning border text-xs'
                      }
                    >
                      {daysToExpiry && daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry}d`}
                    </Badge>
                  )}
                </span>
              </div>
            )}
            {loan?.interest_rate_percent && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span>{loan.interest_rate_percent}% {loan.fixed_or_variable || ''}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cashflow - Clickable Toggle */}
        <CashflowCard 
          monthlyCashflow={monthlyCashflow} 
          annualCashflow={annualCashflow} 
        />

        {/* Returns */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Returns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net Yield</span>
              <span className={`font-medium ${yieldPercent && yieldPercent >= 0 ? 'text-success' : ''}`}>
                {formatPercent(yieldPercent)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ROCE</span>
              <span className={`font-medium ${roce && roce >= 0 ? 'text-success' : ''}`}>
                {formatPercent(roce)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Income & Costs - Clickable Toggle */}
        <IncomeCostsCard
          annualRent={annualRent}
          effectiveCosts={effectiveCosts}
          netRent={netRent}
        />

        {/* Mortgage & Debt */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Mortgage & Debt Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loan ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lender</span>
                  <span>{loan.lender || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{loan.mortgage_type || loan.capital_or_interest || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span>{formatGBP(mortgageBalance)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Payment</span>
                  <span className="font-medium">{formatGBP(mortgagePayment)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Annual Debt Service</span>
                  <span className="text-destructive">-{formatGBP(annualDebtService)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Net Annual Cashflow</span>
                  <span className={annualCashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(annualCashflow)}
                  </span>
                </div>
                {loan.broker_name && (
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-muted-foreground">Broker</span>
                    <span>{loan.broker_name}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No mortgage recorded</p>
                <p className="text-sm">This property may be owned outright</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      {(purchasePrice || purchaseDate) && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Purchase History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {purchasePrice && (
                <div>
                  <span className="text-muted-foreground text-sm">Purchase Price</span>
                  <p className="font-medium">{formatGBP(purchasePrice)}</p>
                </div>
              )}
              {purchaseDate && (
                <div>
                  <span className="text-muted-foreground text-sm">Purchase Date</span>
                  <p className="font-medium">{formatDateUK(purchaseDate)}</p>
                </div>
              )}
              {purchasePrice && currentValue && (
                <div>
                  <span className="text-muted-foreground text-sm">Capital Growth</span>
                  <p className={`font-medium ${currentValue - purchasePrice >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatGBP(currentValue - purchasePrice)} ({formatPercent(((currentValue - purchasePrice) / purchasePrice) * 100)})
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
