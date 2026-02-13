import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { useBulkWriteOff, type RentScheduleWithDetails } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface BulkWriteOffDialogProps {
  items: RentScheduleWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function BulkWriteOffDialog({ items, open, onOpenChange, onSuccess }: BulkWriteOffDialogProps) {
  const bulkWriteOff = useBulkWriteOff();
  const [reason, setReason] = useState('');

  const totalAmount = items.reduce((sum, item) => sum + item.amount_outstanding, 0);

  const handleConfirm = () => {
    bulkWriteOff.mutate(
      { items, reason: reason || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Write off {items.length} payments as bad debt?
          </DialogTitle>
          <DialogDescription>
            This will mark {fmt(totalAmount)} as unrecoverable. This can be reversed on the individual payment detail page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="e.g. Tenant vacated, no forwarding address"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.tenancy.room.room_name} • {[item.tenancy.property.address_line, item.tenancy.property.town_city].filter(Boolean).join(', ')}
                  </p>
                </div>
                <span className="font-medium text-destructive shrink-0 ml-3">
                  {fmt(item.amount_outstanding)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={bulkWriteOff.isPending}>
            {bulkWriteOff.isPending ? 'Writing off…' : `Write off ${fmt(totalAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
