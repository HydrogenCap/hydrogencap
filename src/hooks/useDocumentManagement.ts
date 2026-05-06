import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { showMutationError } from '@/lib/errorToast';
import { generateStructuredFilename } from '@/lib/documentNaming';
import { createSignedStorageUrl } from '@/lib/storagePaths';

interface PropertyAddressJoin {
  address_line: string | null;
}
 
export interface ManagedDocument {
  id: string;
  org_id: string;
  file_url: string;
  original_file_name: string;
  display_name: string | null;
  final_file_name: string | null;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  file_type: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  property_id: string | null;
  company_id: string | null;
  tenant_id: string | null;
  tenancy_id: string | null;
  compliance_item_id: string | null;
  contractor_job_id: string | null;
  document_date: string | null;
  expiry_date: string | null;
  is_confidential: boolean | null;
  visible_to_shareholders: boolean | null;
  visible_to_tenants: boolean | null;
  version: number | null;
  is_current_version: boolean | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined data
  property?: { address_line_1: string } | null;
  company?: { legal_name: string } | null;
}
 
 export interface DocumentCategory {
   id: string;
   org_id: string | null;
   name: string;
   slug: string;
   description: string | null;
   icon: string | null;
   color: string | null;
   entity_type: string | null;
   display_order: number | null;
   is_system: boolean | null;
 }
 
export interface DocumentFilters {
   propertyId?: string;
   companyId?: string;
   tenantId?: string;
   tenancyId?: string;
   complianceItemId?: string;
   jobId?: string;
   category?: string;
   search?: string;
 }
 
 // Get file type from mime type or file extension
 export function getFileType(mimeType: string | null, fileName: string): string {
   if (mimeType) {
     if (mimeType.includes('pdf')) return 'pdf';
     if (mimeType.includes('image')) return 'image';
     if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
     if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
   }
   
   const ext = fileName.split('.').pop()?.toLowerCase();
   if (['pdf'].includes(ext || '')) return 'pdf';
   if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';
   if (['doc', 'docx'].includes(ext || '')) return 'doc';
   if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'spreadsheet';
   return 'other';
 }
 
export async function resolveManagedDocumentUrls<T extends { file_url: string }>(
  documents: T[]
): Promise<T[]> {
  return Promise.all(
    documents.map(async (document) => ({
      ...document,
      file_url: await createSignedStorageUrl('documents', document.file_url),
    }))
  );
}

// getUserOrgId replaced by shared fetchUserOrgId

 // Get documents with filters
 export function useManagedDocuments(filters?: DocumentFilters) {
   return useQuery({
     queryKey: ['managed-documents', filters],
     queryFn: async () => {
        let query = supabaseAny
          .from('documents')
          .select(`
            id, org_id, property_id, company_id, tenant_id, tenancy_id, compliance_item_id, contractor_job_id,
            file_url, original_file_name, display_name, final_file_name, doc_type, category, tags,
            file_type, file_size_bytes, mime_type, description, document_date, expiry_date,
            review_status, is_confidential, visible_to_shareholders, visible_to_tenants,
            version, is_current_version, uploaded_by, created_at, updated_at, deleted_at,
            property:properties_v2(address_line_1),
            company:companies(legal_name)
         `)
         .is('deleted_at', null)
         .order('created_at', { ascending: false });
 
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
       if (filters?.jobId) {
         query = query.eq('contractor_job_id', filters.jobId);
       }
       if (filters?.category && filters.category !== 'all') {
         query = query.eq('category', filters.category);
       }
 
       const { data, error } = await query;
       if (error) throw error;
 
       // Client-side search filter
       let results = data as unknown as ManagedDocument[];
       if (filters?.search) {
         const searchLower = filters.search.toLowerCase();
         results = results.filter(doc =>
           doc.display_name?.toLowerCase().includes(searchLower) ||
           doc.original_file_name.toLowerCase().includes(searchLower) ||
           doc.description?.toLowerCase().includes(searchLower)
         );
       }

       return resolveManagedDocumentUrls(results);
     },
   });
 }
 
 // Get document categories
 export function useDocumentCategories(entityType?: string) {
   return useQuery({
     queryKey: ['document-categories', entityType],
     queryFn: async () => {
        let query = supabaseAny
          .from('document_categories')
          .select('id, org_id, name, slug, description, icon, color, entity_type, display_order, is_system')
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
 export function useUploadManagedDocument() {
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
       jobId?: string;
       documentDate?: string;
       expiryDate?: string;
       isConfidential?: boolean;
       visibleToShareholders?: boolean;
       visibleToTenants?: boolean;
     }) => {
       const orgId = await getUserOrgId();
         if (!orgId) throw new Error('No organization found');

         // ── Duplicate prevention ──────────────────────────────
         // Check if a document with same original filename & size already exists
         // for the same property (or same org if no property)
         {
           let dupQuery = supabaseAny
             .from('documents')
             .select('id, display_name')
             .eq('org_id', orgId)
             .eq('original_file_name', file.name)
             .eq('file_size_bytes', file.size)
             .is('deleted_at', null)
             .limit(1);

           if (propertyId) {
             dupQuery = dupQuery.eq('property_id', propertyId);
           }

           const { data: existingDocs } = await dupQuery;
           if (existingDocs && existingDocs.length > 0) {
             throw new Error(
               `A document with the same file already exists: "${existingDocs[0].display_name}". Please remove the duplicate or rename the file.`
             );
           }
         }

        const { data: userData } = await supabase.auth.getUser();

        // Look up entity names for structured filename
        let propertyAddress: string | null = null;
        let companyName: string | null = null;
        let tenantName: string | null = null;

        if (propertyId) {
          const { data: prop } = await supabaseAny
            .from('properties_v2')
            .select('address_line_1')
            .eq('id', propertyId)
            .single();
          propertyAddress = prop?.address_line_1 || null;
        }

        if (!propertyAddress && companyId) {
          const { data: comp } = await supabaseAny
            .from('companies')
            .select('legal_name')
            .eq('id', companyId)
            .single();
          companyName = comp?.legal_name || null;
        }

        if (!propertyAddress && !companyName && tenantId) {
          const { data: tenant } = await supabaseAny
            .from('tenants')
            .select('first_name, last_name')
            .eq('id', tenantId)
            .single();
          if (tenant) {
            tenantName = [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || null;
          }
        }

        // Fallback: resolve property from tenancy
        if (!propertyAddress && tenancyId) {
          const { data: tenancy } = await supabaseAny
            .from('tenancy_agreements')
            .select('property_id, properties_v2(address_line_1)')
            .eq('id', tenancyId)
            .single();
          const tenancyProperty = (tenancy as any)?.properties_v2 as { address_line_1?: string } | null;
          if (tenancyProperty) {
            propertyAddress = tenancyProperty.address_line_1 || null;
          }
        }

        // Fallback: resolve property from job
        if (!propertyAddress && jobId) {
          const { data: job } = await supabaseAny
            .from('contractor_jobs')
            .select('property_id, properties(address_line)')
            .eq('id', jobId)
            .single();
          const jobProperty = job?.properties as PropertyAddressJoin | null;
          if (jobProperty) {
            propertyAddress = jobProperty.address_line || null;
          }
        }

        // Generate structured filename
        const finalFileName = generateStructuredFilename({
          category,
          displayName,
          originalFilename: file.name,
          documentDate,
          propertyAddress,
          companyName,
          tenantName,
        });

        // Generate unique storage path
        const fileExt = file.name.split('.').pop();
        const filePath = `${orgId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create document record with structured filename
        const { data, error } = await supabaseAny
          .from('documents')
          .insert({
            org_id: orgId,
            file_url: filePath,
            original_file_name: file.name,
            display_name: displayName,
            final_file_name: finalFileName,
            renamed_at: new Date().toISOString(),
            description: description || null,
            category,
            file_type: getFileType(file.type, file.name),
            file_size_bytes: file.size,
            mime_type: file.type || null,
            property_id: propertyId || null,
            company_id: companyId || null,
            tenant_id: tenantId || null,
            tenancy_id: tenancyId || null,
            compliance_item_id: complianceItemId || null,
            contractor_job_id: jobId || null,
            document_date: documentDate || null,
            expiry_date: expiryDate || null,
            is_confidential: isConfidential || false,
            visible_to_shareholders: visibleToShareholders || false,
            visible_to_tenants: visibleToTenants || false,
            uploaded_by: userData.user?.id || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await supabase.from('document_activity').insert({
          document_id: data.id,
          action: 'uploaded',
          performed_by: userData.user?.id || null,
        });

        return data;
      },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['managed-documents'] });
       toast({ title: 'Document uploaded successfully' });
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
 export function useUpdateManagedDocument() {
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
       const { data: userData } = await supabase.auth.getUser();
 
       const updateData: Record<string, unknown> = {
         updated_at: new Date().toISOString(),
       };
 
       if (displayName !== undefined) updateData.display_name = displayName;
       if (description !== undefined) updateData.description = description;
       if (category !== undefined) updateData.category = category;
       if (tags !== undefined) updateData.tags = tags;
       if (documentDate !== undefined) updateData.document_date = documentDate || null;
       if (expiryDate !== undefined) updateData.expiry_date = expiryDate || null;
       if (isConfidential !== undefined) updateData.is_confidential = isConfidential;
       if (visibleToShareholders !== undefined) updateData.visible_to_shareholders = visibleToShareholders;
       if (visibleToTenants !== undefined) updateData.visible_to_tenants = visibleToTenants;
 
       const { data, error } = await supabaseAny
         .from('documents')
         .update(updateData)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
 
       // Log activity
       await supabase.from('document_activity').insert({
         document_id: id,
         action: 'edited',
         performed_by: userData.user?.id || null,
       });
 
       return data;
     },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['managed-documents'] });
        toast({ title: 'Document updated' });
      },
      onError: (error) => {
        showMutationError(error, 'Failed to update document');
      },
    });
 }
 
 // Soft delete document
 export function useDeleteManagedDocument() {
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
        queryClient.invalidateQueries({ queryKey: ['managed-documents'] });
        toast({ title: 'Document deleted' });
      },
      onError: (error) => {
        showMutationError(error, 'Failed to delete document');
      },
    });
  }
 
 // Download document (logs the download)
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (document: ManagedDocument) => {
      // Log download
      await supabase.rpc('log_document_download', { p_document_id: document.id });

      // Trigger download
      const downloadUrl = await createSignedStorageUrl('documents', document.file_url);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
       a.href = url;
       a.download = document.final_file_name || document.display_name || document.original_file_name;
       window.document.body.appendChild(a);
       a.click();
       window.URL.revokeObjectURL(url);
       a.remove();
 
        return true;
      },
      onError: (error) => {
        showMutationError(error, 'Failed to download document');
      },
    });
  }
 
 // Get document activity
 export function useDocumentActivity(documentId: string | undefined) {
   return useQuery({
     queryKey: ['document-activity', documentId],
     queryFn: async () => {
       if (!documentId) return [];
 
       const { data, error } = await supabaseAny
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
