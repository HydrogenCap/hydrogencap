import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, FileText, Check, Banknote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDistributions,
  useDistributionAllocations,
  useCreateDistribution,
  useApproveDistribution,
  useMarkAllocationPaid,
  Distribution,
} from '@/hooks/useDistributions';
import { formatGBP, formatGBPDecimal } from '@/lib/calculations';
import { LoadingState } from '@/components/common/LoadingState';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DistributionAllocation {
  shareholder_name: string;
  ownership_percent: number;
  amount: number;
  paid_at: string | null;
  payment_reference: string | null;
}

type AutoTableJsPdf = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

function getQuarterSuggestion(): { label: string; start: string; end: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();
  const quarters = [
    { label: `Q1 ${year}`, start: `${year}-01-01`, end: `${year}-03-31` },
    { label: `Q2 ${year}`, start: `${year}-04-01`, end: `${year}-06-30` },
    { label: `Q3 ${year}`, start: `${year}-07-01`, end: `${year}-09-30` },
    { label: `Q4 ${year}`, start: `${year}-10-01`, end: `${year}-12-31` },
  ];
  // Suggest current quarter
  return quarters[q];
}

function generateStatementPdf(dist: Distribution, allocations: DistributionAllocation[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Distribution Statement', 14, 20);

  doc.setFontSize(11);
  doc.text(`Entity: ${dist.entity?.entity_name || 'Unknown'}`, 14, 32);
  doc.text(`Period: ${dist.period_label}`, 14, 39);
  doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 14, 46);

  doc.setFontSize(13);
  doc.text('Income & Expense Summary', 14, 60);

  autoTable(doc, {
    startY: 65,
    head: [['Item', 'Amount']],
    body: [
      ['Rental Income', formatGBPDecimal(dist.total_rental_income)],
      ['Expenses', `(${formatGBPDecimal(dist.total_expenses)})`],
      ['Mortgage Costs', `(${formatGBPDecimal(dist.total_mortgage_costs)})`],
      ['Net Distributable', formatGBPDecimal(dist.net_distributable)],
      ['Total Distributed', formatGBPDecimal(dist.total_distributed)],
      ['Retained Earnings', formatGBPDecimal(dist.retained_earnings)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30] },
  });

  const finalY = (doc as AutoTableJsPdf).lastAutoTable?.finalY || 120;

  doc.setFontSize(13);
  doc.text('Shareholder Allocations', 14, finalY + 12);

  autoTable(doc, {
    startY: finalY + 17,
    head: [['Shareholder', 'Ownership %', 'Amount', 'Paid', 'Reference']],
    body: allocations.map(a => [
      a.shareholder_name,
      `${a.ownership_percent.toFixed(2)}%`,
      formatGBPDecimal(a.amount),
      a.paid_at ? format(new Date(a.paid_at), 'dd/MM/yyyy') : 'Unpaid',
      a.payment_reference || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30] },
  });

  doc.save(`distribution-${dist.period_label.replace(/\s/g, '-')}.pdf`);
}

function AllocationRow({ dist }: { dist: Distribution }) {
  const { data: allocations, isLoading } = useDistributionAllocations(dist.id);
  const markPaid = useMarkAllocationPaid();
  const approve = useApproveDistribution();

  if (isLoading) return <p className="text-sm text-muted-foreground p-2">Loading...</p>;

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><span className="text-muted-foreground">Income:</span> <span className="font-medium text-success">{formatGBP(dist.total_rental_income)}</span></div>
        <div><span className="text-muted-foreground">Expenses:</span> <span className="font-medium text-destructive">{formatGBP(dist.total_expenses)}</span></div>
        <div><span className="text-muted-foreground">Mortgage:</span> <span className="font-medium">{formatGBP(dist.total_mortgage_costs)}</span></div>
        <div><span className="text-muted-foreground">Net:</span> <span className="font-medium">{formatGBP(dist.net_distributable)}</span></div>
      </div>

      {allocations && allocations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium">Shareholder</th>
                <th className="text-right py-2 px-2 font-medium">%</th>
                <th className="text-right py-2 px-2 font-medium">Amount</th>
                <th className="text-center py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 px-2">{a.shareholder_name}</td>
                  <td className="py-2 px-2 text-right">{a.ownership_percent.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right font-medium">{formatGBPDecimal(a.amount)}</td>
                  <td className="py-2 px-2 text-center">
                    {a.paid_at ? (
                      <Badge variant="default" className="bg-success text-success-foreground">Paid</Badge>
                    ) : (
                      <Badge variant="secondary">Unpaid</Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {!a.paid_at && (
                      <Button size="sm" variant="outline" onClick={() => markPaid.mutate({ id: a.id })}>
                        Mark Paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {dist.status === 'draft' && (
          <Button size="sm" variant="outline" onClick={() => approve.mutate(dist.id)}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => generateStatementPdf(dist, allocations || [])}>
          <FileText className="h-4 w-4 mr-1" /> PDF Statement
        </Button>
      </div>
    </div>
  );
}

function CreateDistributionDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [periodLabel, setPeriodLabel] = useState(getQuarterSuggestion().label);
  const [periodStart, setPeriodStart] = useState(getQuarterSuggestion().start);
  const [periodEnd, setPeriodEnd] = useState(getQuarterSuggestion().end);
  const [distributionAmount, setDistributionAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const createDist = useCreateDistribution();

  // Fetch entities
  const { data: membership } = useQuery({
    queryKey: ['user-membership', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('memberships').select('org_id').eq('user_id', user!.id).limit(1).single();
      return data;
    },
    enabled: !!user,
  });

  const orgId = membership?.org_id;

  const { data: entities } = useQuery({
    queryKey: ['entities-for-dist', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('legal_entities').select('id, entity_name').eq('org_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch shareholders for selected entity
  const { data: shareholders } = useQuery({
    queryKey: ['entity-shareholders', entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_shareholders')
        .select('id, shareholder_name, percentage')
        .eq('entity_id', entityId)
        .is('effective_to', null);
      return data || [];
    },
    enabled: !!entityId,
  });

  // Fetch financial data for auto-calculation
  const { data: financials } = useQuery({
    queryKey: ['dist-financials', entityId, periodStart, periodEnd],
    queryFn: async () => {
      if (!entityId || !orgId) return { income: 0, expenses: 0, mortgage: 0 };

      // Get properties for this entity
      const { data: props } = await supabase
        .from('properties_v2')
        .select('id')
        .eq('entity_id', entityId)
        .eq('org_id', orgId);

      const propertyIds = (props || []).map(p => p.id);
      if (propertyIds.length === 0) return { income: 0, expenses: 0, mortgage: 0 };

      // Rent income from tenancy_agreements → rent_payments
      const { data: agreements } = await supabase
        .from('tenancy_agreements')
        .select('id')
        .in('property_id', propertyIds);

      let income = 0;
      if (agreements && agreements.length > 0) {
        const agreementIds = agreements.map(a => a.id);
        const { data: payments } = await supabase
          .from('rent_payments')
          .select('amount')
          .in('tenancy_id', agreementIds)
          .gte('payment_date', periodStart)
          .lte('payment_date', periodEnd);
        income = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      }

      // Expenses from maintenance_requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('actual_cost')
        .in('property_id', propertyIds)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);
      const expenses = (maintenance || []).reduce((sum, m) => sum + (m.actual_cost || 0), 0);

      // Mortgage costs from loan_facilities
      const { data: loans } = await supabase
        .from('loan_facilities')
        .select('monthly_payment')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      const months = Math.max(1, Math.round(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      ));
      const mortgage = (loans || []).reduce((sum, l) => sum + (l.monthly_payment || 0), 0) * months;

      return { income, expenses, mortgage };
    },
    enabled: !!entityId && !!periodStart && !!periodEnd,
  });

  const netDistributable = (financials?.income || 0) - (financials?.expenses || 0) - (financials?.mortgage || 0);
  const distAmount = distributionAmount ?? Math.max(0, netDistributable);
  const retained = netDistributable - distAmount;

  const allocations = useMemo(() => {
    if (!shareholders?.length) return [];
    return shareholders.map(s => ({
      shareholder_id: s.id,
      shareholder_name: s.shareholder_name,
      ownership_percent: s.percentage,
      amount: Math.round(distAmount * (s.percentage / 100) * 100) / 100,
    }));
  }, [shareholders, distAmount]);

  const handleCreate = async (status: 'draft' | 'approved') => {
    if (!orgId || !entityId) return;
    await createDist.mutateAsync({
      org_id: orgId,
      entity_id: entityId,
      period_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
      total_rental_income: financials?.income || 0,
      total_expenses: financials?.expenses || 0,
      total_mortgage_costs: financials?.mortgage || 0,
      net_distributable: netDistributable,
      total_distributed: distAmount,
      retained_earnings: retained,
      status,
      notes: notes || undefined,
      allocations,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Create Quarterly Distribution</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Distribution</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Entity</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                <SelectContent>
                  {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period</Label>
              <Input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="Q1 2026" />
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

          {entityId && financials && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Rental Income</p>
                      <p className="text-lg font-bold text-success">{formatGBP(financials.income)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expenses</p>
                      <p className="text-lg font-bold text-destructive">{formatGBP(financials.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mortgage</p>
                      <p className="text-lg font-bold">{formatGBP(financials.mortgage)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Distributable</p>
                      <p className={`text-lg font-bold ${netDistributable >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatGBP(netDistributable)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>Distribution Amount</Label>
                <Input
                  type="number"
                  value={distributionAmount ?? Math.max(0, netDistributable)}
                  onChange={e => setDistributionAmount(parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Retained earnings: {formatGBP(retained)}
                </p>
              </div>

              {allocations.length > 0 && (
                <div>
                  <Label className="mb-2 block">Shareholder Allocations</Label>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">Shareholder</th>
                          <th className="text-right py-2 px-3">%</th>
                          <th className="text-right py-2 px-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map(a => (
                          <tr key={a.shareholder_id} className="border-b last:border-0">
                            <td className="py-2 px-3">{a.shareholder_name}</td>
                            <td className="py-2 px-3 text-right">{a.ownership_percent.toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right font-medium">{formatGBPDecimal(a.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => handleCreate('draft')} disabled={createDist.isPending}>
                  Save as Draft
                </Button>
                <Button onClick={() => handleCreate('approved')} disabled={createDist.isPending}>
                  Approve & Save
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'draft': return <Badge variant="secondary">Draft</Badge>;
    case 'approved': return <Badge variant="default">Approved</Badge>;
    case 'distributed': return <Badge className="bg-success text-success-foreground">Distributed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Distributions() {
  const { data: distributions, isLoading } = useDistributions();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Distributions</h1>
            <p className="text-muted-foreground">Quarterly profit distributions to shareholders</p>
          </div>
          <CreateDistributionDialog />
        </div>

        {isLoading ? (
          <LoadingState text="Loading distributions..." />
        ) : !distributions?.length ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No distributions yet. Create your first quarterly distribution.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Distribution History</CardTitle>
              <CardDescription>All quarterly distributions across entities</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {distributions.map(dist => (
                  <AccordionItem key={dist.id} value={dist.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{dist.period_label}</span>
                          <span className="text-sm text-muted-foreground">{dist.entity?.entity_name}</span>
                          {statusBadge(dist.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Net: <span className="font-medium text-foreground">{formatGBP(dist.net_distributable)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Distributed: <span className="font-medium text-success">{formatGBP(dist.total_distributed)}</span>
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <AllocationRow dist={dist} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
