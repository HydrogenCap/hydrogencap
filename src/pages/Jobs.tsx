 import React, { useState } from 'react';
 import { Link } from 'react-router-dom';
 import { Briefcase, Clock, Calendar, CheckCircle, AlertCircle, Filter, Search } from 'lucide-react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useContractorJobs } from '@/hooks/useContractorJobs';
 import { format, formatDistanceToNow } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
   draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Briefcase },
   requested: { label: 'Awaiting Quote', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
   quoted: { label: 'Quote Received', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: AlertCircle },
   accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: CheckCircle },
   booked: { label: 'Booked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Calendar },
   in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Briefcase },
   completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
   verified: { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
   cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
 };
 
 export default function Jobs() {
   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<string>('active');
   
   const activeStatuses = ['draft', 'requested', 'quoted', 'accepted', 'booked', 'in_progress'];
   const completedStatuses = ['completed', 'verified'];
   
   const { data: allJobs, isLoading } = useContractorJobs();
   
   const filteredJobs = allJobs?.filter(job => {
     const matchesSearch = searchTerm === '' || 
       job.job_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
       job.property?.address_line?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       job.contractor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
     
     const matchesStatus = statusFilter === 'all' ||
       (statusFilter === 'active' && activeStatuses.includes(job.status)) ||
       (statusFilter === 'completed' && completedStatuses.includes(job.status)) ||
       (statusFilter === 'cancelled' && job.status === 'cancelled') ||
       job.status === statusFilter;
     
     return matchesSearch && matchesStatus;
   }) || [];
 
   const activeCount = allJobs?.filter(j => activeStatuses.includes(j.status)).length || 0;
   const completedCount = allJobs?.filter(j => completedStatuses.includes(j.status)).length || 0;
 
   return (
     <AppLayout>
       <div className="space-y-6">
         {/* Header */}
         <div>
           <h1 className="text-2xl font-bold">Jobs</h1>
           <p className="text-muted-foreground">Track and manage contractor jobs</p>
         </div>
 
         {/* Stats */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <Card>
             <CardContent className="p-4">
               <div className="text-2xl font-bold">{activeCount}</div>
               <div className="text-sm text-muted-foreground">Active Jobs</div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="text-2xl font-bold">{completedCount}</div>
               <div className="text-sm text-muted-foreground">Completed</div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="text-2xl font-bold">
                 {allJobs?.filter(j => j.status === 'booked').length || 0}
               </div>
               <div className="text-sm text-muted-foreground">Booked</div>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-4">
               <div className="text-2xl font-bold">
                 {allJobs?.filter(j => j.status === 'requested').length || 0}
               </div>
               <div className="text-sm text-muted-foreground">Awaiting Quote</div>
             </CardContent>
           </Card>
         </div>
 
         {/* Filters */}
         <div className="flex items-center gap-4">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search jobs..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10"
             />
           </div>
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="w-48">
               <Filter className="h-4 w-4 mr-2" />
               <SelectValue placeholder="Filter by status" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Jobs</SelectItem>
               <SelectItem value="active">Active</SelectItem>
               <SelectItem value="completed">Completed</SelectItem>
               <SelectItem value="cancelled">Cancelled</SelectItem>
               <SelectItem value="requested">Awaiting Quote</SelectItem>
               <SelectItem value="booked">Booked</SelectItem>
             </SelectContent>
           </Select>
         </div>
 
         {/* Jobs List */}
         {isLoading ? (
           <div className="space-y-3">
             {[1, 2, 3, 4, 5].map(i => (
               <Card key={i} className="h-24 animate-pulse bg-muted" />
             ))}
           </div>
         ) : filteredJobs.length === 0 ? (
           <Card>
             <CardContent className="py-12 text-center">
               <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
               <h3 className="font-medium mb-1">No jobs found</h3>
               <p className="text-sm text-muted-foreground">
                 {searchTerm || statusFilter !== 'active'
                   ? 'Try adjusting your filters'
                   : 'Jobs you create will appear here'}
               </p>
             </CardContent>
           </Card>
         ) : (
           <div className="space-y-3">
             {filteredJobs.map(job => {
               const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
               const Icon = config.icon;
 
               return (
                 <Link key={job.id} to={`/jobs/${job.id}`}>
                   <Card className="hover:bg-muted/50 transition-colors">
                     <CardContent className="p-4">
                       <div className="flex items-start justify-between gap-4">
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <Badge className={cn('text-xs', config.color)}>
                               <Icon className="h-3 w-3 mr-1" />
                               {config.label}
                             </Badge>
                             {job.booked_date && (
                               <Badge variant="outline" className="text-xs">
                                 <Calendar className="h-3 w-3 mr-1" />
                                 {format(new Date(job.booked_date), 'dd MMM')}
                               </Badge>
                             )}
                           </div>
                           <h3 className="font-medium">{job.job_type}</h3>
                           <p className="text-sm text-muted-foreground truncate">
                             {job.property?.address_line}
                           </p>
                         </div>
                         <div className="text-right shrink-0">
                           {job.contractor && (
                             <p className="text-sm font-medium">{job.contractor.name}</p>
                           )}
                           <p className="text-xs text-muted-foreground">
                             {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                           </p>
                           {job.quoted_amount_gbp && (
                             <p className="text-sm font-medium text-primary mt-1">
                               £{job.quoted_amount_gbp}
                             </p>
                           )}
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 </Link>
               );
             })}
           </div>
         )}
       </div>
     </AppLayout>
   );
 }