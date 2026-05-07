import { format, differenceInDays, parseISO } from 'date-fns';
import { Clock, Plus, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { awaaabStatus } from '../utils/status';
import type { RentersRightsBillState } from '../hooks/useRentersRightsBillState';

export function AwaaabComplaintsCard({ state }: { state: RentersRightsBillState }) {
  const { complaints, showAddComplaint, setShowAddComplaint, newComplaint, setNewComplaint, addComplaint, removeComplaint } = state;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Awaab's Law — Damp & Mould Complaint Tracker
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddComplaint(!showAddComplaint)}>
            <Plus className="h-3 w-3 mr-1" />Log Complaint
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/40 text-xs p-2 text-muted-foreground">
          Under Awaab's Law: investigate within <strong>14 days</strong>, emergency repairs within <strong>24 hours</strong>, all repairs within a <strong>reasonable timeframe</strong>. Failure is a breach of the tenancy agreement.
        </div>

        {showAddComplaint && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Property / Room</Label>
                <Input value={newComplaint.property} onChange={e => setNewComplaint(p => ({ ...p, property: e.target.value }))} placeholder="e.g. 42 High Street, Room 3" />
              </div>
              <div className="space-y-1">
                <Label>Date Reported</Label>
                <Input type="date" value={newComplaint.reported_date} onChange={e => setNewComplaint(p => ({ ...p, reported_date: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={newComplaint.description} onChange={e => setNewComplaint(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the damp/mould complaint…" rows={2} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addComplaint}><Check className="h-3 w-3 mr-1" />Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddComplaint(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
            </div>
          </div>
        )}

        {complaints.length === 0 && !showAddComplaint ? (
          <p className="text-muted-foreground text-center py-4">No complaints logged.</p>
        ) : complaints.length > 0 ? (
          <div className="space-y-2">
            {complaints.map(c => {
              const days = differenceInDays(new Date(), parseISO(c.reported_date));
              const { label, variant } = awaaabStatus(days);
              return (
                <div key={c.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.property}</span>
                      <Badge variant={variant} className="text-xs">{label}</Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>}
                    <p className="text-xs text-muted-foreground">Reported: {format(parseISO(c.reported_date), 'dd MMM yyyy')}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0 shrink-0" onClick={() => removeComplaint(c.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
