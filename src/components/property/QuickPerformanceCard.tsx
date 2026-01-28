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
  const [showAnnual, setShowAnnual] = useState(true);
  
  const divisor = showAnnual ? 1 : 12;
  
  const displayRent = annualRent ? annualRent / divisor : null;
  const displayCosts = totalCosts / divisor;
  const displayNOI = netRent ? netRent / divisor : null;
  const displayDebtService = mortgagePayment ? (showAnnual ? mortgagePayment * 12 : mortgagePayment) : null;
  const displayCashflow = monthlyCashflow ? (showAnnual ? monthlyCashflow * 12 : monthlyCashflow) : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Quick Performance
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
      </CardContent>
    </Card>
  );
}
