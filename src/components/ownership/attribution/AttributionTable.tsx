import React from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { OwnerRow } from './OwnerRow';
import { AttributionOwner, AttributionTotals } from './types';

interface AttributionTableProps {
  attribution: AttributionOwner[];
  totals: AttributionTotals;
}

export function AttributionTable({ attribution, totals }: AttributionTableProps) {
  // Calculate per-owner monthly/annual distribution
  const totalCashflow = totals.cashflow;
  const monthlyCashflow = totalCashflow / 12;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">Owner</TableHead>
              <TableHead className="text-right font-semibold">Stake</TableHead>
              <TableHead className="w-px px-0" /> {/* Divider */}
              <TableHead className="text-right font-semibold">Value</TableHead>
              <TableHead className="text-right font-semibold">Equity</TableHead>
              <TableHead className="text-right font-semibold text-success/80">Gross Rent</TableHead>
              <TableHead className="text-right font-semibold text-success">Net Cashflow</TableHead>
              <TableHead className="w-24" /> {/* Actions */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {attribution.map((owner) => (
              <OwnerRow key={owner.ownerId} owner={owner} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary insight row */}
      {attribution.length > 0 && totalCashflow !== 0 && (
        <div className="rounded-lg bg-gradient-to-r from-success/5 to-success/10 border border-success/20 p-4">
          <p className="text-sm text-muted-foreground mb-2">Distribution Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attribution.map((owner) => {
              const ownerMonthly = (totalCashflow * (owner.effectivePercent / 100)) / 12;
              const ownerAnnual = totalCashflow * (owner.effectivePercent / 100);
              
              return (
                <div key={owner.ownerId} className="flex items-center justify-between gap-2 p-2 rounded bg-background/50">
                  <span className="text-sm font-medium truncate">{owner.ownerName}</span>
                  <div className="text-right text-xs">
                    <div className={cn(
                      'font-semibold',
                      ownerMonthly >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {formatGBP(ownerMonthly)}/mo
                    </div>
                    <div className="text-muted-foreground">
                      {formatGBP(ownerAnnual)}/yr
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
