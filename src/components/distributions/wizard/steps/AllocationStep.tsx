import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBPDecimal } from '@/lib/calculations';
import type { AllocationResult } from '@/lib/distribution-calculator';

interface Props {
  allocations: AllocationResult[];
  totalAllocated: number;
  totalOwnership: number;
  canProceed: boolean;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onBack: () => void;
  onNext: () => void;
}

export function AllocationStep(p: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Investor Allocations</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total Ownership:</span>
          <Badge variant={Math.abs(p.totalOwnership - 100) < 0.1 ? 'default' : 'destructive'}>
            {p.totalOwnership.toFixed(1)}%
          </Badge>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead className="text-right">Ownership %</TableHead>
              <TableHead className="text-right">Gross Amount</TableHead>
              <TableHead className="text-right">Withholding</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-right w-32">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.allocations.map(a => (
              <TableRow key={a.investorId}>
                <TableCell className="font-medium">{a.investorName}</TableCell>
                <TableCell className="text-right">{a.ownershipPct.toFixed(2)}%</TableCell>
                <TableCell className="text-right font-mono">{formatGBPDecimal(a.grossAmount)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatGBPDecimal(a.withholdingTax)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatGBPDecimal(a.netAmount)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28 text-right ml-auto"
                    placeholder={a.grossAmount.toFixed(2)}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        p.setOverrides(prev => ({ ...prev, [a.investorId]: val }));
                      } else {
                        p.setOverrides(prev => {
                          const next = { ...prev };
                          delete next[a.investorId];
                          return next;
                        });
                      }
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total allocated:</span>
        <span className="font-bold">{formatGBPDecimal(p.totalAllocated)}</span>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={p.onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={p.onNext} disabled={!p.canProceed}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
