import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Photo = Tables<'photos'>;
export type PhotoInsert = TablesInsert<'photos'>;

export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['photos', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('property_id', propertyId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Photo[];
    },
    enabled: !!propertyId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, propertyId }: { file: File; propertyId: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${propertyId}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Check how many photos exist to set display order
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', propertyId);

      // Create photo record
      const { data, error } = await supabase
        .from('photos')
        .insert({
          property_id: propertyId,
          file_url: urlData.publicUrl,
          display_order: (count || 0) + 1,
          is_cover: count === 0, // First photo is cover by default
        })
        .select()
        .single();

      if (error) throw error;
      return data as Photo;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property_photos_covers'] });
    },
  });
}

export function useSetCoverPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, propertyId }: { photoId: string; propertyId: string }) => {
      // First, unset all cover photos for this property
      await supabase
        .from('photos')
        .update({ is_cover: false })
        .eq('property_id', propertyId);

      // Then set the new cover photo
      const { data, error } = await supabase
        .from('photos')
        .update({ is_cover: true })
        .eq('id', photoId)
        .select()
        .single();

      if (error) throw error;
      return data as Photo;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property_photos_covers'] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, propertyId, fileUrl }: { photoId: string; propertyId: string; fileUrl: string }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/photos/');
      const filePath = urlParts[urlParts.length - 1];

      // Delete from storage
      if (filePath) {
        await supabase.storage.from('photos').remove([filePath]);
      }

      // Delete record
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property_photos_covers'] });
    },
  });
}

export function useReorderPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photos, propertyId }: { photos: { id: string; display_order: number }[]; propertyId: string }) => {
      // Update each photo's display order
      const updates = photos.map(photo =>
        supabase
          .from('photos')
          .update({ display_order: photo.display_order })
          .eq('id', photo.id)
      );

      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.propertyId] });
    },
  });
}
