// ============================================
// PROPERTIES TABLE DATA HOOKS
// Custom hooks for fetching related property data
// ============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createSignedStorageUrl } from '@/lib/storagePaths';

/**
 * Hook to fetch cover photos for all properties
 */
export function usePropertyPhotos() {
  return useQuery({
    queryKey: ['property_photos_covers_map'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('photos')
        .select('property_id, file_url, is_cover')
        .eq('is_cover', true);
      
      if (error) throw error;
      
      const photoMap = new Map<string, string>();
      const resolvedPhotos = await Promise.all(
        (data || []).map(async (photo) => ({
          property_id: photo.property_id,
          file_url: await createSignedStorageUrl('photos', photo.file_url),
        }))
      );
      resolvedPhotos.forEach((photo) => {
        photoMap.set(photo.property_id, photo.file_url);
      });
      return photoMap;
    },
  });
}

/**
 * Hook to fetch legal owner company names for all properties
 */
export function useLegalOwnerCompanies() {
  return useQuery({
    queryKey: ['property_legal_owner_companies'],
    queryFn: async () => {
      // Get all companies in a single query
      const { data: companies, error } = await (supabase as any)
        .from('companies')
        .select('id, legal_name');
      
      if (error) throw error;
      
      // Create a map of company_id -> company name
      const companyMap = new Map<string, string>();
      companies?.forEach(company => {
        companyMap.set(company.id, company.legal_name);
      });
      return companyMap;
    },
  });
}
