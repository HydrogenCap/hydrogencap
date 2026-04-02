import { useState } from 'react';
import { format } from 'date-fns';
import { PoundSterling } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecordPayment, normalizeRentItem, RentScheduleWithDetails } from '@/hooks/useRentCollection';
import { RentReceiptDialog } from '@/components/rent/RentReceiptDialog';

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
  { value: 'card', label: 'Card' },
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
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    tenantName: string;
    tenantEmail: string | null;
    propertyAddress: string;
    roomName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference: string | null;
  } | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && item) {
      setAmount(item.amount_outstanding.toString());
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMethod('bank_transfer');
      setReference('');
      setNotes('');
      setIsFullPayment(true);
    }
    onOpenChange(nextOpen);
  };

  const handleFullPaymentToggle = (checked: boolean) => {
    setIsFullPayment(checked);
    if (checked && item) {
      setAmount(item.amount_outstanding.toString());
    }
  };

  const handleSubmit = () => {
    if (!item || !amount) return;

    const display = normalizeRentItem(item);
    const paymentAmount = parseFloat(amount);

    recordPayment.mutate(
      {
        tenancy_id: item.tenancy_id,
        rent_schedule_id: item.id,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
        agreement_id: item.agreement_id || null,
      },
      {
        onSuccess: () => {
          // Prepare receipt data before closing
          setReceiptData({
            tenantName: display.tenantName,
            tenantEmail: display.tenantEmail,
            propertyAddress: display.propertyAddress,
            roomName: display.roomName,
            amount: paymentAmount,
            paymentDate,
            paymentMethod,
            reference: reference || null,
          });
          onOpenChange(false);
          setShowReceipt(true);
        },
      }
    );
  };

  if (!item) return (
    <RentReceiptDialog
      data={receiptData}
      open={showReceipt}
      onOpenChange={setShowReceipt}
    />
  );

  const display = normalizeRentItem(item);
  const parsedAmount = parseFloat(amount) || 0;
  const remainingBalance = item.amount_outstanding - parsedAmount;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PoundSterling className="h-5 w-5" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              {display.tenantName} — {display.propertyAddress}
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

            {/* Full Payment Toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="full-payment" className="text-sm font-medium">Full Payment</Label>
                <p className="text-xs text-muted-foreground">Record the full outstanding amount</p>
              </div>
              <Switch
                id="full-payment"
                checked={isFullPayment}
                onCheckedChange={handleFullPaymentToggle}
              />
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
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (parseFloat(e.target.value) !== item.amount_outstanding) {
                    setIsFullPayment(false);
                  }
                }}
                placeholder="0.00"
                disabled={isFullPayment}
              />
              {parsedAmount > 0 && parsedAmount < item.amount_outstanding && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-2 text-xs">
                  <p className="text-amber-700 dark:text-amber-400 font-medium">Partial payment</p>
                  <p className="text-amber-600 dark:text-amber-500">
                    Remaining balance: £{remainingBalance.toFixed(2)}
                  </p>
                </div>
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
              disabled={!amount || parsedAmount <= 0 || recordPayment.isPending}
            >
              {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RentReceiptDialog
        data={receiptData}
        open={showReceipt}
        onOpenChange={setShowReceipt}
      />
    </>
  );
}
