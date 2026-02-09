import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ComplianceItem, ComplianceDocument } from '@/lib/complianceTypes';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

// Fetch compliance items for a property
export function usePropertyCompliance(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['compliance', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('compliance_items')
        .select(`
          *,
          documents:compliance_documents(*)
        `)
        .eq('property_id', propertyId)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as (ComplianceItem & { documents: ComplianceDocument[] })[];
    },
    enabled: !!propertyId,
  });
}

// Fetch all compliance items across portfolio
export function useAllCompliance() {
  return useQuery({
    queryKey: ['compliance', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_items')
        .select(`
          *,
          documents:compliance_documents(*)
        `)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as (ComplianceItem & { documents: ComplianceDocument[] })[];
    },
  });
}

// Fetch all compliance items with property data joined (fixes N+1 query)
export function useAllComplianceWithProperties() {
  return useQuery({
    queryKey: ['compliance', 'all', 'with-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_items')
        .select(`
          *,
          documents:compliance_documents(*),
          property:properties!inner(
            id,
            address_line,
            postcode,
            lifecycle_type,
            is_hmo_licensed,
            has_gas,
            is_grade_listed,
            epc_required,
            asset_category
          )
        `)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as (ComplianceItem & { 
        documents: ComplianceDocument[];
        property: {
          id: string;
          address_line: string;
          postcode: string;
          lifecycle_type: string | null;
          is_hmo_licensed: boolean | null;
          has_gas: boolean | null;
          is_grade_listed: boolean | null;
          epc_required: boolean | null;
          asset_category: string | null;
        };
      })[];
    },
  });
}

// Create compliance item
export function useCreateComplianceItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: Omit<ComplianceItem, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'documents'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('compliance_items')
        .insert({
          ...item,
          org_id: orgId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compliance', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    },
  });
}

// Update compliance item with optimistic updates
export function useUpdateComplianceItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<ComplianceItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('compliance_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // Optimistic update for instant UI feedback
    onMutate: async (newItem) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['compliance'] });
      
      // Snapshot the previous value for rollback
      const previousAllItems = queryClient.getQueryData(['compliance', 'all']);
      const previousAllWithProps = queryClient.getQueryData(['compliance', 'all', 'with-properties']);
      
      // Optimistically update 'all' cache
      queryClient.setQueryData(['compliance', 'all'], (old: ComplianceItem[] | undefined) => 
        old?.map(item => 
          item.id === newItem.id ? { ...item, ...newItem } : item
        )
      );
      
      // Optimistically update 'all with properties' cache
      queryClient.setQueryData(['compliance', 'all', 'with-properties'], (old: unknown[] | undefined) => 
        old?.map((item: any) => 
          item.id === newItem.id ? { ...item, ...newItem } : item
        )
      );
      
      return { previousAllItems, previousAllWithProps };
    },
    onError: (_err, _newItem, context) => {
      // Rollback on error
      if (context?.previousAllItems) {
        queryClient.setQueryData(['compliance', 'all'], context.previousAllItems);
      }
      if (context?.previousAllWithProps) {
        queryClient.setQueryData(['compliance', 'all', 'with-properties'], context.previousAllWithProps);
      }
    },
    onSettled: (data) => {
      // Always refetch after error or success to ensure consistency
      if (data?.property_id) {
        queryClient.invalidateQueries({ queryKey: ['compliance', data.property_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    },
  });
}

// Delete compliance item
export function useDeleteComplianceItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase
        .from('compliance_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compliance', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    },
  });
}

// Compliance type to short code mapping for filenames
const COMPLIANCE_TYPE_CODES: Record<string, string> = {
  'Gas Safety Certificate (CP12)': 'GasSafety',
  'Electrical Safety Certificate (EICR)': 'EICR',
  'Fire Alarm Certificate': 'FireAlarm',
  'Emergency Lighting Certificate': 'EmergencyLighting',
  'Fire Risk Assessment (FRA)': 'FRA',
  'PAT Testing': 'PAT',
  'Legionella Risk Assessment': 'Legionella',
  'EPC': 'EPC',
  'HMO Licence': 'HMOLicence',
  'Asbestos Survey': 'Asbestos',
  'Building Control Certificate': 'BuildingControl',
  'Fire Door Certification': 'FireDoor',
  'Fire Panel Commissioning Certificate': 'FirePanel',
  'Insurance Schedule': 'Insurance',
  'Floor Plans / Fire Plans': 'FloorPlans',
};

function generateComplianceFilename(params: {
  complianceType: string;
  propertyAddress: string;
  originalFilename: string;
}): string {
  const { complianceType, propertyAddress, originalFilename } = params;

  // Get type code or clean up the type name
  const typeCode = COMPLIANCE_TYPE_CODES[complianceType] || 
    complianceType.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

  // Clean property address
  const addressPart = propertyAddress
    .split(',')[0]
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 30);

  // Format date as YYYY-MM-DD
  const dateStr = new Date().toISOString().split('T')[0];

  // Get file extension
  const extMatch = originalFilename.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0].toLowerCase() : '.pdf';

  return `${typeCode}_${addressPart}_${dateStr}${extension}`;
}

// Upload compliance document
export function useUploadComplianceDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      complianceItemId,
      propertyId,
      file,
      complianceType,
      propertyAddress,
      notes,
    }: {
      complianceItemId: string;
      propertyId: string;
      file: File;
      complianceType: string;
      propertyAddress: string;
      notes?: string;
    }) => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current version number
      const { data: existingDocs } = await supabase
        .from('compliance_documents')
        .select('version_number')
        .eq('compliance_item_id', complianceItemId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = existingDocs && existingDocs.length > 0 
        ? existingDocs[0].version_number + 1 
        : 1;

      // Generate structured filename
      const structuredFilename = generateComplianceFilename({
        complianceType,
        propertyAddress,
        originalFilename: file.name,
      });

      // Upload file with structured name
      const fileExt = file.name.split('.').pop();
      const storagePath = `${propertyId}/${complianceItemId}/${Date.now()}_${structuredFilename}`;
      
      const { error: uploadError } = await supabase.storage
        .from('compliance')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('compliance')
        .getPublicUrl(storagePath);

      // Archive previous current documents
      await supabase
        .from('compliance_documents')
        .update({ is_current: false, archived_at: new Date().toISOString() })
        .eq('compliance_item_id', complianceItemId)
        .eq('is_current', true);

      // Create document record with structured filename
      const { data, error } = await supabase
        .from('compliance_documents')
        .insert({
          compliance_item_id: complianceItemId,
          file_url: urlData.publicUrl,
          original_file_name: structuredFilename,
          file_type: file.type,
          uploaded_by: user.id,
          is_current: true,
          version_number: nextVersion,
          notes,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, propertyId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['compliance', result.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    },
  });
}

// Delete compliance document
export function useDeleteComplianceDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      propertyId,
      fileUrl 
    }: { 
      id: string; 
      propertyId: string;
      fileUrl: string;
    }) => {
      // Delete from storage
      const path = fileUrl.split('/compliance/')[1];
      if (path) {
        await supabase.storage.from('compliance').remove([path]);
      }

      // Delete record
      const { error } = await supabase
        .from('compliance_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['compliance', result.propertyId] });
    },
  });
}
