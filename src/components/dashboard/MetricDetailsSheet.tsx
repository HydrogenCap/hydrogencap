import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Calculator, List, Download, ArrowRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MetricBreakdown } from '@/lib/metricsConfig';
import { cn } from '@/lib/utils';

interface MetricDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: MetricBreakdown | null;
}

export function MetricDetailsSheet({
  open,
  onOpenChange,
  breakdown,
}: MetricDetailsSheetProps) {
  const navigate = useNavigate();

  if (!breakdown) return null;

  const handlePropertyClick = (propertyId: string) => {
    navigate(`/properties/${propertyId}`);
    onOpenChange(false);
  };

  const handleExportCSV = () => {
    if (!breakdown.rows.length) return;

    const headers = breakdown.columns.map(c => c.label).join(',');
    const rows = breakdown.rows.map(row => 
      breakdown.columns.map(col => {
        const val = col.key === 'address' ? row.address : row.values[col.key];
        // Escape quotes and wrap in quotes if contains comma
        const strVal = String(val ?? '');
        return strVal.includes(',') || strVal.includes('"') 
          ? `"${strVal.replace(/"/g, '""')}"` 
          : strVal;
      }).join(',')
    ).join('\n');

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${breakdown.title.toLowerCase().replace(/\s+/g, '-')}-breakdown.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex flex-col"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-xl flex items-center gap-2">
            {breakdown.title}
          </SheetTitle>
          <SheetDescription>
            Detailed breakdown and contributing properties
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Summary Value */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total</div>
            <div className="text-3xl font-bold text-primary">
              {breakdown.summaryValue}
            </div>
          </div>

          {/* Calculation Explanation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              How this is calculated
            </div>
            <p className="text-sm text-muted-foreground">
              {breakdown.calculationText}
            </p>
            {breakdown.formula && (
              <Badge variant="secondary" className="font-mono text-xs">
                {breakdown.formula}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Breakdown Table */}
          {breakdown.rows.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <List className="h-4 w-4 text-muted-foreground" />
                  Property Breakdown
                  <Badge variant="outline" className="ml-1">
                    {breakdown.rows.length} properties
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCSV}
                  className="h-8 gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {breakdown.columns.map(col => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            col.align === 'right' && 'text-right'
                          )}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdown.rows.map(row => (
                      <TableRow
                        key={row.propertyId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handlePropertyClick(row.propertyId)}
                      >
                        {breakdown.columns.map(col => (
                          <TableCell
                            key={col.key}
                            className={cn(
                              col.align === 'right' && 'text-right font-mono'
                            )}
                          >
                            {col.key === 'address' ? row.address : row.values[col.key]}
                          </TableCell>
                        ))}
                        <TableCell className="w-10">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    {breakdown.totals && (
                      <TableRow className="bg-muted/30 font-medium">
                        {breakdown.columns.map((col, idx) => (
                          <TableCell
                            key={col.key}
                            className={cn(
                              col.align === 'right' && 'text-right font-mono'
                            )}
                          >
                            {idx === 0 ? 'Total' : breakdown.totals?.[col.key] || ''}
                          </TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>{breakdown.emptyMessage || 'No data available'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              navigate('/properties');
              onOpenChange(false);
            }}
          >
            View All Properties
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
