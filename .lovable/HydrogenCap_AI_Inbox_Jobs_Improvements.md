# HydrogenCap Implementation Specification
## AI Email Inbox & Jobs System Improvements

Two major enhancements:
1. **AI Email Inbox** - Contractors email certificates → AI extracts data → auto-files → updates compliance
2. **Jobs System Improvements** - Better workflow, tracking, and automation

---

# Part 1: AI Email Inbox for Certificates

## The Vision

```
Contractor completes Gas Safety job
    ↓
Emails certificate to: certificates@hydrogencap.com
    ↓
AI reads email + attachment
    ↓
Extracts: Property address, certificate type, issue date, expiry date, engineer details
    ↓
Matches to property in database
    ↓
Files document in correct property folder
    ↓
Updates compliance item (new expiry date, status = valid)
    ↓
Marks job as "Certificate Received"
    ↓
Notifies user: "Gas Safety certificate received for 123 High Street"
```

---

## How It Works

### 1. Email Receiving

**Option A: Dedicated Email Domain (Recommended)**
- Set up `certificates@yourdomain.com` or `inbox@hydrogencap.app`
- Use email forwarding service (SendGrid Inbound Parse, Mailgun, Postmark)
- Webhook triggers when email received

**Option B: Per-Property Email Addresses**
- Each property gets unique email: `prop_abc123@inbox.hydrogencap.app`
- Automatically knows which property the certificate is for

**Option C: Per-Job Email Addresses**
- Each job gets unique email: `job_xyz789@inbox.hydrogencap.app`
- Automatically knows which job and property

### 2. AI Processing Pipeline

```
Email Received
    ↓
Extract attachments (PDF, images)
    ↓
Claude AI analyzes:
  - What type of certificate is this?
  - What property is it for?
  - What are the key dates?
  - Who issued it?
    ↓
Match to existing job (if job email) or property
    ↓
Create/update compliance item
    ↓
Store document
    ↓
Update job status
    ↓
Send confirmation
```

---

## Database Schema

```sql
-- ============================================
-- INBOUND EMAILS TABLE
-- ============================================

CREATE TABLE public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Email details
  message_id TEXT UNIQUE, -- Email message ID for deduplication
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Attachments (stored as JSON array)
  attachments JSONB DEFAULT '[]',
  -- [{filename, content_type, size_bytes, storage_url}]
  
  -- AI Processing
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'processed', 'failed', 'manual_review'
  )),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- AI Extraction Results
  ai_extraction JSONB,
  -- {
  --   certificate_type: 'gas_safety' | 'eicr' | 'epc' | etc,
  --   property_address: string,
  --   issue_date: date,
  --   expiry_date: date,
  --   engineer_name: string,
  --   engineer_id: string,
  --   certificate_number: string,
  --   confidence_score: 0-100,
  --   raw_text: string (OCR result)
  -- }
  
  -- Matching
  matched_property_id UUID REFERENCES public.properties(id),
  matched_job_id UUID REFERENCES public.contractor_jobs(id),
  matched_compliance_item_id UUID REFERENCES public.compliance_items(id),
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low', 'none')),
  
  -- Actions taken
  document_created_id UUID REFERENCES public.documents(id),
  compliance_updated BOOLEAN DEFAULT false,
  job_updated BOOLEAN DEFAULT false,
  
  -- Manual review
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_emails_org ON public.inbound_emails(org_id);
CREATE INDEX idx_inbound_emails_status ON public.inbound_emails(processing_status);
CREATE INDEX idx_inbound_emails_job ON public.inbound_emails(matched_job_id);
CREATE INDEX idx_inbound_emails_property ON public.inbound_emails(matched_property_id);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view inbound emails"
ON public.inbound_emails
FOR ALL
USING (public.user_has_org_access(org_id));

-- ============================================
-- JOB INBOX ADDRESSES
-- ============================================

-- Add unique inbox email per job
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS inbox_email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS inbox_email_token TEXT UNIQUE;

-- Generate inbox email when job created
CREATE OR REPLACE FUNCTION generate_job_inbox_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate unique token
  v_token := encode(gen_random_bytes(8), 'hex');
  
  NEW.inbox_email_token := v_token;
  NEW.inbox_email := 'job-' || v_token || '@inbox.hydrogencap.app';
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER job_inbox_email_trigger
BEFORE INSERT ON public.contractor_jobs
FOR EACH ROW
EXECUTE FUNCTION generate_job_inbox_email();

-- ============================================
-- CERTIFICATE TYPES MAPPING
-- ============================================

CREATE TABLE public.certificate_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What AI might detect
  ai_detected_type TEXT NOT NULL,
  keywords TEXT[], -- Keywords to help matching
  
  -- Maps to
  compliance_type TEXT NOT NULL,
  document_category TEXT NOT NULL,
  
  -- Validation
  has_expiry BOOLEAN DEFAULT true,
  typical_validity_years INTEGER,
  
  UNIQUE(ai_detected_type)
);

-- Insert mappings
INSERT INTO public.certificate_type_mappings 
(ai_detected_type, keywords, compliance_type, document_category, has_expiry, typical_validity_years) VALUES
('gas_safety', ARRAY['gas safety', 'cp12', 'landlord gas safety record', 'lgsr'], 'Gas Safety Certificate', 'gas-safety', true, 1),
('eicr', ARRAY['eicr', 'electrical installation condition report', 'electrical safety'], 'EICR', 'eicr', true, 5),
('epc', ARRAY['epc', 'energy performance certificate', 'energy rating'], 'EPC', 'epc', true, 10),
('pat', ARRAY['pat', 'portable appliance testing', 'pat testing'], 'PAT Testing', 'pat-testing', true, 1),
('fire_alarm', ARRAY['fire alarm', 'fire detection', 'smoke alarm', 'fire safety'], 'Fire Alarm Service', 'fire-safety', true, 1),
('emergency_lighting', ARRAY['emergency lighting', 'emergency light test'], 'Emergency Lighting', 'fire-safety', true, 1),
('fire_extinguisher', ARRAY['fire extinguisher', 'extinguisher service'], 'Fire Extinguisher Service', 'fire-safety', true, 1),
('fire_risk_assessment', ARRAY['fire risk assessment', 'fra'], 'Fire Risk Assessment', 'fire-safety', true, 1),
('legionella', ARRAY['legionella', 'water hygiene', 'water risk assessment'], 'Legionella Risk Assessment', 'legionella', true, 2),
('asbestos', ARRAY['asbestos', 'asbestos survey', 'asbestos register'], 'Asbestos Survey', 'asbestos', false, NULL),
('hmo_licence', ARRAY['hmo licence', 'hmo license', 'house in multiple occupation'], 'HMO Licence', 'hmo-licence', true, 5),
('insurance', ARRAY['insurance certificate', 'insurance schedule', 'policy schedule'], 'Insurance', 'insurance', true, 1);
```

---

## Edge Function: Process Inbound Email

### supabase/functions/process-inbound-email/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

serve(async (req) => {
  try {
    // Parse inbound email webhook (format depends on provider)
    const emailData = await req.json();
    
    const {
      from,
      to,
      subject,
      text,
      html,
      attachments, // [{filename, content_type, data (base64)}]
      message_id,
    } = emailData;

    // Determine org from email address
    const toEmail = to.toLowerCase();
    let orgId: string | null = null;
    let matchedJobId: string | null = null;
    let matchedPropertyId: string | null = null;

    // Check if this is a job-specific email (job-xxxxx@inbox.hydrogencap.app)
    const jobMatch = toEmail.match(/job-([a-f0-9]+)@/);
    if (jobMatch) {
      const token = jobMatch[1];
      const { data: job } = await supabase
        .from('contractor_jobs')
        .select('id, org_id, property_id')
        .eq('inbox_email_token', token)
        .single();
      
      if (job) {
        orgId = job.org_id;
        matchedJobId = job.id;
        matchedPropertyId = job.property_id;
      }
    }

    if (!orgId) {
      // Try to match org from general inbox
      // This would require additional logic based on your setup
      throw new Error('Could not determine organization from email');
    }

    // Store email record
    const { data: emailRecord, error: emailError } = await supabase
      .from('inbound_emails')
      .insert({
        org_id: orgId,
        message_id,
        from_email: from.address || from,
        from_name: from.name || null,
        to_email: to,
        subject,
        body_text: text,
        body_html: html,
        attachments: attachments?.map((a: any) => ({
          filename: a.filename,
          content_type: a.content_type,
          size_bytes: a.size,
        })) || [],
        matched_job_id: matchedJobId,
        matched_property_id: matchedPropertyId,
        processing_status: 'processing',
      })
      .select()
      .single();

    if (emailError) throw emailError;

    // Process attachments
    for (const attachment of attachments || []) {
      if (!attachment.data) continue;

      // Store attachment in Supabase Storage
      const filePath = `${orgId}/inbox/${emailRecord.id}/${attachment.filename}`;
      const fileBuffer = Uint8Array.from(atob(attachment.data), c => c.charCodeAt(0));
      
      await supabase.storage
        .from('documents')
        .upload(filePath, fileBuffer, {
          contentType: attachment.content_type,
        });

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update attachment with storage URL
      attachment.storage_url = urlData.publicUrl;

      // If PDF or image, send to Claude for extraction
      if (attachment.content_type.includes('pdf') || attachment.content_type.includes('image')) {
        const extraction = await extractCertificateData(attachment.data, attachment.content_type);
        
        // Update email record with extraction
        await supabase
          .from('inbound_emails')
          .update({
            ai_extraction: extraction,
            attachments: attachments.map((a: any) => ({
              filename: a.filename,
              content_type: a.content_type,
              size_bytes: a.size,
              storage_url: a.storage_url,
            })),
          })
          .eq('id', emailRecord.id);

        // If we have high confidence, auto-process
        if (extraction.confidence_score >= 80) {
          await autoProcessCertificate(
            emailRecord.id,
            orgId,
            matchedPropertyId,
            matchedJobId,
            extraction,
            attachment.storage_url
          );
        } else {
          // Flag for manual review
          await supabase
            .from('inbound_emails')
            .update({
              requires_review: true,
              processing_status: 'manual_review',
              match_confidence: extraction.confidence_score >= 50 ? 'medium' : 'low',
            })
            .eq('id', emailRecord.id);
        }
      }
    }

    // Mark as processed
    await supabase
      .from('inbound_emails')
      .update({
        processing_status: emailRecord.requires_review ? 'manual_review' : 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', emailRecord.id);

    return new Response(JSON.stringify({ success: true, emailId: emailRecord.id }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Extract data from certificate using Claude
async function extractCertificateData(base64Data: string, contentType: string) {
  const mediaType = contentType.includes('pdf') 
    ? 'application/pdf' 
    : contentType.includes('png') ? 'image/png' : 'image/jpeg';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: mediaType === 'application/pdf' ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Analyze this certificate/document and extract the following information. Return ONLY valid JSON with no other text:

{
  "certificate_type": "gas_safety|eicr|epc|pat|fire_alarm|emergency_lighting|fire_risk_assessment|legionella|hmo_licence|insurance|unknown",
  "property_address": "full address from certificate",
  "postcode": "postcode only",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD or null if no expiry",
  "next_inspection_date": "YYYY-MM-DD or null",
  "engineer_name": "name of engineer/inspector",
  "engineer_registration": "Gas Safe number, NICEIC number, etc",
  "company_name": "company that issued certificate",
  "certificate_number": "certificate/report reference number",
  "result": "pass|fail|satisfactory|unsatisfactory|null",
  "defects_found": ["list of any defects or issues noted"],
  "confidence_score": 0-100
}

Be conservative with confidence_score:
- 90-100: All key fields clearly visible and extracted
- 70-89: Most fields extracted, some uncertainty
- 50-69: Partial extraction, needs review
- Below 50: Significant uncertainty

If this is not a recognizable certificate type, set certificate_type to "unknown".`,
          },
        ],
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Clean JSON from potential markdown code blocks
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return {
      certificate_type: 'unknown',
      confidence_score: 0,
      error: 'Failed to parse extraction',
    };
  }
}

// Auto-process high-confidence certificates
async function autoProcessCertificate(
  emailId: string,
  orgId: string,
  propertyId: string | null,
  jobId: string | null,
  extraction: any,
  documentUrl: string
) {
  // Get certificate type mapping
  const { data: mapping } = await supabase
    .from('certificate_type_mappings')
    .select('*')
    .eq('ai_detected_type', extraction.certificate_type)
    .single();

  if (!mapping) {
    // Unknown certificate type, flag for review
    await supabase
      .from('inbound_emails')
      .update({ requires_review: true, processing_status: 'manual_review' })
      .eq('id', emailId);
    return;
  }

  // If we don't have property ID, try to match from address
  if (!propertyId && extraction.postcode) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address_line, postcode')
      .eq('org_id', orgId)
      .ilike('postcode', `${extraction.postcode}%`);

    if (properties?.length === 1) {
      propertyId = properties[0].id;
    } else if (properties && properties.length > 1 && extraction.property_address) {
      // Try to match on address
      const matched = properties.find(p => 
        extraction.property_address.toLowerCase().includes(
          p.address_line.split(',')[0].toLowerCase()
        )
      );
      if (matched) propertyId = matched.id;
    }
  }

  if (!propertyId) {
    // Still can't match property, flag for review
    await supabase
      .from('inbound_emails')
      .update({ 
        requires_review: true, 
        processing_status: 'manual_review',
        match_confidence: 'low',
      })
      .eq('id', emailId);
    return;
  }

  // Create document record
  const { data: document } = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      property_id: propertyId,
      file_name: `${mapping.compliance_type}_${extraction.issue_date || 'unknown'}.pdf`,
      file_url: documentUrl,
      file_type: 'pdf',
      display_name: `${mapping.compliance_type} - ${extraction.issue_date || 'Unknown Date'}`,
      category: mapping.document_category,
      document_date: extraction.issue_date || null,
      expiry_date: extraction.expiry_date || null,
      compliance_item_id: null, // Will link after compliance update
    })
    .select()
    .single();

  // Update or create compliance item
  const complianceData = {
    org_id: orgId,
    property_id: propertyId,
    compliance_type: mapping.compliance_type,
    issue_date: extraction.issue_date,
    expiry_date: extraction.expiry_date,
    status: extraction.result === 'fail' || extraction.result === 'unsatisfactory' 
      ? 'action_required' 
      : 'valid',
    provider: extraction.company_name,
    reference_number: extraction.certificate_number,
    engineer_name: extraction.engineer_name,
    engineer_registration: extraction.engineer_registration,
    certificate_url: documentUrl,
    notes: extraction.defects_found?.length 
      ? `Defects: ${extraction.defects_found.join(', ')}`
      : null,
    auto_job_created: false, // Reset since we have new cert
    updated_at: new Date().toISOString(),
  };

  // Upsert compliance item
  const { data: compliance, error: complianceError } = await supabase
    .from('compliance_items')
    .upsert(complianceData, {
      onConflict: 'property_id,compliance_type',
    })
    .select()
    .single();

  // Link document to compliance item
  if (document && compliance) {
    await supabase
      .from('documents')
      .update({ compliance_item_id: compliance.id })
      .eq('id', document.id);
  }

  // If job exists, update job status
  if (jobId) {
    await supabase
      .from('contractor_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        certificate_received: true,
        certificate_received_at: new Date().toISOString(),
        certificate_document_id: document?.id,
      })
      .eq('id', jobId);

    // Add note to job
    await supabase
      .from('job_notes')
      .insert({
        job_id: jobId,
        note: `Certificate received via email and automatically processed. ${mapping.compliance_type} updated.`,
        created_by: null, // System
      });
  }

  // Update email record
  await supabase
    .from('inbound_emails')
    .update({
      matched_property_id: propertyId,
      matched_compliance_item_id: compliance?.id,
      document_created_id: document?.id,
      compliance_updated: true,
      job_updated: !!jobId,
      match_confidence: 'high',
      processing_status: 'processed',
    })
    .eq('id', emailId);

  // Send notification to user
  // (You'd implement this based on your notification system)
  console.log(`Certificate processed: ${mapping.compliance_type} for property ${propertyId}`);
}
```

---

## Frontend: AI Inbox Page

### src/pages/Inbox.tsx

```tsx
import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Mail, CheckCircle, AlertCircle, Clock, Eye, RefreshCw,
  FileText, Building2, Wrench, ChevronRight, Search, Filter
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInboundEmails, useReprocessEmail, InboundEmail } from '@/hooks/useInboundEmails';
import { ReviewEmailDialog } from '@/components/inbox/ReviewEmailDialog';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  processed: { label: 'Processed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  manual_review: { label: 'Needs Review', color: 'bg-amber-100 text-amber-700', icon: Eye },
};

export default function Inbox() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewingEmail, setReviewingEmail] = useState<InboundEmail | null>(null);

  const { data: emails, isLoading, refetch } = useInboundEmails({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const reprocess = useReprocessEmail();

  // Stats
  const stats = {
    total: emails?.length || 0,
    processed: emails?.filter(e => e.processing_status === 'processed').length || 0,
    needsReview: emails?.filter(e => e.processing_status === 'manual_review').length || 0,
    failed: emails?.filter(e => e.processing_status === 'failed').length || 0,
  };

  const filteredEmails = emails?.filter(email => {
    if (!searchTerm) return true;
    return (
      email.from_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.ai_extraction?.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Inbox</h1>
            <p className="text-muted-foreground">
              Certificates received via email are automatically processed
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Received</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Auto-Processed</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.processed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(stats.needsReview > 0 && "border-amber-200")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.needsReview}</p>
                </div>
                <Eye className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(stats.failed > 0 && "border-red-200")}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="manual_review">Needs Review</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Email List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : !filteredEmails?.length ? (
              <div className="p-8 text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No emails found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmails.map(email => {
                  const status = STATUS_CONFIG[email.processing_status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = status?.icon || Clock;
                  const extraction = email.ai_extraction;

                  return (
                    <div
                      key={email.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setReviewingEmail(email)}
                    >
                      {/* Status Icon */}
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        status?.color || "bg-slate-100"
                      )}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      {/* Email Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{email.from_name || email.from_email}</p>
                          <Badge variant="outline" className="shrink-0">
                            {extraction?.certificate_type || 'Unknown'}
                          </Badge>
                          {email.matched_job_id && (
                            <Badge variant="secondary" className="shrink-0">
                              <Wrench className="h-3 w-3 mr-1" />
                              Linked to Job
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {email.subject || '(No subject)'}
                        </p>
                        {extraction?.property_address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3" />
                            {extraction.property_address}
                          </p>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="text-right shrink-0">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(email.received_at), 'dd MMM HH:mm')}
                        </p>
                        {extraction?.confidence_score && (
                          <p className={cn(
                            "text-xs",
                            extraction.confidence_score >= 80 ? "text-emerald-600" :
                            extraction.confidence_score >= 50 ? "text-amber-600" :
                            "text-red-600"
                          )}>
                            {extraction.confidence_score}% confidence
                          </p>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      {reviewingEmail && (
        <ReviewEmailDialog
          open={!!reviewingEmail}
          onOpenChange={() => setReviewingEmail(null)}
          email={reviewingEmail}
        />
      )}
    </AppLayout>
  );
}
```

---

## Job Email Address Display

Add to JobDetail.tsx:

```tsx
{/* Inbox Email for Contractor */}
<Card>
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <Mail className="h-4 w-4" />
      Certificate Inbox
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-2">
      Contractor can email certificates directly to:
    </p>
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
        {job.inbox_email}
      </code>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(job.inbox_email);
          toast({ title: 'Email copied to clipboard' });
        }}
      >
        Copy
      </Button>
    </div>
    <p className="text-xs text-muted-foreground mt-2">
      Certificates sent here are automatically processed and filed.
    </p>
  </CardContent>
</Card>
```

---

# Part 2: Jobs System Improvements

## Current Problems

1. **No clear workflow stages** - Hard to see where jobs are stuck
2. **No follow-up tracking** - Contractor hasn't responded? No visibility
3. **No cost tracking** - Quoted vs actual, profit/loss per job
4. **No SLA/deadline tracking** - Which jobs are overdue?
5. **No bulk actions** - Can't update multiple jobs at once
6. **Poor mobile experience** - Hard to manage on the go
7. **No contractor performance** - Who's reliable vs who's slow?

## Improvements

### 1. Job Pipeline View (Kanban)

```tsx
// New view option: Pipeline/Kanban
// Columns: Draft | Requested | Quoted | Booked | In Progress | Completed | Verified

<div className="flex gap-4 overflow-x-auto pb-4">
  {PIPELINE_STAGES.map(stage => (
    <div key={stage.value} className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{stage.label}</h3>
        <Badge variant="secondary">{getJobsForStage(stage.value).length}</Badge>
      </div>
      <div className="space-y-3">
        {getJobsForStage(stage.value).map(job => (
          <JobCard key={job.id} job={job} compact />
        ))}
      </div>
    </div>
  ))}
</div>
```

### 2. Follow-Up Tracking

```sql
-- Add follow-up fields to contractor_jobs
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_follow_up_date DATE,
ADD COLUMN IF NOT EXISTS response_deadline DATE,
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN GENERATED ALWAYS AS (
  CASE 
    WHEN status = 'requested' AND response_deadline < CURRENT_DATE THEN true
    WHEN status = 'booked' AND booked_date < CURRENT_DATE AND status != 'completed' THEN true
    ELSE false
  END
) STORED;

-- Follow-up history
CREATE TABLE public.job_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE NOT NULL,
  follow_up_type TEXT CHECK (follow_up_type IN ('email', 'phone', 'sms', 'other')),
  message TEXT,
  response_received BOOLEAN DEFAULT false,
  response_text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. Cost Tracking & Analysis

```sql
-- Enhanced cost fields
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS budget_gbp INTEGER, -- Expected/budgeted cost
ADD COLUMN IF NOT EXISTS parts_cost_gbp INTEGER,
ADD COLUMN IF NOT EXISTS labour_cost_gbp INTEGER,
ADD COLUMN IF NOT EXISTS call_out_fee_gbp INTEGER,
ADD COLUMN IF NOT EXISTS vat_amount_gbp INTEGER,
ADD COLUMN IF NOT EXISTS total_cost_gbp INTEGER GENERATED ALWAYS AS (
  COALESCE(final_amount_gbp, quoted_amount_gbp, 0)
) STORED,
ADD COLUMN IF NOT EXISTS cost_variance_gbp INTEGER GENERATED ALWAYS AS (
  CASE WHEN budget_gbp IS NOT NULL AND final_amount_gbp IS NOT NULL
       THEN final_amount_gbp - budget_gbp
       ELSE NULL
  END
) STORED,
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
```

### 4. SLA & Deadline Tracking

```tsx
// Dashboard widget: Jobs Needing Attention
const urgentJobs = jobs?.filter(j => {
  // Overdue response (requested > 3 days ago, no quote)
  if (j.status === 'requested' && daysSince(j.requested_at) > 3) return true;
  // Approaching compliance expiry
  if (j.compliance_item?.expiry_date && daysUntil(j.compliance_item.expiry_date) <= 14) return true;
  // Booked date passed, not completed
  if (j.status === 'booked' && j.booked_date < today) return true;
  // Invoice overdue
  if (j.payment_status === 'pending' && j.payment_due_date < today) return true;
  return false;
});
```

### 5. Bulk Actions

```tsx
// Select multiple jobs
const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

// Bulk action bar
{selectedJobs.size > 0 && (
  <div className="sticky bottom-4 mx-auto w-fit bg-primary text-primary-foreground rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
    <span>{selectedJobs.size} selected</span>
    <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus('cancelled')}>
      Cancel All
    </Button>
    <Button size="sm" variant="secondary" onClick={() => bulkSendReminders()}>
      Send Reminders
    </Button>
    <Button size="sm" variant="secondary" onClick={() => bulkAssignContractor()}>
      Assign Contractor
    </Button>
    <Button size="sm" variant="ghost" onClick={() => setSelectedJobs(new Set())}>
      Clear
    </Button>
  </div>
)}
```

### 6. Contractor Performance Tracking

```sql
-- Contractor performance view
CREATE OR REPLACE VIEW contractor_performance AS
SELECT 
  c.id as contractor_id,
  c.name,
  c.company_name,
  COUNT(cj.id) as total_jobs,
  COUNT(cj.id) FILTER (WHERE cj.status = 'completed') as completed_jobs,
  COUNT(cj.id) FILTER (WHERE cj.status = 'cancelled') as cancelled_jobs,
  
  -- Response time (days from requested to quoted)
  AVG(EXTRACT(EPOCH FROM (cj.quoted_at - cj.requested_at)) / 86400) 
    FILTER (WHERE cj.quoted_at IS NOT NULL) as avg_response_days,
  
  -- Completion time (days from booked to completed)
  AVG(EXTRACT(EPOCH FROM (cj.completed_at - cj.booked_date::timestamp)) / 86400)
    FILTER (WHERE cj.completed_at IS NOT NULL) as avg_completion_days,
  
  -- Cost variance
  AVG(cj.cost_variance_gbp) FILTER (WHERE cj.cost_variance_gbp IS NOT NULL) as avg_cost_variance,
  
  -- Certificate turnaround (days from completed to certificate received)
  AVG(EXTRACT(EPOCH FROM (cj.certificate_received_at - cj.completed_at)) / 86400)
    FILTER (WHERE cj.certificate_received_at IS NOT NULL) as avg_certificate_days,
  
  -- Rating (if you implement job ratings)
  AVG(cj.contractor_rating) FILTER (WHERE cj.contractor_rating IS NOT NULL) as avg_rating,
  
  c.org_id
FROM contractors c
LEFT JOIN contractor_jobs cj ON cj.contractor_id = c.id
GROUP BY c.id, c.name, c.company_name, c.org_id;
```

### 7. Smart Job Suggestions

```tsx
// When creating a job, suggest best contractor
const suggestedContractor = useMemo(() => {
  if (!contractors || !jobType) return null;
  
  // Find contractors who do this job type
  const eligible = contractors.filter(c => 
    c.specializations?.includes(jobType)
  );
  
  // Score by: response time, completion rate, cost variance, rating
  return eligible
    .map(c => ({
      ...c,
      score: calculateContractorScore(c, jobType),
    }))
    .sort((a, b) => b.score - a.score)[0];
}, [contractors, jobType]);
```

### 8. Job Templates

```sql
-- Job templates for common work
CREATE TABLE public.job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  description TEXT,
  typical_budget_gbp INTEGER,
  default_contractor_id UUID REFERENCES public.contractors(id),
  checklist JSONB, -- ["Check X", "Test Y", "Replace Z"]
  documents_required TEXT[], -- ["Gas Safety Certificate", "Invoice"]
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Use template to create job quickly
-- "Create Gas Safety job for 123 High Street" -> Pre-fills everything
```

### 9. Enhanced Job Status Flow

```tsx
const JOB_WORKFLOW = {
  draft: {
    next: ['requested', 'cancelled'],
    actions: ['Assign Contractor', 'Send Request', 'Cancel'],
  },
  requested: {
    next: ['quoted', 'declined', 'cancelled'],
    actions: ['Record Quote', 'Mark Declined', 'Send Reminder', 'Cancel'],
    autoReminder: { days: 3, message: 'Awaiting quote from {contractor}' },
  },
  quoted: {
    next: ['accepted', 'rejected', 'negotiating'],
    actions: ['Accept Quote', 'Reject Quote', 'Negotiate', 'Request Alternative'],
  },
  accepted: {
    next: ['booked', 'cancelled'],
    actions: ['Book Date', 'Cancel'],
  },
  booked: {
    next: ['in_progress', 'rescheduled', 'cancelled'],
    actions: ['Start Work', 'Reschedule', 'Cancel'],
  },
  in_progress: {
    next: ['completed', 'on_hold'],
    actions: ['Mark Complete', 'Put On Hold'],
  },
  completed: {
    next: ['verified', 'disputed'],
    actions: ['Verify & Close', 'Dispute'],
    autoCheck: 'Wait for certificate',
  },
  verified: {
    next: [],
    actions: ['Reopen'],
    final: true,
  },
};
```

### 10. Certificate Tracking Status

```tsx
// Add to job card/detail
{job.status === 'completed' && (
  <div className={cn(
    "flex items-center gap-2 p-2 rounded-lg",
    job.certificate_received ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
  )}>
    {job.certificate_received ? (
      <>
        <CheckCircle className="h-4 w-4" />
        <span>Certificate received {format(new Date(job.certificate_received_at), 'dd MMM')}</span>
      </>
    ) : (
      <>
        <Clock className="h-4 w-4" />
        <span>Awaiting certificate</span>
        <Button size="sm" variant="ghost" onClick={() => sendCertificateReminder(job.id)}>
          Send Reminder
        </Button>
      </>
    )}
  </div>
)}
```

---

# Database Updates Summary

```sql
-- Add certificate tracking to jobs
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS certificate_received BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_document_id UUID REFERENCES public.documents(id),
ADD COLUMN IF NOT EXISTS certificate_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_reminder_count INTEGER DEFAULT 0;

-- Add follow-up tracking
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_follow_up_date DATE,
ADD COLUMN IF NOT EXISTS response_deadline DATE;

-- Add cost breakdown
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS budget_gbp INTEGER,
ADD COLUMN IF NOT EXISTS parts_cost_gbp INTEGER,
ADD COLUMN IF NOT EXISTS labour_cost_gbp INTEGER,
ADD COLUMN IF NOT EXISTS call_out_fee_gbp INTEGER,
ADD COLUMN IF NOT EXISTS vat_amount_gbp INTEGER,
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add contractor rating
ALTER TABLE public.contractor_jobs
ADD COLUMN IF NOT EXISTS contractor_rating INTEGER CHECK (contractor_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS contractor_feedback TEXT;
```

---

# Implementation Checklist

## Week 1: AI Email Inbox
- [ ] Set up email receiving (SendGrid/Mailgun inbound)
- [ ] Create inbound_emails table
- [ ] Add inbox_email to contractor_jobs
- [ ] Create Edge Function for processing
- [ ] Build Inbox page with email list
- [ ] Build ReviewEmailDialog for manual review
- [ ] Test with sample certificates

## Week 2: Certificate Processing
- [ ] Integrate Claude API for extraction
- [ ] Create certificate_type_mappings
- [ ] Auto-matching to properties
- [ ] Auto-update compliance items
- [ ] Auto-update job status
- [ ] Notification system
- [ ] Handle edge cases (low confidence, unknown types)

## Week 3: Jobs Improvements
- [ ] Add pipeline/kanban view
- [ ] Add follow-up tracking
- [ ] Add cost breakdown fields
- [ ] Build contractor performance view
- [ ] Add bulk actions
- [ ] Add certificate status tracking
- [ ] Add job templates

## Week 4: Polish & Integration
- [ ] Dashboard widgets for jobs attention
- [ ] Job suggestions (best contractor)
- [ ] Auto-reminders for overdue jobs
- [ ] Mobile optimizations
- [ ] Testing and refinement

---

*Ready for Lovable.dev implementation - 4 weeks*
