import { useState } from 'react';
import { Plus, Briefcase, Clock, Calendar, User, AlertTriangle, Search, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useContractorJobs,
  useJobCounts,
  useRunAutoJobCreation,
  JOB_PRIORITIES,
  JobStatus,
  JobPriority,
} from '@/hooks/useContractorJobs';
import { JobCard, CreateJobDialog, JobsPipeline, ViewModeToggle, type JobsViewMode } from '@/components/jobs';
import { cn } from '@/lib/utils';
import { ListState } from '@/components/ListState';
import { Briefcase as BriefcaseIcon } from 'lucide-react';

export default function JobsTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<JobsViewMode>('grid');

  const { data: counts } = useJobCounts();
  const runAutoJobs = useRunAutoJobCreation();

  const getStatusArray = (): JobStatus[] | undefined => {
    if (viewMode === 'pipeline') {
      return ['draft', 'requested', 'quoted', 'accepted', 'booked', 'in_progress', 'completed', 'verified'];
    }
    switch (statusFilter) {
      case 'draft': return ['draft'];
      case 'active': return ['requested', 'quoted', 'accepted', 'booked', 'in_progress'];
      case 'completed': return ['completed', 'verified'];
      case 'cancelled': return ['cancelled'];
      default: return undefined;
    }
  };

  const { data, isLoading } = useContractorJobs({
    status: getStatusArray(),
    priority: priorityFilter !== 'all' ? [priorityFilter as JobPriority] : undefined,
  });

  const jobs = data?.items;

  const filteredJobs = jobs?.filter(job => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      job.job_type.toLowerCase().includes(search) ||
      job.property?.address_line?.toLowerCase().includes(search) ||
      job.contractor?.name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => runAutoJobs.mutate()} disabled={runAutoJobs.isPending}>
          <Zap className="h-4 w-4 mr-2" />
          Run Auto-Jobs
        </Button>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('draft')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Contractor</p>
                <p className="text-2xl font-bold">{counts?.needsContractor || 0}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('active')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Awaiting Response</p>
                <p className="text-2xl font-bold">{counts?.awaitingResponse || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('active')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Booked</p>
                <p className="text-2xl font-bold">{counts?.booked || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer hover:bg-muted/50 transition-colors",
            (counts?.urgent || 0) > 0 && "border-destructive/30 bg-destructive/5"
          )}
          onClick={() => setPriorityFilter('urgent')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className={cn("text-2xl font-bold", (counts?.urgent || 0) > 0 && "text-destructive")}>{counts?.urgent || 0}</p>
              </div>
              <AlertTriangle className={cn("h-8 w-8", (counts?.urgent || 0) > 0 ? "text-destructive/50" : "text-muted-foreground/30")} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer hover:bg-muted/50 transition-colors",
            (counts?.high || 0) > 0 && "border-amber-500/30 bg-amber-500/5"
          )}
          onClick={() => setPriorityFilter('high')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className={cn("text-2xl font-bold", (counts?.high || 0) > 0 && "text-amber-600 dark:text-amber-400")}>{counts?.high || 0}</p>
              </div>
              <AlertTriangle className={cn("h-8 w-8", (counts?.high || 0) > 0 ? "text-amber-500/50" : "text-muted-foreground/30")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {JOB_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Content */}
      {viewMode === 'pipeline' ? (
        <JobsPipeline jobs={jobs} isLoading={isLoading} searchTerm={searchTerm} />
      ) : (
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="draft">Draft {(counts?.draft || 0) > 0 && <Badge variant="secondary" className="ml-2">{counts?.draft}</Badge>}</TabsTrigger>
            <TabsTrigger value="active">Active {((counts?.total || 0) - (counts?.draft || 0)) > 0 && <Badge variant="secondary" className="ml-2">{(counts?.total || 0) - (counts?.draft || 0)}</Badge>}</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          <TabsContent value={statusFilter} className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
              </div>
            ) : filteredJobs?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-medium mb-1">No jobs found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {statusFilter === 'draft' ? 'Jobs will appear here automatically when compliance items are 90 days from expiry.' : 'No jobs match your current filters.'}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Create Job</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredJobs?.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <CreateJobDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
