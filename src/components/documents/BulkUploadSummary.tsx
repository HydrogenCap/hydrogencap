import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  ArrowRight,
  MapPin,
  CalendarClock,
  CalendarX,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEVERITY } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import type { BulkUploadStats, QueueItem } from '@/hooks/useBulkDocumentUpload';
import {
  validateBatch,
  summariseIssues,
  type ValidationIssue,
  type ValidationSeverity,
} from '@/lib/documents/bulkValidation';

interface BulkUploadSummaryProps {
  stats: BulkUploadStats;
  /** Full queue — required to compute per-item validation issues. */
  items?: QueueItem[];
  onSendToReview: () => void;
  onDone: () => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  severity,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  severity: keyof typeof SEVERITY;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4',
        SEVERITY[severity].bg,
        SEVERITY[severity].border,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          SEVERITY[severity].bg,
        )}
      >
        <Icon className={cn('h-5 w-5', SEVERITY[severity].text)} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground truncate" title={hint || label}>
          {label}
        </p>
      </div>
    </div>
  );
}

function DocTypeGroup({ docType, count }: { docType: string; count: number }) {
  const label =
    docType === 'unclassified'
      ? 'Unclassified'
      : docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="secondary" className="tabular-nums">{count}</Badge>
    </div>
  );
}

const SEVERITY_META: Record<
  ValidationSeverity,
  { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }
> = {
  critical: {
    icon: XCircle,
    cls: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    cls: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
    label: 'Warning',
  },
  info: {
    icon: Info,
    cls: 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/30',
    label: 'Info',
  },
};

function ValidationIssuesPanel({ issues }: { issues: ValidationIssue[] }) {
  const [expanded, setExpanded] = useState(true);
  const counts = summariseIssues(issues);

  if (issues.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">No validation issues</p>
            <p className="text-xs text-muted-foreground">
              Everything parsed cleanly — you can approve in bulk.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by file so the same item collapses into a single row.
  const byFile = new Map<string, ValidationIssue[]>();
  for (const i of issues) {
    const arr = byFile.get(i.fileName) || [];
    arr.push(i);
    byFile.set(i.fileName, arr);
  }
  const rows = Array.from(byFile.entries()).sort((a, b) => {
    const rank = (g: ValidationIssue[]) =>
      g.some((i) => i.severity === 'critical') ? 0 : g.some((i) => i.severity === 'warning') ? 1 : 2;
    return rank(a[1]) - rank(b[1]);
  });

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Validation Issues</CardTitle>
          <div className="flex items-center gap-1 text-xs">
            {counts.critical > 0 && (
              <Badge variant="outline" className={SEVERITY_META.critical.cls}>
                {counts.critical} critical
              </Badge>
            )}
            {counts.warning > 0 && (
              <Badge variant="outline" className={SEVERITY_META.warning.cls}>
                {counts.warning} warning
              </Badge>
            )}
            {counts.info > 0 && (
              <Badge variant="outline" className={SEVERITY_META.info.cls}>
                {counts.info} info
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" aria-label={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <ul className="divide-y max-h-[320px] overflow-y-auto">
            {rows.map(([fileName, fileIssues]) => (
              <li key={fileName} className="py-2.5">
                <div className="text-sm font-medium truncate" title={fileName}>
                  {fileName}
                </div>
                <ul className="mt-1 space-y-1">
                  {fileIssues.map((i, idx) => {
                    const meta = SEVERITY_META[i.severity];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={`${i.code}-${idx}`}
                        className={cn(
                          'flex items-start gap-2 rounded border px-2 py-1 text-xs',
                          meta.cls,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="leading-snug">{i.message}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

export function BulkUploadSummary({ stats, items = [], onSendToReview, onDone }: BulkUploadSummaryProps) {
  const sortedTypes = Object.entries(stats.byDocType).sort(([, a], [, b]) => b - a);
  const issues = useMemo(() => validateBatch(items), [items]);

  return (
    <div className="space-y-6">
      {/* Primary outcome stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Classified" value={stats.classified} icon={CheckCircle2} severity="success" />
        <StatCard label="Extracted" value={stats.extracted} icon={FileText} severity="info" />
        <StatCard label="Needs Review" value={stats.needsReview} icon={Eye} severity="warning" />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={AlertTriangle}
          severity={stats.failed > 0 ? 'critical' : 'neutral'}
        />
      </div>

      {/* Validation depth stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={`Property matched (${stats.propertyMatched}/${stats.extracted || 0})`}
          value={stats.propertyMatched}
          icon={MapPin}
          severity={stats.propertyUnmatched > 0 ? 'warning' : 'success'}
          hint="Items linked to a property via folder, AI, or manual choice"
        />
        <StatCard
          label="Dates parsed"
          value={stats.datesParsed}
          icon={CalendarClock}
          severity={stats.datesParsed > 0 ? 'info' : 'neutral'}
          hint="Issue or expiry date found in filename or content"
        />
        <StatCard
          label="Expired certificates"
          value={stats.expiredCertificates}
          icon={CalendarX}
          severity={stats.expiredCertificates > 0 ? 'critical' : 'neutral'}
          hint="Expiry date is in the past"
        />
        <StatCard
          label="Low confidence fields"
          value={stats.lowConfidenceFields}
          icon={Info}
          severity={stats.lowConfidenceFields > 0 ? 'warning' : 'neutral'}
          hint="At least one extracted field is below 60% confidence"
        />
      </div>

      {/* Validation issues — only render the panel if we actually have queue items. */}
      {items.length > 0 && <ValidationIssuesPanel issues={issues} />}

      {/* Doc Type Breakdown */}
      {sortedTypes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Documents by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {sortedTypes.map(([docType, count]) => (
                <DocTypeGroup key={docType} docType={docType} count={count} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {stats.needsReview > 0 && (
          <Button variant="outline" onClick={onSendToReview} className="gap-2">
            <Eye className="h-4 w-4" />
            Send to Review Queue
            <Badge variant="secondary" className="ml-1">{stats.needsReview}</Badge>
          </Button>
        )}
        <Button onClick={onDone} className="gap-2">
          Done
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
