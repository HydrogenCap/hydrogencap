import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PropertyV2 = Database['public']['Tables']['properties_v2']['Row'];
type PropertyPassport = Database['public']['Tables']['property_passport']['Row'];

export interface PassportPageProperty extends PropertyV2 {
  property_passport: PropertyPassport | null;
  /** @deprecated V1 compat alias for address_line_1 */
  address_line: string;
}

/**
 * Fetches properties_v2 and joins property_passport rows by property_id.
 *
 * As of the 2026-04-30 Class-B FK re-point, property_passport.property_id
 * now references properties_v2(id) directly, so the legacy V1-address
 * bridge is no longer required.
 */
export function usePassportPageData() {
  return useQuery({
    queryKey: ['passport_page_data'],
    queryFn: async () => {
      const [{ data: properties, error: propError }, { data: passports, error: passError }] =
        await Promise.all([
          supabaseAny.from('properties_v2').select('*').order('address_line_1'),
          supabaseAny.from('property_passport').select('*'),
        ]);

      if (propError) throw propError;
      if (passError) throw passError;

      const passportByPropertyId = new Map<string, PropertyPassport>();
      passports?.forEach((p: PropertyPassport) => passportByPropertyId.set(p.property_id, p));

      return (properties || []).map((p: PropertyV2) => ({
        ...p,
        property_passport: passportByPropertyId.get(p.id) || null,
        address_line: p.address_line_1,
      })) as PassportPageProperty[];
    },
  });
}
