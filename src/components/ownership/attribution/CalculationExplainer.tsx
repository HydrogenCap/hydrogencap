import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calculator, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CalculationExplainerProps {
  noFinanceCosts?: boolean;
}

export function CalculationExplainer({ noFinanceCosts }: CalculationExplainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between px-4 py-3 h-auto hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">How these figures are calculated</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      
      <div className={cn(
        'overflow-hidden transition-all duration-200',
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="px-4 pb-4 pt-2 space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Calculator className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Attribution Logic</p>
              <p>
                Each owner's figures are calculated as: <span className="font-mono text-xs bg-muted px-1 rounded">Property Total × Ownership %</span>
              </p>
            </div>
          </div>

          <div className="pl-7 space-y-2">
            <p>
              <span className="font-medium text-foreground">Gross Rent</span> — Annual rental income before any deductions
            </p>
            <p>
              <span className="font-medium text-foreground">Net Cashflow</span> — Distributable cash after operating costs and finance charges
              {noFinanceCosts && (
                <span className="ml-1 text-success/80">(equals Gross Rent — no finance costs)</span>
              )}
            </p>
          </div>

          <div className="pl-7 pt-2 border-t border-border/50">
            <p className="text-xs">
              Ownership stakes are derived from legal ownership and shareholding structures. 
              For SPV-held properties, attribution flows through the company shareholders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
