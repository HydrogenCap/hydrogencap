import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Calendar, Clock, User, AlertTriangle, Building2, Zap, Ellipsis
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  ContractorJob, 
  JOB_PRIORITIES,
  JobStatus,
  useUpdateJob,
  useSendJobRequest,
  useCancelJob 
} from '@/hooks/useContractorJobs';
import { cn } from '@/lib/utils';
import { AssignContractorDialog } from './AssignContractorDialog';

// Pipeline stages - excluding cancelled (shown separately)
const PIPELINE_STAGES: { value: JobStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'draft', label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800' },
  { value: 'requested', label: 'Requested', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'quoted', label: 'Quoted', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  { value: 'accepted', label: 'Accepted', color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { value: 'booked', label: 'Booked', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'in_progress', label: 'In Progress', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'verified', label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
];

interface JobsPipelineProps {
  jobs: ContractorJob[] | undefined;
  isLoading: boolean;
  searchTerm?: string;
}

export function JobsPipeline({ jobs, isLoading, searchTerm }: JobsPipelineProps) {
  // Group jobs by status
  const groupedJobs = useMemo(() => {
    const filtered = jobs?.filter(job => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        job.job_type.toLowerCase().includes(search) ||
        job.property?.address_line?.toLowerCase().includes(search) ||
        job.contractor?.name?.toLowerCase().includes(search)
      );
    }) || [];

    const grouped: Record<JobStatus, ContractorJob[]> = {} as Record<JobStatus, ContractorJob[]>;
    PIPELINE_STAGES.forEach(stage => {
      grouped[stage.value] = filtered.filter(j => j.status === stage.value);
    });
    return grouped;
  }, [jobs, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.slice(0, 6).map(stage => (
          <div key={stage.value} className="w-72 shrink-0">
            <div className="h-8 bg-muted rounded mb-3 animate-pulse" />
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-32 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4 min-h-[500px]">
        {PIPELINE_STAGES.map(stage => {
          const stageJobs = groupedJobs[stage.value] || [];
          
          return (
            <div key={stage.value} className="w-72 shrink-0 flex flex-col">
              {/* Column Header */}
              <div className={cn(
                "flex items-center justify-between mb-3 p-2 rounded-lg",
                stage.bgColor
              )}>
                <h3 className={cn("font-medium text-sm", stage.color)}>
                  {stage.label}
                </h3>
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {stageJobs.length}
                </Badge>
              </div>

              {/* Column Content */}
              <ScrollArea className="flex-1 h-[calc(100vh-350px)]">
                <div className="space-y-3 pr-2">
                  {stageJobs.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-sm">
                      No jobs
                    </div>
                  ) : (
                    stageJobs.map(job => (
                      <PipelineJobCard key={job.id} job={job} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// Compact job card for pipeline view
function PipelineJobCard({ job }: { job: ContractorJob }) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const updateJob = useUpdateJob();
  const sendRequest = useSendJobRequest();
  const cancelJob = useCancelJob();

  const priorityConfig = JOB_PRIORITIES.find(p => p.value === job.priority);

  // Calculate days until expiry if compliance linked
  const daysUntilExpiry = job.compliance_item?.expiry_date
    ? Math.ceil((new Date(job.compliance_item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleMoveToNextStage = () => {
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.value === job.status);
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const nextStatus = PIPELINE_STAGES[currentIndex + 1].value;
      updateJob.mutate({ 
        id: job.id, 
        status: nextStatus,
        ...(nextStatus === 'requested' ? { requested_at: new Date().toISOString() } : {}),
        ...(nextStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      });
    }
  };

  return (
    <>
      <Card className={cn(
        "hover:shadow-md transition-shadow group",
        job.priority === 'urgent' && "border-red-200 dark:border-red-900/50",
        job.priority === 'high' && "border-amber-200 dark:border-amber-900/50"
      )}>
        <CardContent className="p-3">
          {/* Header with priority and actions */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1 flex-wrap">
              {job.priority !== 'normal' && (
                <Badge className={cn("text-xs py-0 h-5", priorityConfig?.color)}>
                  {job.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                  {priorityConfig?.label}
                </Badge>
              )}
              {job.source === 'auto_compliance' && (
                <Badge variant="outline" className="text-xs py-0 h-5">
                  <Zap className="h-3 w-3" />
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Ellipsis" 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/jobs/${job.id}`}>View Details</Link>
                </DropdownMenuItem>
                {job.status === 'draft' && !job.contractor_id && (
                  <DropdownMenuItem onClick={() => setShowAssignDialog(true)}>
                    Assign Contractor
                  </DropdownMenuItem>
                )}
                {job.status === 'draft' && job.contractor_id && (
                  <DropdownMenuItem onClick={() => sendRequest.mutate({ jobId: job.id })}>
                    Send Request
                  </DropdownMenuItem>
                )}
                {job.status !== 'verified' && job.status !== 'completed' && (
                  <DropdownMenuItem onClick={handleMoveToNextStage}>
                    Move to Next Stage
                  </DropdownMenuItem>
                )}
                {['draft', 'requested'].includes(job.status) && (
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => cancelJob.mutate({ jobId: job.id })}
                  >
                    Cancel Job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Job Type */}
          <Link to={`/jobs/${job.id}`} className="block">
            <h4 className="font-medium text-sm truncate hover:underline mb-1">
              {job.job_type}
            </h4>

            {/* Property */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.property?.address_line?.split(',')[0]}</span>
            </div>

            {/* Contractor */}
            <div className="flex items-center gap-1.5 text-xs mb-2">
              <User className="h-3 w-3 shrink-0 text-muted-foreground" />
              {job.contractor ? (
                <span className="truncate text-muted-foreground">{job.contractor.name}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Unassigned</span>
              )}
            </div>

            {/* Expiry Warning */}
            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
              <div className={cn(
                "flex items-center gap-1 text-xs p-1.5 rounded",
                daysUntilExpiry <= 14 ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}>
                <Clock className="h-3 w-3" />
                {daysUntilExpiry <= 0 ? 'Expired!' : `${daysUntilExpiry}d to expiry`}
              </div>
            )}

            {/* Booked Date */}
            {job.booked_date && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(job.booked_date), 'dd MMM')}
              </div>
            )}

            {/* Certificate Status (for completed jobs) */}
            {job.status === 'completed' && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-2 p-1.5 rounded",
                job.certificate_received 
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}>
                {job.certificate_received ? '✓ Certificate received' : '⏳ Awaiting certificate'}
              </div>
            )}
          </Link>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
            {job.quoted_amount_gbp && (
              <span className="font-medium">£{job.quoted_amount_gbp.toLocaleString()}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <AssignContractorDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        job={job}
      />
    </>
  );
}
