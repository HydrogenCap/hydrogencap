import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// Types
export type SubjectType = 'COMPANY' | 'PROPERTY';
export type OwnershipType = 'SHAREHOLDING' | 'BENEFICIAL' | 'OTHER';
export type OwnershipSource = 'manual' | 'companies_house' | 'import';

export interface OwnershipLink {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  owner_party_id: string;
  ownership_type: OwnershipType;
  percent: number;
  shares: number | null;
  effective_from: string | null;
  effective_to: string | null;
  source: OwnershipSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  owner_party?: {
    id: string;
    display_name: string;
    party_type: string;
    company_number: string | null;
    email: string | null;
  } | null;
  // For property subjects
  property?: {
    id: string;
    address_line_1: string;
    postcode: string | null;
    county: string | null;
  } | null;
  // For company subjects
  company?: {
    id: string;
    legal_name: string;
    company_type: string;
    company_number: string | null;
  } | null;
}

export interface OwnershipLinkInsert {
  subject_type: SubjectType;
  subject_id: string;
  owner_party_id: string;
  ownership_type?: OwnershipType;
  percent: number;
  shares?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  source?: OwnershipSource;
  notes?: string | null;
}

export interface OwnershipLinkUpdate {
  id: string;
  owner_party_id?: string;
  ownership_type?: OwnershipType;
  percent?: number;
  shares?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  source?: OwnershipSource;
  notes?: string | null;
}

// Query keys for cache management
export const ownershipKeys = {
  all: ['ownership_links'] as const,
  bySubject: (type: SubjectType, id: string) => ['ownership_links', type, id] as const,
  byOwner: (partyId: string) => ['ownership_links', 'owner', partyId] as const,
  grid: (filters?: OwnershipGridFilters) => ['ownership_links', 'grid', filters] as const,
};

export interface OwnershipGridFilters {
  subjectType?: SubjectType;
  companyId?: string;
  propertyId?: string;
  ownerPartyId?: string;
  ownershipType?: OwnershipType;
}

// Fetch ownership for a company (shareholdings)
export function useCompanyOwnership(companyId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ownershipKeys.bySubject('COMPANY', companyId || ''),
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabaseAny
        .from('ownership_links')
        .select(`
          *,
          owner_party:parties!owner_party_id(id, display_name, party_type, company_number, email)
        `)
        .eq('subject_type', 'COMPANY')
        .eq('subject_id', companyId)
        .is('effective_to', null)
        .order('percent', { ascending: false });

      if (error) throw error;
      return data as OwnershipLink[];
    },
    enabled: !!companyId,
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!companyId) return;

    const topic = `ownership:company:${companyId}`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ownership_links',
          filter: `subject_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ownershipKeys.bySubject('COMPANY', companyId) });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[realtime] channel "${topic}" status=${status}`, err ?? '');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return query;
}

// Fetch ownership for a property (beneficial ownership)
export function usePropertyBeneficialOwnership(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ownershipKeys.bySubject('PROPERTY', propertyId || ''),
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabaseAny
        .from('ownership_links')
        .select(`
          *,
          owner_party:parties!owner_party_id(id, display_name, party_type, company_number, email)
        `)
        .eq('subject_type', 'PROPERTY')
        .eq('subject_id', propertyId)
        .eq('ownership_type', 'BENEFICIAL')
        .is('effective_to', null)
        .order('percent', { ascending: false });

      if (error) throw error;
      return data as OwnershipLink[];
    },
    enabled: !!propertyId,
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`ownership_property_${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ownership_links',
          filter: `subject_id=eq.${propertyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ownershipKeys.bySubject('PROPERTY', propertyId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, queryClient]);

  return query;
}

// Fetch ownership grid (all ownership with filters)
export function useOwnershipGrid(filters?: OwnershipGridFilters) {
  return useQuery({
    queryKey: ownershipKeys.grid(filters),
    queryFn: async () => {
      let query = supabaseAny
        .from('ownership_links')
        .select(`
          *,
          owner_party:parties!owner_party_id(id, display_name, party_type, company_number, email)
        `)
        .is('effective_to', null);

      if (filters?.subjectType) {
        query = query.eq('subject_type', filters.subjectType);
      }
      if (filters?.companyId) {
        query = query.eq('subject_id', filters.companyId).eq('subject_type', 'COMPANY');
      }
      if (filters?.propertyId) {
        query = query.eq('subject_id', filters.propertyId).eq('subject_type', 'PROPERTY');
      }
      if (filters?.ownerPartyId) {
        query = query.eq('owner_party_id', filters.ownerPartyId);
      }
      if (filters?.ownershipType) {
        query = query.eq('ownership_type', filters.ownershipType);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // Enrich with subject details — batch fetch to avoid N+1 queries
      const companyIds = (data || []).filter(l => l.subject_type === 'COMPANY').map(l => l.subject_id);
      const propertyIds = (data || []).filter(l => l.subject_type === 'PROPERTY').map(l => l.subject_id);

      const [companiesRes, propertiesRes] = await Promise.all([
        companyIds.length
          ? supabase.from('companies').select('id, legal_name, company_type, company_number').in('id', companyIds)
          : Promise.resolve({ data: [] as { id: string; legal_name: string | null; company_type: string | null; company_number: string | null }[] }),
        propertyIds.length
          ? supabase.from('properties_v2').select('id, address_line_1, postcode, county').in('id', propertyIds)
          : Promise.resolve({ data: [] as { id: string; address_line_1: string; postcode: string; county: string | null }[] }),
      ]);

      const companyMap = new Map((companiesRes.data || []).map(c => [c.id, c]));
      const propertyMap = new Map((propertiesRes.data || []).map(p => [p.id, p]));

      const enriched = (data || []).map(link => ({
        ...link,
        ...(link.subject_type === 'COMPANY' ? { company: companyMap.get(link.subject_id) ?? null } : {}),
        ...(link.subject_type === 'PROPERTY' ? { property: propertyMap.get(link.subject_id) ?? null } : {}),
      }));

      return enriched as OwnershipLink[];
    },
  });
}

// Add ownership link
export function useAddOwnershipLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: OwnershipLinkInsert) => {
      const { data, error } = await supabaseAny
        .from('ownership_links')
        .insert({
          ...input,
          ownership_type: input.ownership_type || (input.subject_type === 'COMPANY' ? 'SHAREHOLDING' : 'BENEFICIAL'),
          source: input.source || 'manual',
        })
        .select(`
          *,
          owner_party:parties!owner_party_id(id, display_name, party_type, company_number, email)
        `)
        .single();

      if (error) throw error;
      return data as OwnershipLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ownershipKeys.bySubject(data.subject_type, data.subject_id) });
      queryClient.invalidateQueries({ queryKey: ownershipKeys.grid() });
    },
  });
}

// Update ownership link
export function useUpdateOwnershipLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: OwnershipLinkUpdate) => {
      const { data, error } = await supabaseAny
        .from('ownership_links')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          owner_party:parties!owner_party_id(id, display_name, party_type, company_number, email)
        `)
        .single();

      if (error) throw error;
      return data as OwnershipLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ownershipKeys.bySubject(data.subject_type, data.subject_id) });
      queryClient.invalidateQueries({ queryKey: ownershipKeys.grid() });
    },
  });
}

// Delete ownership link
export function useDeleteOwnershipLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, subjectType, subjectId }: { id: string; subjectType: SubjectType; subjectId: string }) => {
      const { error } = await supabaseAny
        .from('ownership_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { subjectType, subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ownershipKeys.bySubject(data.subjectType, data.subjectId) });
      queryClient.invalidateQueries({ queryKey: ownershipKeys.grid() });
    },
  });
}

// Helper: Calculate total ownership percentage
export function calculateOwnershipTotal(links: OwnershipLink[]): number {
  return links
    .filter(l => !l.effective_to)
    .reduce((sum, l) => sum + Number(l.percent), 0);
}

// Helper: Validate ownership total equals 100%
export function validateOwnershipTotal(total: number, tolerance: number = 0.5): boolean {
  return Math.abs(total - 100) <= tolerance;
}

// Helper: Get owner display name
export function getOwnerName(link: OwnershipLink): string {
  return link.owner_party?.display_name || 'Unknown';
}

// Helper: Get owner type
export function getOwnerType(link: OwnershipLink): string {
  return link.owner_party?.party_type || 'Unknown';
}
