 import React from 'react';
 import { Link } from 'react-router-dom';
 import { Briefcase, Clock, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useContractorJobs } from '@/hooks/useContractorJobs';
 import { format, formatDistanceToNow } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
   draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Briefcase },
   requested: { label: 'Awaiting Quote', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock },
   quoted: { label: 'Quote Received', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: AlertCircle },
   accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', icon: CheckCircle },
   booked: { label: 'Booked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Calendar },
   in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: Briefcase },
   completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle },
   verified: { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
   cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: AlertCircle },
 };
 
 export function JobTrackerWidget() {
   const { data: jobs, isLoading } = useContractorJobs({
     status: ['requested', 'quoted', 'accepted', 'booked', 'in_progress'],
   });
 
   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Briefcase className="h-5 w-5" />
             Active Jobs
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-3">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
             ))}
           </div>
         </CardContent>
       </Card>
     );
   }
 
   if (!jobs?.length) {
     return (
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Briefcase className="h-5 w-5" />
             Active Jobs
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="text-center py-8 text-muted-foreground">
             <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
             <p>No active jobs</p>
             <p className="text-sm">Jobs you request will appear here.</p>
           </div>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <div>
             <CardTitle className="flex items-center gap-2">
               <Briefcase className="h-5 w-5" />
               Active Jobs
             </CardTitle>
             <CardDescription>{jobs.length} jobs in progress</CardDescription>
           </div>
           <Button variant="ghost" size="sm" asChild>
             <Link to="/contractors">View All</Link>
           </Button>
         </div>
       </CardHeader>
       <CardContent className="p-0">
         <ScrollArea className="h-[350px]">
           <div className="space-y-2 p-4 pt-0">
             {jobs.map(job => {
               const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
               const Icon = config.icon;
 
               return (
                 <Link
                   key={job.id}
                   to={`/properties/${job.property_id}?tab=compliance`}
                   className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                 >
                   <div className="flex items-start justify-between gap-3">
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <Badge className={cn('text-xs', config.color)}>
                           <Icon className="h-3 w-3 mr-1" />
                           {config.label}
                         </Badge>
                       </div>
                       <p className="font-medium text-sm truncate">{job.job_type}</p>
                       <p className="text-xs text-muted-foreground truncate">
                         {job.property?.address_line}
                       </p>
                       {job.contractor && (
                         <p className="text-xs text-muted-foreground mt-1">
                           {job.contractor.name}
                         </p>
                       )}
                     </div>
                     <div className="text-right shrink-0">
                       {job.booked_date ? (
                         <div>
                           <p className="text-sm font-medium">
                             {format(new Date(job.booked_date), 'dd MMM')}
                           </p>
                           <p className="text-xs text-muted-foreground">
                             {job.booked_time_slot || 'TBC'}
                           </p>
                         </div>
                       ) : (
                         <p className="text-xs text-muted-foreground">
                           {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                         </p>
                       )}
                     </div>
                   </div>
                 </Link>
               );
             })}
           </div>
         </ScrollArea>
       </CardContent>
     </Card>
   );
 }