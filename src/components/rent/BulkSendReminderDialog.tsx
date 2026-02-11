import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Mail } from 'lucide-react';
import { useBulkSendReminder, type RentScheduleWithDetails } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface BulkSendReminderDialogProps {
  items: RentScheduleWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function BulkSendReminderDialog({ items, open, onOpenChange, onSuccess }: BulkSendReminderDialogProps) {
  const bulkSendReminder = useBulkSendReminder();
  const [reminderType, setReminderType] = useState('overdue');
  const [customMessage, setCustomMessage] = useState('');

  const { withEmail, withoutEmail } = useMemo(() => {
    const withEmail: (RentScheduleWithDetails & { email: string })[] = [];
    const withoutEmail: RentScheduleWithDetails[] = [];

    for (const item of items) {
      const tenant = item.tenancy?.tenant as any;
      const email = tenant?.email;
      if (email) {
        withEmail.push({ ...item, email });
      } else {
        withoutEmail.push(item);
      }
    }
    return { withEmail, withoutEmail };
  }, [items]);

  const handleConfirm = () => {
    bulkSendReminder.mutate(
      {
        items,
        reminderType,
        customMessage: customMessage.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setCustomMessage('');
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send reminder to {withEmail.length} tenants?</DialogTitle>
          <DialogDescription>
            {withoutEmail.length > 0
              ? `${withoutEmail.length} tenant(s) have no email and will be skipped.`
              : 'All selected tenants have email addresses on file.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reminder type</Label>
            <Select value={reminderType} onValueChange={setReminderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_due">Pre-Due</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Custom message (optional)</Label>
            <Textarea
              placeholder="Leave blank to use the default template"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Recipients:</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {withEmail.map((item) => (
                <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{item.email}</p>
                    </div>
                  </div>
                  <span className="font-medium shrink-0 ml-3">{fmt(item.amount_outstanding)}</span>
                </div>
              ))}
              {withoutEmail.map((item) => (
                <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">No email on file</p>
                    </div>
                  </div>
                  <span className="font-medium shrink-0 ml-3">{fmt(item.amount_outstanding)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={withEmail.length === 0 || bulkSendReminder.isPending}>
            {bulkSendReminder.isPending
              ? 'Sending…'
              : `Send ${withEmail.length} reminders`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
