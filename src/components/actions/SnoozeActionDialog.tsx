import { useState } from 'react';
import { addWeeks, addMonths, format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSnoozeAction, getActionKey } from '@/hooks/useActionWorkflows';
import type { RiskItem } from '@/hooks/usePortfolioRisks';

type SnoozeDuration = '1w' | '2w' | '1m' | '3m' | 'custom';

const SNOOZE_DURATIONS: { value: SnoozeDuration; label: string }[] = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: 'custom', label: 'Custom date' },
];

const REASON_PRESETS = [
  'Waiting for contractor',
  'Tenant handling it',
  'Not urgent',
  'Awaiting documentation',
  'Under review',
];

function getSnoozeDate(duration: SnoozeDuration): Date {
  const now = new Date();
  switch (duration) {
    case '1w': return addWeeks(now, 1);
    case '2w': return addWeeks(now, 2);
    case '1m': return addMonths(now, 1);
    case '3m': return addMonths(now, 3);
    case 'custom': return addWeeks(now, 1);
  }
}

interface SnoozeActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: RiskItem | null;
}

export function SnoozeActionDialog({ open, onOpenChange, risk }: SnoozeActionDialogProps) {
  const [duration, setDuration] = useState<SnoozeDuration>('1w');
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [reasonPreset, setReasonPreset] = useState('');
  const [customReason, setCustomReason] = useState('');

  const snoozeMutation = useSnoozeAction();

  if (!risk) return null;

  const snoozeUntil = duration === 'custom' && customDate ? customDate : getSnoozeDate(duration);
  const reason = reasonPreset === 'custom' ? customReason : reasonPreset;

  const handleSubmit = () => {
    if (!reason.trim()) return;

    const { actionType, actionKey } = getActionKey(risk.id);
    snoozeMutation.mutate(
      {
        actionType,
        actionKey,
        snoozedUntil: snoozeUntil.toISOString(),
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setDuration('1w');
          setReasonPreset('');
          setCustomReason('');
          setCustomDate(undefined);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Snooze Action
          </DialogTitle>
          <DialogDescription>
            Hide this action temporarily. It will reappear when the snooze period expires.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 mb-2">
          <p className="text-sm font-medium">{risk.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{risk.message}</p>
        </div>

        <div className="space-y-4">
          {/* Duration selection */}
          <div className="space-y-2">
            <Label>Snooze for</Label>
            <div className="flex flex-wrap gap-2">
              {SNOOZE_DURATIONS.map(d => (
                <Button
                  key={d.value}
                  variant={duration === d.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date picker */}
          {duration === 'custom' && (
            <div className="space-y-2">
              <Label>Snooze until</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !customDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(date) => date < new Date()}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Will reappear on {format(snoozeUntil, 'dd MMM yyyy')}
          </p>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reasonPreset} onValueChange={setReasonPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_PRESETS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="custom">Custom reason...</SelectItem>
              </SelectContent>
            </Select>
            {reasonPreset === 'custom' && (
              <Input
                placeholder="Enter your reason..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || snoozeMutation.isPending}
          >
            {snoozeMutation.isPending ? 'Snoozing...' : 'Snooze'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
