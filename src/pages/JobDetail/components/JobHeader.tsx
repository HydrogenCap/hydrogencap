import { ArrowLeft, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { JOB_PRIORITIES } from '@/hooks/useContractorJobs';
import { STATUS_CONFIG } from '../utils/jobConfig';

interface Props {
  job: {
    job_type: string;
    status: string;
    priority: string;
    source?: string;
    compliance_item?: { expiry_date?: string | null } | null;
  };
  onBack: () => void;
}

export function JobHeader({ job, onBack }: Props) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
  const priorityConfig = JOB_PRIORITIES.find(p => p.value === job.priority);
  const daysUntilExpiry = job.compliance_item?.expiry_date
    ? Math.ceil((new Date(job.compliance_item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex items-start justify-between">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Jobs
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{job.job_type}</h1>
          <Badge className={cn('text-sm', config.color)}>{config.label}</Badge>
          {job.priority !== 'normal' && (
            <Badge className={cn('text-sm', priorityConfig?.color)}>
              {job.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {priorityConfig?.label}
            </Badge>
          )}
          {job.source === 'auto_compliance' && (
            <Badge variant="outline" className="text-sm">
              <Zap className="h-3 w-3 mr-1" />
              Auto-created
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">{config.description}</p>
        {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
          <p className={cn(
            "text-sm mt-2",
            daysUntilExpiry <= 14 ? "text-red-600 dark:text-red-400" :
            daysUntilExpiry <= 30 ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          )}>
            Compliance expires in {daysUntilExpiry} days
          </p>
        )}
      </div>
    </div>
  );
}
