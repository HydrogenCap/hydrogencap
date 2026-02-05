import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Photo = Tables<'photos'>;

/**
 * Fetch all cover photos across all properties in the organization
 * Useful for portfolio reports and presentation generation
 */
export function useAllPropertyCoverPhotos() {
  return useQuery({
    queryKey: ['property_photos_covers_array'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, property_id, file_url, is_cover')
        .eq('is_cover', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Photo[];
    },
  });
}

/**
 * Fetch all photos across all properties (not just covers)
 * Useful when building complete media galleries
 */
export function useAllPropertyPhotos() {
  return useQuery({
    queryKey: ['property_photos_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, property_id, file_url, is_cover, display_order')
        .order('property_id')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Photo[];
    },
  });
}
