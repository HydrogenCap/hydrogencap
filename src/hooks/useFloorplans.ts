import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createSignedStorageUrl, extractStoragePath } from '@/lib/storagePaths';

export interface Floorplan {
  id: string;
  property_id: string;
  file_url: string;
  file_type: 'pdf' | 'image';
  original_file_name: string;
  final_file_name: string | null;
  version_label: string | null;
  notes: string | null;
  is_primary: boolean;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

interface UploadFloorplanParams {
  propertyId: string;
  file: File;
  isPrimary: boolean;
  versionLabel?: string;
  notes?: string;
}

async function resolveFloorplanUrls<T extends { file_url: string }>(floorplans: T[]): Promise<T[]> {
  return Promise.all(
    floorplans.map(async (floorplan) => ({
      ...floorplan,
      file_url: await createSignedStorageUrl('floorplans', floorplan.file_url),
    }))
  );
}

export function useFloorplans(propertyId: string) {
  return useQuery({
    queryKey: ['floorplans', propertyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('floorplans')
        .select('*')
        .eq('property_id', propertyId)
        .order('is_primary', { ascending: false })
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return resolveFloorplanUrls((data ?? []) as Floorplan[]);
    },
    enabled: !!propertyId,
  });
}

export function usePrimaryFloorplan(propertyId: string) {
  return useQuery({
    queryKey: ['floorplans', propertyId, 'primary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('floorplans')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_primary', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      const [resolvedFloorplan] = await resolveFloorplanUrls([data as Floorplan]);
      return resolvedFloorplan;
    },
    enabled: !!propertyId,
  });
}

function getFileType(file: File): 'pdf' | 'image' {
  if (file.type === 'application/pdf') return 'pdf';
  return 'image';
}

function generateStoragePath(propertyId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${propertyId}/${timestamp}-${sanitizedName}`;
}

export function useUploadFloorplan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ propertyId, file, isPrimary, versionLabel, notes }: UploadFloorplanParams) => {
      const fileType = getFileType(file);
      const storagePath = generateStoragePath(propertyId, file.name);

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('floorplans')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Insert floorplan record
      const { data, error } = await (supabase as any)
        .from('floorplans')
        .insert({
          property_id: propertyId,
          file_url: storagePath,
          file_type: fileType,
          original_file_name: file.name,
          is_primary: isPrimary,
          version_label: versionLabel || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['floorplans', data.property_id] });
      toast({
        title: 'Floorplan uploaded',
        description: 'The floorplan has been added successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to upload floorplan:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload floorplan. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFloorplan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Floorplan> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('floorplans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['floorplans', data.property_id] });
      toast({
        title: 'Floorplan updated',
        description: 'The floorplan has been updated.',
      });
    },
    onError: (error) => {
      console.error('Failed to update floorplan:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update floorplan.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteFloorplan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, propertyId, fileUrl }: { id: string; propertyId: string; fileUrl: string }) => {
      const storagePath = extractStoragePath('floorplans', fileUrl);
      if (storagePath) {
        await supabase.storage.from('floorplans').remove([storagePath]);
      }

      const { error } = await (supabase as any)
        .from('floorplans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, propertyId };
    },
    onSuccess: ({ propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ['floorplans', propertyId] });
      toast({
        title: 'Floorplan deleted',
        description: 'The floorplan has been removed.',
      });
    },
    onError: (error) => {
      console.error('Failed to delete floorplan:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete floorplan.',
        variant: 'destructive',
      });
    },
  });
}

export function useSetPrimaryFloorplan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, propertyId: _propertyId }: { id: string; propertyId: string }) => {
      const { data, error } = await (supabase as any)
        .from('floorplans')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['floorplans', data.property_id] });
      toast({
        title: 'Primary floorplan set',
        description: 'This floorplan is now the primary view.',
      });
    },
    onError: (error) => {
      console.error('Failed to set primary floorplan:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to set primary floorplan.',
        variant: 'destructive',
      });
    },
  });
}
