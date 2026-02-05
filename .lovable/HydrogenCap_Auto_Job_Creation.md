# HydrogenCap Implementation Specification
## Enhancement: Auto-Job Creation for Expiring Compliance

Automatically create jobs when compliance items are 90 days from expiry, and add the ability to manually create jobs from anywhere in the app.

---

# Overview

**What We're Building:**
1. **Auto-Job Creation** - Automatically create draft jobs when compliance expires within 90 days
2. **Jobs Page Enhancement** - View all jobs (auto-created + manual) with filters
3. **Manual Job Creation** - Create jobs from Jobs page, property detail, or compliance calendar
4. **Job → Contractor Flow** - Select contractor and send request from job detail

---

# Database Changes

```sql
-- Migration: Auto-Job Creation for Compliance
-- File: supabase/migrations/YYYYMMDD_auto_compliance_jobs.sql

-- ============================================
-- ADD AUTO-JOB TRACKING TO COMPLIANCE ITEMS
-- ============================================

ALTER TABLE public.compliance_items
ADD COLUMN IF NOT EXISTS auto_job_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE SET NULL;

-- ============================================
-- ADD SOURCE TRACKING TO JOBS
-- ============================================

ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto_compliance', 'auto_rate_expiry')),
ADD COLUMN IF NOT EXISTS auto_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- ============================================
-- FUNCTION: Create jobs for expiring compliance
-- ============================================

CREATE OR REPLACE FUNCTION create_jobs_for_expiring_compliance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_compliance RECORD;
  v_job_id UUID;
  v_property RECORD;
BEGIN
  -- Find compliance items expiring within 90 days that don't have a job yet
  FOR v_compliance IN
    SELECT 
      ci.id,
      ci.property_id,
      ci.org_id,
      ci.compliance_type,
      ci.expiry_date,
      ci.responsible_party
    FROM compliance_items ci
    WHERE ci.expiry_date IS NOT NULL
    AND ci.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
    AND ci.expiry_date > CURRENT_DATE
    AND ci.auto_job_created = false
    AND NOT EXISTS (
      -- Don't create if there's already an active job for this compliance item
      SELECT 1 FROM contractor_jobs cj
      WHERE cj.compliance_item_id = ci.id
      AND cj.status NOT IN ('completed', 'verified', 'cancelled')
    )
  LOOP
    -- Get property details
    SELECT address_line, postcode INTO v_property
    FROM properties
    WHERE id = v_compliance.property_id;
    
    -- Determine priority based on days until expiry
    DECLARE
      v_days_until INTEGER;
      v_priority TEXT;
    BEGIN
      v_days_until := v_compliance.expiry_date - CURRENT_DATE;
      
      IF v_days_until <= 14 THEN
        v_priority := 'urgent';
      ELSIF v_days_until <= 30 THEN
        v_priority := 'high';
      ELSIF v_days_until <= 60 THEN
        v_priority := 'normal';
      ELSE
        v_priority := 'low';
      END IF;
      
      -- Create the job
      INSERT INTO contractor_jobs (
        org_id,
        property_id,
        compliance_item_id,
        job_type,
        description,
        status,
        source,
        auto_created_at,
        priority
      )
      VALUES (
        v_compliance.org_id,
        v_compliance.property_id,
        v_compliance.id,
        v_compliance.compliance_type,
        'Auto-created: ' || v_compliance.compliance_type || ' expires ' || 
          to_char(v_compliance.expiry_date, 'DD Mon YYYY') || ' at ' || 
          v_property.address_line,
        'draft',
        'auto_compliance',
        now(),
        v_priority
      )
      RETURNING id INTO v_job_id;
      
      -- Mark compliance item as having a job
      UPDATE compliance_items
      SET auto_job_created = true, auto_job_id = v_job_id
      WHERE id = v_compliance.id;
      
      -- Log activity
      INSERT INTO project_activity_log (project_id, activity_type, title, description)
      SELECT 
        dp.id,
        'note',
        'Compliance job auto-created',
        v_compliance.compliance_type || ' renewal job created automatically'
      FROM development_projects dp
      WHERE dp.property_id = v_compliance.property_id
      AND dp.is_active = true
      LIMIT 1;
      
      v_count := v_count + 1;
    END;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- ============================================
-- FUNCTION: Update job priority based on expiry
-- ============================================

CREATE OR REPLACE FUNCTION update_job_priorities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Update priorities for jobs linked to compliance items
  UPDATE contractor_jobs cj
  SET priority = CASE
    WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
    WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
    WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
    ELSE 'low'
  END
  FROM compliance_items ci
  WHERE cj.compliance_item_id = ci.id
  AND cj.status NOT IN ('completed', 'verified', 'cancelled')
  AND ci.expiry_date IS NOT NULL
  AND cj.priority != CASE
    WHEN ci.expiry_date - CURRENT_DATE <= 14 THEN 'urgent'
    WHEN ci.expiry_date - CURRENT_DATE <= 30 THEN 'high'
    WHEN ci.expiry_date - CURRENT_DATE <= 60 THEN 'normal'
    ELSE 'low'
  END;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================
-- TRIGGER: Reset auto_job_created when compliance renewed
-- ============================================

CREATE OR REPLACE FUNCTION reset_compliance_job_on_renewal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If expiry date changed (renewed), reset the auto job flag
  IF OLD.expiry_date IS DISTINCT FROM NEW.expiry_date 
     AND NEW.expiry_date > OLD.expiry_date THEN
    NEW.auto_job_created := false;
    NEW.auto_job_id := NULL;
    
    -- Cancel any draft jobs for this compliance item
    UPDATE contractor_jobs
    SET status = 'cancelled',
        internal_notes = COALESCE(internal_notes, '') || E'\nAuto-cancelled: Compliance was renewed.'
    WHERE compliance_item_id = OLD.id
    AND status = 'draft';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER compliance_renewal_trigger
BEFORE UPDATE ON public.compliance_items
FOR EACH ROW
EXECUTE FUNCTION reset_compliance_job_on_renewal();

-- ============================================
-- VIEW: Jobs with compliance details
-- ============================================

CREATE OR REPLACE VIEW jobs_with_details AS
SELECT 
  cj.*,
  p.address_line as property_address,
  p.postcode as property_postcode,
  ci.expiry_date as compliance_expiry_date,
  ci.compliance_type as compliance_type_full,
  c.name as contractor_name,
  c.company_name as contractor_company,
  c.email as contractor_email,
  c.phone as contractor_phone,
  -- Calculate days until expiry
  CASE 
    WHEN ci.expiry_date IS NOT NULL 
    THEN ci.expiry_date - CURRENT_DATE 
    ELSE NULL 
  END as days_until_expiry
FROM contractor_jobs cj
LEFT JOIN properties p ON p.id = cj.property_id
LEFT JOIN compliance_items ci ON ci.id = cj.compliance_item_id
LEFT JOIN contractors c ON c.id = cj.contractor_id;
```

---

# Edge Function: Run Auto-Job Creation

## supabase/functions/create-compliance-jobs/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    // Create jobs for expiring compliance
    const { data: jobsCreated, error: createError } = await supabase
      .rpc('create_jobs_for_expiring_compliance');

    if (createError) throw createError;

    // Update priorities for existing jobs
    const { data: prioritiesUpdated, error: priorityError } = await supabase
      .rpc('update_job_priorities');

    if (priorityError) throw priorityError;

    console.log(`Created ${jobsCreated} new jobs, updated ${prioritiesUpdated} priorities`);

    return new Response(JSON.stringify({
      success: true,
      jobs_created: jobsCreated,
      priorities_updated: prioritiesUpdated,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

# Cron Job Setup

```sql
-- Run auto-job creation daily at 6am
SELECT cron.schedule(
  'create-compliance-jobs',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-compliance-jobs',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  );
  $$
);
```

---

# Enhanced Hooks

## src/hooks/useContractorJobs.ts (Enhanced)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContractorJob {
  id: string;
  org_id: string;
  property_id: string;
  compliance_item_id: string | null;
  contractor_id: string | null;
  job_type: string;
  description: string | null;
  status: 'draft' | 'requested' | 'quoted' | 'accepted' | 'booked' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
  source: 'manual' | 'auto_compliance' | 'auto_rate_expiry';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requested_at: string | null;
  quoted_at: string | null;
  booked_date: string | null;
  booked_time_slot: string | null;
  completed_at: string | null;
  quoted_amount_gbp: number | null;
  final_amount_gbp: number | null;
  payment_status: 'unpaid' | 'invoiced' | 'paid';
  request_message: string | null;
  contractor_notes: string | null;
  internal_notes: string | null;
  auto_created_at: string | null;
  created_at: string;
  // Joined data
  contractor?: {
    id: string;
    name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  };
  property?: {
    id: string;
    address_line: string;
    postcode: string;
  };
  compliance_item?: {
    id: string;
    compliance_type: string;
    expiry_date: string | null;
  };
}

export type JobStatus = ContractorJob['status'];
export type JobPriority = ContractorJob['priority'];
export type JobSource = ContractorJob['source'];

export const JOB_STATUSES: { value: JobStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  { value: 'requested', label: 'Requested', color: 'bg-blue-100 text-blue-700' },
  { value: 'quoted', label: 'Quoted', color: 'bg-purple-100 text-purple-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'booked', label: 'Booked', color: 'bg-amber-100 text-amber-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-orange-100 text-orange-700' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'verified', label: 'Verified', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
];

export const JOB_PRIORITIES: { value: JobPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600' },
];

// Get all jobs with filters
export function useContractorJobs(filters?: {
  status?: JobStatus[];
  priority?: JobPriority[];
  source?: JobSource[];
  propertyId?: string;
  contractorId?: string;
  hasContractor?: boolean;
}) {
  return useQuery({
    queryKey: ['contractor-jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('contractor_jobs')
        .select(`
          *,
          contractor:contractors(id, name, company_name, email, phone),
          property:properties(id, address_line, postcode),
          compliance_item:compliance_items(id, compliance_type, expiry_date)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters?.priority?.length) {
        query = query.in('priority', filters.priority);
      }
      if (filters?.source?.length) {
        query = query.in('source', filters.source);
      }
      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.contractorId) {
        query = query.eq('contractor_id', filters.contractorId);
      }
      if (filters?.hasContractor === true) {
        query = query.not('contractor_id', 'is', null);
      }
      if (filters?.hasContractor === false) {
        query = query.is('contractor_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContractorJob[];
    },
  });
}

// Get job counts by status
export function useJobCounts() {
  return useQuery({
    queryKey: ['job-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractor_jobs')
        .select('status, priority')
        .not('status', 'in', '("completed","verified","cancelled")');

      if (error) throw error;

      const counts = {
        total: data.length,
        draft: data.filter(j => j.status === 'draft').length,
        needsContractor: data.filter(j => j.status === 'draft').length,
        awaitingResponse: data.filter(j => j.status === 'requested').length,
        booked: data.filter(j => j.status === 'booked').length,
        urgent: data.filter(j => j.priority === 'urgent').length,
        high: data.filter(j => j.priority === 'high').length,
      };

      return counts;
    },
  });
}

// Get single job
export function useContractorJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['contractor-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('contractor_jobs')
        .select(`
          *,
          contractor:contractors(*),
          property:properties(id, address_line, postcode, beds),
          compliance_item:compliance_items(id, compliance_type, expiry_date, issue_date)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data as ContractorJob;
    },
    enabled: !!jobId,
  });
}

// Create job manually
export function useCreateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (job: {
      propertyId: string;
      complianceItemId?: string;
      contractorId?: string;
      jobType: string;
      description?: string;
      requestMessage?: string;
      priority?: JobPriority;
    }) => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('contractor_jobs')
        .insert({
          org_id: membership!.org_id,
          property_id: job.propertyId,
          compliance_item_id: job.complianceItemId || null,
          contractor_id: job.contractorId || null,
          job_type: job.jobType,
          description: job.description || null,
          request_message: job.requestMessage || null,
          status: 'draft',
          source: 'manual',
          priority: job.priority || 'normal',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({ title: 'Job created' });
    },
  });
}

// Assign contractor to job
export function useAssignContractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, contractorId }: { jobId: string; contractorId: string }) => {
      const { error } = await supabase
        .from('contractor_jobs')
        .update({ 
          contractor_id: contractorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['contractor-job', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({ title: 'Contractor assigned' });
    },
  });
}

// Update job
export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContractorJob> & { id: string }) => {
      const { data, error } = await supabase
        .from('contractor_jobs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['contractor-job', data.id] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({ title: 'Job updated' });
    },
  });
}

// Send job request to contractor
export function useSendJobRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, customMessage }: { jobId: string; customMessage?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-job-request', {
        body: { jobId, customMessage },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({
        title: 'Request sent',
        description: `Job request sent to ${data.sentTo}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Cancel job
export function useCancelJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason?: string }) => {
      const { error } = await supabase
        .from('contractor_jobs')
        .update({
          status: 'cancelled',
          internal_notes: reason ? `Cancelled: ${reason}` : 'Cancelled by user',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-counts'] });
      toast({ title: 'Job cancelled' });
    },
  });
}
```

---

# Frontend Components

## src/pages/Jobs.tsx

```tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Briefcase, Clock, AlertTriangle, Send, User, Calendar, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  useContractorJobs, 
  useJobCounts, 
  JOB_STATUSES, 
  JOB_PRIORITIES,
  JobStatus,
  JobPriority 
} from '@/hooks/useContractorJobs';
import { JobCard } from '@/components/jobs/JobCard';
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';
import { cn } from '@/lib/utils';

export default function Jobs() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: counts } = useJobCounts();

  // Determine status filter based on tab
  const getStatusArray = (): JobStatus[] | undefined => {
    switch (statusFilter) {
      case 'draft':
        return ['draft'];
      case 'active':
        return ['requested', 'quoted', 'accepted', 'booked', 'in_progress'];
      case 'completed':
        return ['completed', 'verified'];
      case 'cancelled':
        return ['cancelled'];
      default:
        return undefined;
    }
  };

  const { data: jobs, isLoading } = useContractorJobs({
    status: getStatusArray(),
    priority: priorityFilter !== 'all' ? [priorityFilter as JobPriority] : undefined,
  });

  // Filter by search term
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
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Jobs</h1>
            <p className="text-muted-foreground">Manage compliance renewals and contractor jobs</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('draft')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Needs Contractor</p>
                  <p className="text-2xl font-bold">{counts?.needsContractor || 0}</p>
                </div>
                <User className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('active')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Response</p>
                  <p className="text-2xl font-bold">{counts?.awaitingResponse || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('active')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Booked</p>
                  <p className="text-2xl font-bold">{counts?.booked || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "cursor-pointer hover:bg-muted/50",
            (counts?.urgent || 0) > 0 && "border-red-200 bg-red-50/50"
          )} onClick={() => setPriorityFilter('urgent')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Urgent</p>
                  <p className={cn("text-2xl font-bold", (counts?.urgent || 0) > 0 && "text-red-600")}>
                    {counts?.urgent || 0}
                  </p>
                </div>
                <AlertTriangle className={cn(
                  "h-8 w-8",
                  (counts?.urgent || 0) > 0 ? "text-red-500" : "text-muted-foreground/30"
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "cursor-pointer hover:bg-muted/50",
            (counts?.high || 0) > 0 && "border-amber-200 bg-amber-50/50"
          )} onClick={() => setPriorityFilter('high')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                  <p className={cn("text-2xl font-bold", (counts?.high || 0) > 0 && "text-amber-600")}>
                    {counts?.high || 0}
                  </p>
                </div>
                <AlertTriangle className={cn(
                  "h-8 w-8",
                  (counts?.high || 0) > 0 ? "text-amber-500" : "text-muted-foreground/30"
                )} />
              </div>
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

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {JOB_PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="draft">
              Draft
              {(counts?.draft || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{counts?.draft}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              {(counts?.total || 0) - (counts?.draft || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {(counts?.total || 0) - (counts?.draft || 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : filteredJobs?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-medium mb-1">No jobs found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {statusFilter === 'draft' 
                      ? 'Jobs will appear here automatically when compliance items are 90 days from expiry.'
                      : 'No jobs match your current filters.'}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredJobs?.map(job => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateJobDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </AppLayout>
  );
}
```

## src/components/jobs/JobCard.tsx

```tsx
import React from 'react';
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
  useAssignContractor,
  useSendJobRequest,
  useCancelJob 
} from '@/hooks/useContractorJobs';
import { cn } from '@/lib/utils';
import { AssignContractorDialog } from './AssignContractorDialog';

interface JobCardProps {
  job: ContractorJob;
}

export function JobCard({ job }: JobCardProps) {
  const [showAssignDialog, setShowAssignDialog] = React.useState(false);
  
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
      <Card className={cn(
        "hover:shadow-md transition-shadow",
        job.priority === 'urgent' && "border-red-200",
        job.priority === 'high' && "border-amber-200"
      )}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
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
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
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
                  <DropdownMenuItem onClick={handleSendRequest}>
                    Send Request
                  </DropdownMenuItem>
                )}
                {['draft', 'requested'].includes(job.status) && (
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
              <span className="text-amber-600 font-medium">No contractor assigned</span>
            )}
          </div>

          {/* Expiry Warning */}
          {daysUntilExpiry !== null && (
            <div className={cn(
              "flex items-center gap-2 text-xs p-2 rounded mb-3",
              daysUntilExpiry <= 14 ? "bg-red-50 text-red-700" :
              daysUntilExpiry <= 30 ? "bg-amber-50 text-amber-700" :
              "bg-blue-50 text-blue-700"
            )}>
              <Clock className="h-3 w-3" />
              {daysUntilExpiry <= 0 
                ? 'Expired!' 
                : `Expires in ${daysUntilExpiry} days`}
            </div>
          )}

          {/* Booked Date */}
          {job.booked_date && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-3">
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
                <Button size="sm" variant="outline" onClick={() => setShowAssignDialog(true)}>
                  <User className="h-4 w-4 mr-1" />
                  Assign
                </Button>
              )}
              {job.status === 'draft' && job.contractor_id && (
                <Button 
                  size="sm" 
                  onClick={handleSendRequest}
                  disabled={sendRequest.isPending}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              )}
              {job.status !== 'draft' && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/jobs/${job.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
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
```

## src/components/jobs/CreateJobDialog.tsx

```tsx
import React, { useState } from 'react';
import { Loader2, Building2, Briefcase } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useCreateJob, JOB_PRIORITIES, JobPriority } from '@/hooks/useContractorJobs';
import { useProperties } from '@/hooks/useProperties';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { COMPLIANCE_TYPES } from '@/lib/complianceTypes';

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPropertyId?: string;
  preselectedComplianceItemId?: string;
}

export function CreateJobDialog({ 
  open, 
  onOpenChange, 
  preselectedPropertyId,
  preselectedComplianceItemId 
}: CreateJobDialogProps) {
  const [formData, setFormData] = useState({
    propertyId: preselectedPropertyId || '',
    complianceItemId: preselectedComplianceItemId || '',
    jobType: '',
    description: '',
    priority: 'normal' as JobPriority,
  });

  const { data: properties } = useProperties();
  const { data: complianceItems } = usePropertyCompliance(formData.propertyId || undefined);
  const createJob = useCreateJob();

  // Filter to operational properties
  const availableProperties = properties?.filter(p => p.lifecycle_type === 'core_rental');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createJob.mutateAsync({
      propertyId: formData.propertyId,
      complianceItemId: formData.complianceItemId || undefined,
      jobType: formData.jobType,
      description: formData.description || undefined,
      priority: formData.priority,
    });

    onOpenChange(false);
    setFormData({
      propertyId: '',
      complianceItemId: '',
      jobType: '',
      description: '',
      priority: 'normal',
    });
  };

  // Auto-fill job type when compliance item selected
  const handleComplianceChange = (complianceItemId: string) => {
    const item = complianceItems?.find(c => c.id === complianceItemId);
    setFormData(prev => ({
      ...prev,
      complianceItemId,
      jobType: item?.compliance_type || prev.jobType,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Create a job to track work needed at a property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(v) => setFormData({ ...formData, propertyId: v, complianceItemId: '' })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties?.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{property.address_line?.split(',')[0]}</span>
                        <span className="text-muted-foreground">({property.postcode})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Link to Compliance Item (Optional) */}
            {formData.propertyId && complianceItems && complianceItems.length > 0 && (
              <div className="space-y-2">
                <Label>Link to Compliance Item (optional)</Label>
                <Select
                  value={formData.complianceItemId}
                  onValueChange={handleComplianceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance item..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {complianceItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.compliance_type}
                        {item.expiry_date && (
                          <span className="text-muted-foreground ml-2">
                            (expires {new Date(item.expiry_date).toLocaleDateString()})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Job Type */}
            <div className="space-y-2">
              <Label>Job Type *</Label>
              <Select
                value={formData.jobType}
                onValueChange={(v) => setFormData({ ...formData, jobType: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPLIANCE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                  <SelectItem value="General Maintenance">General Maintenance</SelectItem>
                  <SelectItem value="Repair">Repair</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v as JobPriority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add any details about this job..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.propertyId || !formData.jobType || createJob.isPending}
            >
              {createJob.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
              ) : (
                'Create Job'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## src/components/jobs/AssignContractorDialog.tsx

```tsx
import React, { useState } from 'react';
import { Search, Star, User, Send, Loader2, ChevronRight } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ContractorJob, 
  useAssignContractor, 
  useSendJobRequest,
  useMatchingContractors 
} from '@/hooks/useContractorJobs';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface AssignContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ContractorJob;
}

export function AssignContractorDialog({ open, onOpenChange, job }: AssignContractorDialogProps) {
  const [step, setStep] = useState<'select' | 'message' | 'done'>('select');
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendImmediately, setSendImmediately] = useState(true);

  const { data: contractors, isLoading } = useMatchingContractors(
    job.job_type,
    job.property?.postcode || ''
  );

  const assignContractor = useAssignContractor();
  const sendRequest = useSendJobRequest();

  const selectedContractor = contractors?.find(c => c.contractor_id === selectedContractorId);

  const handleAssign = async () => {
    if (!selectedContractorId) return;

    // Assign the contractor
    await assignContractor.mutateAsync({
      jobId: job.id,
      contractorId: selectedContractorId,
    });

    if (sendImmediately) {
      // Send the request
      await sendRequest.mutateAsync({
        jobId: job.id,
        customMessage: customMessage || undefined,
      });
      setStep('done');
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('select');
      setSelectedContractorId(null);
      setCustomMessage('');
      setSendImmediately(true);
    }, 200);
  };

  const isSubmitting = assignContractor.isPending || sendRequest.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Contractor</DialogTitle>
          <DialogDescription>
            {job.job_type} at {job.property?.address_line?.split(',')[0]}
          </DialogDescription>
        </DialogHeader>

        {step === 'done' ? (
          <div className="py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 mx-auto mb-4 flex items-center justify-center">
              <Send className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Request Sent!</h3>
            <p className="text-muted-foreground mb-4">
              Job request sent to {selectedContractor?.name}.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : step === 'select' ? (
          <>
            <div className="py-4">
              <Label className="mb-3 block">Suggested Contractors</Label>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : contractors?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No contractors found for this job type.</p>
                  <Button variant="link" className="mt-2">Add a contractor</Button>
                </div>
              ) : (
                <RadioGroup
                  value={selectedContractorId || ''}
                  onValueChange={setSelectedContractorId}
                >
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {contractors?.map((contractor) => (
                        <label
                          key={contractor.contractor_id}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                            selectedContractorId === contractor.contractor_id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <RadioGroupItem
                            value={contractor.contractor_id}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{contractor.name}</span>
                              {contractor.average_rating > 0 && (
                                <div className="flex items-center gap-1 text-amber-600">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span className="text-xs">{contractor.average_rating.toFixed(1)}</span>
                                </div>
                              )}
                              {contractor.match_score >= 80 && (
                                <Badge variant="secondary" className="text-xs">Best Match</Badge>
                              )}
                            </div>
                            {contractor.company_name && (
                              <p className="text-sm text-muted-foreground">{contractor.company_name}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {contractor.typical_cost && (
                                <span>Typical: {formatGBP(contractor.typical_cost)}</span>
                              )}
                              {contractor.total_jobs > 0 && (
                                <span>{contractor.total_jobs} jobs done</span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </RadioGroup>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep('message')} disabled={!selectedContractorId}>
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-4">
              {/* Selected contractor */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedContractor?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedContractor?.company_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Additional Message (optional)</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add any specific requirements or notes..."
                  rows={4}
                />
              </div>

              {/* Send option */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendImmediately"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="sendImmediately" className="text-sm">
                  Send request to contractor immediately
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button onClick={handleAssign} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                ) : sendImmediately ? (
                  <><Send className="h-4 w-4 mr-2" />Assign & Send</>
                ) : (
                  'Assign Contractor'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

# Integration Points

## Add Jobs Badge to Sidebar

```tsx
// In AppSidebar.tsx
import { useJobCounts } from '@/hooks/useContractorJobs';

// In nav items:
{
  title: 'Jobs',
  icon: Briefcase,
  href: '/jobs',
  badge: <JobsBadge />,
}

// JobsBadge component:
function JobsBadge() {
  const { data: counts } = useJobCounts();
  const urgentCount = (counts?.urgent || 0) + (counts?.high || 0);
  
  if (!urgentCount) return null;
  
  return (
    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
      {urgentCount}
    </Badge>
  );
}
```

## Add "Create Job" button to Compliance Calendar

```tsx
// In ComplianceCalendar.tsx
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';

// Add button next to expiring compliance items
<Button 
  size="sm" 
  variant="outline"
  onClick={() => {
    setSelectedComplianceItem(item);
    setShowCreateJobDialog(true);
  }}
>
  <Briefcase className="h-4 w-4 mr-1" />
  Create Job
</Button>
```

## Add Job Link to Property Detail Compliance Tab

```tsx
// Show linked job for compliance item
{complianceItem.auto_job_id && (
  <Link to={`/jobs/${complianceItem.auto_job_id}`}>
    <Badge variant="outline" className="cursor-pointer">
      <Briefcase className="h-3 w-3 mr-1" />
      View Job
    </Badge>
  </Link>
)}
```

---

# Implementation Checklist

## Database & Backend
- [ ] Run database migration
- [ ] Deploy create-compliance-jobs edge function
- [ ] Set up daily cron job (6am)
- [ ] Test auto-job creation logic
- [ ] Test priority updates

## Frontend - Jobs Page
- [ ] Create Jobs.tsx page
- [ ] Create JobCard component
- [ ] Create CreateJobDialog component
- [ ] Create AssignContractorDialog component
- [ ] Add job counts to stats cards
- [ ] Add to navigation with badge

## Integration
- [ ] Add JobsBadge to sidebar
- [ ] Add "Create Job" to ComplianceCalendar
- [ ] Link compliance items to their jobs
- [ ] Show job status on property compliance tab

---

# How It Works

**Auto-Job Creation Flow:**
```
Daily at 6am → Check all compliance items
→ Find items expiring within 90 days without a job
→ Create draft job with priority based on days remaining:
   - ≤14 days: Urgent
   - ≤30 days: High  
   - ≤60 days: Normal
   - >60 days: Low
→ Mark compliance item as having job created
```

**Manual Job Creation Flow:**
```
User clicks "New Job" on Jobs page
→ Select property → Optionally link to compliance item
→ Select job type → Set priority
→ Job created as "Draft"
→ Assign contractor → Send request
```

**Job Lifecycle:**
```
Draft (no contractor) → Draft (contractor assigned) → Requested (email sent)
→ Quoted (contractor responded) → Booked (date confirmed)
→ Completed (work done) → Verified (certificate uploaded)
```

**Priority Updates:**
- Priorities automatically update daily as expiry dates approach
- Urgent jobs show with red styling throughout the app
- Badge in sidebar shows count of urgent + high priority jobs

---

*Ready for Lovable.dev implementation*
