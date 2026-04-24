import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface PassportSuggestion {
  id: string;
  property_id: string;
  field_key: string;
  suggested_value: Json;
  confidence: number;
  source_type: 'postcode_lookup' | 'epc' | 'floorplan' | 'listing' | 'inventory' | 'photo' | 'default';
  source_ref: string | null;
  evidence_excerpt: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface AcceptedSuggestion {
  id: string;
  field_key: string;
  value: Json;
  source_type: string;
  source_ref: string | null;
  confidence: number;
}

// Fields that always require manual confirmation
export const MUST_CONFIRM_FIELDS = ['local_authority', 'council_tax_band', 'construction_type'];

// High confidence threshold for auto-accepting
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;

// Field display labels
export const FIELD_LABELS: Record<string, string> = {
  local_authority: 'Local Authority',
  council_tax_band: 'Council Tax Band',
  construction_type: 'Construction Type',
  construction_date_band: 'Construction Period',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  ensuites: 'Ensuites',
  kitchens: 'Kitchens',
  living_rooms_communal: 'Living Rooms',
  county: 'County',
  epc_rating: 'EPC Rating',
};

// Source type display labels
export const SOURCE_LABELS: Record<string, string> = {
  postcode_lookup: 'Postcode Lookup',
  epc: 'EPC',
  floorplan: 'Floorplan',
  listing: 'Listing',
  inventory: 'Inventory',
  photo: 'Photos',
  default: 'Default',
};

export function usePendingSuggestions(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['passport_suggestions', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabaseAny
        .from('passport_autofill_suggestions')
        .select('*')
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .order('confidence', { ascending: false });

      if (error) throw error;
      return data as PassportSuggestion[];
    },
    enabled: !!propertyId,
  });
}

export function useGenerateSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-passport-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ property_id: propertyId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate suggestions');
      }

      return response.json();
    },
    onSuccess: (_, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ['passport_suggestions', propertyId] });
    },
  });
}

export function useApplySuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      acceptedSuggestions,
      rejectedSuggestionIds,
    }: {
      propertyId: string;
      acceptedSuggestions: AcceptedSuggestion[];
      rejectedSuggestionIds: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-passport-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            property_id: propertyId,
            accepted_suggestions: acceptedSuggestions,
            rejected_suggestion_ids: rejectedSuggestionIds,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to apply suggestions');
      }

      return response.json();
    },
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ['passport_suggestions', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property_passport', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property_passports'] });
    },
  });
}

// Categorize suggestions into must-confirm, high-confidence, and needs-review
export function categorizeSuggestions(suggestions: PassportSuggestion[]) {
  const mustConfirm: PassportSuggestion[] = [];
  const highConfidence: PassportSuggestion[] = [];
  const needsReview: PassportSuggestion[] = [];

  for (const suggestion of suggestions) {
    // Skip meta fields
    if (suggestion.field_key === 'has_floorplan') continue;
    
    if (MUST_CONFIRM_FIELDS.includes(suggestion.field_key)) {
      mustConfirm.push(suggestion);
    } else if (suggestion.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      highConfidence.push(suggestion);
    } else {
      needsReview.push(suggestion);
    }
  }

  return { mustConfirm, highConfidence, needsReview };
}
