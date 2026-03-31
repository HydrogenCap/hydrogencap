import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import {
  useCreateShareholder,
  useUpdateShareholder,
  type EntityShareholder,
} from '@/hooks/useLegalEntities';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useShareClassesWithAllocation } from '@/hooks/useShareCapital';
import { useToast } from '@/hooks/use-toast';

interface ShareholderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  editingShareholder?: EntityShareholder | null;
}

export function ShareholderFormModal({ open, onOpenChange, entityId, editingShareholder }: ShareholderFormModalProps) {
  const { toast } = useToast();
  const createShareholder = useCreateShareholder();
  const updateShareholder = useUpdateShareholder();
  const { data: shareClassesWithAllocation } = useShareClassesWithAllocation(entityId);
  const { data: allEntities } = useLegalEntities();
  const isEditing = !!editingShareholder;

  // Filter out the entity being edited (can't own itself)
  const linkableEntities = (allEntities || []).filter(e => e.id !== entityId);

  const [form, setForm] = useState({
    shareholder_name: '',
    share_class_id: '',
    shares_held: '',
    effective_date: '',
    shareholder_entity_id: '' as string | null,
    shareholder_type: 'individual' as 'individual' | 'entity',
  });

  useEffect(() => {
    if (open) {
      if (editingShareholder) {
        const primaryClass = shareClassesWithAllocation?.find(sc => sc.is_primary);
        const fallbackClassId = primaryClass?.id || shareClassesWithAllocation?.[0]?.id || '';
        setForm({
          shareholder_name: editingShareholder.shareholder_name,
          share_class_id: editingShareholder.share_class_id || fallbackClassId,
          shares_held: editingShareholder.shares_held > 0 ? String(editingShareholder.shares_held) : '',
          effective_date: editingShareholder.effective_date,
          shareholder_entity_id: editingShareholder.shareholder_entity_id || null,
          shareholder_type: editingShareholder.shareholder_type || 'individual',
        });
      } else {
        const primaryClass = shareClassesWithAllocation?.find(sc => sc.is_primary);
        setForm({
          shareholder_name: '',
          share_class_id: primaryClass?.id || '',
          shares_held: '',
          effective_date: new Date().toISOString().split('T')[0],
          shareholder_entity_id: null,
          shareholder_type: 'individual',
        });
      }
    }
  }, [open, editingShareholder, shareClassesWithAllocation]);

  const isPending = createShareholder.isPending || updateShareholder.isPending;

  // Over-allocation calculation
  const selectedShareClass = shareClassesWithAllocation?.find(sc => sc.id === form.share_class_id);
  const sharesEntered = parseInt(form.shares_held, 10) || 0;
  const currentlyAllocated = selectedShareClass?.allocated_shares || 0;
  const editingShares = (editingShareholder?.share_class_id === form.share_class_id)
    ? editingShareholder!.shares_held : 0;
  const wouldBeAllocated = currentlyAllocated - editingShares + sharesEntered;
  const isOverAllocated = selectedShareClass && sharesEntered > 0 && wouldBeAllocated > selectedShareClass.issued_shares;

  // Auto-calculated percentage
  const calculatedPercent = selectedShareClass && sharesEntered > 0
    ? (sharesEntered / selectedShareClass.issued_shares) * 100
    : 0;

  const handleSubmit = async () => {
    if (!form.shareholder_name.trim()) {
      toast({ title: 'Error', description: 'Shareholder name is required', variant: 'destructive' });
      return;
    }
    if (!form.share_class_id) {
      toast({ title: 'Error', description: 'Share class is required', variant: 'destructive' });
      return;
    }
    const shares = parseInt(form.shares_held, 10);
    if (isNaN(shares) || shares <= 0) {
      toast({ title: 'Error', description: 'Shares held must be a positive number', variant: 'destructive' });
      return;
    }
    if (!form.effective_date) {
      toast({ title: 'Error', description: 'Effective date is required', variant: 'destructive' });
      return;
    }
    if (isOverAllocated) {
      toast({ title: 'Error', description: 'Cannot exceed issued shares for this class', variant: 'destructive' });
      return;
    }

    const pct = Math.round(calculatedPercent * 100) / 100;

    const payload = {
      entity_id: entityId,
      shareholder_name: form.shareholder_name.trim(),
      share_class: selectedShareClass?.class_name || 'Ordinary',
      share_class_id: form.share_class_id,
      shares_held: shares,
      percentage: pct,
      effective_date: form.effective_date,
      shareholder_entity_id: form.shareholder_entity_id || null,
      shareholder_type: form.shareholder_type,
    };

    try {
      if (isEditing && editingShareholder) {
        await updateShareholder.mutateAsync({ id: editingShareholder.id, ...payload });
        toast({ title: 'Shareholder updated' });
      } else {
        await createShareholder.mutateAsync(payload);
        toast({ title: 'Shareholder added' });
      }
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Failed to save shareholder';
      toast({ title: 'Error', description, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shareholder' : 'Add Shareholder'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Shareholder Name *</Label>
            <Input value={form.shareholder_name} onChange={(e) => setForm(f => ({ ...f, shareholder_name: e.target.value }))} placeholder="e.g. John Smith or Hydrogen Capital Ltd" />
          </div>

          <div className="space-y-2">
            <Label>Shareholder Type</Label>
            <Select
              value={form.shareholder_type}
              onValueChange={(v) => {
                setForm(f => ({
                  ...f,
                  shareholder_type: v as 'individual' | 'entity',
                  shareholder_entity_id: v === 'individual' ? null : f.shareholder_entity_id,
                }));
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual Person</SelectItem>
                <SelectItem value="entity">Company / Entity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.shareholder_type === 'entity' && (
            <div className="space-y-2">
              <Label>Link to Entity (for ownership look-through)</Label>
              <Select
                value={form.shareholder_entity_id || ''}
                onValueChange={(v) => {
                  const entity = linkableEntities.find(e => e.id === v);
                  setForm(f => ({
                    ...f,
                    shareholder_entity_id: v || null,
                    shareholder_name: entity?.entity_name || f.shareholder_name,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select entity..." /></SelectTrigger>
                <SelectContent>
                  {linkableEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking enables automatic ownership look-through for portfolio attribution.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Share Class *</Label>
            <Select
              value={form.share_class_id}
              onValueChange={(v) => setForm(f => ({ ...f, share_class_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select share class..." />
              </SelectTrigger>
              <SelectContent>
                {(shareClassesWithAllocation || []).map(sc => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.class_name} ({sc.unallocated_shares.toLocaleString()} of {sc.issued_shares.toLocaleString()} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shares Held *</Label>
              <Input type="number" min="1" value={form.shares_held} onChange={(e) => setForm(f => ({ ...f, shares_held: e.target.value }))} placeholder="100" />
              {selectedShareClass && sharesEntered > 0 && (
                <p className="text-sm text-muted-foreground">
                  = {calculatedPercent.toFixed(2)}% ownership
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Input type="date" value={form.effective_date} onChange={(e) => setForm(f => ({ ...f, effective_date: e.target.value }))} />
            </div>
          </div>

          {isOverAllocated && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                This would allocate {wouldBeAllocated.toLocaleString()} shares against
                {' '}{selectedShareClass!.issued_shares.toLocaleString()} issued — exceeds total by
                {' '}{(wouldBeAllocated - selectedShareClass!.issued_shares).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Add Shareholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
