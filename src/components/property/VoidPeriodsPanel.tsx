import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Calendar, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { formatGBP } from '@/lib/calculations';
import {
  useVoidPeriods,
  useCreateVoidPeriod,
  useUpdateVoidPeriod,
  useDeleteVoidPeriod,
  VOID_REASON_LABELS,
  type VoidReason,
} from '@/hooks/useVoidPeriods';

interface VoidPeriodsPanelProps {
  propertyId: string;
}

export function VoidPeriodsPanel({ propertyId }: VoidPeriodsPanelProps) {
  const { data: voids, isLoading } = useVoidPeriods(propertyId);
  const createVoid = useCreateVoidPeriod();
  const updateVoid = useUpdateVoidPeriod();
  const deleteVoid = useDeleteVoidPeriod();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState<VoidReason | ''>('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [monthlyCost, setMonthlyCost] = useState('');

  const handleCreate = async () => {
    if (!startDate) return;
    await createVoid.mutateAsync({
      propertyId,
      startDate,
      endDate: endDate || undefined,
      reason: reason || undefined,
      reasonNotes: reasonNotes || undefined,
      estimatedMonthlyCost: monthlyCost ? parseFloat(monthlyCost) : undefined,
    });
    setDialogOpen(false);
    resetForm();
  };

  const handleEndVoid = async (id: string) => {
    await updateVoid.mutateAsync({
      id,
      end_date: new Date().toISOString().split('T')[0],
    });
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setReasonNotes('');
    setMonthlyCost('');
  };

  const activeVoids = voids?.filter(v => !v.end_date) || [];
  const completedVoids = voids?.filter(v => v.end_date) || [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Void Periods
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Record Void
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Void Period</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={v => setReason(v as VoidReason)}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VOID_REASON_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Est. Monthly Cost (£)</Label>
                <Input type="number" step="0.01" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="e.g. 850" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={reasonNotes} onChange={e => setReasonNotes(e.target.value)} placeholder="Optional notes..." />
              </div>
              <Button onClick={handleCreate} disabled={!startDate || createVoid.isPending} className="w-full">
                {createVoid.isPending ? 'Saving...' : 'Save Void Period'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !voids?.length ? (
          <p className="text-sm text-muted-foreground">No void periods recorded.</p>
        ) : (
          <div className="space-y-3">
            {activeVoids.map(v => {
              const days = differenceInDays(new Date(), new Date(v.start_date));
              return (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">Active — {days} days</Badge>
                      {v.reason && <span className="text-xs text-muted-foreground">{VOID_REASON_LABELS[v.reason as VoidReason]}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Since {format(new Date(v.start_date), 'dd MMM yyyy')}
                      {v.estimated_monthly_cost ? ` • ${formatGBP(v.estimated_monthly_cost)}/mo cost` : ''}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEndVoid(v.id)}>
                    End Void
                  </Button>
                </div>
              );
            })}

            {completedVoids.slice(0, 5).map(v => {
              const days = differenceInDays(new Date(v.end_date!), new Date(v.start_date));
              return (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{days} days</Badge>
                      {v.reason && <span className="text-xs text-muted-foreground">{VOID_REASON_LABELS[v.reason as VoidReason]}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(v.start_date), 'dd MMM yyyy')} — {format(new Date(v.end_date!), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => deleteVoid.mutate(v.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
