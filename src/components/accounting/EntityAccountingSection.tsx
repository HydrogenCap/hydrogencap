import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileDown, PoundSterling, ExternalLink } from 'lucide-react';
import { useAccountingExports } from '@/hooks/useAccountingExports';
import { useTaxYearSummaries } from '@/hooks/useTaxYearSummaries';
import { formatGBPDecimal } from '@/lib/calculations';
import { getCurrentTaxYear } from '@/lib/accountingTypes';
import { format } from 'date-fns';

interface Props {
  entityId: string;
  entityName: string;
}

export function EntityAccountingSection({ entityId, entityName: _entityName }: Props) {
  const navigate = useNavigate();
  const { data: exports, isLoading: exportsLoading } = useAccountingExports(entityId, 5);
  const { data: taxSummaries, isLoading: taxLoading } = useTaxYearSummaries(entityId);

  const currentTaxYear = getCurrentTaxYear();
  const currentSummary = taxSummaries?.find(s => s.tax_year === currentTaxYear);

  if (exportsLoading || taxLoading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <PoundSterling className="h-5 w-5 text-primary" />
          <CardTitle>Accounting</CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/accounting')}>
          <ExternalLink className="h-4 w-4 mr-1" /> Open Accounting
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tax Year Summary */}
        {currentSummary ? (
          <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Tax Year {currentTaxYear}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Rental Income</span>
                <p className="font-semibold">{formatGBPDecimal(currentSummary.total_rental_income || 0)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Allowable Expenses</span>
                <p className="font-semibold">{formatGBPDecimal(currentSummary.total_allowable_expenses || 0)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Net Rental Profit</span>
                <p className="font-semibold">{formatGBPDecimal(currentSummary.net_rental_profit || 0)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <Badge variant={currentSummary.is_locked ? 'default' : 'secondary'} className="mt-0.5">
                  {currentSummary.is_locked ? 'Locked' : 'Draft'}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No tax year summary for {currentTaxYear} yet. Generate one from the Accounting page.
          </p>
        )}

        {/* Recent Exports */}
        {exports && exports.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Exports</h4>
            <div className="space-y-1.5">
              {exports.slice(0, 3).map(exp => (
                <div key={exp.id} className="flex items-center justify-between text-xs border border-border/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{exp.export_type.toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      {exp.accounting_system} · {exp.row_count || 0} rows
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {exp.generated_at ? format(new Date(exp.generated_at), 'dd MMM yyyy') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
