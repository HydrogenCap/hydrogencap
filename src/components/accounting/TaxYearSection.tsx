import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RefreshCw, Lock, Unlock, Download, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useTaxYearSummaries, useGenerateTaxYearSummary, useLockTaxYear } from '@/hooks/useTaxYearSummaries';
import { getRecentTaxYears, getCurrentTaxYear, parseTaxYear, type TaxYearSummary } from '@/lib/accountingTypes';
import { taxSummaryToSA105, downloadFile } from '@/lib/accountingExportUtils';
import { cn } from '@/lib/utils';

export function TaxYearSection() {
  const [selectedYear, setSelectedYear] = useState(getCurrentTaxYear());
  const taxYears = useMemo(() => getRecentTaxYears(5), []);

  const { data: entities } = useLegalEntities();
  const { data: summaries, isLoading } = useTaxYearSummaries(selectedYear);
  const generate = useGenerateTaxYearSummary();
  const lockMutation = useLockTaxYear();

  const entityMap = useMemo(() => new Map((entities || []).map(e => [e.id, e])), [entities]);

  const handleGenerate = async (entityId: string) => {
    try {
      await generate.mutateAsync({ entityId, taxYear: selectedYear });
      toast.success('Tax year summary generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate summary');
    }
  };

  const handleLock = async (summary: TaxYearSummary) => {
    try {
      await lockMutation.mutateAsync({ id: summary.id, lock: !summary.is_locked });
      toast.success(summary.is_locked ? 'Summary unlocked' : 'Summary locked');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleExportSA105 = (summary: TaxYearSummary) => {
    const entity = entityMap.get(summary.entity_id);
    const content = taxSummaryToSA105(summary, entity?.entity_name || 'Unknown');
    downloadFile(content, `SA105-${summary.tax_year.replace('/', '-')}-${entity?.entity_name || 'entity'}.txt`, 'text/plain');
    toast.success('SA105 summary downloaded');
  };

  const fmt = (n: number | null) => `£${(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {taxYears.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {(() => { const { start, end } = parseTaxYear(selectedYear); return `6 April ${start.getFullYear()} – 5 April ${end.getFullYear()}`; })()}
        </p>
      </div>

      {/* Generate buttons for entities without summaries */}
      {entities && entities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entities.filter(e => !summaries?.find(s => s.entity_id === e.id)).map(e => (
            <Button key={e.id} variant="outline" size="sm" onClick={() => handleGenerate(e.id)} disabled={generate.isPending}>
              <RefreshCw className="h-3 w-3 mr-1" /> Generate for {e.entity_name}
            </Button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading summaries...</p>}

      {summaries?.map(summary => {
        const entity = entityMap.get(summary.entity_id);
        const isPersonal = entity?.entity_type === 'personal';
        return (
          <Card key={summary.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{entity?.entity_name || 'Unknown Entity'}</CardTitle>
                  <Badge variant="secondary">{entity?.entity_type || 'unknown'}</Badge>
                  <Badge variant="outline">{summary.tax_year}</Badge>
                  {summary.is_locked && <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleGenerate(summary.entity_id)} disabled={summary.is_locked || generate.isPending}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleLock(summary)}>
                    {summary.is_locked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {summary.is_locked ? 'Unlock' : 'Lock'}
                  </Button>
                  {isPersonal && (
                    <Button variant="outline" size="sm" onClick={() => handleExportSA105(summary)}>
                      <Download className="h-3 w-3 mr-1" /> SA105
                    </Button>
                  )}
                  {!isPersonal && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" disabled>
                            <Download className="h-3 w-3 mr-1" /> CT600
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Corporation tax export coming soon</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Income</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span>Rental Income</span><span className="font-mono">{fmt(summary.total_rental_income)}</span></div>
                    <div className="flex justify-between text-sm"><span>Other Income</span><span className="font-mono">{fmt(summary.total_other_income)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Total Income</span>
                      <span className="font-mono">{fmt((summary.total_rental_income ?? 0) + (summary.total_other_income ?? 0))}</span>
                    </div>
                  </div>
                </div>

                {/* Expenses */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Expenses</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span>Repairs & Maintenance</span><span className="font-mono">{fmt(summary.total_repairs_maintenance)}</span></div>
                    <div className="flex justify-between text-sm"><span>Insurance</span><span className="font-mono">{fmt(summary.total_insurance)}</span></div>
                    <div className="flex justify-between text-sm"><span>Management Fees</span><span className="font-mono">{fmt(summary.total_management_fees)}</span></div>
                    <div className="flex justify-between text-sm"><span>Professional Fees</span><span className="font-mono">{fmt(summary.total_professional_fees)}</span></div>
                    <div className="flex justify-between text-sm"><span>Utilities</span><span className="font-mono">{fmt(summary.total_utilities)}</span></div>
                    <div className="flex justify-between text-sm"><span>Council Tax</span><span className="font-mono">{fmt(summary.total_council_tax)}</span></div>
                    <div className="flex justify-between text-sm"><span>Licensing</span><span className="font-mono">{fmt(summary.total_licensing)}</span></div>
                    <div className="flex justify-between text-sm"><span>Other Expenses</span><span className="font-mono">{fmt(summary.total_other_expenses)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Total Allowable Expenses</span>
                      <span className="font-mono">{fmt(summary.total_allowable_expenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Net Rental Profit</span>
                  <span className={cn("font-mono", (summary.net_rental_profit ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                    {fmt(summary.net_rental_profit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    {isPersonal ? 'Finance Costs (Mortgage Interest)' : 'Corporation Tax Deductible Interest'}
                    {isPersonal && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[280px]">Since April 2020, mortgage interest for individual landlords is claimed as a 20% tax credit, not as an expense.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  <span className="font-mono">{fmt(summary.total_mortgage_interest)}</span>
                </div>
                {isPersonal && (
                  <div className="flex justify-between text-sm text-primary font-medium">
                    <span>Basic Rate Tax Reduction (20%)</span>
                    <span className="font-mono">{fmt(summary.basic_rate_tax_reduction)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!isLoading && (!summaries || summaries.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tax year summaries for {selectedYear}. Select an entity above to generate one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
