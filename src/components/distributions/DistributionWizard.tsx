import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Check, ChevronLeft, ChevronRight, Calendar, Calculator, ClipboardCheck, CreditCard,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useCreateDistributionRun, useMarkPayment, useMarkAllPayments, useDistributionLineItems } from '@/hooks/useDistributionWorkflow';
import {
  getQuarterFromDate,
  calculateDistributableIncome,
  calculateRetainedEarnings,
  allocateToInvestors,
  type EntityOwnership,
  type AllocationResult,
  type PeriodFinancials,
} from '@/lib/distribution-calculator';
import { formatGBP, formatGBPDecimal } from '@/lib/calculations';

const STEPS = [
  { label: 'Period', icon: Calendar, description: 'Select period & income' },
  { label: 'Allocate', icon: Calculator, description: 'Preview allocations' },
  { label: 'Review', icon: ClipboardCheck, description: 'Review & approve' },
  { label: 'Payment', icon: CreditCard, description: 'Track payments' },
];

interface DistributionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRunId?: string | null;
}

export function DistributionWizard({ open, onOpenChange, existingRunId }: DistributionWizardProps) {
  const { data: orgId } = useUserOrg();
  const [step, setStep] = useState(existingRunId ? 3 : 0);
  const [entityId, setEntityId] = useState('');
  const quarter = getQuarterFromDate();
  const [period, setPeriod] = useState(quarter.period);
  const [periodStart, setPeriodStart] = useState(quarter.start);
  const [periodEnd, setPeriodEnd] = useState(quarter.end);
  const [retentionPct, setRetentionPct] = useState(10);
  const [notes, setNotes] = useState('');
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const createRun = useCreateDistributionRun();
  const markPayment = useMarkPayment();
  const markAllPayments = useMarkAllPayments();

  // Existing run line items (for step 4 when resuming)
  const { data: existingLineItems } = useDistributionLineItems(existingRunId || null);

  // Fetch entities
  const { data: entities } = useQuery({
    queryKey: ['entities-for-dist-wizard', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch shareholders for selected entity
  const { data: shareholders } = useQuery({
    queryKey: ['entity-shareholders-wizard', entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_shareholders')
        .select('id, shareholder_name, percentage, investor_id')
        .eq('entity_id', entityId)
        .is('effective_to', null);
      return data || [];
    },
    enabled: !!entityId,
  });

  // Fetch investors to map names
  const { data: investors } = useQuery({
    queryKey: ['investors-for-dist-wizard', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('investors')
        .select('id, investor_name, email')
        .eq('org_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch financial data for period
  const { data: financials } = useQuery({
    queryKey: ['dist-wizard-financials', entityId, periodStart, periodEnd],
    queryFn: async () => {
      if (!entityId || !orgId) return { grossRent: 0, expenses: 0, mortgagePayments: 0, managementFees: 0, otherDeductions: 0 };

      const { data: props } = await supabase
        .from('properties_v2')
        .select('id')
        .eq('entity_id', entityId)
        .eq('org_id', orgId);

      const propertyIds = (props || []).map(p => p.id);
      if (propertyIds.length === 0) return { grossRent: 0, expenses: 0, mortgagePayments: 0, managementFees: 0, otherDeductions: 0 };

      // Rent income
      const { data: agreements } = await supabase
        .from('tenancy_agreements')
        .select('id')
        .in('property_id', propertyIds);

      let grossRent = 0;
      if (agreements && agreements.length > 0) {
        const { data: payments } = await supabase
          .from('rent_payments')
          .select('amount')
          .in('tenancy_id', agreements.map(a => a.id))
          .gte('payment_date', periodStart)
          .lte('payment_date', periodEnd);
        grossRent = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      }

      // Expenses
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('actual_cost')
        .in('property_id', propertyIds)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);
      const expenses = (maintenance || []).reduce((sum, m) => sum + (m.actual_cost || 0), 0);

      // Mortgage costs
      const { data: loans } = await supabase
        .from('loan_facilities')
        .select('monthly_payment')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      const months = Math.max(1, Math.round(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      ));
      const mortgagePayments = (loans || []).reduce((sum, l) => sum + (l.monthly_payment || 0), 0) * months;

      return { grossRent, expenses, mortgagePayments, managementFees: 0, otherDeductions: 0 } as PeriodFinancials;
    },
    enabled: !!entityId && !!periodStart && !!periodEnd,
  });

  const noi = financials ? calculateDistributableIncome(financials) : 0;
  const { retained, distributable } = calculateRetainedEarnings(noi, retentionPct);

  // Build ownership list from shareholders
  const ownerships: EntityOwnership[] = useMemo(() => {
    if (!shareholders?.length) return [];
    const investorMap = new Map(investors?.map(i => [i.id, i]) || []);

    return shareholders.map(s => {
      const inv = s.investor_id ? investorMap.get(s.investor_id) : null;
      return {
        investorId: s.investor_id || s.id,
        investorName: inv?.investor_name || s.shareholder_name,
        entityId: entityId || null,
        entityName: entities?.find(e => e.id === entityId)?.entity_name || null,
        ownershipPct: s.percentage,
        entityType: 'spv' as const,
        propertyIds: [],
      };
    });
  }, [shareholders, investors, entityId, entities]);

  // Calculate allocations
  const allocations: AllocationResult[] = useMemo(() => {
    if (distributable <= 0 || ownerships.length === 0) return [];
    const allocs = allocateToInvestors(distributable, ownerships);

    // Apply overrides
    return allocs.map(a => {
      const override = overrides[a.investorId];
      if (override !== undefined && override !== a.grossAmount) {
        return {
          ...a,
          grossAmount: override,
          netAmount: override - a.withholdingTax,
        };
      }
      return a;
    });
  }, [distributable, ownerships, overrides]);

  const totalAllocated = allocations.reduce((s, a) => s + a.grossAmount, 0);
  const totalOwnership = allocations.reduce((s, a) => s + a.ownershipPct, 0);

  const handleCreate = async () => {
    if (!orgId) return;
    try {
      await createRun.mutateAsync({
        period,
        period_start: periodStart,
        period_end: periodEnd,
        total_distributable: distributable,
        total_distributed: totalAllocated,
        retained_amount: retained,
        notes: notes || undefined,
        allocations,
      });
      setStep(3);
    } catch {
      // Error handled by mutation
    }
  };

  const canProceedStep0 = !!entityId && !!periodStart && !!periodEnd;
  const canProceedStep1 = allocations.length > 0 && Math.abs(totalOwnership - 100) < 0.1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Distribution Run</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <div key={s.label} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Period Selection */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entity</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>
                    {entities?.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Q1-2026" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Retention % (reserve holdback)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={retentionPct}
                onChange={e => setRetentionPct(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Percentage of net income held back for reserves and maintenance
              </p>
            </div>

            {entityId && financials && (
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-3">Income Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gross Rent</p>
                      <p className="text-lg font-bold text-success">{formatGBP(financials.grossRent)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expenses</p>
                      <p className="text-lg font-bold text-destructive">{formatGBP(financials.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mortgage</p>
                      <p className="text-lg font-bold">{formatGBP(financials.mortgagePayments)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Operating Income</p>
                      <p className={`text-lg font-bold ${noi >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatGBP(noi)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Retained ({retentionPct}%)</p>
                      <p className="text-lg font-bold">{formatGBP(retained)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Distributable</p>
                      <p className="text-lg font-bold text-primary">{formatGBP(distributable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!canProceedStep0}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Allocation Preview */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Investor Allocations</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Total Ownership:</span>
                <Badge variant={Math.abs(totalOwnership - 100) < 0.1 ? 'default' : 'destructive'}>
                  {totalOwnership.toFixed(1)}%
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
                  {allocations.map(a => (
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
                              setOverrides(prev => ({ ...prev, [a.investorId]: val }));
                            } else {
                              setOverrides(prev => {
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
              <span className="font-bold">{formatGBPDecimal(totalAllocated)}</span>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Approve */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <h3 className="font-semibold">Distribution Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Period</p>
                    <p className="font-medium">{period}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Entity</p>
                    <p className="font-medium">{entities?.find(e => e.id === entityId)?.entity_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Investors</p>
                    <p className="font-medium">{allocations.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Distributable</p>
                    <p className="font-bold text-primary">{formatGBP(distributable)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Distributed</p>
                    <p className="font-bold text-success">{formatGBP(totalAllocated)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Retained</p>
                    <p className="font-bold">{formatGBP(retained)}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {allocations.map(a => (
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
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes for this distribution run..."
                rows={3}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleCreate} disabled={createRun.isPending}>
                {createRun.isPending ? 'Creating...' : 'Approve & Process'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Payment Tracking */}
        {step === 3 && (
          <PaymentTrackingStep
            lineItems={existingLineItems || []}
            runId={existingRunId || null}
            onMarkPaid={(id, ref) => markPayment.mutate({ id, reference: ref })}
            onMarkAllPaid={() => existingRunId && markAllPayments.mutate(existingRunId)}
            isPending={markPayment.isPending || markAllPayments.isPending}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentTrackingStep({
  lineItems,
  runId,
  onMarkPaid,
  onMarkAllPaid,
  isPending,
  onClose,
}: {
  lineItems: Array<{
    id: string;
    investor?: { investor_name: string; email: string | null } | null;
    ownership_pct: number;
    gross_amount: number;
    withholding_tax: number;
    net_amount: number;
    payment_status: string;
    payment_reference: string | null;
    paid_at: string | null;
  }>;
  runId: string | null;
  onMarkPaid: (id: string, reference?: string) => void;
  onMarkAllPaid: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [references, setReferences] = useState<Record<string, string>>({});
  const pendingCount = lineItems.filter(li => li.payment_status === 'pending').length;
  const paidCount = lineItems.filter(li => li.payment_status === 'paid').length;

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Distribution created successfully. Payment tracking will be available once line items are loaded.</p>
        <Button className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default">{paidCount} Paid</Badge>
          <Badge variant="secondary">{pendingCount} Pending</Badge>
        </div>
        {pendingCount > 0 && (
          <Button size="sm" onClick={onMarkAllPaid} disabled={isPending}>
            Mark All Paid
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Payment Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map(li => (
              <TableRow key={li.id}>
                <TableCell className="font-medium">
                  {li.investor?.investor_name || 'Unknown'}
                  {li.investor?.email && (
                    <span className="block text-xs text-muted-foreground">{li.investor.email}</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">{formatGBPDecimal(li.net_amount)}</TableCell>
                <TableCell className="text-center">
                  {li.payment_status === 'paid' ? (
                    <Badge className="bg-success text-success-foreground">Paid</Badge>
                  ) : li.payment_status === 'failed' ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {li.payment_status === 'paid' ? (
                    <span className="text-sm text-muted-foreground">{li.payment_reference || '—'}</span>
                  ) : (
                    <Input
                      className="h-8 text-sm"
                      placeholder="Reference..."
                      value={references[li.id] || ''}
                      onChange={e => setReferences(prev => ({ ...prev, [li.id]: e.target.value }))}
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {li.payment_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarkPaid(li.id, references[li.id])}
                      disabled={isPending}
                    >
                      <Check className="h-3 w-3 mr-1" /> Paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
