import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BookDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  bookingTime: string;
  setBookingTime: (v: string) => void;
  handleBookJob: () => void;
  isPending: boolean;
}

export function BookDialog(p: BookDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Job</DialogTitle>
          <DialogDescription>Schedule a date for this work</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" value={p.bookingDate} onChange={(e) => p.setBookingDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Time Slot</Label>
            <Input
              value={p.bookingTime}
              onChange={(e) => p.setBookingTime(e.target.value)}
              placeholder="e.g., Morning, 9am-12pm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancel</Button>
          <Button onClick={p.handleBookJob} disabled={!p.bookingDate || p.isPending}>
            {p.isPending ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CompleteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  finalAmount: string;
  setFinalAmount: (v: string) => void;
  completionNotes: string;
  setCompletionNotes: (v: string) => void;
  handleCompleteJob: () => void;
  isPending: boolean;
  quotedAmountPlaceholder: string;
}

export function CompleteDialog(p: CompleteDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Job Complete</DialogTitle>
          <DialogDescription>Record completion details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Final Amount (£)</Label>
            <Input
              type="number"
              value={p.finalAmount}
              onChange={(e) => p.setFinalAmount(e.target.value)}
              placeholder={p.quotedAmountPlaceholder || 'Enter amount'}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={p.completionNotes}
              onChange={(e) => p.setCompletionNotes(e.target.value)}
              placeholder="Any notes about the work..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancel</Button>
          <Button onClick={p.handleCompleteJob} disabled={p.isPending}>
            {p.isPending ? 'Completing...' : 'Complete Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
