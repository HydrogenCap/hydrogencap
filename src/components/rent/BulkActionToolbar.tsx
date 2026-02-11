import { CheckCircle2, Clock, Send, Ban, MessageSquare, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RentScheduleWithDetails } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface BulkActionToolbarProps {
  selectedItems: RentScheduleWithDetails[];
  selectedTotal: number;
  onMarkPaidOnTime: () => void;
  onMarkPaidLate: () => void;
  onSendReminder: () => void;
  onWriteOffBadDebt: () => void;
  onAddNote: () => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
  isProcessing: boolean;
}

export default function BulkActionToolbar({
  selectedItems,
  selectedTotal,
  onMarkPaidOnTime,
  onMarkPaidLate,
  onSendReminder,
  onWriteOffBadDebt,
  onAddNote,
  onExportSelected,
  onClearSelection,
  isProcessing,
}: BulkActionToolbarProps) {
  const hasUnpaid = selectedItems.some(i => i.status !== 'paid' && i.status !== 'bad_debt');
  const hasOverdueOrDue = selectedItems.some(i => i.status === 'overdue' || i.status === 'due' || i.status === 'partial');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Left: selection info */}
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">
              ✓ {selectedItems.length} selected
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-bold text-lg">{fmt(selectedTotal)}</span>
          </div>

          {/* Center: action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={onMarkPaidOnTime}
              disabled={!hasUnpaid || isProcessing}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Paid on time
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onMarkPaidLate}
              disabled={!hasUnpaid || isProcessing}
            >
              <Clock className="h-4 w-4 mr-1" />
              Paid late
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onSendReminder}
              disabled={!hasOverdueOrDue || isProcessing}
            >
              <Send className="h-4 w-4 mr-1" />
              Send reminder
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onWriteOffBadDebt}
              disabled={!hasOverdueOrDue || isProcessing}
            >
              <Ban className="h-4 w-4 mr-1" />
              Write off
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onAddNote}
              disabled={isProcessing}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Add note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onExportSelected}
              disabled={isProcessing}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>

          {/* Right: clear */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
