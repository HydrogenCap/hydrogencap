# HydrogenCap Implementation Specification
## Document Management System

Complete document storage, viewing, downloading, editing metadata, and deletion across the platform.

---

# Overview

**What We're Building:**
- Centralized document storage for all entities (properties, companies, tenants, compliance, projects)
- Document viewer (PDFs, images, common file types)
- Download functionality
- Edit document metadata (name, category, notes)
- Delete with confirmation
- Folder/category organization
- Search and filter

---

# Database Schema

```sql
-- Migration: Document Management System
-- File: supabase/migrations/YYYYMMDD_document_management.sql

-- ============================================
-- DOCUMENTS TABLE (Centralized)
-- ============================================

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- File details
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'pdf', 'image', 'doc', 'spreadsheet', 'other'
  file_size_bytes INTEGER,
  mime_type TEXT,
  
  -- Metadata
  display_name TEXT NOT NULL, -- User-friendly name
  description TEXT,
  category TEXT NOT NULL,
  tags JSONB DEFAULT '[]', -- Array of tags for searching
  
  -- Entity links (document can belong to one or more)
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES public.tenancies(id) ON DELETE CASCADE,
  compliance_item_id UUID REFERENCES public.compliance_items(id) ON DELETE CASCADE,
  development_project_id UUID REFERENCES public.development_projects(id) ON DELETE CASCADE,
  contractor_job_id UUID REFERENCES public.contractor_jobs(id) ON DELETE CASCADE,
  
  -- Document-specific dates
  document_date DATE, -- Date of the document itself (e.g., certificate issue date)
  expiry_date DATE, -- If document expires
  
  -- Access control
  is_confidential BOOLEAN DEFAULT false,
  visible_to_shareholders BOOLEAN DEFAULT false,
  visible_to_tenants BOOLEAN DEFAULT false,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES public.documents(id),
  is_current_version BOOLEAN DEFAULT true,
  
  -- Audit
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  deleted_by UUID REFERENCES auth.users(id),
  
  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(file_name, '')), 'C')
  ) STORED
);

-- Indexes
CREATE INDEX idx_documents_org ON public.documents(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_property ON public.documents(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_company ON public.documents(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_tenant ON public.documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_tenancy ON public.documents(tenancy_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_compliance ON public.documents(compliance_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_project ON public.documents(development_project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_category ON public.documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_search ON public.documents USING GIN(search_vector);
CREATE INDEX idx_documents_expiry ON public.documents(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage documents"
ON public.documents
FOR ALL
USING (public.user_has_org_access(org_id) AND deleted_at IS NULL);

-- ============================================
-- DOCUMENT CATEGORIES
-- ============================================

CREATE TABLE public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Icon name for UI
  color TEXT, -- Color for UI
  entity_type TEXT, -- 'property', 'company', 'tenant', 'compliance', 'project', 'all'
  display_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false, -- System categories can't be deleted
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, slug)
);

-- Insert default categories
INSERT INTO public.document_categories (org_id, name, slug, icon, entity_type, is_system, display_order) VALUES
(NULL, 'Legal Pack', 'legal-pack', 'Scale', 'property', true, 1),
(NULL, 'Title Deeds', 'title-deeds', 'FileText', 'property', true, 2),
(NULL, 'Mortgage', 'mortgage', 'Landmark', 'property', true, 3),
(NULL, 'Insurance', 'insurance', 'Shield', 'property', true, 4),
(NULL, 'Valuation', 'valuation', 'TrendingUp', 'property', true, 5),
(NULL, 'Survey', 'survey', 'ClipboardCheck', 'property', true, 6),
(NULL, 'Planning', 'planning', 'Map', 'property', true, 7),
(NULL, 'Building Control', 'building-control', 'HardHat', 'property', true, 8),
(NULL, 'EPC', 'epc', 'Zap', 'compliance', true, 9),
(NULL, 'Gas Safety', 'gas-safety', 'Flame', 'compliance', true, 10),
(NULL, 'EICR', 'eicr', 'Plug', 'compliance', true, 11),
(NULL, 'HMO Licence', 'hmo-licence', 'Award', 'compliance', true, 12),
(NULL, 'Fire Safety', 'fire-safety', 'AlertTriangle', 'compliance', true, 13),
(NULL, 'Tenancy Agreement', 'tenancy-agreement', 'FileSignature', 'tenant', true, 14),
(NULL, 'Inventory', 'inventory', 'List', 'tenant', true, 15),
(NULL, 'Reference', 'reference', 'UserCheck', 'tenant', true, 16),
(NULL, 'ID Document', 'id-document', 'CreditCard', 'tenant', true, 17),
(NULL, 'Company Accounts', 'company-accounts', 'Calculator', 'company', true, 18),
(NULL, 'Shareholder Agreement', 'shareholder-agreement', 'Users', 'company', true, 19),
(NULL, 'Board Minutes', 'board-minutes', 'FileText', 'company', true, 20),
(NULL, 'Invoice', 'invoice', 'Receipt', 'project', true, 21),
(NULL, 'Quote', 'quote', 'FileQuestion', 'project', true, 22),
(NULL, 'Photo', 'photo', 'Camera', 'all', true, 23),
(NULL, 'Other', 'other', 'File', 'all', true, 99);

-- ============================================
-- DOCUMENT ACTIVITY LOG
-- ============================================

CREATE TABLE public.document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  
  action TEXT NOT NULL CHECK (action IN ('uploaded', 'viewed', 'downloaded', 'edited', 'deleted', 'restored', 'shared', 'version_created')),
  details JSONB, -- Additional details about the action
  
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET
);

CREATE INDEX idx_document_activity ON public.document_activity(document_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Soft delete document
CREATE OR REPLACE FUNCTION soft_delete_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  UPDATE documents
  SET deleted_at = now(),
      deleted_by = v_user_id,
      updated_at = now()
  WHERE id = p_document_id
  AND deleted_at IS NULL;
  
  -- Log activity
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'deleted', v_user_id);
  
  RETURN FOUND;
END;
$$;

-- Restore deleted document
CREATE OR REPLACE FUNCTION restore_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  
  UPDATE documents
  SET deleted_at = NULL,
      deleted_by = NULL,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_document_id
  AND deleted_at IS NOT NULL;
  
  -- Log activity
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'restored', v_user_id);
  
  RETURN FOUND;
END;
$$;

-- Log document view
CREATE OR REPLACE FUNCTION log_document_view(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'viewed', auth.uid());
END;
$$;

-- Log document download
CREATE OR REPLACE FUNCTION log_document_download(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO document_activity (document_id, action, performed_by)
  VALUES (p_document_id, 'downloaded', auth.uid());
END;
$$;

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Create storage bucket for documents (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
-- CREATE POLICY "Authenticated users can upload documents"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- CREATE POLICY "Users can view their org documents"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

---

# Frontend Hooks

## src/hooks/useDocuments.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Document {
  id: string;
  org_id: string;
  file_name: string;
  file_url: string;
  file_type: 'pdf' | 'image' | 'doc' | 'spreadsheet' | 'other';
  file_size_bytes: number | null;
  mime_type: string | null;
  display_name: string;
  description: string | null;
  category: string;
  tags: string[];
  property_id: string | null;
  company_id: string | null;
  tenant_id: string | null;
  tenancy_id: string | null;
  compliance_item_id: string | null;
  development_project_id: string | null;
  contractor_job_id: string | null;
  document_date: string | null;
  expiry_date: string | null;
  is_confidential: boolean;
  visible_to_shareholders: boolean;
  visible_to_tenants: boolean;
  version: number;
  is_current_version: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
  updated_at: string;
  // Joined data
  property?: { address_line: string };
  company?: { name: string };
  uploader?: { email: string };
}

export interface DocumentCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  entity_type: string;
}

// File type detection
export function getFileType(mimeType: string | null, fileName: string): Document['file_type'] {
  if (!mimeType) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';
    if (['doc', 'docx'].includes(ext || '')) return 'doc';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'spreadsheet';
    return 'other';
  }
  
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  return 'other';
}

// Get documents with filters
export function useDocuments(filters?: {
  propertyId?: string;
  companyId?: string;
  tenantId?: string;
  tenancyId?: string;
  complianceItemId?: string;
  projectId?: string;
  jobId?: string;
  category?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select(`
          *,
          property:properties(address_line),
          company:companies(name)
        `)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
      }
      if (filters?.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }
      if (filters?.tenancyId) {
        query = query.eq('tenancy_id', filters.tenancyId);
      }
      if (filters?.complianceItemId) {
        query = query.eq('compliance_item_id', filters.complianceItemId);
      }
      if (filters?.projectId) {
        query = query.eq('development_project_id', filters.projectId);
      }
      if (filters?.jobId) {
        query = query.eq('contractor_job_id', filters.jobId);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.search) {
        query = query.textSearch('search_vector', filters.search);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    },
  });
}

// Get single document
export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      if (!documentId) return null;

      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          property:properties(address_line),
          company:companies(name)
        `)
        .eq('id', documentId)
        .single();

      if (error) throw error;
      
      // Log view
      await supabase.rpc('log_document_view', { p_document_id: documentId });
      
      return data as Document;
    },
    enabled: !!documentId,
  });
}

// Get document categories
export function useDocumentCategories(entityType?: string) {
  return useQuery({
    queryKey: ['document-categories', entityType],
    queryFn: async () => {
      let query = supabase
        .from('document_categories')
        .select('*')
        .order('display_order');

      if (entityType) {
        query = query.or(`entity_type.eq.${entityType},entity_type.eq.all`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentCategory[];
    },
  });
}

// Upload document
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      file,
      displayName,
      category,
      description,
      propertyId,
      companyId,
      tenantId,
      tenancyId,
      complianceItemId,
      projectId,
      jobId,
      documentDate,
      expiryDate,
      isConfidential,
      visibleToShareholders,
      visibleToTenants,
    }: {
      file: File;
      displayName: string;
      category: string;
      description?: string;
      propertyId?: string;
      companyId?: string;
      tenantId?: string;
      tenancyId?: string;
      complianceItemId?: string;
      projectId?: string;
      jobId?: string;
      documentDate?: string;
      expiryDate?: string;
      isConfidential?: boolean;
      visibleToShareholders?: boolean;
      visibleToTenants?: boolean;
    }) => {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${membership!.org_id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          org_id: membership!.org_id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: getFileType(file.type, file.name),
          file_size_bytes: file.size,
          mime_type: file.type,
          display_name: displayName,
          description: description || null,
          category,
          property_id: propertyId || null,
          company_id: companyId || null,
          tenant_id: tenantId || null,
          tenancy_id: tenancyId || null,
          compliance_item_id: complianceItemId || null,
          development_project_id: projectId || null,
          contractor_job_id: jobId || null,
          document_date: documentDate || null,
          expiry_date: expiryDate || null,
          is_confidential: isConfidential || false,
          visible_to_shareholders: visibleToShareholders || false,
          visible_to_tenants: visibleToTenants || false,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase
        .from('document_activity')
        .insert({
          document_id: data.id,
          action: 'uploaded',
          performed_by: user?.id,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document uploaded' });
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update document metadata
export function useUpdateDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      displayName,
      description,
      category,
      tags,
      documentDate,
      expiryDate,
      isConfidential,
      visibleToShareholders,
      visibleToTenants,
    }: {
      id: string;
      displayName?: string;
      description?: string;
      category?: string;
      tags?: string[];
      documentDate?: string;
      expiryDate?: string;
      isConfidential?: boolean;
      visibleToShareholders?: boolean;
      visibleToTenants?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('documents')
        .update({
          display_name: displayName,
          description,
          category,
          tags,
          document_date: documentDate,
          expiry_date: expiryDate,
          is_confidential: isConfidential,
          visible_to_shareholders: visibleToShareholders,
          visible_to_tenants: visibleToTenants,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase
        .from('document_activity')
        .insert({
          document_id: id,
          action: 'edited',
          performed_by: user?.id,
        });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', data.id] });
      toast({ title: 'Document updated' });
    },
  });
}

// Delete document (soft delete)
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.rpc('soft_delete_document', {
        p_document_id: documentId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document deleted' });
    },
  });
}

// Download document (logs the download)
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (document: Document) => {
      // Log download
      await supabase.rpc('log_document_download', { p_document_id: document.id });

      // Trigger download
      const response = await fetch(document.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      return true;
    },
  });
}

// Get document activity
export function useDocumentActivity(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-activity', documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from('document_activity')
        .select('*')
        .eq('document_id', documentId)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!documentId,
  });
}
```

---

# Frontend Components

## src/components/documents/DocumentsPanel.tsx

```tsx
import React, { useState } from 'react';
import { 
  FileText, Upload, Search, Filter, Grid, List, 
  MoreVertical, Download, Pencil, Trash2, Eye,
  FolderOpen, File, Image, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useDocuments, 
  useDocumentCategories,
  useDownloadDocument,
  useDeleteDocument,
  Document 
} from '@/hooks/useDocuments';
import { UploadDocumentDialog } from './UploadDocumentDialog';
import { EditDocumentDialog } from './EditDocumentDialog';
import { DocumentViewer } from './DocumentViewer';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { formatBytes, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DocumentsPanelProps {
  propertyId?: string;
  companyId?: string;
  tenantId?: string;
  tenancyId?: string;
  complianceItemId?: string;
  projectId?: string;
  jobId?: string;
  entityType?: string;
  title?: string;
  compact?: boolean;
}

const FILE_ICONS = {
  pdf: FileText,
  image: Image,
  doc: FileText,
  spreadsheet: FileSpreadsheet,
  other: File,
};

export function DocumentsPanel({
  propertyId,
  companyId,
  tenantId,
  tenancyId,
  complianceItemId,
  projectId,
  jobId,
  entityType,
  title = 'Documents',
  compact = false,
}: DocumentsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);

  const { data: documents, isLoading } = useDocuments({
    propertyId,
    companyId,
    tenantId,
    tenancyId,
    complianceItemId,
    projectId,
    jobId,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchTerm || undefined,
  });

  const { data: categories } = useDocumentCategories(entityType);
  const downloadDocument = useDownloadDocument();
  const deleteDocument = useDeleteDocument();

  const handleDelete = async () => {
    if (!deletingDocument) return;
    await deleteDocument.mutateAsync(deletingDocument.id);
    setDeletingDocument(null);
  };

  const filteredDocuments = documents?.filter(doc => {
    if (!searchTerm) return true;
    return (
      doc.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Group by category
  const groupedDocuments = filteredDocuments?.reduce((acc, doc) => {
    const cat = doc.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Filters */}
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(cat => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Documents */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !filteredDocuments?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-medium mb-1">No documents</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first document to get started
            </p>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="space-y-6">
          {Object.entries(groupedDocuments || {}).map(([category, docs]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {category}
                <Badge variant="secondary" className="ml-1">{docs.length}</Badge>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {docs.map(doc => {
                  const FileIcon = FILE_ICONS[doc.file_type] || File;
                  
                  return (
                    <Card
                      key={doc.id}
                      className="group cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setViewingDocument(doc)}
                    >
                      <CardContent className="p-3">
                        {/* Preview/Icon */}
                        <div className="aspect-[4/3] bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                          {doc.file_type === 'image' ? (
                            <img
                              src={doc.file_url}
                              alt={doc.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileIcon className="h-12 w-12 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium truncate" title={doc.display_name}>
                            {doc.display_name}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                            <span>{formatDate(doc.uploaded_at)}</span>
                          </div>
                        </div>

                        {/* Actions (visible on hover) */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="secondary" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setViewingDocument(doc);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                downloadDocument.mutate(doc);
                              }}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingDocument(doc);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingDocument(doc);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="border rounded-lg divide-y">
          {filteredDocuments?.map(doc => {
            const FileIcon = FILE_ICONS[doc.file_type] || File;
            
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer"
                onClick={() => setViewingDocument(doc)}
              >
                <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.category} • {formatBytes(doc.file_size_bytes || 0)}
                  </p>
                </div>

                <div className="text-sm text-muted-foreground shrink-0">
                  {formatDate(doc.uploaded_at)}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setViewingDocument(doc);
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      downloadDocument.mutate(doc);
                    }}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setEditingDocument(doc);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingDocument(doc);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <UploadDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        propertyId={propertyId}
        companyId={companyId}
        tenantId={tenantId}
        tenancyId={tenancyId}
        complianceItemId={complianceItemId}
        projectId={projectId}
        jobId={jobId}
        entityType={entityType}
      />

      {editingDocument && (
        <EditDocumentDialog
          open={!!editingDocument}
          onOpenChange={() => setEditingDocument(null)}
          document={editingDocument}
        />
      )}

      {viewingDocument && (
        <DocumentViewer
          open={!!viewingDocument}
          onOpenChange={() => setViewingDocument(null)}
          document={viewingDocument}
          onEdit={() => {
            setEditingDocument(viewingDocument);
            setViewingDocument(null);
          }}
          onDownload={() => downloadDocument.mutate(viewingDocument)}
          onDelete={() => {
            setDeletingDocument(viewingDocument);
            setViewingDocument(null);
          }}
        />
      )}

      <DeleteConfirmDialog
        open={!!deletingDocument}
        onOpenChange={() => setDeletingDocument(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${deletingDocument?.display_name}"? This action can be undone.`}
        isLoading={deleteDocument.isPending}
      />
    </div>
  );
}
```

## src/components/documents/DocumentViewer.tsx

```tsx
import React from 'react';
import { format } from 'date-fns';
import { 
  X, Download, Pencil, Trash2, ExternalLink, 
  Calendar, User, FileText, Tag, Eye, Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Document, useDocumentActivity } from '@/hooks/useDocuments';
import { formatBytes } from '@/lib/utils';

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function DocumentViewer({
  open,
  onOpenChange,
  document,
  onEdit,
  onDownload,
  onDelete,
}: DocumentViewerProps) {
  const { data: activity } = useDocumentActivity(document.id);

  const canPreview = document.file_type === 'pdf' || document.file_type === 'image';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{document.display_name}</h2>
            <p className="text-sm text-muted-foreground">
              {document.category} • {formatBytes(document.file_size_bytes || 0)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(document.file_url, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 bg-muted/30 flex items-center justify-center overflow-auto p-4">
            {document.file_type === 'image' ? (
              <img
                src={document.file_url}
                alt={document.display_name}
                className="max-w-full max-h-full object-contain"
              />
            ) : document.file_type === 'pdf' ? (
              <iframe
                src={`${document.file_url}#view=FitH`}
                className="w-full h-full border-0"
                title={document.display_name}
              />
            ) : (
              <div className="text-center">
                <FileText className="h-24 w-24 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                <Button onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l overflow-auto p-4 shrink-0">
            <h3 className="font-medium mb-4">Document Details</h3>

            <div className="space-y-4">
              {/* Description */}
              {document.description && (
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <p className="text-sm">{document.description}</p>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <p className="text-sm">{document.category}</p>
              </div>

              {/* File Info */}
              <div>
                <label className="text-xs text-muted-foreground">File Name</label>
                <p className="text-sm truncate">{document.file_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Size</label>
                  <p className="text-sm">{formatBytes(document.file_size_bytes || 0)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <p className="text-sm uppercase">{document.file_type}</p>
                </div>
              </div>

              {/* Dates */}
              {document.document_date && (
                <div>
                  <label className="text-xs text-muted-foreground">Document Date</label>
                  <p className="text-sm">{format(new Date(document.document_date), 'dd MMMM yyyy')}</p>
                </div>
              )}

              {document.expiry_date && (
                <div>
                  <label className="text-xs text-muted-foreground">Expiry Date</label>
                  <p className="text-sm">{format(new Date(document.expiry_date), 'dd MMMM yyyy')}</p>
                </div>
              )}

              {/* Tags */}
              {document.tags?.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {document.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Visibility */}
              <div>
                <label className="text-xs text-muted-foreground">Visibility</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {document.is_confidential && (
                    <Badge variant="destructive" className="text-xs">Confidential</Badge>
                  )}
                  {document.visible_to_shareholders && (
                    <Badge variant="secondary" className="text-xs">Shareholders</Badge>
                  )}
                  {document.visible_to_tenants && (
                    <Badge variant="secondary" className="text-xs">Tenants</Badge>
                  )}
                </div>
              </div>

              {/* Linked To */}
              {document.property && (
                <div>
                  <label className="text-xs text-muted-foreground">Property</label>
                  <p className="text-sm">{document.property.address_line}</p>
                </div>
              )}
              {document.company && (
                <div>
                  <label className="text-xs text-muted-foreground">Company</label>
                  <p className="text-sm">{document.company.name}</p>
                </div>
              )}

              <Separator />

              {/* Upload Info */}
              <div>
                <label className="text-xs text-muted-foreground">Uploaded</label>
                <p className="text-sm">
                  {format(new Date(document.uploaded_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>

              {/* Activity */}
              {activity && activity.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Recent Activity</label>
                    <div className="space-y-2">
                      {activity.slice(0, 5).map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-xs">
                          {a.action === 'viewed' && <Eye className="h-3 w-3" />}
                          {a.action === 'downloaded' && <Download className="h-3 w-3" />}
                          {a.action === 'edited' && <Pencil className="h-3 w-3" />}
                          {a.action === 'uploaded' && <FileText className="h-3 w-3" />}
                          <span className="capitalize">{a.action}</span>
                          <span className="text-muted-foreground ml-auto">
                            {format(new Date(a.performed_at), 'dd MMM HH:mm')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Delete */}
              <Button
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Document
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## src/components/documents/UploadDocumentDialog.tsx

```tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useUploadDocument, useDocumentCategories } from '@/hooks/useDocuments';
import { formatBytes } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  companyId?: string;
  tenantId?: string;
  tenancyId?: string;
  complianceItemId?: string;
  projectId?: string;
  jobId?: string;
  entityType?: string;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  propertyId,
  companyId,
  tenantId,
  tenancyId,
  complianceItemId,
  projectId,
  jobId,
  entityType,
}: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    category: '',
    description: '',
    documentDate: '',
    expiryDate: '',
    isConfidential: false,
    visibleToShareholders: false,
    visibleToTenants: false,
  });

  const { data: categories } = useDocumentCategories(entityType);
  const uploadDocument = useUploadDocument();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (selected) {
      setFile(selected);
      // Auto-fill display name from file name
      if (!formData.displayName) {
        const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, displayName: nameWithoutExt }));
      }
    }
  }, [formData.displayName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !formData.displayName || !formData.category) return;

    await uploadDocument.mutateAsync({
      file,
      displayName: formData.displayName,
      category: formData.category,
      description: formData.description || undefined,
      propertyId,
      companyId,
      tenantId,
      tenancyId,
      complianceItemId,
      projectId,
      jobId,
      documentDate: formData.documentDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      isConfidential: formData.isConfidential,
      visibleToShareholders: formData.visibleToShareholders,
      visibleToTenants: formData.visibleToTenants,
    });

    // Reset and close
    setFile(null);
    setFormData({
      displayName: '',
      category: '',
      description: '',
      documentDate: '',
      expiryDate: '',
      isConfidential: false,
      visibleToShareholders: false,
      visibleToTenants: false,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragActive && "border-primary bg-primary/5",
                file && "border-emerald-500 bg-emerald-50"
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <File className="h-8 w-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">Drop file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    PDF, Images, Word, Excel up to 50MB
                  </p>
                </>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Document Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., Gas Safety Certificate 2024"
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes about this document..."
                rows={2}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentDate">Document Date</Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={formData.documentDate}
                  onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-3">
              <Label>Visibility</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isConfidential}
                    onCheckedChange={(c) => setFormData({ ...formData, isConfidential: !!c })}
                  />
                  <span className="text-sm">Confidential (restricted access)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.visibleToShareholders}
                    onCheckedChange={(c) => setFormData({ ...formData, visibleToShareholders: !!c })}
                  />
                  <span className="text-sm">Visible to shareholders</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.visibleToTenants}
                    onCheckedChange={(c) => setFormData({ ...formData, visibleToTenants: !!c })}
                  />
                  <span className="text-sm">Visible to tenants</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file || !formData.displayName || !formData.category || uploadDocument.isPending}
            >
              {uploadDocument.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Upload</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## src/components/documents/EditDocumentDialog.tsx

```tsx
import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Document, useUpdateDocument, useDocumentCategories } from '@/hooks/useDocuments';

interface EditDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
}

export function EditDocumentDialog({ open, onOpenChange, document }: EditDocumentDialogProps) {
  const [formData, setFormData] = useState({
    displayName: document.display_name,
    category: document.category,
    description: document.description || '',
    documentDate: document.document_date || '',
    expiryDate: document.expiry_date || '',
    isConfidential: document.is_confidential,
    visibleToShareholders: document.visible_to_shareholders,
    visibleToTenants: document.visible_to_tenants,
  });

  const { data: categories } = useDocumentCategories();
  const updateDocument = useUpdateDocument();

  // Reset form when document changes
  useEffect(() => {
    setFormData({
      displayName: document.display_name,
      category: document.category,
      description: document.description || '',
      documentDate: document.document_date || '',
      expiryDate: document.expiry_date || '',
      isConfidential: document.is_confidential,
      visibleToShareholders: document.visible_to_shareholders,
      visibleToTenants: document.visible_to_tenants,
    });
  }, [document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await updateDocument.mutateAsync({
      id: document.id,
      displayName: formData.displayName,
      category: formData.category,
      description: formData.description || undefined,
      documentDate: formData.documentDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      isConfidential: formData.isConfidential,
      visibleToShareholders: formData.visibleToShareholders,
      visibleToTenants: formData.visibleToTenants,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Document Name *</Label>
              <Input
                id="editDisplayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDocDate">Document Date</Label>
                <Input
                  id="editDocDate"
                  type="date"
                  value={formData.documentDate}
                  onChange={(e) => setFormData({ ...formData, documentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editExpiry">Expiry Date</Label>
                <Input
                  id="editExpiry"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-3">
              <Label>Visibility</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.isConfidential}
                    onCheckedChange={(c) => setFormData({ ...formData, isConfidential: !!c })}
                  />
                  <span className="text-sm">Confidential</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.visibleToShareholders}
                    onCheckedChange={(c) => setFormData({ ...formData, visibleToShareholders: !!c })}
                  />
                  <span className="text-sm">Visible to shareholders</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.visibleToTenants}
                    onCheckedChange={(c) => setFormData({ ...formData, visibleToTenants: !!c })}
                  />
                  <span className="text-sm">Visible to tenants</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDocument.isPending}>
              {updateDocument.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                'Save Changes'
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

## Add to Property Detail

```tsx
// In PropertyDetail.tsx, add Documents tab
<TabsContent value="documents">
  <DocumentsPanel
    propertyId={property.id}
    entityType="property"
    title="Property Documents"
  />
</TabsContent>
```

## Add to Company Detail

```tsx
// In CompanyDetail.tsx
<DocumentsPanel
  companyId={company.id}
  entityType="company"
  title="Company Documents"
/>
```

## Add to Tenant Detail

```tsx
// In TenantDetail.tsx
<DocumentsPanel
  tenantId={tenant.id}
  entityType="tenant"
  title="Tenant Documents"
/>
```

## Add to Compliance Item

```tsx
// When uploading certificate, link to compliance item
<UploadDocumentDialog
  complianceItemId={complianceItem.id}
  entityType="compliance"
/>
```

## Add to Development Project

```tsx
// In ProjectDetail.tsx
<DocumentsPanel
  projectId={project.id}
  entityType="project"
  title="Project Documents"
/>
```

---

# Dependencies

```bash
npm install react-dropzone
```

---

# Implementation Checklist

## Week 1: Database & Storage
- [ ] Run database migration
- [ ] Create Supabase storage bucket
- [ ] Configure storage policies
- [ ] Test upload/download

## Week 2: Core Components
- [ ] Create useDocuments hooks
- [ ] Build UploadDocumentDialog
- [ ] Build DocumentsPanel (grid + list views)
- [ ] Build DocumentViewer

## Week 3: Edit & Delete
- [ ] Build EditDocumentDialog
- [ ] Implement soft delete
- [ ] Add activity logging
- [ ] Add search functionality

## Week 4: Integration
- [ ] Add to Property Detail
- [ ] Add to Company Detail
- [ ] Add to Tenant Detail
- [ ] Add to Compliance Items
- [ ] Add to Development Projects
- [ ] Add to Contractor Jobs

---

*Ready for Lovable.dev implementation - 4 weeks*
