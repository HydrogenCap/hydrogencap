# HydrogenCap Implementation Specification
## Phase 5: Contractor Management & Booking Integration

A complete contractor management system with job requests, tracking, and smart suggestions based on compliance type and property location.

---

# Overview

**What We're Building:**
1. **Contractor Directory** - Full UI to manage trusted contractors with specializations
2. **Smart Suggestions** - Auto-recommend contractors based on compliance type + property postcode
3. **Job Request System** - Send booking requests via email directly from compliance items
4. **Job Tracking** - Track jobs from requested → booked → completed → paid
5. **Contractor Performance** - Response times, average costs, ratings/reviews
6. **Calendar Integration** - See booked jobs on compliance calendar

---

# Database Migrations

```sql
-- Migration: Contractor Management & Job Tracking
-- File: supabase/migrations/YYYYMMDD_contractor_jobs.sql

-- ============================================
-- ENHANCE CONTRACTORS TABLE
-- ============================================

ALTER TABLE public.contractors
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_hours INTEGER,
ADD COLUMN IF NOT EXISTS hourly_rate_gbp INTEGER,
ADD COLUMN IF NOT EXISTS call_out_fee_gbp INTEGER,
ADD COLUMN IF NOT EXISTS typical_costs JSONB DEFAULT '{}',
-- e.g., {"Gas Safety Certificate (CP12)": 75, "EICR": 150}
ADD COLUMN IF NOT EXISTS availability_notes TEXT,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- CONTRACTOR JOBS TABLE
-- ============================================

CREATE TABLE public.contractor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- What needs doing
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  compliance_item_id UUID REFERENCES public.compliance_items(id) ON DELETE SET NULL,
  
  -- Who's doing it
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  
  -- Job details
  job_type TEXT NOT NULL, -- Compliance type or custom description
  description TEXT,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Created but not sent
    'requested',       -- Sent to contractor
    'quoted',          -- Contractor provided quote
    'accepted',        -- Quote accepted, awaiting booking
    'booked',          -- Date confirmed
    'in_progress',     -- Work underway
    'completed',       -- Work done, awaiting certificate
    'verified',        -- Certificate uploaded and verified
    'cancelled'        -- Cancelled
  )),
  
  -- Dates
  requested_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  booked_date DATE,
  booked_time_slot TEXT, -- 'morning', 'afternoon', 'all_day', or specific time
  completed_at TIMESTAMPTZ,
  
  -- Financials
  quoted_amount_gbp INTEGER,
  final_amount_gbp INTEGER,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'invoiced', 'paid')),
  invoice_reference TEXT,
  
  -- Communication
  request_message TEXT,
  contractor_notes TEXT,
  internal_notes TEXT,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage jobs"
ON public.contractor_jobs
FOR ALL
USING (public.user_has_org_access(org_id));

CREATE INDEX idx_contractor_jobs_property ON public.contractor_jobs(property_id);
CREATE INDEX idx_contractor_jobs_contractor ON public.contractor_jobs(contractor_id);
CREATE INDEX idx_contractor_jobs_status ON public.contractor_jobs(status) WHERE status NOT IN ('completed', 'verified', 'cancelled');
CREATE INDEX idx_contractor_jobs_booked ON public.contractor_jobs(booked_date) WHERE booked_date IS NOT NULL;

-- ============================================
-- CONTRACTOR REVIEWS TABLE
-- ============================================

CREATE TABLE public.contractor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE SET NULL,
  
  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Review details
  review_text TEXT,
  
  -- Specific ratings (optional)
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  
  -- Metadata
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage reviews"
ON public.contractor_reviews
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- JOB REQUEST TEMPLATES
-- ============================================

CREATE TABLE public.job_request_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Template details
  name TEXT NOT NULL,
  compliance_type TEXT, -- NULL = generic template
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  -- Placeholders: {{property_address}}, {{compliance_type}}, {{expiry_date}}, {{contact_name}}, {{contact_phone}}
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_request_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage templates"
ON public.job_request_templates
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- CONTRACTOR SERVICE AREAS (for smart matching)
-- ============================================

CREATE TABLE public.contractor_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE NOT NULL,
  
  -- Area definition (one of these)
  postcode_prefix TEXT, -- e.g., 'GL50', 'GL51', 'GL'
  postcode_district TEXT, -- e.g., 'GL50'
  city TEXT,
  county TEXT,
  
  -- Priority (lower = preferred)
  priority INTEGER DEFAULT 1,
  
  UNIQUE(contractor_id, postcode_prefix)
);

ALTER TABLE public.contractor_service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage service areas"
ON public.contractor_service_areas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contractors c
    WHERE c.id = contractor_id
    AND public.user_has_org_access(c.org_id)
  )
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to find matching contractors for a job
CREATE OR REPLACE FUNCTION find_matching_contractors(
  p_org_id UUID,
  p_compliance_type TEXT,
  p_postcode TEXT
)
RETURNS TABLE (
  contractor_id UUID,
  name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  average_rating DECIMAL,
  total_jobs INTEGER,
  typical_cost INTEGER,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_postcode_prefix TEXT;
  v_postcode_district TEXT;
BEGIN
  -- Extract postcode parts
  v_postcode_district := split_part(p_postcode, ' ', 1); -- e.g., 'GL50'
  v_postcode_prefix := substring(v_postcode_district from '^[A-Z]+'); -- e.g., 'GL'
  
  RETURN QUERY
  SELECT 
    c.id as contractor_id,
    c.name,
    c.company_name,
    c.email,
    c.phone,
    c.average_rating,
    c.total_jobs,
    (c.typical_costs->>p_compliance_type)::INTEGER as typical_cost,
    (
      -- Calculate match score
      CASE WHEN p_compliance_type = ANY(c.compliance_types) THEN 50 ELSE 0 END +
      CASE WHEN c.is_preferred THEN 30 ELSE 0 END +
      CASE WHEN c.average_rating >= 4 THEN 20 ELSE (c.average_rating * 4)::INTEGER END +
      CASE WHEN EXISTS (
        SELECT 1 FROM contractor_service_areas csa
        WHERE csa.contractor_id = c.id
        AND (csa.postcode_district = v_postcode_district OR csa.postcode_prefix = v_postcode_prefix)
      ) THEN 25 ELSE 0 END
    ) as match_score
  FROM contractors c
  WHERE c.org_id = p_org_id
  AND c.is_active = true
  AND (
    p_compliance_type = ANY(c.compliance_types)
    OR array_length(c.compliance_types, 1) IS NULL
  )
  ORDER BY match_score DESC, c.average_rating DESC NULLS LAST, c.total_jobs DESC
  LIMIT 10;
END;
$$;

-- Function to update contractor stats after job completion
CREATE OR REPLACE FUNCTION update_contractor_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
    -- Update contractor stats
    UPDATE contractors
    SET 
      total_jobs = total_jobs + 1,
      last_used_at = now()
    WHERE id = NEW.contractor_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_job_completed_trigger
AFTER UPDATE ON public.contractor_jobs
FOR EACH ROW
EXECUTE FUNCTION update_contractor_stats();

-- Function to update contractor rating after review
CREATE OR REPLACE FUNCTION update_contractor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE contractors
  SET average_rating = (
    SELECT ROUND(AVG(rating)::NUMERIC, 1)
    FROM contractor_reviews
    WHERE contractor_id = NEW.contractor_id
  )
  WHERE id = NEW.contractor_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractor_review_trigger
AFTER INSERT OR UPDATE ON public.contractor_reviews
FOR EACH ROW
EXECUTE FUNCTION update_contractor_rating();

-- ============================================
-- DEFAULT JOB REQUEST TEMPLATES
-- ============================================

-- Insert will be done per-org, but here's the structure for reference
COMMENT ON TABLE job_request_templates IS 'Default templates:
Subject: {{compliance_type}} Required - {{property_address}}
Body:
Hi,

I require a {{compliance_type}} for the following property:

{{property_address}}

Current certificate expires: {{expiry_date}}

Please could you provide a quote and your earliest availability?

Contact: {{contact_name}} - {{contact_phone}}

Kind regards
';
```

---

# Edge Functions

## supabase/functions/send-job-request/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface JobRequestParams {
  jobId: string;
  customMessage?: string;
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'HydrogenCap <jobs@hydrogencap.com>',
      to: [to],
      subject,
      html,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send email: ${await res.text()}`);
  }

  return res.json();
}

function generateJobRequestEmail(params: {
  contractorName: string;
  complianceType: string;
  propertyAddress: string;
  expiryDate: string | null;
  customMessage: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  jobReference: string;
}): { subject: string; html: string } {
  const {
    contractorName,
    complianceType,
    propertyAddress,
    expiryDate,
    customMessage,
    senderName,
    senderEmail,
    senderPhone,
    jobReference,
  } = params;

  const subject = `Job Request: ${complianceType} - ${propertyAddress.split(',')[0]}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Job Request</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Reference: ${jobReference}</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi ${contractorName},</p>
    
    <p>I would like to request a quote for the following work:</p>
    
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #14b8a6;">${complianceType}</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Property:</td>
          <td style="padding: 8px 0; font-weight: 500;">${propertyAddress}</td>
        </tr>
        ${expiryDate ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Current Expiry:</td>
          <td style="padding: 8px 0; font-weight: 500;">${new Date(expiryDate).toLocaleDateString('en-GB', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${customMessage ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; white-space: pre-wrap;">${customMessage}</p>
    </div>
    ` : ''}
    
    <p>Please reply to this email with:</p>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li>Your quote for this work</li>
      <li>Your earliest available dates</li>
      <li>Any questions about the property or requirements</li>
    </ul>
    
    <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 5px 0; font-weight: 600;">Contact Details</p>
      <p style="margin: 0; color: #6b7280;">
        ${senderName}<br>
        ${senderEmail}
        ${senderPhone ? `<br>${senderPhone}` : ''}
      </p>
    </div>
    
    <p style="margin-bottom: 0;">Kind regards,<br>${senderName}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Sent via HydrogenCap Property Management</p>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

serve(async (req) => {
  try {
    const { jobId, customMessage }: JobRequestParams = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400 });
    }

    // Get job details with related data
    const { data: job, error: jobError } = await supabase
      .from('contractor_jobs')
      .select(`
        *,
        contractor:contractors(*),
        property:properties(address_line, postcode),
        compliance_item:compliance_items(compliance_type, expiry_date)
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
    }

    if (!job.contractor?.email) {
      return new Response(JSON.stringify({ error: 'Contractor has no email' }), { status: 400 });
    }

    // Get sender (user who created the job)
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', job.created_by)
      .single();

    const { data: senderAuth } = await supabase.auth.admin.getUserById(job.created_by);

    // Generate job reference
    const jobRef = `JOB-${job.id.slice(0, 8).toUpperCase()}`;

    // Generate email
    const { subject, html } = generateJobRequestEmail({
      contractorName: job.contractor.name,
      complianceType: job.job_type,
      propertyAddress: `${job.property.address_line}, ${job.property.postcode}`,
      expiryDate: job.compliance_item?.expiry_date,
      customMessage: customMessage || job.request_message || '',
      senderName: senderProfile?.full_name || 'Property Manager',
      senderEmail: senderAuth?.user?.email || '',
      senderPhone: senderProfile?.phone,
      jobReference: jobRef,
    });

    // Send email
    await sendEmail(
      job.contractor.email,
      subject,
      html,
      senderAuth?.user?.email
    );

    // Update job status
    await supabase
      .from('contractor_jobs')
      .update({
        status: 'requested',
        requested_at: new Date().toISOString(),
        request_message: customMessage || job.request_message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Log notification
    await supabase.from('notification_log').insert({
      org_id: job.org_id,
      user_id: job.created_by,
      notification_type: 'job_request',
      reference_type: 'contractor_job',
      reference_id: jobId,
      channel: 'email',
      recipient: job.contractor.email,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      jobReference: jobRef,
      sentTo: job.contractor.email,
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

## supabase/functions/send-job-reminders/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    const results = [];

    // 1. Find jobs requested but no response in 3+ days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingJobs } = await supabase
      .from('contractor_jobs')
      .select(`
        *,
        contractor:contractors(name, email),
        property:properties(address_line)
      `)
      .eq('status', 'requested')
      .lt('requested_at', threeDaysAgo.toISOString());

    for (const job of pendingJobs || []) {
      // Send reminder to contractor
      if (job.contractor?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'HydrogenCap <jobs@hydrogencap.com>',
            to: [job.contractor.email],
            subject: `Reminder: Quote requested - ${job.property.address_line}`,
            html: `
              <p>Hi ${job.contractor.name},</p>
              <p>This is a reminder about a job request sent ${Math.floor((Date.now() - new Date(job.requested_at).getTime()) / (1000 * 60 * 60 * 24))} days ago.</p>
              <p><strong>${job.job_type}</strong> at ${job.property.address_line}</p>
              <p>Please reply with your quote and availability, or let us know if you're unable to take this job.</p>
            `,
          }),
        });

        results.push({ jobId: job.id, type: 'contractor_reminder', sent: true });
      }
    }

    // 2. Find booked jobs happening tomorrow - remind owner
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: tomorrowJobs } = await supabase
      .from('contractor_jobs')
      .select(`
        *,
        contractor:contractors(name, phone),
        property:properties(address_line)
      `)
      .eq('status', 'booked')
      .eq('booked_date', tomorrowStr);

    // Would send reminder to property owner/manager here
    // Implementation similar to above

    return new Response(JSON.stringify({
      processed: results.length,
      results,
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

# Frontend Hooks

## src/hooks/useContractorJobs.ts

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

export interface MatchingContractor {
  contractor_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  average_rating: number;
  total_jobs: number;
  typical_cost: number | null;
  match_score: number;
}

// Get all jobs
export function useContractorJobs(filters?: {
  status?: string[];
  propertyId?: string;
  contractorId?: string;
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
      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.contractorId) {
        query = query.eq('contractor_id', filters.contractorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContractorJob[];
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
          property:properties(id, address_line, postcode),
          compliance_item:compliance_items(id, compliance_type, expiry_date)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data as ContractorJob;
    },
    enabled: !!jobId,
  });
}

// Get jobs for calendar view
export function useJobsCalendar(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['contractor-jobs-calendar', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractor_jobs')
        .select(`
          id,
          job_type,
          status,
          booked_date,
          booked_time_slot,
          contractor:contractors(name),
          property:properties(address_line)
        `)
        .gte('booked_date', startDate.toISOString().split('T')[0])
        .lte('booked_date', endDate.toISOString().split('T')[0])
        .not('booked_date', 'is', null);

      if (error) throw error;
      return data;
    },
  });
}

// Find matching contractors for a job
export function useMatchingContractors(complianceType: string, postcode: string) {
  return useQuery({
    queryKey: ['matching-contractors', complianceType, postcode],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      if (!membership) return [];

      const { data, error } = await supabase
        .rpc('find_matching_contractors', {
          p_org_id: membership.org_id,
          p_compliance_type: complianceType,
          p_postcode: postcode,
        });

      if (error) throw error;
      return data as MatchingContractor[];
    },
    enabled: !!complianceType && !!postcode,
  });
}

// Create job
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
          status: job.contractorId ? 'draft' : 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      toast({ title: 'Job created' });
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
      toast({ title: 'Job updated' });
    },
  });
}

// Send job request
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

// Mark job as booked
export function useBookJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      bookedDate,
      bookedTimeSlot,
      quotedAmount,
    }: {
      jobId: string;
      bookedDate: string;
      bookedTimeSlot?: string;
      quotedAmount?: number;
    }) => {
      const { error } = await supabase
        .from('contractor_jobs')
        .update({
          status: 'booked',
          booked_date: bookedDate,
          booked_time_slot: bookedTimeSlot || null,
          quoted_amount_gbp: quotedAmount || null,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      toast({ title: 'Job booked' });
    },
  });
}

// Mark job as completed
export function useCompleteJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      finalAmount,
      notes,
    }: {
      jobId: string;
      finalAmount?: number;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('contractor_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          final_amount_gbp: finalAmount || null,
          contractor_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
      toast({ title: 'Job marked as completed' });
    },
  });
}
```

## src/hooks/useContractors.ts (Enhanced)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Contractor {
  id: string;
  org_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  compliance_types: string[];
  service_areas: string[];
  notes: string | null;
  is_preferred: boolean;
  is_active: boolean;
  average_rating: number;
  total_jobs: number;
  avg_response_hours: number | null;
  hourly_rate_gbp: number | null;
  call_out_fee_gbp: number | null;
  typical_costs: Record<string, number>;
  availability_notes: string | null;
  last_used_at: string | null;
}

export interface ContractorReview {
  id: string;
  contractor_id: string;
  job_id: string | null;
  rating: number;
  review_text: string | null;
  punctuality_rating: number | null;
  quality_rating: number | null;
  value_rating: number | null;
  communication_rating: number | null;
  created_at: string;
  reviewed_by: string;
}

// Get all contractors
export function useContractors(filters?: {
  complianceType?: string;
  isActive?: boolean;
  isPreferred?: boolean;
}) {
  return useQuery({
    queryKey: ['contractors', filters],
    queryFn: async () => {
      let query = supabase
        .from('contractors')
        .select('*')
        .order('is_preferred', { ascending: false })
        .order('average_rating', { ascending: false, nullsFirst: false })
        .order('name');

      if (filters?.complianceType) {
        query = query.contains('compliance_types', [filters.complianceType]);
      }
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      if (filters?.isPreferred !== undefined) {
        query = query.eq('is_preferred', filters.isPreferred);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contractor[];
    },
  });
}

// Get single contractor with reviews
export function useContractor(contractorId: string | undefined) {
  return useQuery({
    queryKey: ['contractor', contractorId],
    queryFn: async () => {
      if (!contractorId) return null;

      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .eq('id', contractorId)
        .single();

      if (error) throw error;
      return data as Contractor;
    },
    enabled: !!contractorId,
  });
}

// Get contractor reviews
export function useContractorReviews(contractorId: string | undefined) {
  return useQuery({
    queryKey: ['contractor-reviews', contractorId],
    queryFn: async () => {
      if (!contractorId) return [];

      const { data, error } = await supabase
        .from('contractor_reviews')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContractorReview[];
    },
    enabled: !!contractorId,
  });
}

// Get contractor job history
export function useContractorJobHistory(contractorId: string | undefined) {
  return useQuery({
    queryKey: ['contractor-job-history', contractorId],
    queryFn: async () => {
      if (!contractorId) return [];

      const { data, error } = await supabase
        .from('contractor_jobs')
        .select(`
          id,
          job_type,
          status,
          booked_date,
          completed_at,
          final_amount_gbp,
          property:properties(address_line)
        `)
        .eq('contractor_id', contractorId)
        .in('status', ['completed', 'verified'])
        .order('completed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!contractorId,
  });
}

// Create contractor
export function useCreateContractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contractor: Omit<Contractor, 'id' | 'org_id' | 'average_rating' | 'total_jobs' | 'last_used_at'>) => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      const { data, error } = await supabase
        .from('contractors')
        .insert({ ...contractor, org_id: membership!.org_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast({ title: 'Contractor added' });
    },
  });
}

// Update contractor
export function useUpdateContractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contractor> & { id: string }) => {
      const { data, error } = await supabase
        .from('contractors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      queryClient.invalidateQueries({ queryKey: ['contractor', data.id] });
      toast({ title: 'Contractor updated' });
    },
  });
}

// Add review
export function useAddContractorReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (review: {
      contractorId: string;
      jobId?: string;
      rating: number;
      reviewText?: string;
      punctualityRating?: number;
      qualityRating?: number;
      valueRating?: number;
      communicationRating?: number;
    }) => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('contractor_reviews')
        .insert({
          org_id: membership!.org_id,
          contractor_id: review.contractorId,
          job_id: review.jobId || null,
          rating: review.rating,
          review_text: review.reviewText || null,
          punctuality_rating: review.punctualityRating || null,
          quality_rating: review.qualityRating || null,
          value_rating: review.valueRating || null,
          communication_rating: review.communicationRating || null,
          reviewed_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      queryClient.invalidateQueries({ queryKey: ['contractor-reviews', data.contractor_id] });
      toast({ title: 'Review added' });
    },
  });
}

// Delete contractor
export function useDeleteContractor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contractors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast({ title: 'Contractor removed' });
    },
  });
}
```

---

# Frontend Components

## src/pages/Contractors.tsx

```tsx
import React, { useState } from 'react';
import { Plus, Search, Star, Phone, Mail, MapPin, Briefcase, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContractors } from '@/hooks/useContractors';
import { COMPLIANCE_TYPES } from '@/lib/complianceTypes';
import { ContractorCard } from '@/components/contractors/ContractorCard';
import { AddContractorDialog } from '@/components/contractors/AddContractorDialog';
import { ContractorDetailDrawer } from '@/components/contractors/ContractorDetailDrawer';

export default function Contractors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  const { data: contractors, isLoading } = useContractors({
    isActive: true,
    complianceType: complianceFilter !== 'all' ? complianceFilter : undefined,
  });

  const filteredContractors = contractors?.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const preferredContractors = filteredContractors?.filter(c => c.is_preferred) || [];
  const otherContractors = filteredContractors?.filter(c => !c.is_preferred) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contractor Directory</h1>
            <p className="text-muted-foreground">Manage your trusted contractors and service providers</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contractor
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contractors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-64">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {COMPLIANCE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contractors Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="h-48 animate-pulse bg-muted" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({filteredContractors?.length || 0})</TabsTrigger>
              <TabsTrigger value="preferred">
                <Star className="h-4 w-4 mr-1 fill-amber-400 text-amber-400" />
                Preferred ({preferredContractors.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {preferredContractors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    Preferred Contractors
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {preferredContractors.map(contractor => (
                      <ContractorCard
                        key={contractor.id}
                        contractor={contractor}
                        onClick={() => setSelectedContractorId(contractor.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otherContractors.length > 0 && (
                <div>
                  {preferredContractors.length > 0 && (
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Other Contractors</h3>
                  )}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {otherContractors.map(contractor => (
                      <ContractorCard
                        key={contractor.id}
                        contractor={contractor}
                        onClick={() => setSelectedContractorId(contractor.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredContractors?.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="font-medium mb-1">No contractors found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchTerm || complianceFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Add your first contractor to get started'}
                    </p>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contractor
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="preferred" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {preferredContractors.map(contractor => (
                  <ContractorCard
                    key={contractor.id}
                    contractor={contractor}
                    onClick={() => setSelectedContractorId(contractor.id)}
                  />
                ))}
              </div>
              {preferredContractors.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="font-medium mb-1">No preferred contractors</h3>
                    <p className="text-sm text-muted-foreground">
                      Mark contractors as preferred to see them here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AddContractorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      <ContractorDetailDrawer
        contractorId={selectedContractorId}
        open={!!selectedContractorId}
        onOpenChange={(open) => !open && setSelectedContractorId(null)}
      />
    </AppLayout>
  );
}
```

## src/components/contractors/ContractorCard.tsx

```tsx
import React from 'react';
import { Star, Phone, Mail, MapPin, Briefcase, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type Contractor } from '@/hooks/useContractors';
import { cn } from '@/lib/utils';

interface ContractorCardProps {
  contractor: Contractor;
  onClick?: () => void;
  selected?: boolean;
}

export function ContractorCard({ contractor, onClick, selected }: ContractorCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{contractor.name}</h3>
              {contractor.is_preferred && (
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              )}
            </div>
            {contractor.company_name && (
              <p className="text-sm text-muted-foreground">{contractor.company_name}</p>
            )}
          </div>
          {contractor.average_rating > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium">{contractor.average_rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          {contractor.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {contractor.phone}
            </div>
          )}
          {contractor.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span className="truncate">{contractor.email}</span>
            </div>
          )}
        </div>

        {/* Services */}
        <div className="flex flex-wrap gap-1">
          {contractor.compliance_types.slice(0, 3).map(type => (
            <Badge key={type} variant="secondary" className="text-xs">
              {type.split(' ')[0]}
            </Badge>
          ))}
          {contractor.compliance_types.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{contractor.compliance_types.length - 3}
            </Badge>
          )}
        </div>

        {/* Stats */}
        {contractor.total_jobs > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {contractor.total_jobs} jobs completed
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## src/components/contractors/RequestJobDialog.tsx

```tsx
import React, { useState } from 'react';
import { Send, User, Building2, Star, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMatchingContractors, useCreateJob, useSendJobRequest } from '@/hooks/useContractorJobs';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface RequestJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  propertyPostcode: string;
  complianceItemId?: string;
  complianceType: string;
  expiryDate?: string | null;
}

export function RequestJobDialog({
  open,
  onOpenChange,
  propertyId,
  propertyAddress,
  propertyPostcode,
  complianceItemId,
  complianceType,
  expiryDate,
}: RequestJobDialogProps) {
  const [step, setStep] = useState<'select' | 'message' | 'sent'>('select');
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');

  const { data: contractors, isLoading: loadingContractors } = useMatchingContractors(
    complianceType,
    propertyPostcode
  );

  const createJob = useCreateJob();
  const sendRequest = useSendJobRequest();

  const selectedContractor = contractors?.find(c => c.contractor_id === selectedContractorId);

  const handleSendRequest = async () => {
    if (!selectedContractorId) return;

    try {
      // Create the job
      const job = await createJob.mutateAsync({
        propertyId,
        complianceItemId,
        contractorId: selectedContractorId,
        jobType: complianceType,
        requestMessage: customMessage,
      });

      // Send the request
      await sendRequest.mutateAsync({
        jobId: job.id,
        customMessage,
      });

      setStep('sent');
    } catch (error) {
      // Error handled by hooks
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep('select');
      setSelectedContractorId(null);
      setCustomMessage('');
    }, 200);
  };

  const isSubmitting = createJob.isPending || sendRequest.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request {complianceType}</DialogTitle>
          <DialogDescription>
            {propertyAddress}
            {expiryDate && (
              <span className="text-amber-600 ml-2">
                • Expires {new Date(expiryDate).toLocaleDateString('en-GB')}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'sent' ? (
          <div className="py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 mx-auto mb-4 flex items-center justify-center">
              <Send className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Request Sent!</h3>
            <p className="text-muted-foreground mb-4">
              Your job request has been sent to {selectedContractor?.name}.
              You'll receive their quote by email.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : step === 'select' ? (
          <>
            <div className="py-4">
              <Label className="mb-3 block">Select a Contractor</Label>
              
              {loadingContractors ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : contractors?.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No contractors found for {complianceType} in {propertyPostcode}.
                    <Button variant="link" className="px-1 h-auto">Add a contractor</Button>
                  </AlertDescription>
                </Alert>
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
                                <Badge variant="secondary" className="text-xs">
                                  Best Match
                                </Badge>
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
              <Button
                onClick={() => setStep('message')}
                disabled={!selectedContractorId}
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-4">
              {/* Selected contractor summary */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedContractor?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedContractor?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Additional Message (optional)</Label>
                <Textarea
                  id="message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add any specific requirements, access instructions, or questions..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  The contractor will receive the property address, compliance type, and expiry date automatically.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button onClick={handleSendRequest} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Request</>
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

## src/components/contractors/JobTrackerWidget.tsx

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, Calendar, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContractorJobs } from '@/hooks/useContractorJobs';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Briefcase },
  requested: { label: 'Awaiting Quote', color: 'bg-blue-100 text-blue-700', icon: Clock },
  quoted: { label: 'Quote Received', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
  booked: { label: 'Booked', color: 'bg-amber-100 text-amber-700', icon: Calendar },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-700', icon: Briefcase },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: AlertCircle },
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
            <Link to="/jobs">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 p-4 pt-0">
            {jobs.map(job => {
              const config = STATUS_CONFIG[job.status];
              const Icon = config.icon;

              return (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
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
```

## src/components/contractors/AddContractorDialog.tsx

```tsx
import React, { useState } from 'react';
import { Loader2, Plus, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useCreateContractor } from '@/hooks/useContractors';
import { COMPLIANCE_TYPES } from '@/lib/complianceTypes';

interface AddContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContractorDialog({ open, onOpenChange }: AddContractorDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    website: '',
    compliance_types: [] as string[],
    service_areas: [] as string[],
    notes: '',
    is_preferred: false,
    hourly_rate_gbp: '',
    call_out_fee_gbp: '',
  });

  const createContractor = useCreateContractor();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createContractor.mutateAsync({
      name: formData.name,
      company_name: formData.company_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      website: formData.website || null,
      compliance_types: formData.compliance_types,
      service_areas: formData.service_areas,
      notes: formData.notes || null,
      is_preferred: formData.is_preferred,
      is_active: true,
      hourly_rate_gbp: formData.hourly_rate_gbp ? parseInt(formData.hourly_rate_gbp) : null,
      call_out_fee_gbp: formData.call_out_fee_gbp ? parseInt(formData.call_out_fee_gbp) : null,
      typical_costs: {},
      availability_notes: null,
      avg_response_hours: null,
    });

    onOpenChange(false);
    setFormData({
      name: '',
      company_name: '',
      email: '',
      phone: '',
      website: '',
      compliance_types: [],
      service_areas: [],
      notes: '',
      is_preferred: false,
      hourly_rate_gbp: '',
      call_out_fee_gbp: '',
    });
  };

  const toggleComplianceType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      compliance_types: prev.compliance_types.includes(type)
        ? prev.compliance_types.filter(t => t !== type)
        : [...prev.compliance_types, type],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Contractor</DialogTitle>
            <DialogDescription>
              Add a new contractor or service provider to your directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Contact Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <Label>Services Provided</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                {COMPLIANCE_TYPES.filter(t => t !== 'Other').map(type => (
                  <Badge
                    key={type}
                    variant={formData.compliance_types.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleComplianceType(type)}
                  >
                    {type.split('(')[0].trim()}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click to select services this contractor provides</p>
            </div>

            {/* Rates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourly">Hourly Rate (£)</Label>
                <Input
                  id="hourly"
                  type="number"
                  value={formData.hourly_rate_gbp}
                  onChange={(e) => setFormData({ ...formData, hourly_rate_gbp: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="callout">Call-out Fee (£)</Label>
                <Input
                  id="callout"
                  type="number"
                  value={formData.call_out_fee_gbp}
                  onChange={(e) => setFormData({ ...formData, call_out_fee_gbp: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this contractor..."
                rows={3}
              />
            </div>

            {/* Preferred */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preferred"
                checked={formData.is_preferred}
                onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: !!checked })}
              />
              <label htmlFor="preferred" className="text-sm cursor-pointer flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" />
                Mark as preferred contractor
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || createContractor.isPending}>
              {createContractor.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Add Contractor</>
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

## Add "Book Renewal" button to compliance items

In the compliance table or detail view:

```tsx
import { RequestJobDialog } from '@/components/contractors/RequestJobDialog';

// In component:
const [showJobDialog, setShowJobDialog] = useState(false);
const [selectedCompliance, setSelectedCompliance] = useState<ComplianceItem | null>(null);

// Button:
<Button
  size="sm"
  variant="outline"
  onClick={() => {
    setSelectedCompliance(item);
    setShowJobDialog(true);
  }}
>
  <Briefcase className="h-4 w-4 mr-1" />
  Book Renewal
</Button>

// Dialog:
{selectedCompliance && (
  <RequestJobDialog
    open={showJobDialog}
    onOpenChange={setShowJobDialog}
    propertyId={selectedCompliance.property_id}
    propertyAddress={propertyAddress}
    propertyPostcode={propertyPostcode}
    complianceItemId={selectedCompliance.id}
    complianceType={selectedCompliance.compliance_type}
    expiryDate={selectedCompliance.expiry_date}
  />
)}
```

## Add Jobs Widget to Dashboard

```tsx
import { JobTrackerWidget } from '@/components/contractors/JobTrackerWidget';

// In Dashboard layout:
<JobTrackerWidget />
```

## Add to Navigation

```tsx
// In AppSidebar.tsx nav items:
{ title: 'Contractors', icon: Briefcase, href: '/contractors' },
{ title: 'Jobs', icon: ClipboardList, href: '/jobs' },
```

---

# Implementation Checklist

## Week 1: Database & Backend
- [ ] Run database migration
- [ ] Deploy send-job-request edge function
- [ ] Deploy send-job-reminders edge function
- [ ] Set up daily cron for job reminders
- [ ] Test job request emails

## Week 2: Contractor Directory
- [ ] Create useContractors hooks (enhanced)
- [ ] Create Contractors page
- [ ] Create ContractorCard component
- [ ] Create AddContractorDialog component
- [ ] Create ContractorDetailDrawer component
- [ ] Add to navigation

## Week 3: Job System
- [ ] Create useContractorJobs hooks
- [ ] Create RequestJobDialog component
- [ ] Create JobTrackerWidget component
- [ ] Create Jobs list page
- [ ] Create Job detail page
- [ ] Integrate with compliance items

## Week 4: Polish & Reviews
- [ ] Create review system components
- [ ] Add contractor ratings display
- [ ] Calendar integration for booked jobs
- [ ] Job status workflow testing
- [ ] Email template refinement

---

*Ready for Lovable.dev implementation*
