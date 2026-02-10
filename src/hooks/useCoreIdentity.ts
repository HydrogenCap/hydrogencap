import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types for Core Identity — fields that live on the `properties` table
export interface CoreIdentityData {
  property_name: string | null;
  address_line: string;
  address_line2: string | null;
  town_city: string | null;
  county: string | null;
  postcode: string | null;
  uprn: string | null;
  planning_authority: string | null;
  property_type: string | null;
  listed_status: string | null;
  conservation_area: boolean;
  // NOTE: construction_type and year_built have moved to property_passport table
}

export interface TitleNumber {
  id: string;
  property_id: string;
  title_number: string;
  created_at: string;
}

// Property Type enum values
export const PROPERTY_TYPES = [
  'Single let',
  'HMO',
  'Care home',
  'Mixed use',
  'Commercial',
] as const;

// Construction Type enum values
export const CONSTRUCTION_TYPES = [
  'Traditional',
  'Timber frame',
  'Steel frame',
  'Non-standard',
] as const;

// Listed Status enum values
export const LISTED_STATUSES = [
  'Not listed',
  'Grade II',
  'Grade II*',
  'Grade I',
] as const;

// Fetch title numbers for a property
export function useTitleNumbers(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_title_numbers', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('property_title_numbers')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TitleNumber[];
    },
    enabled: !!propertyId,
  });
}

// Add a title number
export function useAddTitleNumber() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ propertyId, titleNumber }: { propertyId: string; titleNumber: string }) => {
      const { data, error } = await supabase
        .from('property_title_numbers')
        .insert({ property_id: propertyId, title_number: titleNumber.trim().toUpperCase() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_title_numbers', data.property_id] });
    },
  });
}

// Remove a title number
export function useRemoveTitleNumber() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase
        .from('property_title_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property_title_numbers', data.propertyId] });
    },
  });
}

// Update core identity fields on the property
export function useUpdateCoreIdentity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ propertyId, data }: { propertyId: string; data: Partial<CoreIdentityData> }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('properties')
        .update({
          ...data,
          identity_updated_at: new Date().toISOString(),
          identity_updated_by: user?.user?.id || null,
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.id] });
    },
  });
}

// Calculate Core Identity completeness
export interface CoreIdentityCompleteness {
  percentage: number;
  completed: number;
  total: number;
  missingRequired: string[];
  missingSoftRequired: string[];
}

export function calculateCoreIdentityCompleteness(
  property: Partial<CoreIdentityData> & { construction_type_from_passport?: string | null } | null,
  titleNumbers: TitleNumber[]
): CoreIdentityCompleteness {
  if (!property) {
    return {
      percentage: 0,
      completed: 0,
      total: 9,
      missingRequired: ['Address', 'Property Type', 'Construction Type', 'Listed Status'],
      missingSoftRequired: ['UPRN', 'Title Numbers'],
    };
  }

  const requiredFields = [
    { key: 'address_line', label: 'Address Line 1', check: () => !!property.address_line },
    { key: 'town_city', label: 'City/Town', check: () => !!property.town_city },
    { key: 'postcode', label: 'Postcode', check: () => !!property.postcode },
    { key: 'planning_authority', label: 'Planning Authority', check: () => !!property.planning_authority },
    { key: 'property_type', label: 'Property Type', check: () => !!property.property_type },
    { key: 'construction_type', label: 'Construction Type', check: () => !!property.construction_type_from_passport },
    { key: 'listed_status', label: 'Listed Status', check: () => !!property.listed_status },
  ];

  const softRequiredFields = [
    { key: 'uprn', label: 'UPRN', check: () => !!property.uprn },
    { key: 'title_numbers', label: 'Title Numbers', check: () => titleNumbers.length > 0 },
  ];

  const missingRequired: string[] = [];
  const missingSoftRequired: string[] = [];
  let completed = 0;

  requiredFields.forEach(field => {
    if (field.check()) {
      completed++;
    } else {
      missingRequired.push(field.label);
    }
  });

  softRequiredFields.forEach(field => {
    if (field.check()) {
      completed++;
    } else {
      missingSoftRequired.push(field.label);
    }
  });

  const total = requiredFields.length + softRequiredFields.length;
  const percentage = Math.round((completed / total) * 100);

  return {
    percentage,
    completed,
    total,
    missingRequired,
    missingSoftRequired,
  };
}

// UK Postcode validation regex
export const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

export function formatUKPostcode(postcode: string): string {
  // Remove all spaces and convert to uppercase
  const clean = postcode.replace(/\s/g, '').toUpperCase();
  // Add space before last 3 characters if length > 3
  if (clean.length > 3) {
    return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
  }
  return clean;
}

export function isValidUKPostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test(postcode.replace(/\s/g, ''));
}
