import { useState, useRef, useCallback } from 'react';
import {
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Printer,
  Download,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEADLINE_LABELS,
  type ChecklistItem,
  type ChecklistCategory,
  type ChecklistItemStatus,
} from '@/lib/tenancy-checklist';
import {
  useTenancyChecklist,
  useMarkChecklistItem,
  useUnmarkChecklistItem,
  useTenancyChecklistStats,
} from '@/hooks/useTenancyChecklist';

// ─── Status helpers ──────────────────────────────────────────

function StatusIcon({ status }: { status: ChecklistItemStatus }) {
  switch (status) {
    case 'done':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'overdue':
      return <X className="h-4 w-4 text-red-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-600" />;
  }
}

function StatusBadge({ status }: { status: ChecklistItemStatus }) {
  const styles: Record<ChecklistItemStatus, string> = {
    done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels: Record<ChecklistItemStatus, string> = {
    done: 'Complete',
    pending: 'Pending',
    overdue: 'Overdue',
  };
  return <Badge className={cn('text-xs font-medium', styles[status])}>{labels[status]}</Badge>;
}

// ─── Notes Dialog ────────────────────────────────────────────

function MarkCompleteDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
  onConfirm: (notes: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Complete</DialogTitle>
          <DialogDescription>
            Confirm this checklist item is done and add any supporting evidence or notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {item?.title}
          </p>
          <Textarea
            placeholder="Add notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Saving...' : 'Mark Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single checklist item row ───────────────────────────────

function ChecklistItemRow({
  item,
  tenancyId,
  orgId,
  onMarkComplete,
  onUnmark,
}: {
  item: ChecklistItem;
  tenancyId: string;
  orgId: string;
  onMarkComplete: (item: ChecklistItem) => void;
  onUnmark: (item: ChecklistItem) => void;
}) {
  const rowStyles: Record<ChecklistItemStatus, string> = {
    overdue: 'bg-destructive/10 border border-destructive/20',
    pending: 'bg-muted/30 border border-transparent',
    done: 'bg-muted/20 border border-transparent',
  };

  const handleCheck = (checked: boolean | 'indeterminate') => {
    if (checked === true && item.status !== 'done') {
      onMarkComplete(item);
    } else if (checked === false && item.status === 'done' && !item.auto_verified) {
      onUnmark(item);
    }
  };

  return (
    <div className={cn('flex items-start gap-3 py-3 px-4 rounded-lg', rowStyles[item.status])}>
      <Checkbox
        checked={item.status === 'done'}
        onCheckedChange={handleCheck}
        disabled={item.auto_verified}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'font-medium text-sm',
            item.status === 'done' && 'text-muted-foreground line-through',
          )}>
            {item.title}
          </span>
          {item.auto_verified && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                    <Sparkles className="h-3 w-3" />
                    Auto
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Auto-verified from existing compliance data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{DEADLINE_LABELS[item.deadline]}</span>
          {item.due_date && (
            <span>Due: {new Date(item.due_date).toLocaleDateString('en-GB')}</span>
          )}
          {item.notes && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {item.notes}
            </span>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-xs text-muted-foreground/70 hover:text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {item.legal_reference}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              <p className="text-xs">{item.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={item.status} />
        <StatusIcon status={item.status} />
      </div>
    </div>
  );
}

// ─── Category section ────────────────────────────────────────

function CategorySection({
  category,
  items,
  tenancyId,
  orgId,
  onMarkComplete,
  onUnmark,
}: {
  category: ChecklistCategory;
  items: ChecklistItem[];
  tenancyId: string;
  orgId: string;
  onMarkComplete: (item: ChecklistItem) => void;
  onUnmark: (item: ChecklistItem) => void;
}) {
  const hasIssues = items.some((i) => i.status === 'overdue' || i.status === 'pending');
  const [isOpen, setIsOpen] = useState(hasIssues);

  const completedCount = items.filter((i) => i.status === 'done').length;
  const issueCount = items.filter((i) => i.status === 'overdue').length;

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{CATEGORY_LABELS[category]}</span>
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {issueCount} overdue
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {completedCount}/{items.length} complete
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              tenancyId={tenancyId}
              orgId={orgId}
              onMarkComplete={onMarkComplete}
              onUnmark={onUnmark}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Print/Export ─────────────────────────────────────────────

function exportChecklistCSV(items: ChecklistItem[], tenancyId: string) {
  const headers = ['Item', 'Category', 'Status', 'Deadline', 'Due Date', 'Completed Date', 'Notes', 'Legal Reference'];
  const rows = items.map((item) => [
    item.title,
    CATEGORY_LABELS[item.category],
    item.status,
    DEADLINE_LABELS[item.deadline],
    item.due_date || '',
    item.completed_date || '',
    item.notes || '',
    item.legal_reference,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenancy-checklist-${tenancyId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ──────────────────────────────────────────

interface TenancyChecklistProps {
  tenancyId: string;
  orgId: string;
  compact?: boolean;
}

export function TenancyChecklist({ tenancyId, orgId, compact = false }: TenancyChecklistProps) {
  const { items, grouped, summary, isLoading } = useTenancyChecklist(tenancyId);
  const markItem = useMarkChecklistItem();
  const unmarkItem = useUnmarkChecklistItem();
  const printRef = useRef<HTMLDivElement>(null);

  const [dialogItem, setDialogItem] = useState<ChecklistItem | null>(null);

  const handleMarkComplete = useCallback((item: ChecklistItem) => {
    setDialogItem(item);
  }, []);

  const handleConfirmComplete = useCallback(
    (notes: string) => {
      if (!dialogItem) return;
      markItem.mutate({
        tenancyId,
        itemType: dialogItem.id,
        label: dialogItem.title,
        orgId,
        notes: notes || undefined,
      });
      setDialogItem(null);
    },
    [dialogItem, markItem, tenancyId, orgId],
  );

  const handleUnmark = useCallback(
    (item: ChecklistItem) => {
      unmarkItem.mutate({ tenancyId, itemType: item.id });
    },
    [unmarkItem, tenancyId],
  );

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenancy Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-3 w-full mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenancy Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            No checklist items generated for this tenancy.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Compact view for embedding in other pages
  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Tenancy Checklist
            </CardTitle>
            {summary.overdue > 0 && (
              <Badge variant="destructive">
                {summary.overdue} overdue
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-semibold">
                {summary.completed} of {summary.total} ({summary.completionRate}%)
              </span>
            </div>
            <Progress value={summary.completionRate} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
                <div className="font-bold text-green-700 dark:text-green-400">{summary.completed}</div>
                <div className="text-green-600 dark:text-green-500">Done</div>
              </div>
              <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/20">
                <div className="font-bold text-amber-700 dark:text-amber-400">{summary.pending}</div>
                <div className="text-amber-600 dark:text-amber-500">Pending</div>
              </div>
              <div className="p-2 rounded bg-red-100 dark:bg-red-900/20">
                <div className="font-bold text-red-700 dark:text-red-400">{summary.overdue}</div>
                <div className="text-red-600 dark:text-red-500">Overdue</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <>
      <Card ref={printRef}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Tenancy Compliance Checklist
              {summary.overdue > 0 && (
                <Badge variant="destructive">
                  {summary.overdue} overdue
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground mr-2">
                {summary.completed} of {summary.total} complete
              </div>
              <Progress value={summary.completionRate} className="w-24 h-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="print:hidden"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportChecklistCSV(items, tenancyId)}
                className="print:hidden"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {summary.completed}
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">Complete</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-center">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {summary.pending}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Pending</div>
            </div>
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-center">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {summary.overdue}
              </div>
              <div className="text-xs text-red-600 dark:text-red-500">Overdue</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {summary.completionRate}%
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-500">Score</div>
            </div>
          </div>

          {/* Categorized checklist */}
          <div className="space-y-4">
            {CATEGORY_ORDER.map((category) => (
              <CategorySection
                key={category}
                category={category}
                items={grouped[category]}
                tenancyId={tenancyId}
                orgId={orgId}
                onMarkComplete={handleMarkComplete}
                onUnmark={handleUnmark}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <MarkCompleteDialog
        open={!!dialogItem}
        onOpenChange={(open) => { if (!open) setDialogItem(null); }}
        item={dialogItem}
        onConfirm={handleConfirmComplete}
        isPending={markItem.isPending}
      />
    </>
  );
}

// ─── Summary Card for portfolio pages ────────────────────────

export function TenancyChecklistSummaryCard() {
  const { data: stats, isLoading } = useTenancyChecklistStats();

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  if (!stats || stats.totalTenancies === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Tenancy Checklist Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Portfolio Completion</span>
            <span className="font-semibold">{stats.overallCompletionRate}%</span>
          </div>
          <Progress value={stats.overallCompletionRate} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
              <div className="font-bold text-green-700 dark:text-green-400">{stats.fullyCompliant}</div>
              <div className="text-green-600 dark:text-green-500">Compliant</div>
            </div>
            <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/20">
              <div className="font-bold text-amber-700 dark:text-amber-400">{stats.partiallyCompliant}</div>
              <div className="text-amber-600 dark:text-amber-500">Partial</div>
            </div>
            <div className="p-2 rounded bg-red-100 dark:bg-red-900/20">
              <div className="font-bold text-red-700 dark:text-red-400">{stats.overdueItems}</div>
              <div className="text-red-600 dark:text-red-500">Overdue</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

