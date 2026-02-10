import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];
type PropertyPassport = Database['public']['Tables']['property_passport']['Row'];

export interface PassportPageProperty extends Property {
  property_passport: PropertyPassport | null;
}

/**
 * Fetches properties joined with their property_passport data.
 * Used by the Passport page to display both identity (properties) 
 * and building classification / operational data (property_passport).
 */
export function usePassportPageData() {
  return useQuery({
    queryKey: ['passport_page_data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          property_passport(*)
        `)
        .order('address_line');

      if (error) throw error;

      // Normalize: Supabase returns property_passport as array, flatten to single object
      return (data || []).map(p => ({
        ...p,
        property_passport: Array.isArray(p.property_passport)
          ? p.property_passport[0] ?? null
          : p.property_passport ?? null,
      })) as PassportPageProperty[];
    },
  });
}
