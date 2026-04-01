import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays, differenceInWeeks } from 'date-fns';
import { SEVERITY } from '@/lib/design-tokens';
import {
  ArrowLeft, PoundSterling, AlertTriangle, CheckCircle2, Clock,
  Send, Ban, Trash2, Copy, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useRentScheduleItem, useUpdateRentScheduleStatus,
  usePaymentReminders, useDeleteRentSchedule, useDuplicateRentSchedule,
  normalizeRentItem, type RentScheduleWithDetails,
} from '@/hooks/useRentCollection';
import { LoadingState } from '@/components/common';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import SendReminderDialog from '@/components/rent/SendReminderDialog';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  upcoming: { label: 'Upcoming', color: SEVERITY.neutral.badge, icon: Clock },
  due: { label: 'Due Today', color: SEVERITY.info.badge, icon: Calendar },
  paid: { label: 'Paid', color: SEVERITY.success.badge, icon: CheckCircle2 },
  partial: { label: 'Partial', color: SEVERITY.warning.badge, icon: AlertTriangle },
  overdue: { label: 'Overdue', color: SEVERITY.critical.badge, icon: AlertTriangle },
  bad_debt: { label: 'Bad Debt', color: SEVERITY.critical.badge, icon: Ban },
};

export default function PaymentDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading } = useRentScheduleItem(scheduleId || '');
  const updateStatus = useUpdateRentScheduleStatus();
  const deleteSchedule = useDeleteRentSchedule();
  const duplicateSchedule = useDuplicateRentSchedule();
  const { data: reminders } = usePaymentReminders(scheduleId || '');
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showSendReminder, setShowSendReminder] = useState(false);

  if (isLoading) return <LoadingState text="Loading payment details..." />;
  if (!item) return <div className="container py-6"><p>Payment not found.</p></div>;

  const display = normalizeRentItem(item);
  const status = statusConfig[item.status] || statusConfig.upcoming;
  const StatusIcon = status.icon;
  const today = new Date();
  const dueDate = new Date(item.due_date);
  const daysOverdue = differenceInDays(today, dueDate);
  const weeksOverdue = differenceInWeeks(today, dueDate);
  const isOverdue = daysOverdue > 0 && item.status !== 'paid' && item.status !== 'bad_debt';

  const propertyAddress = `${display.propertyAddress}${display.propertyPostcode ? `, ${display.propertyPostcode}` : ''}`;

  const handleMarkOverdue = () => {
    updateStatus.mutate({ id: item.id, status: 'overdue' });
  };

  const handleMarkPaid = () => {
    updateStatus.mutate({ id: item.id, status: 'paid' });
  };

  const handleMarkBadDebt = () => {
    updateStatus.mutate({ id: item.id, status: 'bad_debt' });
  };

  const handleDelete = () => {
    deleteSchedule.mutate(item.id, {
      onSuccess: () => navigate('/rent'),
    });
  };

  const handleDuplicate = () => {
    duplicateSchedule.mutate(item, {
      onSuccess: () => navigate('/rent'),
    });
  };

  const paymentReference = (item as RentScheduleWithDetails & { payment_reference?: string | null }).payment_reference;

  return (
    <div className="container py-6 space-y-6 max-w-3xl">
      {/* Back button & header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/rent')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Payment Detail</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>
          {paymentReference && (
            <p className="text-sm text-muted-foreground">Ref: {paymentReference}</p>
          )}
        </div>
      </div>

      {/* Overdue alert */}
      {isOverdue && item.status !== 'overdue' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>This payment appears to be overdue</AlertTitle>
          <AlertDescription>
            This payment is {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} past due but hasn't been confirmed as overdue. You can:
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Send the tenant a reminder</li>
              <li>Mark it as overdue</li>
              <li>Record a payment</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Tenant & property info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tenant & Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tenant</p>
              <p className="font-medium">{display.tenantName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Property</p>
              <p className="font-medium">{propertyAddress}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {display.tenantEmail && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${display.tenantEmail}`} className="text-sm text-primary hover:underline">{display.tenantEmail}</a>
              </div>
            )}
            {display.tenantPhone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a href={`tel:${display.tenantPhone}`} className="text-sm text-primary hover:underline">{display.tenantPhone}</a>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Room</p>
            <p className="font-medium">{display.roomName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{format(dueDate, 'dd MMM yyyy')}</p>
              {isOverdue && (
                <p className="text-xs text-red-600 font-medium">
                  {weeksOverdue > 0 ? `${weeksOverdue} week${weeksOverdue !== 1 ? 's' : ''} overdue` : `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-xl font-bold">£{(item.rent_amount + item.additional_charges).toLocaleString()}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Rent Period</p>
              <p className="font-medium">{format(new Date(item.period_start), 'dd MMM yyyy')} — {format(new Date(item.period_end), 'dd MMM yyyy')}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Rent</p>
              <p className="font-medium">£{item.rent_amount.toLocaleString()}</p>
            </div>
            {item.additional_charges > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Additional Charges</p>
                <p className="font-medium">£{item.additional_charges.toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="font-medium text-green-600">£{item.amount_paid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className={`font-bold ${item.amount_outstanding > 0 ? 'text-red-600' : ''}`}>
                £{item.amount_outstanding.toLocaleString()}
              </p>
            </div>
          </div>
          {item.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{item.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.status !== 'paid' && item.status !== 'bad_debt' && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleMarkPaid} disabled={updateStatus.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark £{item.amount_outstanding.toLocaleString()} Paid
              </Button>
              <Button variant="secondary" onClick={() => setShowRecordPayment(true)}>
                <PoundSterling className="h-4 w-4 mr-2" />
                Log Payment
              </Button>
              <Button variant="outline" onClick={() => setShowSendReminder(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
              {item.status !== 'overdue' && isOverdue && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Mark Overdue
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mark payment as overdue?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the payment of £{item.amount_outstanding.toLocaleString()} from {display.tenantName} as overdue.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMarkOverdue}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {/* Bad Debt */}
          {item.status !== 'paid' && item.status !== 'bad_debt' && (
            <div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Ban className="h-4 w-4 mr-2" />
                    Set as Bad Debt
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark as bad debt?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will write off £{item.amount_outstanding.toLocaleString()} from {display.tenantName} as bad debt. This action can be reversed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleMarkBadDebt} className="bg-destructive hover:bg-destructive/90">
                      Confirm Bad Debt
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {item.status === 'bad_debt' && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <Ban className="h-4 w-4" />
              This payment has been written off as bad debt.
            </p>
          )}

          {item.status === 'paid' && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              This payment has been fully paid.
            </p>
          )}

          {/* Secondary actions */}
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicateSchedule.isPending}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to New
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this rent schedule item. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Reminder history */}
      {reminders && reminders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reminder History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <Badge variant="outline" className="mr-2">
                      {r.reminder_type === 'pre_due' ? 'Pre-Due' : r.reminder_type === 'due_date' ? 'Due Date' : 'Overdue'}
                    </Badge>
                    <span className="text-muted-foreground">to {r.recipient_email}</span>
                  </div>
                  <span className="text-muted-foreground">{format(new Date(r.sent_at), 'dd MMM yyyy HH:mm')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <RecordPaymentDialog
        item={showRecordPayment ? item : null}
        open={showRecordPayment}
        onOpenChange={setShowRecordPayment}
      />
      <SendReminderDialog
        item={showSendReminder ? item : null}
        open={showSendReminder}
        onOpenChange={setShowSendReminder}
      />
    </div>
  );
}
