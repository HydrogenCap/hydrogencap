import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PropertyV2 = Database['public']['Tables']['properties_v2']['Row'];
type PropertyPassport = Database['public']['Tables']['property_passport']['Row'];

export interface PassportPageProperty extends PropertyV2 {
  property_passport: PropertyPassport | null;
  /** @deprecated V1 compat alias for address_line_1 */
  address_line: string;
}

/**
 * Fetches properties_v2 and separately fetches property_passport data,
 * then merges them client-side (since property_passport FK still points to V1).
 */
export function usePassportPageData() {
  return useQuery({
    queryKey: ['passport_page_data'],
    queryFn: async () => {
      // Fetch V2 properties
      const { data: properties, error: propError } = await (supabase as any)
        .from('properties_v2')
        .select('*')
        .order('address_line_1');

      if (propError) throw propError;

      // Fetch all passports separately
      const { data: passports, error: passError } = await (supabase as any)
        .from('property_passport')
        .select('*');

      if (passError) throw passError;

      // Create passport lookup by property_id
      // Note: passport.property_id still references V1 IDs
      // We need to match by org_id + address for cross-reference
      const passportByPropertyId = new Map<string, PropertyPassport>();
      passports?.forEach(p => passportByPropertyId.set(p.property_id, p));

      // Also create a lookup by address for V1→V2 matching
      const passportByAddress = new Map<string, PropertyPassport>();
      // We'll need V1 properties to resolve the mapping
      const { data: v1Props } = await (supabase as any)
        .from('properties')
        .select('id, address_line, postcode');

      const v1IdToAddress = new Map<string, string>();
      v1Props?.forEach(p => {
        const key = `${(p.address_line || '').toLowerCase().trim()}|${(p.postcode || '').toLowerCase().trim()}`;
        v1IdToAddress.set(p.id, key);
      });

      passports?.forEach(p => {
        const addressKey = v1IdToAddress.get(p.property_id);
        if (addressKey) {
          passportByAddress.set(addressKey, p);
        }
      });

      return (properties || []).map(p => {
        // Try direct ID match first, then address match
        let passport = passportByPropertyId.get(p.id) || null;
        if (!passport) {
          const key = `${(p.address_line_1 || '').toLowerCase().trim()}|${(p.postcode || '').toLowerCase().trim()}`;
          passport = passportByAddress.get(key) || null;
        }

        return {
          ...p,
          property_passport: passport,
          // V1 compat alias
          address_line: p.address_line_1,
        };
      }) as PassportPageProperty[];
    },
  });
}
