import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatGBP, formatGBPDecimal } from '@/lib/calculations';
import type { AllocationResult } from '@/lib/distribution-calculator';

interface Props {
  period: string;
  entityName: string;
  allocations: AllocationResult[];
  distributable: number;
  totalAllocated: number;
  retained: number;
  notes: string;
  setNotes: (v: string) => void;
  onBack: () => void;
  onApprove: () => void;
  isCreating: boolean;
}

export function ReviewStep(p: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <h3 className="font-semibold">Distribution Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Period</p>
              <p className="font-medium">{p.period}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Entity</p>
              <p className="font-medium">{p.entityName || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Investors</p>
              <p className="font-medium">{p.allocations.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Distributable</p>
              <p className="font-bold text-primary">{formatGBP(p.distributable)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Distributed</p>
              <p className="font-bold text-success">{formatGBP(p.totalAllocated)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Retained</p>
              <p className="font-bold">{formatGBP(p.retained)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            {p.allocations.map(a => (
              <div key={a.investorId} className="flex items-center justify-between text-sm py-1">
                <span>{a.investorName} ({a.ownershipPct.toFixed(1)}%)</span>
                <span className="font-mono font-medium">{formatGBPDecimal(a.netAmount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={p.notes}
          onChange={e => p.setNotes(e.target.value)}
          placeholder="Optional notes for this distribution run..."
          rows={3}
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={p.onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={p.onApprove} disabled={p.isCreating}>
          {p.isCreating ? 'Creating...' : 'Approve & Process'}
        </Button>
      </div>
    </div>
  );
}
