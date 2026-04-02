import React from 'react';
import { Clock, AlertTriangle, CheckCircle, Timer, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type ContractorJob } from '@/hooks/useContractorJobs';
import { cn } from '@/lib/utils';

interface SLATrackerProps {
  jobs: ContractorJob[];
}

type SLAStatus = 'on_track' | 'at_risk' | 'breached';

interface SLAMetrics {
  job: ContractorJob;
  responseTimeHours: number | null;
  slaDeadlineHours: number;
  status: SLAStatus;
  percentUsed: number;
  awaabLawDeadline: Date | null;
  contractorAvgResponse: number | null;
}

const SLA_DEFAULTS: Record<string, number> = {
  urgent: 4,
  high: 24,
  normal: 72,
  low: 168, // 7 days
};

// Awaab's Law categories and their maximum response times in hours
const AWAAB_LAW_HOURS: Record<string, number> = {
  emergency: 24, // life-threatening hazards
  urgent_repair: 168, // 7 days for significant hazards
  standard_repair: 504, // 21 days for non-urgent
};

function calculateSLAMetrics(job: ContractorJob): SLAMetrics {
  const slaDeadlineHours = SLA_DEFAULTS[job.priority] || 72;

  let responseTimeHours: number | null = null;
  if (job.requested_at) {
    const requestedAt = new Date(job.requested_at);
    const respondedAt = job.accepted_at ? new Date(job.accepted_at) : new Date();
    responseTimeHours = (respondedAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
  }

  const percentUsed = responseTimeHours !== null
    ? Math.min(100, (responseTimeHours / slaDeadlineHours) * 100)
    : 0;

  let status: SLAStatus = 'on_track';
  if (responseTimeHours !== null) {
    if (responseTimeHours > slaDeadlineHours) {
      status = 'breached';
    } else if (percentUsed > 75) {
      status = 'at_risk';
    }
  }

  // Awaab's Law deadline — applies to maintenance-linked urgent/high jobs
  let awaabLawDeadline: Date | null = null;
  if (job.compliance_item && job.requested_at) {
    const requestedAt = new Date(job.requested_at);
    const hours = job.priority === 'urgent'
      ? AWAAB_LAW_HOURS.emergency
      : job.priority === 'high'
        ? AWAAB_LAW_HOURS.urgent_repair
        : AWAAB_LAW_HOURS.standard_repair;
    awaabLawDeadline = new Date(requestedAt.getTime() + hours * 60 * 60 * 1000);
  }

  return {
    job,
    responseTimeHours,
    slaDeadlineHours,
    status,
    percentUsed,
    awaabLawDeadline,
    contractorAvgResponse: null, // Could be enriched from contractor data
  };
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`;
}

const STATUS_CONFIG: Record<SLAStatus, { label: string; color: string; icon: React.ElementType; progressColor: string }> = {
  on_track: {
    label: 'On Track',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: CheckCircle,
    progressColor: '[&>div]:bg-emerald-500',
  },
  at_risk: {
    label: 'At Risk',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: AlertTriangle,
    progressColor: '[&>div]:bg-amber-500',
  },
  breached: {
    label: 'Breached',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: AlertTriangle,
    progressColor: '[&>div]:bg-red-500',
  },
};

export function SLATracker({ jobs }: SLATrackerProps) {
  const activeJobs = jobs.filter(
    (j) => !['completed', 'verified', 'cancelled', 'draft'].includes(j.status)
  );

  const metrics = activeJobs.map(calculateSLAMetrics);
  const breached = metrics.filter((m) => m.status === 'breached');
  const atRisk = metrics.filter((m) => m.status === 'at_risk');
  const onTrack = metrics.filter((m) => m.status === 'on_track');

  if (activeJobs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Timer className="h-4 w-4" />
            SLA Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active jobs to track.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Timer className="h-4 w-4" />
          SLA Tracking
          <div className="ml-auto flex items-center gap-2">
            {breached.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {breached.length} breached
              </Badge>
            )}
            {atRisk.length > 0 && (
              <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {atRisk.length} at risk
              </Badge>
            )}
            {onTrack.length > 0 && (
              <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {onTrack.length} on track
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Show breached first, then at risk, then on track */}
        {[...breached, ...atRisk, ...onTrack].slice(0, 10).map((m) => {
          const config = STATUS_CONFIG[m.status];
          const StatusIcon = config.icon;
          const address = m.job.property_v2
            ? `${m.job.property_v2.address_line_1}, ${m.job.property_v2.postcode}`
            : m.job.property
              ? `${m.job.property.address_line}, ${m.job.property.postcode}`
              : 'No property';

          return (
            <div key={m.job.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', m.status === 'breached' ? 'text-red-500' : m.status === 'at_risk' ? 'text-amber-500' : 'text-emerald-500')} />
                  <span className="font-medium truncate">{m.job.job_type}</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">{address}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.responseTimeHours !== null && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground">
                            {formatHours(m.responseTimeHours)} / {formatHours(m.slaDeadlineHours)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Response time vs SLA deadline
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge className={cn('text-[10px] px-1.5', config.color)}>
                    {config.label}
                  </Badge>
                </div>
              </div>
              <Progress value={m.percentUsed} className={cn('h-1.5', config.progressColor)} />
              {m.awaabLawDeadline && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  Awaab&apos;s Law deadline: {m.awaabLawDeadline.toLocaleDateString('en-GB')}{' '}
                  {m.awaabLawDeadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          );
        })}

        {metrics.length > 10 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{metrics.length - 10} more active jobs
          </p>
        )}
      </CardContent>
    </Card>
  );
}
