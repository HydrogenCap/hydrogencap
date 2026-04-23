import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { PortfolioStats } from '@/lib/portfolioStats';
import { formatGBPDecimal } from '@/lib/calculations';
import { ColumnKey } from '@/lib/propertiesTableConfig';
import { cn } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

interface PortfolioTotalsRowProps {
  stats: PortfolioStats;
  visibleColumns: Set<ColumnKey>;
}

function MetricCell({ 
  label, 
  value, 
  variant = 'neutral' 
}: { 
  label: 'total' | 'avg' | 'portfolio'; 
  value: string | number; 
  variant?: 'neutral' | 'positive' | 'negative' | 'primary';
}) {
  const variantClasses = {
    neutral: 'text-foreground',
    positive: 'text-success',
    negative: 'text-destructive',
    primary: 'text-primary',
  };
  
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">
        {label}
      </span>
      <span className={cn('font-semibold', variantClasses[variant])}>
        {value}
      </span>
    </div>
  );
}

export function PortfolioTotalsRow({ stats, visibleColumns }: PortfolioTotalsRowProps) {
  const avgMonthlyCashflow = stats.avgMonthlyCashflow;
  
  return (
    <TableRow className="bg-primary/5 border-t-2 border-primary/30 hover:bg-primary/10">
      {/* Photo Column */}
      {visibleColumns.has('photo') && (
        <TableCell className="w-16 p-2">
          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
        </TableCell>
      )}
      
      {/* Address Column - Label */}
      {visibleColumns.has('address') && (
        <TableCell className="font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-sm uppercase tracking-wide text-primary">
              Portfolio Totals
            </span>
          </div>
        </TableCell>
      )}
      
      {/* Area Column */}
      {visibleColumns.has('area') && (
        <TableCell className="text-muted-foreground text-sm">
          {stats.count} properties
        </TableCell>
      )}
      
      {/* Ownership Column */}
      {visibleColumns.has('ownership') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Property Type Column */}
      {visibleColumns.has('propertyType') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Beds - Total */}
      {visibleColumns.has('beds') && (
        <TableCell className="text-center">
          <MetricCell label="total" value={stats.totalBeds} />
        </TableCell>
      )}
      
      {/* Value - Total */}
      {visibleColumns.has('value') && (
        <TableCell className="text-right">
          <MetricCell label="total" value={formatGBPDecimal(stats.totalValue)} variant="primary" />
        </TableCell>
      )}
      
      {/* Purchase Price */}
      {visibleColumns.has('purchasePrice') && (
        <TableCell className="text-right text-muted-foreground">—</TableCell>
      )}
      
      {/* Purchase Date */}
      {visibleColumns.has('purchaseDate') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Lender */}
      {visibleColumns.has('lender') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Interest Rate - Average */}
      {visibleColumns.has('interestRate') && (
        <TableCell className="text-right">
          <MetricCell label="avg" value={`${stats.avgInterestRate.toFixed(2)}%`} />
        </TableCell>
      )}
      
      {/* Fixed/Variable */}
      {visibleColumns.has('fixedOrVariable') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Mortgage Type */}
      {visibleColumns.has('mortgageType') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Capital/Interest */}
      {visibleColumns.has('capitalOrInterest') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Fixed Rate Expires */}
      {visibleColumns.has('fixedRateExpires') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Insurance Expire */}
      {visibleColumns.has('insuranceExpire') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Mortgage Balance - Total */}
      {visibleColumns.has('mortgageBalance') && (
        <TableCell className="text-right">
          <MetricCell label="total" value={formatGBPDecimal(stats.totalMortgageBalance)} />
        </TableCell>
      )}
      
      {/* Mortgage Payment - Total */}
      {visibleColumns.has('mortgagePayment') && (
        <TableCell className="text-right">
          <MetricCell label="total" value={formatGBPDecimal(stats.totalMortgagePayment)} />
        </TableCell>
      )}
      
      {/* Rental Income - Total */}
      {visibleColumns.has('rentalIncome') && (
        <TableCell className="text-right">
          <MetricCell label="total" value={formatGBPDecimal(stats.totalAnnualRent)} variant="positive" />
        </TableCell>
      )}
      
      {/* Bills & Management */}
      {visibleColumns.has('billsManagement') && (
        <TableCell className="text-right text-muted-foreground">—</TableCell>
      )}
      
      {/* Net Rent - Total */}
      {visibleColumns.has('netRent') && (
        <TableCell className="text-right">
          <MetricCell 
            label="total" 
            value={formatGBPDecimal(stats.totalNetRent)} 
            variant={stats.totalNetRent >= 0 ? 'positive' : 'negative'} 
          />
        </TableCell>
      )}
      
      {/* Yield - Weighted Average */}
      {visibleColumns.has('yield') && (
        <TableCell className="text-right">
          <MetricCell 
            label="portfolio" 
            value={`${stats.weightedAvgYield.toFixed(2)}%`} 
            variant={stats.weightedAvgYield >= 6 ? 'positive' : 'neutral'} 
          />
        </TableCell>
      )}
      
      {/* LTV - Portfolio */}
      {visibleColumns.has('ltv') && (
        <TableCell className="text-right">
          <MetricCell 
            label="portfolio" 
            value={`${stats.portfolioLTV.toFixed(1)}%`} 
            variant={stats.portfolioLTV > 75 ? 'negative' : stats.portfolioLTV > 60 ? 'neutral' : 'positive'} 
          />
        </TableCell>
      )}
      
      {/* Equity - Total */}
      {visibleColumns.has('equity') && (
        <TableCell className="text-right">
          <MetricCell label="total" value={formatGBPDecimal(stats.totalEquity)} variant="primary" />
        </TableCell>
      )}
      
      {/* EPC */}
      {visibleColumns.has('epc') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Monthly Cashflow - Total */}
      {visibleColumns.has('monthlyCashflow') && (
        <TableCell className="text-right">
          <MetricCell 
            label="total" 
            value={formatGBPDecimal(stats.totalMonthlyCashflow)} 
            variant={stats.totalMonthlyCashflow >= 0 ? 'positive' : 'negative'} 
          />
        </TableCell>
      )}
      
      {/* Risk Status */}
      {visibleColumns.has('riskStatus') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Keysafe Code */}
      {visibleColumns.has('keysafeCode') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Water Stop Tap */}
      {visibleColumns.has('waterStopTap') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Electric Meter */}
      {visibleColumns.has('electricMeter') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Gas Meter */}
      {visibleColumns.has('gasMeter') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Water Meter */}
      {visibleColumns.has('waterMeter') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Construction Date Band */}
      {visibleColumns.has('constructionDateBand') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* HMO Licence Number */}
      {visibleColumns.has('hmoLicenceNumber') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* HMO Licence Expiry */}
      {visibleColumns.has('hmoLicenceExpiry') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Management Company */}
      {visibleColumns.has('managementCompany') && (
        <TableCell className="text-muted-foreground">—</TableCell>
      )}
      
      {/* Actions Column */}
      {visibleColumns.has('actions') && (
        <TableCell className="w-24">—</TableCell>
      )}
    </TableRow>
  );
}
