import { useState } from 'react';
import { format } from 'date-fns';
import { PoundSterling } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecordPayment, RentScheduleWithDetails } from '@/hooks/useRentCollection';

interface RecordPaymentDialogProps {
  item: RentScheduleWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethods = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'standing_order', label: 'Standing Order' },
  { value: 'direct_debit', label: 'Direct Debit' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function RecordPaymentDialog({ item, open, onOpenChange }: RecordPaymentDialogProps) {
  const recordPayment = useRecordPayment();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && item) {
      setAmount(item.amount_outstanding.toString());
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMethod('bank_transfer');
      setReference('');
      setNotes('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = () => {
    if (!item || !amount) return;

    recordPayment.mutate(
      {
        tenancy_id: item.tenancy_id,
        rent_schedule_id: item.id,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PoundSterling className="h-5 w-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name} — {item.tenancy.property.address_line}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Outstanding context */}
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rent due</span>
              <span className="font-medium">£{item.rent_amount.toLocaleString()}</span>
            </div>
            {item.additional_charges > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Additional charges</span>
                <span className="font-medium">£{item.additional_charges.toLocaleString()}</span>
              </div>
            )}
            {item.amount_paid > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already paid</span>
                <span className="font-medium text-green-600">£{item.amount_paid.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span className="font-medium">Outstanding</span>
              <span className="font-semibold text-red-600">£{item.amount_outstanding.toLocaleString()}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (£)</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {parseFloat(amount) > 0 && parseFloat(amount) < item.amount_outstanding && (
              <p className="text-xs text-amber-600">This is a partial payment</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment Date</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="payment-ref">Reference (optional)</Label>
            <Input
              id="payment-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. bank transaction ref"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || recordPayment.isPending}
          >
            {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
