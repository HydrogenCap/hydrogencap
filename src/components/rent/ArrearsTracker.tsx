import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Send, PoundSterling, Handshake, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';
import { useRentArrears, type ArrearsEntry } from '@/hooks/useRentManagement';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import SendReminderDialog from '@/components/rent/SendReminderDialog';
import { ListState } from '@/components/ListState';

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

const SEVERITY_CONFIG: Record<string, { label: string; severity: SeverityLevel; description: string }> = {
  '90+': { label: '90+ Days Overdue', severity: 'critical', description: 'Requires immediate legal/formal action' },
  '60+': { label: '60+ Days Overdue', severity: 'critical', description: 'Formal notice recommended' },
  '30+': { label: '30+ Days Overdue', severity: 'warning', description: 'Escalation may be needed' },
  '7+': { label: '7+ Days Overdue', severity: 'info', description: 'Follow up required' },
};

function ArrearsGroup({
  groupKey,
  entries,
}: {
  groupKey: string;
  entries: ArrearsEntry[];
}) {
  const [expanded, setExpanded] = useState(entries.length <= 5);
  const config = SEVERITY_CONFIG[groupKey];
  const severity = SEVERITY[config.severity];
  const totalOwed = entries.reduce((s, e) => s + e.amountOwed, 0);

  return (
    <Card className={`${severity.border} border`}>
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <CardTitle className={`text-sm font-semibold ${severity.text}`}>
                {config.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{entries.length} tenant{entries.length !== 1 ? 's' : ''}</Badge>
            <span className={`text-sm font-bold ${severity.text}`}>{formatGBP(totalOwed)}</span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          {entries.map((entry) => (
            <ArrearsEntryRow key={entry.scheduleItem.id} entry={entry} severity={config.severity} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ArrearsEntryRow({ entry, severity }: { entry: ArrearsEntry; severity: SeverityLevel }) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const severityClasses = SEVERITY[severity];

  return (
    <>
      <div className={`flex items-center justify-between p-3 rounded-lg border ${severityClasses.border} ${severityClasses.bg}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{entry.tenantName}</p>
          <p className="text-xs text-muted-foreground">
            {entry.roomName !== 'Whole Property' ? `${entry.roomName} · ` : ''}
            {entry.propertyAddress}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className={`text-sm font-bold ${severityClasses.text}`}>
              {formatGBP(entry.amountOwed)}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.daysOverdue} days overdue
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setReminderOpen(true)}
              title="Send formal notice"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setPaymentOpen(true)}
              title="Record partial payment"
            >
              <PoundSterling className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="Mark arrangement in place"
            >
              <Handshake className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <RecordPaymentDialog
        item={paymentOpen ? entry.scheduleItem : null}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
      <SendReminderDialog
        item={reminderOpen ? entry.scheduleItem : null}
        open={reminderOpen}
        onOpenChange={setReminderOpen}
      />
    </>
  );
}

export function ArrearsTracker() {
  const { data: arrears, isLoading, error, refetch } = useRentArrears();

  const groups = arrears
    ? (['90+', '60+', '30+', '7+'] as const).filter(key => arrears[key].length > 0)
    : [];

  return (
    <ListState
      isLoading={isLoading}
      error={(error as Error | null) ?? null}
      isEmpty={!isLoading && !!arrears && groups.length === 0}
      emptyTitle="No overdue rent"
      emptyDescription="All tenants are up to date — nothing to chase right now."
      emptyIcon={CheckCircle2}
      onRetry={() => refetch()}
    >
      <div className="space-y-4">
        {groups.map(key => (
          <ArrearsGroup key={key} groupKey={key} entries={arrears![key]} />
        ))}
      </div>
    </ListState>
  );
}
