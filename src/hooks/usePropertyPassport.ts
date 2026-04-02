import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PropertyPassport = Database['public']['Tables']['property_passport']['Row'];
type PropertyPassportInsert = Database['public']['Tables']['property_passport']['Insert'];
type PropertyPassportUpdate = Database['public']['Tables']['property_passport']['Update'];

export type { PropertyPassport };

// Fetch a single passport by property ID
export function usePropertyPassport(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_passport', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      
      const { data, error } = await (supabase as any)
        .from('property_passport')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}

// Fetch all passports (for dashboard)
export function usePropertyPassports() {
  return useQuery({
    queryKey: ['property_passports'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('property_passport')
        .select('*');

      if (error) throw error;
      return data as PropertyPassport[];
    },
  });
}

// Fetch passports with property info for dashboard
export function usePassportsWithProperties() {
  return useQuery({
    queryKey: ['passports_with_properties'],
    queryFn: async () => {
      // Get all properties
      const { data: properties, error: propError } = await (supabase as any)
        .from('properties_v2')
        .select('id, address_line_1, postcode, county');
      
      if (propError) throw propError;

      // Get all passports
      const { data: passports, error: passError } = await (supabase as any)
        .from('property_passport')
        .select('*');
      
      if (passError) throw passError;

      // Create a map of passports by property_id
      const passportMap = new Map<string, PropertyPassport>();
      passports?.forEach(p => passportMap.set(p.property_id, p));

      // Combine data
      return properties?.map(prop => ({
        ...prop,
        passport: passportMap.get(prop.id) || null,
      })) || [];
    },
  });
}

// Upsert (create or update) a passport
export function useUpsertPassport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (passport: PropertyPassportInsert) => {
      // Sanitize empty strings to null for UUID fields to prevent database errors
      const sanitized = { ...passport };
      const uuidFields = ['management_company_id', 'local_authority_id'] as const;
      for (const field of uuidFields) {
        if (sanitized[field] === '') {
          sanitized[field] = null;
        }
      }
      
      const { data, error } = await (supabase as any)
        .from('property_passport')
        .upsert(sanitized, { onConflict: 'property_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_passport', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['property_passports'] });
      queryClient.invalidateQueries({ queryKey: ['passports_with_properties'] });
    },
  });
}

// Update an existing passport
export function useUpdatePassport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...passport }: PropertyPassportUpdate & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('property_passport')
        .update(passport)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_passport', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['property_passports'] });
      queryClient.invalidateQueries({ queryKey: ['passports_with_properties'] });
    },
  });
}

// Calculate passport completeness - only operational fields in the passport table
export interface PassportCompleteness {
  complete: boolean;
  percentage: number;
  missingFields: string[];
  criticalMissing: string[];
}

export function calculatePassportCompleteness(passport: PropertyPassport | null): PassportCompleteness {
  if (!passport) {
    return {
      complete: false,
      percentage: 0,
      missingFields: ['No passport data'],
      criticalMissing: ['Property Type'],
    };
  }

  // Key passport fields for completeness tracking
  const requiredFields = [
    { key: 'construction_type', label: 'Construction Type', critical: true },
    { key: 'built_in_year', label: 'Year Built', critical: false },
    { key: 'number_of_storeys', label: 'Number of Storeys', critical: false },
    { key: 'keysafe_code', label: 'Keysafe Code', critical: false },
    { key: 'electric_meter_location', label: 'Electric Meter Location', critical: false },
    { key: 'gas_meter_location', label: 'Gas Meter Location', critical: false },
    { key: 'water_stop_tap_location', label: 'Water Stop Tap', critical: false },
    { key: 'kitchens', label: 'Kitchens', critical: false },
    { key: 'bathrooms', label: 'Bathrooms', critical: false },
    { key: 'bedrooms', label: 'Bedrooms', critical: false },
  ];

  const missingFields: string[] = [];
  const criticalMissing: string[] = [];
  let filledCount = 0;

  requiredFields.forEach(field => {
    const value = passport[field.key as keyof PropertyPassport];
    if (value === null || value === undefined || value === '') {
      missingFields.push(field.label);
      if (field.critical) {
        criticalMissing.push(field.label);
      }
    } else {
      filledCount++;
    }
  });

  const totalFields = requiredFields.length;
  const percentage = Math.round((filledCount / totalFields) * 100);

  return {
    complete: missingFields.length === 0,
    percentage,
    missingFields,
    criticalMissing,
  };
}

// HMO licence status
export type HMOLicenceStatus = 'overdue' | 'expiring_soon' | 'valid' | 'not_required' | 'missing';

export function getHMOLicenceStatus(passport: PropertyPassport | null): HMOLicenceStatus {
  if (!passport) return 'not_required';
  
  if (!passport.hmo_licence_required) return 'not_required';
  
  if (!passport.hmo_licence || !passport.hmo_licence_expiry) return 'missing';
  
  const expiry = new Date(passport.hmo_licence_expiry);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry <= 0) return 'overdue';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
}
