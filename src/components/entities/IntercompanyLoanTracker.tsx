import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useIntercompanyLoans,
  useCreateIntercompanyLoan,
  useUpdateIntercompanyLoan,
  useDeleteIntercompanyLoan,
  type IntercompanyLoan,
  type LoanStatus,
} from '@/hooks/useEntityCompliance';
import { useLegalEntities, type LegalEntity } from '@/hooks/useLegalEntities';
import { useOrganization } from '@/hooks/useOrganization';
import { formatGBPDecimal } from '@/lib/calculations';
import { format, differenceInDays } from 'date-fns';
import { Plus, ArrowLeftRight, Trash2, Edit2, TrendingUp } from 'lucide-react';

const STATUS_BADGE: Record<LoanStatus, { variant: string; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  repaid: { variant: 'secondary', label: 'Repaid' },
  written_off: { variant: 'destructive', label: 'Written Off' },
};

function calculateAccruedInterest(loan: IntercompanyLoan): number {
  const daysSinceStart = differenceInDays(new Date(), new Date(loan.start_date));
  if (daysSinceStart <= 0) return 0;
  const dailyRate = loan.interest_rate / 100 / 365;
  return loan.outstanding_balance * dailyRate * daysSinceStart;
}

interface Props {
  entityId: string;
}

export function IntercompanyLoanTracker({ entityId }: Props) {
  const { toast } = useToast();
  const { data: org } = useOrganization();
  const { data: loans, isLoading } = useIntercompanyLoans(entityId);
  const { data: entities } = useLegalEntities();
  const createLoan = useCreateIntercompanyLoan();
  const updateLoan = useUpdateIntercompanyLoan();
  const deleteLoan = useDeleteIntercompanyLoan();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IntercompanyLoan | null>(null);
  const [formData, setFormData] = useState({
    lender_entity_id: entityId,
    borrower_entity_id: '',
    principal: '',
    interest_rate: '0',
    start_date: '',
    maturity_date: '',
    outstanding_balance: '',
    interest_accrued: '0',
    status: 'active' as LoanStatus,
  });

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities?.forEach(e => map.set(e.id, e.entity_name));
    return map;
  }, [entities]);

  const otherEntities = useMemo(() => {
    return (entities || []).filter(e => e.id !== entityId);
  }, [entities, entityId]);

  const summary = useMemo(() => {
    if (!loans) return { totalLent: 0, totalBorrowed: 0, netPosition: 0, totalInterest: 0 };
    let totalLent = 0;
    let totalBorrowed = 0;
    let totalInterest = 0;
    loans.filter(l => l.status === 'active').forEach(l => {
      if (l.lender_entity_id === entityId) {
        totalLent += l.outstanding_balance;
        totalInterest += calculateAccruedInterest(l);
      } else {
        totalBorrowed += l.outstanding_balance;
        totalInterest -= calculateAccruedInterest(l);
      }
    });
    return { totalLent, totalBorrowed, netPosition: totalLent - totalBorrowed, totalInterest };
  }, [loans, entityId]);

  const openCreate = () => {
    setEditing(null);
    setFormData({
      lender_entity_id: entityId,
      borrower_entity_id: '',
      principal: '',
      interest_rate: '0',
      start_date: '',
      maturity_date: '',
      outstanding_balance: '',
      interest_accrued: '0',
      status: 'active',
    });
    setShowForm(true);
  };

  const openEdit = (loan: IntercompanyLoan) => {
    setEditing(loan);
    setFormData({
      lender_entity_id: loan.lender_entity_id,
      borrower_entity_id: loan.borrower_entity_id,
      principal: String(loan.principal),
      interest_rate: String(loan.interest_rate),
      start_date: loan.start_date,
      maturity_date: loan.maturity_date || '',
      outstanding_balance: String(loan.outstanding_balance),
      interest_accrued: String(loan.interest_accrued),
      status: loan.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!org?.id || !formData.lender_entity_id || !formData.borrower_entity_id || !formData.principal || !formData.start_date) return;
    try {
      const payload = {
        org_id: org.id,
        lender_entity_id: formData.lender_entity_id,
        borrower_entity_id: formData.borrower_entity_id,
        principal: parseFloat(formData.principal),
        interest_rate: parseFloat(formData.interest_rate),
        start_date: formData.start_date,
        maturity_date: formData.maturity_date || null,
        outstanding_balance: parseFloat(formData.outstanding_balance || formData.principal),
        interest_accrued: parseFloat(formData.interest_accrued || '0'),
        status: formData.status,
      };
      if (editing) {
        await updateLoan.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'Loan updated' });
      } else {
        await createLoan.mutateAsync(payload);
        toast({ title: 'Intercompany loan created' });
      }
      setShowForm(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Intercompany Loans
          </CardTitle>
          <Button size="sm" onClick={openCreate} disabled={otherEntities.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Add Loan
          </Button>
        </CardHeader>
        <CardContent>
          {loans && loans.filter(l => l.status === 'active').length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatBlock label="Total Lent" value={formatGBPDecimal(summary.totalLent)} />
              <StatBlock label="Total Borrowed" value={formatGBPDecimal(summary.totalBorrowed)} />
              <StatBlock label="Net Position" value={formatGBPDecimal(summary.netPosition)} positive={summary.netPosition >= 0} />
              <StatBlock label="Accrued Interest" value={formatGBPDecimal(summary.totalInterest)} />
            </div>
          )}

          {(loans || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              {otherEntities.length === 0
                ? 'Add more entities to track intercompany loans.'
                : 'No intercompany loans. Track loans between group entities.'}
            </p>
          ) : (
            <div className="space-y-3">
              {loans!.map(loan => {
                const isLender = loan.lender_entity_id === entityId;
                const counterparty = entityMap.get(isLender ? loan.borrower_entity_id : loan.lender_entity_id) || 'Unknown';
                const accrued = calculateAccruedInterest(loan);
                const statusConfig = STATUS_BADGE[loan.status];

                return (
                  <div key={loan.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <TrendingUp className={`h-4 w-4 ${isLender ? 'text-emerald-600' : 'text-red-600'}`} />
                      <div>
                        <div className="font-medium">
                          {isLender ? `Lent to ${counterparty}` : `Borrowed from ${counterparty}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Principal: {formatGBPDecimal(loan.principal)} &middot; Rate: {loan.interest_rate}%
                          &middot; Outstanding: {formatGBPDecimal(loan.outstanding_balance)}
                          {loan.maturity_date && <> &middot; Matures: {format(new Date(loan.maturity_date), 'dd MMM yyyy')}</>}
                        </div>
                        {loan.status === 'active' && accrued > 0 && (
                          <div className="text-xs text-muted-foreground">Estimated accrued interest: {formatGBPDecimal(accrued)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusConfig.variant as any}>{statusConfig.label}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(loan)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          await deleteLoan.mutateAsync(loan.id);
                          toast({ title: 'Loan removed' });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Loan' : 'New Intercompany Loan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lender Entity</Label>
              <Select value={formData.lender_entity_id} onValueChange={(v) => setFormData(p => ({ ...p, lender_entity_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {entities?.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Borrower Entity</Label>
              <Select value={formData.borrower_entity_id} onValueChange={(v) => setFormData(p => ({ ...p, borrower_entity_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {entities?.filter(e => e.id !== formData.lender_entity_id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Principal</Label>
                <Input type="number" step="0.01" value={formData.principal} onChange={e => setFormData(p => ({ ...p, principal: e.target.value }))} placeholder="100000" />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input type="number" step="0.001" value={formData.interest_rate} onChange={e => setFormData(p => ({ ...p, interest_rate: e.target.value }))} placeholder="3.500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Maturity Date</Label>
                <Input type="date" value={formData.maturity_date} onChange={e => setFormData(p => ({ ...p, maturity_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Outstanding Balance</Label>
                <Input type="number" step="0.01" value={formData.outstanding_balance} onChange={e => setFormData(p => ({ ...p, outstanding_balance: e.target.value }))} placeholder="Same as principal if new" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v as LoanStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="repaid">Repaid</SelectItem>
                    <SelectItem value="written_off">Written Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createLoan.isPending || updateLoan.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatBlock({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center p-2 bg-muted/50 rounded-lg">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${positive === false ? 'text-red-600' : positive === true ? 'text-emerald-600' : ''}`}>
        {value}
      </div>
    </div>
  );
}
