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
  useFilingDeadlines,
  useCreateFilingDeadline,
  useUpdateFilingDeadline,
  useDeleteFilingDeadline,
  type CompanyFilingDeadline,
  type FilingType,
} from '@/hooks/useEntityCompliance';
import { useOrganization } from '@/hooks/useOrganization';
import { format, differenceInDays, addMonths, addDays } from 'date-fns';
import { Plus, FileText, Trash2, Edit2, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { LegalEntity } from '@/hooks/useLegalEntities';

const FILING_LABELS: Record<FilingType, string> = {
  confirmation_statement: 'Confirmation Statement',
  annual_accounts: 'Annual Accounts',
  ct600: 'CT600 Corporation Tax',
  vat_return: 'VAT Return',
};

function getTrafficLight(dueDate: string, status: string): { color: string; label: string; icon: React.ReactNode } {
  if (status === 'filed') {
    return { color: 'bg-emerald-500', label: 'Filed', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> };
  }
  const days = differenceInDays(new Date(dueDate), new Date());
  if (days < 0) {
    return { color: 'bg-zinc-900', label: 'Overdue', icon: <XCircle className="h-4 w-4 text-zinc-900" /> };
  }
  if (days < 30) {
    return { color: 'bg-red-500', label: `${days}d left`, icon: <AlertTriangle className="h-4 w-4 text-red-600" /> };
  }
  if (days < 60) {
    return { color: 'bg-amber-500', label: `${days}d left`, icon: <Clock className="h-4 w-4 text-amber-600" /> };
  }
  return { color: 'bg-emerald-500', label: `${days}d left`, icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> };
}

function autoCalculateFilingDates(entity: LegalEntity): Partial<Record<FilingType, string>> {
  const dates: Partial<Record<FilingType, string>> = {};

  if (entity.confirmation_statement_due_date) {
    dates.confirmation_statement = entity.confirmation_statement_due_date;
  } else if (entity.incorporation_date) {
    const incDate = new Date(entity.incorporation_date);
    const nextDue = addDays(addMonths(incDate, 12), 14);
    if (nextDue > new Date()) {
      dates.confirmation_statement = format(nextDue, 'yyyy-MM-dd');
    }
  }

  if (entity.accounts_due_date) {
    dates.annual_accounts = entity.accounts_due_date;
  } else if (entity.accounts_period_end) {
    const periodEnd = new Date(entity.accounts_period_end);
    dates.annual_accounts = format(addMonths(periodEnd, 9), 'yyyy-MM-dd');
  }

  return dates;
}

interface Props {
  entityId: string;
  entity: LegalEntity;
}

export function CompanyFilingDeadlines({ entityId, entity }: Props) {
  const { toast } = useToast();
  const { data: org } = useOrganization();
  const { data: filings, isLoading } = useFilingDeadlines(entityId);
  const createFiling = useCreateFilingDeadline();
  const updateFiling = useUpdateFilingDeadline();
  const deleteFiling = useDeleteFilingDeadline();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CompanyFilingDeadline | null>(null);
  const [formData, setFormData] = useState({
    filing_type: 'confirmation_statement' as FilingType,
    due_date: '',
    filed_date: '',
    status: 'upcoming' as string,
    reference: '',
    document_url: '',
  });

  const chDates = useMemo(() => autoCalculateFilingDates(entity), [entity]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ filing_type: 'confirmation_statement', due_date: '', filed_date: '', status: 'upcoming', reference: '', document_url: '' });
    setShowForm(true);
  };

  const openEdit = (f: CompanyFilingDeadline) => {
    setEditing(f);
    setFormData({
      filing_type: f.filing_type,
      due_date: f.due_date,
      filed_date: f.filed_date || '',
      status: f.status,
      reference: f.reference || '',
      document_url: f.document_url || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!org?.id || !formData.due_date) return;
    try {
      if (editing) {
        await updateFiling.mutateAsync({
          id: editing.id,
          ...formData,
          status: formData.status as any,
          filed_date: formData.filed_date || null,
          reference: formData.reference || null,
          document_url: formData.document_url || null,
        });
        toast({ title: 'Filing updated' });
      } else {
        await createFiling.mutateAsync({
          entity_id: entityId,
          org_id: org.id,
          ...formData,
          filed_date: formData.filed_date || null,
          reference: formData.reference || null,
          document_url: formData.document_url || null,
        });
        toast({ title: 'Filing deadline added' });
      }
      setShowForm(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    }
  };

  const handleAutoGenerate = async () => {
    if (!org?.id) return;
    let created = 0;
    for (const [filingType, dueDate] of Object.entries(chDates)) {
      const exists = filings?.some(f => f.filing_type === filingType && f.due_date === dueDate);
      if (!exists) {
        await createFiling.mutateAsync({
          entity_id: entityId,
          org_id: org.id,
          filing_type: filingType as FilingType,
          due_date: dueDate,
          filed_date: null,
          status: differenceInDays(new Date(dueDate), new Date()) < 0 ? 'overdue' : 'upcoming',
          reference: null,
          document_url: null,
        });
        created++;
      }
    }
    toast({ title: created > 0 ? `${created} filing deadline(s) generated from CH data` : 'No new deadlines to add' });
  };

  if (isLoading) return <Skeleton className="h-48" />;

  const sortedFilings = [...(filings || [])].sort((a, b) => {
    if (a.status === 'filed' && b.status !== 'filed') return 1;
    if (a.status !== 'filed' && b.status === 'filed') return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Filing Deadlines
          </CardTitle>
          <div className="flex gap-2">
            {Object.keys(chDates).length > 0 && (
              <Button variant="outline" size="sm" onClick={handleAutoGenerate} disabled={createFiling.isPending}>
                Auto-fill from CH
              </Button>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Filing
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedFilings.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No filing deadlines tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedFilings.map(f => {
                const tl = getTrafficLight(f.due_date, f.status);
                return (
                  <div key={f.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${tl.color}`} />
                      <div>
                        <div className="font-medium">{FILING_LABELS[f.filing_type]}</div>
                        <div className="text-sm text-muted-foreground">
                          Due: {format(new Date(f.due_date), 'dd MMM yyyy')}
                          {f.filed_date && <> &middot; Filed: {format(new Date(f.filed_date), 'dd MMM yyyy')}</>}
                          {f.reference && <> &middot; Ref: {f.reference}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={f.status === 'filed' ? 'default' : f.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {tl.icon}
                        <span className="ml-1">{tl.label}</span>
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          await deleteFiling.mutateAsync({ id: f.id, entityId });
                          toast({ title: 'Filing removed' });
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Filing Deadline' : 'Add Filing Deadline'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Filing Type</Label>
              <Select value={formData.filing_type} onValueChange={(v) => setFormData(p => ({ ...p, filing_type: v as FilingType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FILING_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={formData.due_date} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div>
              <Label>Filed Date</Label>
              <Input type="date" value={formData.filed_date} onChange={e => setFormData(p => ({ ...p, filed_date: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={formData.reference} onChange={e => setFormData(p => ({ ...p, reference: e.target.value }))} placeholder="e.g. filing reference number" />
            </div>
            <div>
              <Label>Document URL</Label>
              <Input value={formData.document_url} onChange={e => setFormData(p => ({ ...p, document_url: e.target.value }))} placeholder="Link to filed document" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createFiling.isPending || updateFiling.isPending}>
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
