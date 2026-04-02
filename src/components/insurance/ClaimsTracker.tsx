import { useState } from 'react';
import { Plus, FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common';
import {
  useInsuranceClaims,
  useCreateClaim,
  useUpdateClaim,
  useInsurancePolicies,
  CLAIM_STATUSES,
  type InsuranceClaim,
} from '@/hooks/useInsuranceTracker';
import { formatGBP } from '@/lib/calculations';
import { SEVERITY } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

const STATUS_SEVERITY: Record<string, keyof typeof SEVERITY> = {
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  settled: 'success',
  rejected: 'critical',
  withdrawn: 'neutral',
};

const PIPELINE_STEPS = ['submitted', 'under_review', 'approved', 'settled'];

function getStatusBadge(status: string) {
  const severity = STATUS_SEVERITY[status] || 'neutral';
  const label = CLAIM_STATUSES.find(s => s.value === status)?.label || status;
  return <Badge className={cn('text-xs', SEVERITY[severity].badge)}>{label}</Badge>;
}

function ClaimStatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus);
  const isTerminal = ['rejected', 'withdrawn'].includes(currentStatus);

  if (isTerminal) {
    return getStatusBadge(currentStatus);
  }

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const severity = STATUS_SEVERITY[step] || 'neutral';
        const label = CLAIM_STATUSES.find(s => s.value === step)?.label || step;
        return (
          <div key={step} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight className={cn('h-3 w-3', isCompleted ? 'text-green-500' : 'text-muted-foreground/30')} />
            )}
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                isCompleted ? SEVERITY[severity].badge : 'bg-muted/50 text-muted-foreground/50'
              )}
              title={label}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AddClaimDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: policies } = useInsurancePolicies();
  const createClaim = useCreateClaim();

  const [form, setForm] = useState({
    policy_id: '',
    claim_date: new Date().toISOString().split('T')[0],
    description: '',
    amount_claimed: '',
    claim_reference: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPolicy = policies?.find(p => p.id === form.policy_id);
    createClaim.mutate(
      {
        policy_id: form.policy_id,
        property_id: selectedPolicy?.property_id,
        claim_date: form.claim_date,
        description: form.description,
        amount_claimed: form.amount_claimed ? Number(form.amount_claimed) : undefined,
        claim_reference: form.claim_reference || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({
            policy_id: '',
            claim_date: new Date().toISOString().split('T')[0],
            description: '',
            amount_claimed: '',
            claim_reference: '',
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File a Claim</DialogTitle>
          <DialogDescription>Submit a new insurance claim against a policy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="claim_policy">Policy</Label>
            <Select
              value={form.policy_id}
              onValueChange={(v) => setForm(f => ({ ...f, policy_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select policy..." />
              </SelectTrigger>
              <SelectContent>
                {policies?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.insurer_name || 'Unknown'} — {p.policy_number || 'No ref'} ({p.property?.address_line || 'Unknown property'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="claim_date">Claim Date</Label>
              <Input
                id="claim_date"
                type="date"
                value={form.claim_date}
                onChange={(e) => setForm(f => ({ ...f, claim_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="claim_reference">Reference</Label>
              <Input
                id="claim_reference"
                value={form.claim_reference}
                onChange={(e) => setForm(f => ({ ...f, claim_reference: e.target.value }))}
                placeholder="Claim reference"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="claim_amount">Amount Claimed (&pound;)</Label>
            <Input
              id="claim_amount"
              type="number"
              step="0.01"
              value={form.amount_claimed}
              onChange={(e) => setForm(f => ({ ...f, amount_claimed: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="claim_description">Description</Label>
            <Textarea
              id="claim_description"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the claim..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.policy_id || !form.description || createClaim.isPending}
            >
              {createClaim.isPending ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClaimStatusUpdater({
  claim,
  onClose,
}: {
  claim: InsuranceClaim;
  onClose: () => void;
}) {
  const updateClaim = useUpdateClaim();
  const [status, setStatus] = useState(claim.status);
  const [amountSettled, setAmountSettled] = useState(claim.amount_settled?.toString() || '');
  const [notes, setNotes] = useState(claim.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClaim.mutate(
      {
        id: claim.id,
        status,
        amount_settled: amountSettled ? Number(amountSettled) : null,
        settled_at: status === 'settled' ? new Date().toISOString().split('T')[0] : null,
        notes: notes || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Claim</DialogTitle>
          <DialogDescription>
            {claim.claim_reference || 'No reference'} — {claim.description.slice(0, 60)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(status === 'settled' || status === 'approved') && (
            <div>
              <Label>Amount Settled (&pound;)</Label>
              <Input
                type="number"
                step="0.01"
                value={amountSettled}
                onChange={(e) => setAmountSettled(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateClaim.isPending}>
              {updateClaim.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClaimsTracker() {
  const { data: claims, isLoading } = useInsuranceClaims();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClaim, setEditingClaim] = useState<InsuranceClaim | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredClaims = claims?.filter(c =>
    statusFilter === 'all' || c.status === statusFilter
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Claims Tracker</CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            File Claim
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {CLAIM_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : !filteredClaims?.length ? (
          <EmptyState
            icon={FileText}
            title="No claims"
            description="No insurance claims have been filed yet."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Policy / Insurer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Claimed</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClaims.map(claim => (
                <TableRow key={claim.id} className="cursor-pointer" onClick={() => setEditingClaim(claim)}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(claim.claim_date).toLocaleDateString('en-GB')}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{claim.policy?.insurer_name || '—'}</div>
                    {claim.claim_reference && (
                      <div className="text-xs text-muted-foreground">Ref: {claim.claim_reference}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {claim.description}
                  </TableCell>
                  <TableCell className="text-sm text-right">{formatGBP(claim.amount_claimed)}</TableCell>
                  <TableCell className="text-sm text-right">{formatGBP(claim.amount_settled)}</TableCell>
                  <TableCell>
                    <ClaimStatusPipeline currentStatus={claim.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setEditingClaim(claim); }}
                    >
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddClaimDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      {editingClaim && (
        <ClaimStatusUpdater
          claim={editingClaim}
          onClose={() => setEditingClaim(null)}
        />
      )}
    </Card>
  );
}
