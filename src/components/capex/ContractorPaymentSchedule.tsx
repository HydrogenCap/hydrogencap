import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  useCapexPayments,
  useCreateCapexPayment,
  useCapexPhases,
  type CapexPayment,
} from '@/hooks/useCapexUpgrade';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  stage_payment: 'Stage Payment',
  final: 'Final Payment',
  retention: 'Retention',
};

function paymentStatus(p: CapexPayment): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (p.payment_type === 'retention' && !p.paid_at) return { label: 'Held', variant: 'secondary' };
  if (p.paid_at) return { label: 'Paid', variant: 'outline' };
  return { label: 'Due', variant: 'default' };
}

export default function ContractorPaymentSchedule({ projectId }: { projectId: string }) {
  const { data: payments = [], isLoading } = useCapexPayments(projectId);
  const { data: phases = [] } = useCapexPhases(projectId);
  const [showAdd, setShowAdd] = useState(false);

  const phaseMap = useMemo(() => new Map(phases.map(p => [p.id, p.phase_name])), [phases]);

  const totals = useMemo(() => {
    const paid = payments.filter(p => p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
    const retentionHeld = payments.filter(p => p.payment_type === 'retention' && !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = payments.filter(p => !p.paid_at && p.payment_type !== 'retention').reduce((s, p) => s + Number(p.amount), 0);
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    return { paid, retentionHeld, outstanding, total };
  }, [payments]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Contract</p>
            <p className="text-lg font-bold">{fmt(totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid to Date</p>
            <p className="text-lg font-bold text-green-600">{fmt(totals.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-amber-500">{fmt(totals.outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Retention Held</p>
            <p className="text-lg font-bold">{fmt(totals.retentionHeld)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment Schedule</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Payment
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments scheduled yet.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Phase / Milestone</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                    <th className="text-right px-3 py-2 font-medium">Retention %</th>
                    <th className="text-right px-3 py-2 font-medium">Net Payable</th>
                    <th className="text-left px-3 py-2 font-medium">Invoice</th>
                    <th className="text-left px-3 py-2 font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map(p => {
                    const amount = Number(p.amount);
                    const retPct = Number(p.retention_pct) || 0;
                    const net = amount * (1 - retPct / 100);
                    const status = paymentStatus(p);
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-medium">
                          {p.phase_id ? phaseMap.get(p.phase_id) || '—' : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(amount)}</td>
                        <td className="px-3 py-2 text-right">{retPct > 0 ? `${retPct}%` : '—'}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(net)}</td>
                        <td className="px-3 py-2">
                          {p.invoice_ref ? (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {p.invoice_url ? (
                                <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                                  {p.invoice_ref} <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span>{p.invoice_ref}</span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.paid_at ? format(parseISO(p.paid_at), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Running total */}
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Running Total</td>
                    <td className="px-3 py-2 text-right">{fmt(totals.total)}</td>
                    <td className="px-3 py-2 text-right" />
                    <td className="px-3 py-2 text-right">{fmt(totals.paid)}</td>
                    <td className="px-3 py-2" colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retention summary */}
      {totals.retentionHeld > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retention Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.filter(p => p.payment_type === 'retention' || (Number(p.retention_pct) > 0 && !p.paid_at)).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <span>{p.phase_id ? phaseMap.get(p.phase_id) : 'General'}</span>
                  <span className="font-medium">{fmt(Number(p.amount) * (Number(p.retention_pct) / 100))}</span>
                  <span className="text-muted-foreground">
                    Release: {p.retention_release_date ? format(parseISO(p.retention_release_date), 'dd MMM yyyy') : 'TBD'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddPaymentDialog open={showAdd} onOpenChange={setShowAdd} projectId={projectId} phases={phases} />
    </div>
  );
}

function AddPaymentDialog({ open, onOpenChange, projectId, phases }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  phases: Array<{ id: string; phase_name: string }>;
}) {
  const create = useCreateCapexPayment();
  const [phaseId, setPhaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<string>('stage_payment');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [retentionPct, setRetentionPct] = useState('');
  const [retentionRelease, setRetentionRelease] = useState('');

  const handleCreate = () => {
    if (!amount) return;
    create.mutate({
      project_id: projectId,
      phase_id: phaseId || null,
      contractor_id: null,
      amount: parseFloat(amount),
      payment_type: paymentType as 'stage_payment' | 'final' | 'retention',
      invoice_ref: invoiceRef || null,
      invoice_url: null,
      paid_at: null,
      retention_pct: retentionPct ? parseFloat(retentionPct) : 0,
      retention_release_date: retentionRelease || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setPhaseId('');
        setAmount('');
        setPaymentType('stage_payment');
        setInvoiceRef('');
        setRetentionPct('');
        setRetentionRelease('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>Schedule a contractor payment</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {phases.length > 0 && (
            <div>
              <Label>Phase</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {phases.map(p => <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Payment Type</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stage_payment">Stage Payment</SelectItem>
                <SelectItem value="final">Final Payment</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount (£)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Invoice Reference</Label><Input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="INV-001" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Retention %</Label><Input type="number" value={retentionPct} onChange={e => setRetentionPct(e.target.value)} placeholder="5" /></div>
            <div><Label>Retention Release</Label><Input type="date" value={retentionRelease} onChange={e => setRetentionRelease(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!amount || create.isPending}>
            {create.isPending ? 'Adding...' : 'Add Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
