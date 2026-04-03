import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useEntityDividends,
  useAddEntityDividend,
  useUpdateEntityDividend,
  useShareClasses,
  useShareholdings,
  formatCurrency,
  type ShareClass,
  type EntityDividend,
} from '@/hooks/useShareRegister';

interface DividendTrackerProps {
  entityId: string;
  orgId: string;
}

export function DividendTracker({ entityId, orgId }: DividendTrackerProps) {
  const { toast } = useToast();
  const { data: dividends = [], isLoading } = useEntityDividends(entityId);
  const { data: shareClasses = [] } = useShareClasses(entityId);
  const { data: shareholdings = [] } = useShareholdings(entityId);
  const updateDividend = useUpdateEntityDividend();
  const [showDeclareDialog, setShowDeclareDialog] = useState(false);
  const [showVoucherDialog, setShowVoucherDialog] = useState<EntityDividend | null>(null);

  const handleMarkPaid = async (dividend: EntityDividend) => {
    try {
      await updateDividend.mutateAsync({
        id: dividend.id,
        entity_id: dividend.entity_id,
        status: 'paid',
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'Dividend marked as paid' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'declared': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'approved': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return '';
    }
  };

  const totalDeclared = dividends.reduce((sum, d) => sum + Number(d.total_amount), 0);
  const totalPaid = dividends.filter((d) => d.status === 'paid').reduce((sum, d) => sum + Number(d.total_amount), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Declared</p>
            <p className="text-2xl font-bold">{formatCurrency(totalDeclared)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold">{formatCurrency(totalDeclared - totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Dividends Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Dividend History</CardTitle>
          <Button size="sm" onClick={() => setShowDeclareDialog(true)} disabled={shareClasses.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Declare Dividend
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : dividends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dividends declared.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Declaration Date</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead className="text-right">Per Share</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dividends.map((div) => (
                  <TableRow key={div.id}>
                    <TableCell>{div.declaration_date}</TableCell>
                    <TableCell>{div.share_class?.class_name ?? '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(div.amount_per_share)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(div.total_amount)}</TableCell>
                    <TableCell>{div.payment_date ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(div.status)} variant="secondary">
                        {div.status.charAt(0).toUpperCase() + div.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {div.status !== 'paid' && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(div)}>
                            Mark Paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setShowVoucherDialog(div)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DeclareDividendDialog
        open={showDeclareDialog}
        onOpenChange={setShowDeclareDialog}
        entityId={entityId}
        orgId={orgId}
        shareClasses={shareClasses}
      />
      {showVoucherDialog && (
        <TaxVoucherDialog
          open={!!showVoucherDialog}
          onOpenChange={() => setShowVoucherDialog(null)}
          dividend={showVoucherDialog}
          shareholdings={shareholdings}
        />
      )}
    </div>
  );
}

// ─── Declare Dividend Dialog ─────────────────────────────────────────────────

function DeclareDividendDialog({
  open,
  onOpenChange,
  entityId,
  orgId,
  shareClasses,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityId: string;
  orgId: string;
  shareClasses: ShareClass[];
}) {
  const { toast } = useToast();
  const addDividend = useAddEntityDividend();
  const [shareClassId, setShareClassId] = useState('');
  const [declarationDate, setDeclarationDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState('');
  const [amountPerShare, setAmountPerShare] = useState('');
  const [notes, setNotes] = useState('');

  const selectedClass = shareClasses.find((sc) => sc.id === shareClassId);
  const totalAmount = selectedClass ? (parseFloat(amountPerShare) || 0) * selectedClass.total_issued : 0;

  const handleSubmit = async () => {
    try {
      await addDividend.mutateAsync({
        org_id: orgId,
        entity_id: entityId,
        share_class_id: shareClassId,
        declaration_date: declarationDate,
        payment_date: paymentDate || null,
        amount_per_share: parseFloat(amountPerShare),
        total_amount: totalAmount,
        status: 'declared',
        notes: notes || null,
      });
      toast({ title: 'Dividend declared' });
      onOpenChange(false);
      setShareClassId('');
      setAmountPerShare('');
      setPaymentDate('');
      setNotes('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declare Dividend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Share Class</Label>
            <Select value={shareClassId} onValueChange={setShareClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {shareClasses.filter((sc) => sc.dividend_rights).map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.class_name} ({sc.total_issued.toLocaleString()} shares)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Declaration Date</Label>
              <Input type="date" value={declarationDate} onChange={(e) => setDeclarationDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment Date (optional)</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Amount Per Share (£)</Label>
            <Input type="number" step="0.01" min="0.01" value={amountPerShare} onChange={(e) => setAmountPerShare(e.target.value)} />
          </div>
          {totalAmount > 0 && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm"><span className="font-medium">Total dividend:</span> {formatCurrency(totalAmount)}</p>
              {selectedClass && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(parseFloat(amountPerShare))} x {selectedClass.total_issued.toLocaleString()} {selectedClass.class_name} shares
                </p>
              )}
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Board resolution reference, etc." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addDividend.isPending || !shareClassId || !amountPerShare || totalAmount <= 0}>
            {addDividend.isPending ? 'Declaring...' : 'Declare Dividend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tax Voucher Dialog ──────────────────────────────────────────────────────

function TaxVoucherDialog({
  open,
  onOpenChange,
  dividend,
  shareholdings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dividend: EntityDividend;
  shareholdings: { holder_name: string; shares_held: number; percentage: number; share_class_id: string }[];
}) {
  const relevantHolders = shareholdings.filter((sh) => sh.share_class_id === dividend.share_class_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tax Voucher — {dividend.declaration_date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Share Class</p>
              <p className="font-medium">{dividend.share_class?.class_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount Per Share</p>
              <p className="font-medium">{formatCurrency(dividend.amount_per_share)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Declaration Date</p>
              <p className="font-medium">{dividend.declaration_date}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Date</p>
              <p className="font-medium">{dividend.payment_date ?? 'Pending'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-2">Payment per Holder</p>
            {relevantHolders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shareholdings found for this share class.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holder</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Dividend Due</TableHead>
                    <TableHead className="text-right">Tax Credit (10%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relevantHolders.map((holder, i) => {
                    const holderDividend = holder.shares_held * Number(dividend.amount_per_share);
                    const taxCredit = holderDividend * 0.1;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{holder.holder_name}</TableCell>
                        <TableCell className="text-right">{holder.shares_held.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(holderDividend)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(taxCredit)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Total Dividend: {formatCurrency(dividend.total_amount)}</p>
            <p className="text-muted-foreground text-xs mt-1">
              This voucher is for information purposes. Shareholders should declare dividends on their tax return.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
