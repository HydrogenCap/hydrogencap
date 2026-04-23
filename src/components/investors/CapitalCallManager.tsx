import { useState, useMemo } from 'react';
import {
  Plus, AlertTriangle, CheckCircle2, Clock, Banknote, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  useCapitalCalls, useCreateCapitalCall, useCapitalCallItems,
  useInvestorCapitalCallItems, useRecordCapitalPayment,
  CapitalCall, CapitalCallItem,
} from '@/hooks/useInvestorOnboarding';
import { useInvestors } from '@/hooks/useInvestors';
import { useInvestorPortfolioSummaries } from '@/hooks/useInvestors';
import { formatGBP } from '@/lib/calculations';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  issued: { label: 'Issued', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  partially_funded: { label: 'Partially Funded', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  fully_funded: { label: 'Fully Funded', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  paid: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  partial: { label: 'Partial', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  waived: { label: 'Waived', className: 'bg-muted text-muted-foreground border-border' },
};

interface CapitalCallManagerProps {
  investorId?: string;
}

export function CapitalCallManager({ investorId }: CapitalCallManagerProps) {
  const { data: allCalls, isLoading: callsLoading } = useCapitalCalls();
  const { data: investorItems } = useInvestorCapitalCallItems(investorId);
  const { data: investors } = useInvestors();
  const { data: summaries } = useInvestorPortfolioSummaries();
  const createCall = useCreateCapitalCall();
  const recordPayment = useRecordCapitalPayment();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CapitalCallItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  // Form state for creating capital call
  const [form, setForm] = useState({ title: '', description: '', total_amount: '', due_date: '' });

  // Build investor name map
  const investorMap = useMemo(() => {
    const map: Record<string, string> = {};
    investors?.forEach(i => { map[i.id] = i.investor_name; });
    return map;
  }, [investors]);

  // Calculate ownership percentages for auto-split
  const ownershipSplit = useMemo(() => {
    if (!summaries || summaries.length === 0) return [];
    const totalCommitted = summaries.reduce((s, i) => s + (i.total_committed || 0), 0);
    if (totalCommitted === 0) return summaries.map(s => ({ investor_id: s.investor_id, pct: 0 }));
    return summaries.map(s => ({
      investor_id: s.investor_id,
      pct: (s.total_committed || 0) / totalCommitted,
    }));
  }, [summaries]);

  // Filter calls relevant to investor if investorId provided
  const relevantCallIds = useMemo(() => {
    if (!investorId || !investorItems) return new Set<string>();
    return new Set(investorItems.map(i => i.capital_call_id));
  }, [investorId, investorItems]);

  const calls = useMemo(() => {
    if (!allCalls) return [];
    if (!investorId) return allCalls;
    return allCalls.filter(c => relevantCallIds.has(c.id));
  }, [allCalls, investorId, relevantCallIds]);

  const handleCreateCall = () => {
    const totalAmount = parseFloat(form.total_amount);
    if (!form.title || isNaN(totalAmount) || !form.due_date) return;

    const items = ownershipSplit
      .filter(s => s.pct > 0)
      .map(s => ({
        investor_id: s.investor_id,
        amount: Math.round(totalAmount * s.pct * 100) / 100,
      }));

    createCall.mutate(
      { title: form.title, description: form.description, total_amount: totalAmount, due_date: form.due_date, items },
      { onSuccess: () => { setShowCreateDialog(false); setForm({ title: '', description: '', total_amount: '', due_date: '' }); } },
    );
  };

  const handleRecordPayment = () => {
    if (!selectedItem || !paymentAmount) return;
    recordPayment.mutate(
      { itemId: selectedItem.id, paid_amount: parseFloat(paymentAmount), payment_reference: paymentRef || undefined },
      { onSuccess: () => { setShowPaymentDialog(false); setPaymentAmount(''); setPaymentRef(''); setSelectedItem(null); } },
    );
  };

  if (callsLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Capital Calls</h3>
          <p className="text-sm text-muted-foreground">
            {calls.length} capital call{calls.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!investorId && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Capital Call
          </Button>
        )}
      </div>

      {/* Capital Call List */}
      {calls.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No capital calls {investorId ? 'for this investor' : 'yet'}.
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map(call => (
            <CapitalCallCard
              key={call.id}
              call={call}
              investorId={investorId}
              investorMap={investorMap}
              expanded={selectedCallId === call.id}
              onToggle={() => setSelectedCallId(selectedCallId === call.id ? null : call.id)}
              onRecordPayment={(item) => {
                setSelectedItem(item);
                setPaymentAmount('');
                setPaymentRef('');
                setShowPaymentDialog(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Create Capital Call Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Capital Call</DialogTitle>
            <DialogDescription>
              Request a new capital drawdown from investors against their commitments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Q2 2026 Capital Call"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Amount (GBP)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="200000"
                  value={form.total_amount}
                  onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1"
                placeholder="Details about this capital call..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            {form.total_amount && ownershipSplit.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Auto-split by ownership</Label>
                <div className="mt-1 space-y-1 text-sm">
                  {ownershipSplit.filter(s => s.pct > 0).map(s => (
                    <div key={s.investor_id} className="flex justify-between">
                      <span>{investorMap[s.investor_id] || 'Unknown'} ({(s.pct * 100).toFixed(1)}%)</span>
                      <span className="font-mono">{formatGBP(Math.round(parseFloat(form.total_amount) * s.pct * 100) / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCall} disabled={createCall.isPending || !form.title || !form.total_amount || !form.due_date}>
              Create Capital Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Log an investor's payment against this capital call line item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedItem && (
              <div className="text-sm space-y-1">
                <p>Amount due: <strong>{formatGBP(selectedItem.amount)}</strong></p>
                <p>Already paid: <strong>{formatGBP(selectedItem.paid_amount)}</strong></p>
                <p>Remaining: <strong>{formatGBP(selectedItem.amount - selectedItem.paid_amount)}</strong></p>
              </div>
            )}
            <div>
              <Label>Payment Amount (GBP)</Label>
              <Input
                className="mt-1"
                type="number"
                placeholder={selectedItem ? String(selectedItem.amount - selectedItem.paid_amount) : ''}
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Payment Reference</Label>
              <Input
                className="mt-1"
                placeholder="e.g. BACS ref, cheque number"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending || !paymentAmount}>
              <Banknote className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-component: Capital Call Card ──

function CapitalCallCard({
  call,
  investorId,
  investorMap,
  expanded,
  onToggle,
  onRecordPayment,
}: {
  call: CapitalCall;
  investorId?: string;
  investorMap: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
  onRecordPayment: (item: CapitalCallItem) => void;
}) {
  const { data: items } = useCapitalCallItems(expanded ? call.id : undefined);

  const statusConfig = STATUS_CONFIG[call.status] || STATUS_CONFIG.draft;
  const isOverdue = new Date(call.due_date) < new Date() && call.status !== 'fully_funded' && call.status !== 'cancelled';

  const totalPaid = items?.reduce((s, i) => s + (i.paid_amount || 0), 0) || 0;
  const progressPct = call.total_amount > 0 ? Math.min((totalPaid / call.total_amount) * 100, 100) : 0;

  // Filter items to this investor if in investor context
  const displayItems = useMemo(() => {
    if (!items) return [];
    if (!investorId) return items;
    return items.filter(i => i.investor_id === investorId);
  }, [items, investorId]);

  return (
    <Card className={isOverdue ? 'border-destructive/50' : ''}>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{call.title}</CardTitle>
            <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
            {isOverdue && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-3 w-3 mr-1" />Overdue
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Due {format(new Date(call.due_date), 'dd MMM yyyy')}
            </span>
            <span className="font-mono font-semibold text-foreground">{formatGBP(call.total_amount)}</span>
          </div>
        </div>
        {call.description && <p className="text-sm text-muted-foreground mt-1">{call.description}</p>}
        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatGBP(totalPaid)} of {formatGBP(call.total_amount)} funded</span>
            <span>{progressPct.toFixed(0)}%</span>
          </div>
          <Progress value={progressPct} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead className="text-right">Called</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No items</TableCell>
                </TableRow>
              ) : displayItems.map(item => {
                const itemStatus = ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.pending;
                const outstanding = item.amount - (item.paid_amount || 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{investorMap[item.investor_id] || 'Unknown'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatGBP(item.amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatGBP(item.paid_amount)}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatGBP(outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={itemStatus.className}>{itemStatus.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.payment_reference || '-'}</TableCell>
                    <TableCell>
                      {item.status !== 'paid' && item.status !== 'waived' && (
                        <Button variant="ghost" size="sm" onClick={() => onRecordPayment(item)}>
                          <Banknote className="h-3.5 w-3.5 mr-1" />Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
