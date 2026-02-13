import { useState, useRef } from 'react';
import { formatPropertyAddress } from '@/utils/formatAddress';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useBulkMarkPaid, type RentScheduleWithDetails } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface BulkMarkPaidDialogProps {
  items: RentScheduleWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'on_time' | 'late';
  onSuccess: () => void;
}

export default function BulkMarkPaidDialog({ items, open, onOpenChange, mode, onSuccess }: BulkMarkPaidDialogProps) {
  const bulkMarkPaid = useBulkMarkPaid();
  const [paymentMethod, setPaymentMethod] = useState('standing_order');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [processedCount, setProcessedCount] = useState(0);
  const processedRef = useRef(0);

  const totalAmount = items.reduce((sum, item) => sum + item.amount_outstanding, 0);

  const handleConfirm = () => {
    setProcessedCount(0);
    processedRef.current = 0;

    bulkMarkPaid.mutate(
      {
        items,
        paymentMethod,
        paymentDate: mode === 'on_time' ? 'due_date' : paymentDate,
        notes: mode === 'on_time' ? 'Bulk marked as paid on time' : `Bulk marked as paid late (${paymentDate})`,
        onProgress: (count) => {
          processedRef.current = count;
          if (count % 3 === 0 || count === items.length) {
            setProcessedCount(count);
          }
        },
      },
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
          <DialogTitle>
            {mode === 'on_time'
              ? `Mark ${items.length} payments as paid on time?`
              : `Mark ${items.length} payments as paid late?`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'on_time'
              ? 'Each payment will be recorded on its due date.'
              : 'All payments will be recorded on the date you specify.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{items.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total amount</span>
              <span className="font-bold text-lg">{fmt(totalAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment method (applied to all)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standing_order">Standing Order</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="direct_debit">Direct Debit</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'late' && (
            <div className="space-y-2">
              <Label>Payment date (applied to all)</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {items.length} items to be marked as paid:
            </Label>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.tenancy.room.room_name} • {formatPropertyAddress(item.tenancy.property.address_line, item.tenancy.property.town_city)}
                    </p>
                  </div>
                  <span className="font-medium shrink-0 ml-3">{fmt(item.amount_outstanding)}</span>
                </div>
              ))}
            </div>
          </div>

          {bulkMarkPaid.isPending && items.length > 10 && (
            <div className="space-y-2">
              <Progress value={(processedCount / items.length) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                Processing {processedCount} of {items.length}...
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={bulkMarkPaid.isPending}>
            {bulkMarkPaid.isPending
              ? `Processing ${processedCount} of ${items.length}…`
              : `Confirm ${items.length} payments`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
