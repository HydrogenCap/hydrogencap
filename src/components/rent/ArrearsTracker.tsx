import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Send, PoundSterling, CheckCircle2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';
import { useRentArrears, type ArrearsEntry } from '@/hooks/useRentManagement';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import SendReminderDialog from '@/components/rent/SendReminderDialog';
import { ListState } from '@/components/ListState';
import { exportArrearsCSV } from '@/lib/rentCsvExporter';


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

  const summary = useMemo(() => {
    if (!arrears) return { count: 0, owed: 0, critical: 0 };
    const all = [...arrears['7+'], ...arrears['30+'], ...arrears['60+'], ...arrears['90+']];
    return {
      count: all.length,
      owed: all.reduce((s, e) => s + e.amountOwed, 0),
      critical: arrears['60+'].length + arrears['90+'].length,
    };
  }, [arrears]);

  const handleExport = () => {
    if (!arrears) return;
    const all = [...arrears['90+'], ...arrears['60+'], ...arrears['30+'], ...arrears['7+']];
    exportArrearsCSV(all.map(e => ({ ...e.scheduleItem, days_overdue: e.daysOverdue })));
  };

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
        {summary.count > 0 && (
          <Card>
            <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total outstanding</p>
                  <p className="text-lg font-bold text-destructive">{formatGBP(summary.owed)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tenants in arrears</p>
                  <p className="text-lg font-semibold">{summary.count}</p>
                </div>
                {summary.critical > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">60+ days</p>
                    <p className="text-lg font-semibold text-destructive">{summary.critical}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardContent>
          </Card>
        )}
        {groups.map(key => (
          <ArrearsGroup key={key} groupKey={key} entries={arrears![key]} />
        ))}
      </div>
    </ListState>
  );
}

