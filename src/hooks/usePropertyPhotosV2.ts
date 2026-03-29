import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createSignedStorageUrl } from '@/lib/storagePaths';

/**
 * Fetches cover photos for V2 properties by matching them to V1 properties 
 * via address/postcode and looking up their photos.
 * Returns a Map<v2_property_id, cover_photo_url>
 */
export function usePropertyPhotosV2() {
  return useQuery({
    queryKey: ['property_photos_v2_map'],
    queryFn: async () => {
      // 1. Get all V2 properties (just id + address for matching)
      const { data: v2Props, error: v2Err } = await supabase
        .from('properties_v2')
        .select('id, address_line_1, postcode');
      if (v2Err) throw v2Err;

      // 2. Get all V1 properties (id + address for matching — still needed for photo lookup)
      const { data: v1Props, error: v1Err } = await supabase
        .from('properties')
        .select('id, address_line, postcode');
      if (v1Err) throw v1Err;

      // 3. Get all cover photos
      const { data: photos, error: photoErr } = await supabase
        .from('photos')
        .select('property_id, file_url, is_cover')
        .eq('is_cover', true);
      if (photoErr) throw photoErr;

      // Batch all signed URL requests into a single Storage API call
      const photoPaths = (photos || []).map(p => p.file_url).filter(Boolean);
      const { data: signedUrlsData } = photoPaths.length > 0
        ? await supabase.storage.from('photos').createSignedUrls(photoPaths, 3600)
        : { data: [] };
      const signedUrlMap = new Map<string, string>();
      (signedUrlsData || []).forEach((entry) => {
        if (entry.signedUrl) signedUrlMap.set(entry.path, entry.signedUrl);
      });
      const resolvedPhotos = (photos || []).map((photo) => ({
        property_id: photo.property_id,
        file_url: signedUrlMap.get(photo.file_url) || photo.file_url,
      }));

      // Build V1 photo map
      const v1PhotoMap = new Map<string, string>();
      resolvedPhotos.forEach((photo) => v1PhotoMap.set(photo.property_id, photo.file_url));

      // Build V1 lookup by normalised postcode
      const v1ByPostcode = new Map<string, typeof v1Props>();
      v1Props?.forEach(v1 => {
        const key = (v1.postcode || '').trim().toLowerCase();
        if (!v1ByPostcode.has(key)) v1ByPostcode.set(key, []);
        v1ByPostcode.get(key)!.push(v1);
      });

      // Match V2 → V1 → photo
      const result = new Map<string, string>();
      v2Props?.forEach(v2 => {
        const postKey = (v2.postcode || '').trim().toLowerCase();
        const candidates = v1ByPostcode.get(postKey) || [];
        const v2Addr = (v2.address_line_1 || '').toLowerCase();

        for (const v1 of candidates) {
          const v1Addr = (v1.address_line || '').toLowerCase();
          const v2First = v2Addr.split(',')[0].trim();
          const v1First = v1Addr.split(',')[0].trim();
          
          if (v2First === v1First || v2Addr.includes(v1First) || v1Addr.includes(v2First)) {
            const photoUrl = v1PhotoMap.get(v1.id);
            if (photoUrl) {
              result.set(v2.id, photoUrl);
              break;
            }
          }
        }
      });

      return result;
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Get a single V2 property's cover photo URL
 */
export function usePropertyPhotoV2(propertyId: string | undefined) {
  const { data: photoMap } = usePropertyPhotosV2();
  return propertyId ? photoMap?.get(propertyId) : undefined;
}
