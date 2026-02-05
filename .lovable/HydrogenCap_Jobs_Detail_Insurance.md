# HydrogenCap Implementation Specification
## Jobs Page Detail View & Insurance Cost Tracking

Two enhancements:
1. **Jobs Page** - Add full job details view with status management
2. **Insurance Tracking** - Track insurance costs per property with renewal alerts

---

# Part 1: Jobs Page - Full Detail View

## The Problem

Current Jobs page shows:
- ✅ Job cards in grid layout
- ✅ Status badges
- ✅ Basic info (property, contractor)
- ❌ **No detail view when clicking a job**
- ❌ **No way to update status, add notes, record costs**

## Solution: Job Detail Page + Enhanced Job Cards

---

## New Page: /jobs/:jobId

### src/pages/JobDetail.tsx

```tsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Building2, User, Calendar, Clock, PoundSterling,
  Send, CheckCircle, XCircle, MessageSquare, FileText, Camera,
  AlertTriangle, Phone, Mail, MoreVertical, Loader2
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useContractorJob,
  useUpdateJob,
  useSendJobRequest,
  useCancelJob,
  JOB_STATUSES,
  JOB_PRIORITIES,
  JobStatus,
} from '@/hooks/useContractorJobs';
import { useJobNotes, useAddJobNote } from '@/hooks/useJobNotes';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { AssignContractorDialog } from '@/components/jobs/AssignContractorDialog';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  
  const { data: job, isLoading } = useContractorJob(jobId);
  const { data: notes } = useJobNotes(jobId);
  const updateJob = useUpdateJob();
  const sendRequest = useSendJobRequest();
  const cancelJob = useCancelJob();
  const addNote = useAddJobNote();

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Editable fields
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    quoted_amount_gbp: 0,
    final_amount_gbp: 0,
    booked_date: '',
    booked_time_slot: '',
    contractor_notes: '',
    internal_notes: '',
  });

  React.useEffect(() => {
    if (job) {
      setEditData({
        quoted_amount_gbp: job.quoted_amount_gbp || 0,
        final_amount_gbp: job.final_amount_gbp || 0,
        booked_date: job.booked_date || '',
        booked_time_slot: job.booked_time_slot || '',
        contractor_notes: job.contractor_notes || '',
        internal_notes: job.internal_notes || '',
      });
    }
  }, [job]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Job not found</h2>
          <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
        </div>
      </AppLayout>
    );
  }

  const statusConfig = JOB_STATUSES.find(s => s.value === job.status);
  const priorityConfig = JOB_PRIORITIES.find(p => p.value === job.priority);

  // Calculate days until compliance expiry
  const daysUntilExpiry = job.compliance_item?.expiry_date
    ? Math.ceil((new Date(job.compliance_item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleStatusChange = async (newStatus: JobStatus) => {
    setIsUpdating(true);
    try {
      await updateJob.mutateAsync({
        id: job.id,
        status: newStatus,
        ...(newStatus === 'requested' && { requested_at: new Date().toISOString() }),
        ...(newStatus === 'quoted' && { quoted_at: new Date().toISOString() }),
        ...(newStatus === 'completed' && { completed_at: new Date().toISOString() }),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveDetails = async () => {
    setIsUpdating(true);
    try {
      await updateJob.mutateAsync({
        id: job.id,
        ...editData,
      });
      setEditMode(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote.mutateAsync({
      jobId: job.id,
      note: newNote,
    });
    setNewNote('');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{job.job_type}</h1>
                <Badge className={cn(statusConfig?.color)}>{statusConfig?.label}</Badge>
                {job.priority !== 'normal' && (
                  <Badge className={cn(priorityConfig?.color)}>
                    {job.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {priorityConfig?.label}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {job.property?.address_line}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Actions */}
            {job.status === 'draft' && !job.contractor_id && (
              <Button onClick={() => setShowAssignDialog(true)}>
                <User className="h-4 w-4 mr-2" />
                Assign Contractor
              </Button>
            )}
            {job.status === 'draft' && job.contractor_id && (
              <Button onClick={() => sendRequest.mutate({ jobId: job.id })}>
                <Send className="h-4 w-4 mr-2" />
                Send Request
              </Button>
            )}
            {job.status === 'quoted' && (
              <Button onClick={() => handleStatusChange('accepted')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Quote
              </Button>
            )}
            {job.status === 'accepted' && (
              <Button onClick={() => handleStatusChange('booked')}>
                <Calendar className="h-4 w-4 mr-2" />
                Mark as Booked
              </Button>
            )}
            {job.status === 'booked' && (
              <Button onClick={() => handleStatusChange('in_progress')}>
                <Clock className="h-4 w-4 mr-2" />
                Start Work
              </Button>
            )}
            {job.status === 'in_progress' && (
              <Button onClick={() => handleStatusChange('completed')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditMode(true)}>
                  Edit Details
                </DropdownMenuItem>
                {job.contractor_id && (
                  <DropdownMenuItem onClick={() => setShowAssignDialog(true)}>
                    Change Contractor
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {!['completed', 'verified', 'cancelled'].includes(job.status) && (
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => cancelJob.mutate({ jobId: job.id })}
                  >
                    Cancel Job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Compliance Expiry Warning */}
        {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
          <Card className={cn(
            "border-l-4",
            daysUntilExpiry <= 0 ? "border-l-red-500 bg-red-50" :
            daysUntilExpiry <= 14 ? "border-l-amber-500 bg-amber-50" :
            "border-l-blue-500 bg-blue-50"
          )}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  daysUntilExpiry <= 0 ? "text-red-600" :
                  daysUntilExpiry <= 14 ? "text-amber-600" :
                  "text-blue-600"
                )} />
                <span className="font-medium">
                  {daysUntilExpiry <= 0
                    ? `Compliance expired ${Math.abs(daysUntilExpiry)} days ago!`
                    : `Compliance expires in ${daysUntilExpiry} days`
                  }
                </span>
                <span className="text-muted-foreground">
                  ({job.compliance_item?.compliance_type} - {format(new Date(job.compliance_item!.expiry_date!), 'dd MMM yyyy')})
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                {job.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="mt-1">{job.description}</p>
                  </div>
                )}

                {/* Request Message */}
                {job.request_message && (
                  <div>
                    <Label className="text-muted-foreground">Request Message</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg">{job.request_message}</p>
                  </div>
                )}

                <Separator />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  {job.requested_at && (
                    <div>
                      <Label className="text-muted-foreground">Requested</Label>
                      <p className="mt-1">{format(new Date(job.requested_at), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                  )}
                  {job.quoted_at && (
                    <div>
                      <Label className="text-muted-foreground">Quoted</Label>
                      <p className="mt-1">{format(new Date(job.quoted_at), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                  )}
                  {job.booked_date && (
                    <div>
                      <Label className="text-muted-foreground">Booked Date</Label>
                      <p className="mt-1">
                        {format(new Date(job.booked_date), 'dd MMM yyyy')}
                        {job.booked_time_slot && ` (${job.booked_time_slot})`}
                      </p>
                    </div>
                  )}
                  {job.completed_at && (
                    <div>
                      <Label className="text-muted-foreground">Completed</Label>
                      <p className="mt-1">{format(new Date(job.completed_at), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Costs */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Quoted Amount</Label>
                    {editMode ? (
                      <Input
                        type="number"
                        value={editData.quoted_amount_gbp}
                        onChange={(e) => setEditData({ ...editData, quoted_amount_gbp: Number(e.target.value) })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1 text-lg font-semibold">
                        {job.quoted_amount_gbp ? formatGBP(job.quoted_amount_gbp) : '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Final Amount</Label>
                    {editMode ? (
                      <Input
                        type="number"
                        value={editData.final_amount_gbp}
                        onChange={(e) => setEditData({ ...editData, final_amount_gbp: Number(e.target.value) })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1 text-lg font-semibold">
                        {job.final_amount_gbp ? formatGBP(job.final_amount_gbp) : '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Payment Status</Label>
                    <p className="mt-1">
                      <Badge variant={job.payment_status === 'paid' ? 'default' : 'secondary'}>
                        {job.payment_status}
                      </Badge>
                    </p>
                  </div>
                </div>

                {editMode && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Booked Date</Label>
                        <Input
                          type="date"
                          value={editData.booked_date}
                          onChange={(e) => setEditData({ ...editData, booked_date: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Time Slot</Label>
                        <Select
                          value={editData.booked_time_slot}
                          onValueChange={(v) => setEditData({ ...editData, booked_time_slot: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select time..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning (8am-12pm)</SelectItem>
                            <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                            <SelectItem value="all_day">All Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Internal Notes</Label>
                      <Textarea
                        value={editData.internal_notes}
                        onChange={(e) => setEditData({ ...editData, internal_notes: e.target.value })}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveDetails} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Notes & Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Notes & Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add Note */}
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button onClick={handleAddNote} disabled={!newNote.trim() || addNote.isPending}>
                    Add
                  </Button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {notes?.map(note => (
                    <div key={note.id} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                  ))}
                  {(!notes || notes.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notes yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Quotes, invoices, certificates</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentsPanel
                  jobId={job.id}
                  entityType="job"
                  compact
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/properties/${job.property_id}`}
                  className="font-medium hover:underline"
                >
                  {job.property?.address_line}
                </Link>
                <p className="text-sm text-muted-foreground">{job.property?.postcode}</p>
              </CardContent>
            </Card>

            {/* Contractor Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contractor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.contractor ? (
                  <div className="space-y-2">
                    <p className="font-medium">{job.contractor.name}</p>
                    {job.contractor.company_name && (
                      <p className="text-sm text-muted-foreground">{job.contractor.company_name}</p>
                    )}
                    {job.contractor.phone && (
                      <a
                        href={`tel:${job.contractor.phone}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {job.contractor.phone}
                      </a>
                    )}
                    {job.contractor.email && (
                      <a
                        href={`mailto:${job.contractor.email}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {job.contractor.email}
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setShowAssignDialog(true)}
                    >
                      Change Contractor
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground mb-2">No contractor assigned</p>
                    <Button size="sm" onClick={() => setShowAssignDialog(true)}>
                      Assign Contractor
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {job.completed_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Completed</span>
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(job.completed_at), 'dd MMM')}
                      </span>
                    </div>
                  )}
                  {job.booked_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Booked</span>
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(job.booked_date), 'dd MMM')}
                      </span>
                    </div>
                  )}
                  {job.quoted_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                      <span>Quoted</span>
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(job.quoted_at), 'dd MMM')}
                      </span>
                    </div>
                  )}
                  {job.requested_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span>Requested</span>
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(job.requested_at), 'dd MMM')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Created</span>
                    <span className="text-muted-foreground ml-auto">
                      {format(new Date(job.created_at), 'dd MMM')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AssignContractorDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        job={job}
      />
    </AppLayout>
  );
}
```

---

## Job Notes Hook

### src/hooks/useJobNotes.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface JobNote {
  id: string;
  job_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export function useJobNotes(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-notes', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_notes')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as JobNote[];
    },
    enabled: !!jobId,
  });
}

export function useAddJobNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, note }: { jobId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('job_notes')
        .insert({
          job_id: jobId,
          note,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-notes', variables.jobId] });
      toast({ title: 'Note added' });
    },
  });
}
```

---

## Database: Job Notes Table

```sql
-- Add job notes table
CREATE TABLE public.job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_notes_job ON public.job_notes(job_id);

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage job notes"
ON public.job_notes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contractor_jobs cj
    WHERE cj.id = job_id
    AND public.user_has_org_access(cj.org_id)
  )
);
```

---

## Update JobCard to Link to Detail

```tsx
// In JobCard.tsx, make the card clickable
<Link to={`/jobs/${job.id}`}>
  <Card className="hover:shadow-md transition-shadow cursor-pointer">
    {/* ... existing card content ... */}
  </Card>
</Link>
```

---

# Part 2: Insurance Cost Tracking

## The Problem

- ❌ No way to track insurance costs per property
- ❌ No insurance renewal reminders
- ❌ Insurance not linked to compliance system

## Solution: Insurance as a Compliance Item + Cost Tracking

---

## Database Changes

```sql
-- Add insurance fields to properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_premium_annual_gbp INTEGER,
ADD COLUMN IF NOT EXISTS insurance_premium_monthly_gbp INTEGER GENERATED ALWAYS AS (
  CASE WHEN insurance_premium_annual_gbp IS NOT NULL 
       THEN ROUND(insurance_premium_annual_gbp / 12.0)
       ELSE NULL 
  END
) STORED,
ADD COLUMN IF NOT EXISTS insurance_start_date DATE,
ADD COLUMN IF NOT EXISTS insurance_end_date DATE,
ADD COLUMN IF NOT EXISTS insurance_type TEXT CHECK (insurance_type IN (
  'buildings', 'contents', 'buildings_contents', 'landlord', 'rent_guarantee', 'legal_expenses'
)),
ADD COLUMN IF NOT EXISTS insurance_excess_gbp INTEGER,
ADD COLUMN IF NOT EXISTS insurance_notes TEXT;

-- Create insurance_policies table for detailed tracking
CREATE TABLE public.insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  
  -- Policy details
  provider TEXT NOT NULL,
  policy_number TEXT,
  policy_type TEXT NOT NULL CHECK (policy_type IN (
    'buildings', 'contents', 'buildings_contents', 'landlord', 
    'rent_guarantee', 'legal_expenses', 'hmo_specialist', 'other'
  )),
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Costs
  premium_annual_gbp INTEGER NOT NULL,
  premium_monthly_gbp INTEGER GENERATED ALWAYS AS (ROUND(premium_annual_gbp / 12.0)) STORED,
  excess_gbp INTEGER,
  
  -- Payment
  payment_frequency TEXT DEFAULT 'annual' CHECK (payment_frequency IN ('annual', 'monthly')),
  payment_method TEXT,
  auto_renew BOOLEAN DEFAULT false,
  
  -- Coverage
  buildings_cover_gbp INTEGER,
  contents_cover_gbp INTEGER,
  rent_guarantee_months INTEGER,
  legal_expenses_cover_gbp INTEGER,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  
  -- Documents
  policy_document_url TEXT,
  certificate_url TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_insurance_property ON public.insurance_policies(property_id);
CREATE INDEX idx_insurance_end_date ON public.insurance_policies(end_date) WHERE status = 'active';

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage insurance"
ON public.insurance_policies
FOR ALL
USING (public.user_has_org_access(org_id));

-- Insurance claims table
CREATE TABLE public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  policy_id UUID REFERENCES public.insurance_policies(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  
  -- Claim details
  claim_reference TEXT,
  claim_date DATE NOT NULL,
  incident_date DATE,
  incident_description TEXT NOT NULL,
  
  -- Amounts
  claim_amount_gbp INTEGER,
  settlement_amount_gbp INTEGER,
  excess_paid_gbp INTEGER,
  
  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'approved', 'rejected', 'settled', 'withdrawn'
  )),
  
  -- Dates
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  
  -- Documents
  documents JSONB DEFAULT '[]',
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_policy ON public.insurance_claims(policy_id);
CREATE INDEX idx_claims_property ON public.insurance_claims(property_id);

-- View for insurance summary
CREATE OR REPLACE VIEW insurance_summary AS
SELECT 
  p.id as property_id,
  p.address_line,
  p.postcode,
  ip.id as policy_id,
  ip.provider,
  ip.policy_number,
  ip.policy_type,
  ip.premium_annual_gbp,
  ip.premium_monthly_gbp,
  ip.start_date,
  ip.end_date,
  ip.status,
  ip.end_date - CURRENT_DATE as days_until_expiry,
  CASE 
    WHEN ip.end_date <= CURRENT_DATE THEN 'expired'
    WHEN ip.end_date <= CURRENT_DATE + 30 THEN 'expiring_soon'
    ELSE 'active'
  END as expiry_status,
  p.org_id
FROM properties p
LEFT JOIN insurance_policies ip ON ip.property_id = p.id AND ip.status = 'active'
WHERE p.lifecycle_type = 'core_rental';

-- Function to create compliance item for insurance
CREATE OR REPLACE FUNCTION create_insurance_compliance_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create or update compliance item for this insurance
  INSERT INTO compliance_items (
    org_id,
    property_id,
    compliance_type,
    issue_date,
    expiry_date,
    status,
    provider,
    reference_number,
    notes
  )
  VALUES (
    NEW.org_id,
    NEW.property_id,
    'Insurance',
    NEW.start_date,
    NEW.end_date,
    CASE 
      WHEN NEW.end_date <= CURRENT_DATE THEN 'expired'
      WHEN NEW.end_date <= CURRENT_DATE + 30 THEN 'expiring_soon'
      ELSE 'valid'
    END,
    NEW.provider,
    NEW.policy_number,
    NEW.policy_type || ' insurance - ' || NEW.provider
  )
  ON CONFLICT (property_id, compliance_type) 
  DO UPDATE SET
    issue_date = EXCLUDED.issue_date,
    expiry_date = EXCLUDED.expiry_date,
    status = EXCLUDED.status,
    provider = EXCLUDED.provider,
    reference_number = EXCLUDED.reference_number,
    notes = EXCLUDED.notes,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER insurance_compliance_trigger
AFTER INSERT OR UPDATE ON public.insurance_policies
FOR EACH ROW
EXECUTE FUNCTION create_insurance_compliance_item();
```

---

## Frontend Hooks

### src/hooks/useInsurance.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InsurancePolicy {
  id: string;
  org_id: string;
  property_id: string;
  provider: string;
  policy_number: string | null;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_annual_gbp: number;
  premium_monthly_gbp: number;
  excess_gbp: number | null;
  payment_frequency: 'annual' | 'monthly';
  payment_method: string | null;
  auto_renew: boolean;
  buildings_cover_gbp: number | null;
  contents_cover_gbp: number | null;
  rent_guarantee_months: number | null;
  legal_expenses_cover_gbp: number | null;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  policy_document_url: string | null;
  certificate_url: string | null;
  notes: string | null;
  // Joined
  property?: {
    address_line: string;
    postcode: string;
  };
}

export interface InsuranceSummary {
  property_id: string;
  address_line: string;
  postcode: string;
  policy_id: string | null;
  provider: string | null;
  policy_number: string | null;
  policy_type: string | null;
  premium_annual_gbp: number | null;
  premium_monthly_gbp: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  days_until_expiry: number | null;
  expiry_status: 'expired' | 'expiring_soon' | 'active' | null;
}

export const POLICY_TYPES = [
  { value: 'buildings', label: 'Buildings Only' },
  { value: 'contents', label: 'Contents Only' },
  { value: 'buildings_contents', label: 'Buildings & Contents' },
  { value: 'landlord', label: 'Landlord Insurance' },
  { value: 'rent_guarantee', label: 'Rent Guarantee' },
  { value: 'legal_expenses', label: 'Legal Expenses' },
  { value: 'hmo_specialist', label: 'HMO Specialist' },
  { value: 'other', label: 'Other' },
];

// Get all policies
export function useInsurancePolicies(filters?: {
  propertyId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['insurance-policies', filters],
    queryFn: async () => {
      let query = supabase
        .from('insurance_policies')
        .select(`
          *,
          property:properties(address_line, postcode)
        `)
        .order('end_date', { ascending: true });

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InsurancePolicy[];
    },
  });
}

// Get insurance summary (all properties with their insurance status)
export function useInsuranceSummary() {
  return useQuery({
    queryKey: ['insurance-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_summary')
        .select('*')
        .order('days_until_expiry', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as InsuranceSummary[];
    },
  });
}

// Get portfolio insurance totals
export function useInsuranceTotals() {
  return useQuery({
    queryKey: ['insurance-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_policies')
        .select('premium_annual_gbp, premium_monthly_gbp, status')
        .eq('status', 'active');

      if (error) throw error;

      return {
        total_annual: data.reduce((sum, p) => sum + (p.premium_annual_gbp || 0), 0),
        total_monthly: data.reduce((sum, p) => sum + (p.premium_monthly_gbp || 0), 0),
        policy_count: data.length,
      };
    },
  });
}

// Get single policy
export function useInsurancePolicy(policyId: string | undefined) {
  return useQuery({
    queryKey: ['insurance-policy', policyId],
    queryFn: async () => {
      if (!policyId) return null;

      const { data, error } = await supabase
        .from('insurance_policies')
        .select(`
          *,
          property:properties(address_line, postcode)
        `)
        .eq('id', policyId)
        .single();

      if (error) throw error;
      return data as InsurancePolicy;
    },
    enabled: !!policyId,
  });
}

// Create policy
export function useCreateInsurancePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (policy: {
      propertyId: string;
      provider: string;
      policyNumber?: string;
      policyType: string;
      startDate: string;
      endDate: string;
      premiumAnnualGbp: number;
      excessGbp?: number;
      paymentFrequency?: 'annual' | 'monthly';
      autoRenew?: boolean;
      buildingsCoverGbp?: number;
      contentsCoverGbp?: number;
      notes?: string;
    }) => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('insurance_policies')
        .insert({
          org_id: membership!.org_id,
          property_id: policy.propertyId,
          provider: policy.provider,
          policy_number: policy.policyNumber || null,
          policy_type: policy.policyType,
          start_date: policy.startDate,
          end_date: policy.endDate,
          premium_annual_gbp: policy.premiumAnnualGbp,
          excess_gbp: policy.excessGbp || null,
          payment_frequency: policy.paymentFrequency || 'annual',
          auto_renew: policy.autoRenew || false,
          buildings_cover_gbp: policy.buildingsCoverGbp || null,
          contents_cover_gbp: policy.contentsCoverGbp || null,
          notes: policy.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-totals'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-items'] });
      toast({ title: 'Insurance policy added' });
    },
  });
}

// Update policy
export function useUpdateInsurancePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InsurancePolicy> & { id: string }) => {
      const { data, error } = await supabase
        .from('insurance_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-policy', data.id] });
      queryClient.invalidateQueries({ queryKey: ['insurance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-totals'] });
      toast({ title: 'Policy updated' });
    },
  });
}

// Cancel policy
export function useCancelInsurancePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (policyId: string) => {
      const { error } = await supabase
        .from('insurance_policies')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', policyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-summary'] });
      toast({ title: 'Policy cancelled' });
    },
  });
}
```

---

## Insurance Panel Component

### src/components/insurance/InsurancePanel.tsx

```tsx
import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { 
  Shield, Plus, AlertTriangle, Calendar, PoundSterling,
  FileText, MoreVertical, Pencil, Trash2, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useInsurancePolicies,
  useInsuranceTotals,
  InsurancePolicy,
  POLICY_TYPES,
} from '@/hooks/useInsurance';
import { AddInsuranceDialog } from './AddInsuranceDialog';
import { EditInsuranceDialog } from './EditInsuranceDialog';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface InsurancePanelProps {
  propertyId?: string;
  showTotals?: boolean;
}

export function InsurancePanel({ propertyId, showTotals = false }: InsurancePanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);

  const { data: policies, isLoading } = useInsurancePolicies({
    propertyId,
    status: 'active',
  });

  const { data: totals } = useInsuranceTotals();

  const getExpiryBadge = (endDate: string) => {
    const daysUntil = differenceInDays(new Date(endDate), new Date());
    
    if (daysUntil < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysUntil <= 30) {
      return <Badge className="bg-amber-100 text-amber-700">Expires in {daysUntil}d</Badge>;
    }
    if (daysUntil <= 60) {
      return <Badge variant="secondary">Expires in {daysUntil}d</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Insurance
        </h3>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Policy
        </Button>
      </div>

      {/* Totals */}
      {showTotals && totals && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Annual Total</p>
              <p className="text-xl font-bold">{formatGBP(totals.total_annual)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Monthly Total</p>
              <p className="text-xl font-bold">{formatGBP(totals.total_monthly)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Active Policies</p>
              <p className="text-xl font-bold">{totals.policy_count}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Policies List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !policies?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-3">No insurance policies</p>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {policies.map(policy => {
            const policyType = POLICY_TYPES.find(t => t.value === policy.policy_type);
            const daysUntilExpiry = differenceInDays(new Date(policy.end_date), new Date());

            return (
              <Card
                key={policy.id}
                className={cn(
                  daysUntilExpiry < 0 && "border-red-200 bg-red-50/50",
                  daysUntilExpiry >= 0 && daysUntilExpiry <= 30 && "border-amber-200 bg-amber-50/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{policy.provider}</h4>
                        <Badge variant="outline">{policyType?.label}</Badge>
                        {getExpiryBadge(policy.end_date)}
                      </div>
                      
                      {policy.policy_number && (
                        <p className="text-sm text-muted-foreground">
                          Policy: {policy.policy_number}
                        </p>
                      )}

                      {!propertyId && policy.property && (
                        <p className="text-sm text-muted-foreground">
                          {policy.property.address_line?.split(',')[0]}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <PoundSterling className="h-3 w-3" />
                          {formatGBP(policy.premium_annual_gbp)}/year
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(policy.start_date), 'dd MMM yyyy')} - {format(new Date(policy.end_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingPolicy(policy)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {policy.policy_document_url && (
                          <DropdownMenuItem onClick={() => window.open(policy.policy_document_url!, '_blank')}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddInsuranceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        propertyId={propertyId}
      />

      {editingPolicy && (
        <EditInsuranceDialog
          open={!!editingPolicy}
          onOpenChange={() => setEditingPolicy(null)}
          policy={editingPolicy}
        />
      )}
    </div>
  );
}
```

---

## Add Insurance Dialog

### src/components/insurance/AddInsuranceDialog.tsx

```tsx
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInsurancePolicy, POLICY_TYPES } from '@/hooks/useInsurance';
import { useProperties } from '@/hooks/useProperties';

interface AddInsuranceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
}

export function AddInsuranceDialog({ open, onOpenChange, propertyId }: AddInsuranceDialogProps) {
  const [formData, setFormData] = useState({
    propertyId: propertyId || '',
    provider: '',
    policyNumber: '',
    policyType: '',
    startDate: '',
    endDate: '',
    premiumAnnualGbp: '',
    excessGbp: '',
    paymentFrequency: 'annual' as 'annual' | 'monthly',
    autoRenew: false,
    buildingsCoverGbp: '',
    contentsCoverGbp: '',
    notes: '',
  });

  const { data: properties } = useProperties();
  const createPolicy = useCreateInsurancePolicy();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createPolicy.mutateAsync({
      propertyId: formData.propertyId,
      provider: formData.provider,
      policyNumber: formData.policyNumber || undefined,
      policyType: formData.policyType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      premiumAnnualGbp: Number(formData.premiumAnnualGbp),
      excessGbp: formData.excessGbp ? Number(formData.excessGbp) : undefined,
      paymentFrequency: formData.paymentFrequency,
      autoRenew: formData.autoRenew,
      buildingsCoverGbp: formData.buildingsCoverGbp ? Number(formData.buildingsCoverGbp) : undefined,
      contentsCoverGbp: formData.contentsCoverGbp ? Number(formData.contentsCoverGbp) : undefined,
      notes: formData.notes || undefined,
    });

    onOpenChange(false);
    // Reset form
    setFormData({
      propertyId: propertyId || '',
      provider: '',
      policyNumber: '',
      policyType: '',
      startDate: '',
      endDate: '',
      premiumAnnualGbp: '',
      excessGbp: '',
      paymentFrequency: 'annual',
      autoRenew: false,
      buildingsCoverGbp: '',
      contentsCoverGbp: '',
      notes: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Insurance Policy</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Property (if not pre-selected) */}
            {!propertyId && (
              <div className="space-y-2">
                <Label>Property *</Label>
                <Select
                  value={formData.propertyId}
                  onValueChange={(v) => setFormData({ ...formData, propertyId: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address_line?.split(',')[0]} ({p.postcode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">Insurance Provider *</Label>
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                placeholder="e.g., Simply Business, Alan Boswell"
                required
              />
            </div>

            {/* Policy Number */}
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Policy Number</Label>
              <Input
                id="policyNumber"
                value={formData.policyNumber}
                onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                placeholder="e.g., POL123456"
              />
            </div>

            {/* Policy Type */}
            <div className="space-y-2">
              <Label>Policy Type *</Label>
              <Select
                value={formData.policyType}
                onValueChange={(v) => setFormData({ ...formData, policyType: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Premium & Excess */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="premium">Annual Premium (£) *</Label>
                <Input
                  id="premium"
                  type="number"
                  value={formData.premiumAnnualGbp}
                  onChange={(e) => setFormData({ ...formData, premiumAnnualGbp: e.target.value })}
                  placeholder="e.g., 450"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excess">Excess (£)</Label>
                <Input
                  id="excess"
                  type="number"
                  value={formData.excessGbp}
                  onChange={(e) => setFormData({ ...formData, excessGbp: e.target.value })}
                  placeholder="e.g., 250"
                />
              </div>
            </div>

            {/* Payment Frequency */}
            <div className="space-y-2">
              <Label>Payment Frequency</Label>
              <Select
                value={formData.paymentFrequency}
                onValueChange={(v) => setFormData({ ...formData, paymentFrequency: v as 'annual' | 'monthly' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual (paid yearly)</SelectItem>
                  <SelectItem value="monthly">Monthly (paid monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cover Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buildingsCover">Buildings Cover (£)</Label>
                <Input
                  id="buildingsCover"
                  type="number"
                  value={formData.buildingsCoverGbp}
                  onChange={(e) => setFormData({ ...formData, buildingsCoverGbp: e.target.value })}
                  placeholder="e.g., 350000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contentsCover">Contents Cover (£)</Label>
                <Input
                  id="contentsCover"
                  type="number"
                  value={formData.contentsCoverGbp}
                  onChange={(e) => setFormData({ ...formData, contentsCoverGbp: e.target.value })}
                  placeholder="e.g., 15000"
                />
              </div>
            </div>

            {/* Auto Renew */}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={formData.autoRenew}
                onCheckedChange={(c) => setFormData({ ...formData, autoRenew: !!c })}
              />
              <span className="text-sm">Auto-renew enabled</span>
            </label>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.propertyId || !formData.provider || !formData.policyType || createPolicy.isPending}
            >
              {createPolicy.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
              ) : (
                'Add Policy'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

# Integration Points

## Add Insurance to Property Detail

```tsx
// In PropertyDetail.tsx, add Insurance section
<TabsContent value="insurance">
  <InsurancePanel propertyId={property.id} />
</TabsContent>
```

## Add Insurance to Dashboard

```tsx
// Dashboard widget showing portfolio insurance totals
<InsuranceSummaryWidget />
```

## Add Insurance to Financials

```tsx
// Include insurance in property running costs
Total Running Costs = Mortgage + Insurance + Bills + Management Fees
```

## Add Insurance to Compliance Calendar

Insurance expiry dates now appear automatically:
- Created via trigger when policy added
- Shows on calendar as "Insurance" compliance type
- Creates auto-job at 90 days before expiry

---

# Routes

Add to router:
```tsx
<Route path="/jobs/:jobId" element={<JobDetail />} />
```

---

# Implementation Checklist

## Jobs Detail (Week 1)
- [ ] Create JobDetail page
- [ ] Add job_notes table
- [ ] Create useJobNotes hook
- [ ] Update JobCard to link to detail
- [ ] Add status change buttons
- [ ] Add notes functionality
- [ ] Add documents panel
- [ ] Add timeline sidebar

## Insurance Tracking (Week 2)
- [ ] Run database migration (insurance_policies, insurance_claims)
- [ ] Create useInsurance hooks
- [ ] Build InsurancePanel component
- [ ] Build AddInsuranceDialog
- [ ] Build EditInsuranceDialog
- [ ] Add to Property Detail
- [ ] Verify compliance integration (trigger)
- [ ] Add to calendar events view

---

*Ready for Lovable.dev implementation - 2 weeks*
