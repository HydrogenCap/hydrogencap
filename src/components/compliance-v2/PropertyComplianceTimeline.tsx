import { useMemo } from 'react';
import { format } from 'date-fns';
import { useComplianceDocumentsV2 } from '@/hooks/useComplianceV2';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { ShieldCheck, FileText, AlertTriangle, CalendarClock, ExternalLink, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'issued' | 'expired' | 'superseded' | 'upcoming_expiry';
  docTypeLabel: string;
  title: string;
  description?: string;
  fileUrl?: string | null;
  isCurrent?: boolean;
}

/**
 * Per-property compliance timeline — vertical chronological view of every
 * certificate issued, superseded, and expired against this property.
 *
 * Designed to answer "when did we last test the alarms?" in 2 seconds.
 */
export function PropertyComplianceTimeline({
  propertyId,
  matrixRows,
}: {
  propertyId: string;
  matrixRows: ComplianceMatrixRow[];
}) {
  const { data: docs, isLoading } = useComplianceDocumentsV2(propertyId);

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Past + current document events
    for (const d of docs || []) {
      const docTypeLabel = DOC_TYPE_DISPLAY_NAMES[d.document_type] || d.document_type;
      if (d.issue_date) {
        out.push({
          id: `${d.id}:issued`,
          date: d.issue_date,
          type: 'issued',
          docTypeLabel,
          title: `${docTypeLabel} issued`,
          description: [d.issuer_name, d.certificate_number ? `Cert #${d.certificate_number}` : null]
            .filter(Boolean)
            .join(' · '),
          fileUrl: d.file_url,
          isCurrent: d.is_current,
        });
      }
      if (d.expiry_date && new Date(d.expiry_date) <= today && !d.is_current) {
        out.push({
          id: `${d.id}:expired`,
          date: d.expiry_date,
          type: 'expired',
          docTypeLabel,
          title: `${docTypeLabel} expired`,
          description: d.issuer_name || undefined,
        });
      }
    }

    // Upcoming expiries from the matrix
    for (const r of matrixRows) {
      if (r.is_required && r.expiry_date && r.days_remaining !== null && r.days_remaining > 0) {
        out.push({
          id: `${r.requirement_id}:upcoming`,
          date: r.expiry_date,
          type: 'upcoming_expiry',
          docTypeLabel: DOC_TYPE_DISPLAY_NAMES[r.document_type] || r.document_type,
          title: `${DOC_TYPE_DISPLAY_NAMES[r.document_type] || r.document_type} expires`,
          description: `${r.days_remaining} day${r.days_remaining === 1 ? '' : 's'} remaining`,
        });
      }
    }

    return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [docs, matrixRows]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No compliance history yet"
        description="Upload your first certificate to start building this property's compliance trail."
      />
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="relative pl-6">
          {/* Vertical guideline */}
          <span aria-hidden="true" className="absolute left-2 top-1 bottom-1 w-px bg-border" />
          <ol className="space-y-4">
            {events.map((e) => (
              <TimelineRow key={e.id} event={e} />
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const meta = (() => {
    switch (event.type) {
      case 'issued':
        return {
          Icon: ShieldCheck,
          dotClass: event.isCurrent ? 'bg-success border-success' : 'bg-muted border-border',
          label: event.isCurrent ? 'Current' : 'Historic',
          labelClass: event.isCurrent ? 'bg-success/15 text-success border-success/40' : 'bg-muted text-muted-foreground',
        };
      case 'expired':
        return {
          Icon: AlertTriangle,
          dotClass: 'bg-destructive border-destructive',
          label: 'Expired',
          labelClass: 'bg-destructive/15 text-destructive border-destructive/40',
        };
      case 'upcoming_expiry':
        return {
          Icon: CalendarClock,
          dotClass: 'bg-warning border-warning',
          label: 'Upcoming',
          labelClass: 'bg-warning/15 text-warning border-warning/40',
        };
      default:
        return {
          Icon: FileText,
          dotClass: 'bg-muted border-border',
          label: '',
          labelClass: 'bg-muted text-muted-foreground',
        };
    }
  })();

  const Icon = meta.Icon;
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[19px] top-1.5 h-3 w-3 rounded-full border-2 ring-2 ring-background',
          meta.dotClass,
        )}
      />
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{event.title}</span>
            {meta.label && (
              <Badge variant="outline" className={cn('text-[10px]', meta.labelClass)}>
                {meta.label}
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(new Date(event.date), 'dd MMM yyyy')}
          </p>
        </div>
        {event.fileUrl && (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <a href={event.fileUrl} target="_blank" rel="noreferrer noopener" aria-label="Open certificate">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
