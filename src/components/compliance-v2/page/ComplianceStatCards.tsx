import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';

interface ScoreLike {
  compliance_score_pct?: number;
  total_valid?: number;
  total_required?: number;
  total_expiring_soon?: number;
  total_critical?: number;
  total_expired?: number;
  total_missing?: number;
}

interface Props {
  isLoading: boolean;
  score: ScoreLike | undefined;
  nextExpiry: ComplianceMatrixRow | null;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  setViewMode: (v: 'matrix' | 'calendar') => void;
  onOpenRow: (row: ComplianceMatrixRow) => void;
}

export function ComplianceStatCards({ isLoading, score, nextExpiry, statusFilter, setStatusFilter, setViewMode, onOpenRow }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const pct = score?.compliance_score_pct ?? 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const ringColor = pct === 100 ? 'text-success' : pct >= 90 ? 'text-warning' : 'text-destructive';

  const expiring = score?.total_expiring_soon ?? 0;
  const critical = score?.total_critical ?? 0;
  const expired = score?.total_expired ?? 0;
  const missing = score?.total_missing ?? 0;
  const needsAttentionTotal = expiring + critical + expired + missing;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            Compliance Score
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="How the compliance score is calculated">
                  <Info className="h-3 w-3 text-muted-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                Percentage of required compliance items that are currently valid. Expired, missing, critical and expiring-soon items all reduce the score.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" className={ringColor} aria-hidden="true">
              <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
              <circle
                cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={c / 4}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
              />
            </svg>
            <div>
              <span className={cn('text-3xl font-bold leading-none', ringColor)}>{pct}%</span>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                {score?.total_valid ?? 0} of {score?.total_required ?? 0} required items valid
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => { setStatusFilter('needs_attention'); setViewMode('matrix'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('needs_attention'); setViewMode('matrix'); } }}
        aria-pressed={statusFilter === 'needs_attention'}
        className={cn(
          'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          statusFilter === 'needs_attention' && 'ring-2 ring-primary/40',
        )}
        title="Click to filter the matrix to items needing attention"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <span className={cn('text-3xl font-bold', needsAttentionTotal > 0 && 'text-destructive')}>
            {needsAttentionTotal}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
            <button
              type="button"
              className="hover:underline"
              onClick={(e) => { e.stopPropagation(); setStatusFilter('missing'); setViewMode('matrix'); }}
            >{missing} missing</button>
            {' · '}
            <button
              type="button"
              className="hover:underline"
              onClick={(e) => { e.stopPropagation(); setStatusFilter('expired'); setViewMode('matrix'); }}
            >{expired} expired</button>
            {' · '}{critical} critical · {expiring} expiring soon
          </p>
        </CardContent>
      </Card>

      <Card
        role={nextExpiry ? 'button' : undefined}
        tabIndex={nextExpiry ? 0 : undefined}
        onClick={() => { if (nextExpiry) onOpenRow(nextExpiry); }}
        onKeyDown={(e) => { if (nextExpiry && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenRow(nextExpiry); } }}
        className={cn(nextExpiry && 'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
        title={nextExpiry ? 'Click to open this compliance item' : undefined}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Next Expiry</CardTitle>
        </CardHeader>
        <CardContent>
          {nextExpiry ? (
            <div>
              <p className={cn('text-sm font-semibold', (nextExpiry.days_remaining ?? 0) < 30 ? 'text-destructive' : (nextExpiry.days_remaining ?? 0) <= 90 ? 'text-warning' : 'text-foreground')}>
                {nextExpiry.days_remaining}d — {DOC_TYPE_DISPLAY_NAMES[nextExpiry.document_type]}
              </p>
              <p className="text-xs text-muted-foreground truncate">{nextExpiry.property_address}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming expiries</p>
          )}
        </CardContent>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => { setStatusFilter('expired'); setViewMode('matrix'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('expired'); setViewMode('matrix'); } }}
        aria-pressed={statusFilter === 'expired'}
        className={cn(
          'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          (score?.total_expired ?? 0) > 0 && 'bg-destructive/5 border-destructive/30',
          statusFilter === 'expired' && 'ring-2 ring-primary/40',
        )}
        title="Click to filter the matrix to expired items"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Items</CardTitle>
        </CardHeader>
        <CardContent>
          <span className={cn('text-3xl font-bold', (score?.total_expired ?? 0) > 0 && 'text-destructive')}>
            {score?.total_expired ?? 0}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
            Past expiry date (excludes missing)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
