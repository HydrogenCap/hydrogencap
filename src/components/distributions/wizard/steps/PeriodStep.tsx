import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatGBP } from '@/lib/calculations';
import type { PeriodFinancials } from '@/lib/distribution-calculator';

interface Props {
  entities: { id: string; entity_name: string }[] | undefined;
  entityId: string;
  setEntityId: (v: string) => void;
  period: string;
  setPeriod: (v: string) => void;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  retentionPct: number;
  setRetentionPct: (v: number) => void;
  financials: PeriodFinancials | undefined;
  noi: number;
  retained: number;
  distributable: number;
  canProceed: boolean;
  onNext: () => void;
}

export function PeriodStep(p: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Entity</Label>
          <Select value={p.entityId} onValueChange={p.setEntityId}>
            <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
            <SelectContent>
              {p.entities?.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Period</Label>
          <Input value={p.period} onChange={e => p.setPeriod(e.target.value)} placeholder="Q1-2026" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={p.periodStart} onChange={e => p.setPeriodStart(e.target.value)} />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={p.periodEnd} onChange={e => p.setPeriodEnd(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Retention % (reserve holdback)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={p.retentionPct}
          onChange={e => p.setRetentionPct(parseFloat(e.target.value) || 0)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Percentage of net income held back for reserves and maintenance
        </p>
      </div>

      {p.entityId && p.financials && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Income Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Gross Rent</p>
                <p className="text-lg font-bold text-success">{formatGBP(p.financials.grossRent)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expenses</p>
                <p className="text-lg font-bold text-destructive">{formatGBP(p.financials.expenses)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mortgage</p>
                <p className="text-lg font-bold">{formatGBP(p.financials.mortgagePayments)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net Operating Income</p>
                <p className={`text-lg font-bold ${p.noi >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatGBP(p.noi)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Retained ({p.retentionPct}%)</p>
                <p className="text-lg font-bold">{formatGBP(p.retained)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Distributable</p>
                <p className="text-lg font-bold text-primary">{formatGBP(p.distributable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={p.onNext} disabled={!p.canProceed}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
