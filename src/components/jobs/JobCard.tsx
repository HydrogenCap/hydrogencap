 import React, { useState } from 'react';
 import { Link } from 'react-router-dom';
 import { format, formatDistanceToNow } from 'date-fns';
 import { 
   Calendar, Clock, User, Send, AlertTriangle, Building2, 
   ChevronRight, Zap, MoreVertical 
 } from 'lucide-react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { 
   DropdownMenu, 
   DropdownMenuContent, 
   DropdownMenuItem, 
   DropdownMenuTrigger 
 } from '@/components/ui/dropdown-menu';
 import { 
   ContractorJob, 
   JOB_STATUSES, 
   JOB_PRIORITIES,
   useSendJobRequest,
   useCancelJob 
 } from '@/hooks/useContractorJobs';
 import { cn } from '@/lib/utils';
 import { AssignContractorDialog } from './AssignContractorDialog';
 
 interface JobCardProps {
   job: ContractorJob;
 }
 
 export function JobCard({ job }: JobCardProps) {
   const [showAssignDialog, setShowAssignDialog] = useState(false);
   
   const sendRequest = useSendJobRequest();
   const cancelJob = useCancelJob();
 
   const statusConfig = JOB_STATUSES.find(s => s.value === job.status);
   const priorityConfig = JOB_PRIORITIES.find(p => p.value === job.priority);
 
   // Calculate days until expiry if compliance linked
   const daysUntilExpiry = job.compliance_item?.expiry_date
     ? Math.ceil((new Date(job.compliance_item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
     : null;
 
   const handleSendRequest = () => {
     if (job.contractor_id) {
       sendRequest.mutate({ jobId: job.id });
     }
   };
 
   return (
     <>
      <Link to={`/jobs/${job.id}`} className="block">
        <Card className={cn(
          "hover:shadow-md transition-shadow cursor-pointer",
          job.priority === 'urgent' && "border-red-200 dark:border-red-900/50",
          job.priority === 'high' && "border-amber-200 dark:border-amber-900/50"
        )}>
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={cn("text-xs", statusConfig?.color)}>
                    {statusConfig?.label}
                   </Badge>
                  {job.priority !== 'normal' && (
                    <Badge className={cn("text-xs", priorityConfig?.color)}>
                      {job.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {priorityConfig?.label}
                    </Badge>
                  )}
                  {job.source === 'auto_compliance' && (
                    <Badge variant="outline" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Auto
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium text-sm truncate">{job.job_type}</h3>
               </div>
 
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/jobs/${job.id}`}>View Details</Link>
                  </DropdownMenuItem>
                  {job.status === 'draft' && !job.contractor_id && (
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); setShowAssignDialog(true); }}>
                      Assign Contractor
                    </DropdownMenuItem>
                  )}
                  {job.status === 'draft' && job.contractor_id && (
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleSendRequest(); }}>
                      Send Request
                    </DropdownMenuItem>
                  )}
                  {['draft', 'requested'].includes(job.status) && (
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={(e) => { e.preventDefault(); cancelJob.mutate({ jobId: job.id }); }}
                    >
                      Cancel Job
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
 
            {/* Property */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{job.property?.address_line?.split(',')[0]}</span>
            </div>
 
            {/* Contractor */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              {job.contractor ? (
                <span className="truncate">{job.contractor.name}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">No contractor assigned</span>
              )}
            </div>
 
            {/* Expiry Warning */}
            {daysUntilExpiry !== null && (
              <div className={cn(
                "flex items-center gap-2 text-xs p-2 rounded mb-3",
                daysUntilExpiry <= 14 ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                daysUntilExpiry <= 30 ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              )}>
                <Clock className="h-3 w-3" />
                {daysUntilExpiry <= 0 
                  ? 'Expired!' 
                  : `Expires in ${daysUntilExpiry} days`}
              </div>
            )}
 
            {/* Booked Date */}
            {job.booked_date && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                <Calendar className="h-4 w-4" />
                Booked: {format(new Date(job.booked_date), 'dd MMM yyyy')}
                {job.booked_time_slot && ` (${job.booked_time_slot})`}
              </div>
            )}
 
            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
              </span>
 
              <div className="flex items-center gap-2">
                {job.status === 'draft' && !job.contractor_id && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); setShowAssignDialog(true); }}>
                    <User className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                )}
                {job.status === 'draft' && job.contractor_id && (
                  <Button 
                    size="sm" 
                    onClick={(e) => { e.preventDefault(); handleSendRequest(); }}
                    disabled={sendRequest.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                )}
                {job.status !== 'draft' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
             </div>
          </CardContent>
        </Card>
      </Link>
 
       <AssignContractorDialog
         open={showAssignDialog}
         onOpenChange={setShowAssignDialog}
         job={job}
       />
     </>
   );
 }