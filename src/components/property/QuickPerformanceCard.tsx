import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface QuickPerformanceCardProps {
  annualRent: number | null;
  totalCosts: number;
  netRent: number | null;
  mortgagePayment: number | null;
  monthlyCashflow: number | null;
}

export function QuickPerformanceCard({
  annualRent,
  totalCosts,
  netRent,
  mortgagePayment,
  monthlyCashflow,
}: QuickPerformanceCardProps) {
  const [showAnnual, setShowAnnual] = useState(false);
  
  const divisor = showAnnual ? 1 : 12;
  const periodLabel = showAnnual ? 'ANNUAL' : 'MONTHLY';
  
  const displayRent = annualRent ? annualRent / divisor : null;
  const displayCosts = totalCosts / divisor;
  const displayNOI = netRent ? netRent / divisor : null;
  const displayDebtService = mortgagePayment ? (showAnnual ? mortgagePayment * 12 : mortgagePayment) : null;
  const displayCashflow = monthlyCashflow ? (showAnnual ? monthlyCashflow * 12 : monthlyCashflow) : null;

  return (
    <Card 
      className={cn(
        "bg-card border-border transition-all duration-200 cursor-pointer",
        "hover:bg-muted/50 hover:border-primary/50",
        "active:scale-[0.98]"
      )}
      onClick={() => setShowAnnual(!showAnnual)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowAnnual(!showAnnual);
        }
      }}
      aria-label={`Toggle between monthly and annual performance. Currently showing ${showAnnual ? 'annual' : 'monthly'}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {periodLabel} Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rent</span>
          <span>{formatGBP(displayRent)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Operating Costs</span>
          <span className="text-destructive">-{formatGBP(displayCosts)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">NOI</span>
          <span className={displayNOI !== null && displayNOI >= 0 ? 'text-success' : 'text-destructive'}>
            {formatGBP(displayNOI)}
          </span>
        </div>
        {displayDebtService !== null && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Debt Service</span>
              <span className="text-destructive">-{formatGBP(displayDebtService)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Net Cashflow</span>
              <span className={displayCashflow !== null && displayCashflow >= 0 ? 'text-success' : 'text-destructive'}>
                {formatGBP(displayCashflow)}
              </span>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground pt-1">
          Click to toggle
        </p>
      </CardContent>
    </Card>
  );
}
