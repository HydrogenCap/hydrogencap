import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Send, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RentScheduleWithDetails, useSendReminder } from '@/hooks/useRentCollection';

interface SendReminderDialogProps {
  item: RentScheduleWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SendReminderDialog({ item, open, onOpenChange }: SendReminderDialogProps) {
  const sendReminder = useSendReminder();
  const [reminderType, setReminderType] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');

  if (!item) return null;

  const tenantName = `${item.tenancy.tenant.first_name} ${item.tenancy.tenant.last_name}`;
  const tenantEmail = (item.tenancy as any).tenant?.email || '';
  const propertyAddress = `${item.tenancy.property.address_line}${item.tenancy.property.postcode ? `, ${item.tenancy.property.postcode}` : ''}`;
  const dueDate = new Date(item.due_date);
  const today = new Date();
  const daysOverdue = differenceInDays(today, dueDate);

  // Auto-detect reminder type
  const autoType = daysOverdue > 0 ? 'overdue' : daysOverdue === 0 ? 'due_date' : 'pre_due';
  const activeType = reminderType || autoType;

  const getPreviewMessage = () => {
    if (customMessage) return customMessage;
    switch (activeType) {
      case 'pre_due':
        return `Dear ${tenantName},\n\nThis is a friendly reminder that your rent payment of £${item.amount_outstanding.toLocaleString()} will be due on ${format(dueDate, 'dd MMMM yyyy')}.\n\nPlease ensure payment is made on time.\n\nThank you`;
      case 'due_date':
        return `Dear ${tenantName},\n\nYour rent payment of £${item.amount_outstanding.toLocaleString()} is due today.\n\nPlease make payment as soon as possible.\n\nThank you`;
      case 'overdue':
        return `Dear ${tenantName},\n\nYour rent payment of £${item.amount_outstanding.toLocaleString()} is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.\n\nPlease contact us immediately to arrange payment or discuss a payment plan.\n\nOutstanding Amount: £${item.amount_outstanding.toLocaleString()}\nOriginal Due Date: ${format(dueDate, 'dd MMMM yyyy')}\n\nThank you`;
      default:
        return '';
    }
  };

  const handleSend = () => {
    sendReminder.mutate(
      {
        rentScheduleId: item.id,
        tenancyId: item.tenancy_id,
        reminderType: activeType,
        customMessage: customMessage || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Send a reminder to {tenantName} about their rent payment for {propertyAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient info */}
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">To: {tenantEmail || 'No email on file'}</span>
            </div>
            <p className="text-muted-foreground">
              Amount outstanding: £{item.amount_outstanding.toLocaleString()} • Due: {format(dueDate, 'dd MMM yyyy')}
            </p>
          </div>

          {/* Reminder type */}
          <div className="space-y-2">
            <Label>Reminder Type</Label>
            <Select value={activeType} onValueChange={setReminderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_due">Pre-Due Reminder</SelectItem>
                <SelectItem value="due_date">Due Date Reminder</SelectItem>
                <SelectItem value="overdue">Overdue Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message preview */}
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <Textarea
              value={customMessage || getPreviewMessage()}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={8}
              className="text-sm"
            />
            {customMessage && (
              <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setCustomMessage('')}>
                Reset to template
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={!tenantEmail || sendReminder.isPending}
          >
            {sendReminder.isPending ? 'Sending…' : 'Send Reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
