import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';

// Types
export interface CHSearchResult {
  company_number: string;
  company_name: string;
  company_status: string;
  date_of_creation: string;
  address_snippet: string;
}

export interface CHProfile {
  company_name: string;
  company_number: string;
  company_status: string;
  type: string;
  date_of_creation: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  accounts?: {
    next_due?: string;
    last_accounts?: { made_up_to?: string; type?: string };
    accounting_reference_date?: { month?: string; day?: string };
  };
  confirmation_statement?: {
    next_due?: string;
    last_made_up_to?: string;
    next_made_up_to?: string;
  };
  has_charges?: boolean;
  has_been_liquidated?: boolean;
  has_insolvency_history?: boolean;
  sic_codes?: string[];
}

export interface CHOfficer {
  name: string;
  officer_role: string;
  appointed_on: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
}

export interface CHFilingHistoryItem {
  date: string;
  description: string;
  type: string;
  category: string;
}

export type VerificationStatus = 'not_synced' | 'no_company_number' | 'status_mismatch' | 'verified';
export type FilingStatus = 'ok' | 'due_soon' | 'overdue';

export interface EntityVerification {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  company_number: string | null;
  org_id: string;
  local_status: string;
  local_incorporation_date: string | null;
  local_registered_address: string | null;
  ch_company_name: string | null;
  ch_company_status: string | null;
  ch_incorporation_date: string | null;
  ch_address_line_1: string | null;
  ch_postcode: string | null;
  ch_accounts_next_due: string | null;
  ch_confirmation_next_due: string | null;
  ch_has_charges: string | null;
  last_synced: string | null;
  verification_status: VerificationStatus;
  accounts_filing_status: FilingStatus;
  confirmation_filing_status: FilingStatus;
}

type EntityVerificationStatusRow = Database['public']['Views']['entity_verification_status']['Row'];
type CompaniesHouseCacheRow = Database['public']['Tables']['companies_house_cache']['Row'];
type OfficersCacheResponse = { items?: CHOfficer[] };
type FilingHistoryCacheResponse = { items?: CHFilingHistoryItem[] };

// Hook: call the new companies-house edge function
export function useCompaniesHouseV2() {
  const [isSearching, setIsSearching] = useState(false);

  const searchCompanies = async (query: string): Promise<CHSearchResult[]> => {
    if (!query || query.length < 2) return [];
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('companies-house', {
        body: { action: 'search', search_query: query }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.companies || [];
    } catch (err) {
      console.error('CH search error:', err);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const fetchProfile = async (companyNumber: string, entityId?: string): Promise<{ data: CHProfile; cached: boolean; fetched_at: string } | null> => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'profile', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  const fetchOfficers = async (companyNumber: string, entityId?: string): Promise<{ data: { items: CHOfficer[] }; cached: boolean } | null> => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'officers', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  const fetchFilingHistory = async (companyNumber: string, entityId?: string): Promise<{ data: { items: CHFilingHistoryItem[] }; cached: boolean } | null> => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'filing_history', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  return { searchCompanies, fetchProfile, fetchOfficers, fetchFilingHistory, isSearching };
}

// Hook: entity verification status from the view
export function useEntityVerificationStatus() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['entity_verification_status', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_verification_status')
        .select('*')
        .eq('org_id', org!.id);
      if (error) throw error;
      return ((data || []) as EntityVerificationStatusRow[]) as unknown as EntityVerification[];
    },
    enabled: !!org?.id,
  });
}

// Hook: single entity verification
export function useEntityVerification(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_verification', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_verification_status')
        .select('*')
        .eq('entity_id', entityId!)
        .maybeSingle();
      if (error) throw error;
      return (data as EntityVerificationStatusRow | null) as unknown as EntityVerification | null;
    },
    enabled: !!entityId,
  });
}

// Hook: sync a single entity (profile + officers + filing_history)
export function useSyncEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityId, companyNumber }: { entityId: string; companyNumber: string }) => {
      const ch = createCompaniesHouseClient();
      
      // Fetch all three in parallel
      const [profile, officers, filings] = await Promise.all([
        ch.fetchProfile(companyNumber, entityId),
        ch.fetchOfficers(companyNumber, entityId),
        ch.fetchFilingHistory(companyNumber, entityId),
      ]);

      return { profile, officers, filings };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entity_verification', variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['entity_verification_status'] });
      queryClient.invalidateQueries({ queryKey: ['ch_officers', variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['ch_filing_history', variables.entityId] });
    },
  });
}

// Standalone function (not a hook) for use inside mutations
function createCompaniesHouseClient() {
  const fetchProfile = async (companyNumber: string, entityId?: string) => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'profile', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  const fetchOfficers = async (companyNumber: string, entityId?: string) => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'officers', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  const fetchFilingHistory = async (companyNumber: string, entityId?: string) => {
    const { data, error } = await supabase.functions.invoke('companies-house', {
      body: { action: 'filing_history', company_number: companyNumber, entity_id: entityId }
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data;
  };

  return { fetchProfile, fetchOfficers, fetchFilingHistory };
}

// Hook: cached officers for an entity
export function useCHOfficers(entityId: string | undefined, companyNumber: string | null) {
  return useQuery({
    queryKey: ['ch_officers', entityId],
    queryFn: async () => {
      const { data: cached } = await supabase
        .from('companies_house_cache')
        .select('response_data')
        .eq('entity_id', entityId!)
        .eq('data_type', 'officers')
        .maybeSingle();
      
      const row = cached as Pick<CompaniesHouseCacheRow, 'response_data'> | null;
      const responseData = row?.response_data as unknown as OfficersCacheResponse | undefined;
      if (responseData?.items) {
        return responseData.items.filter((officer) => !officer.resigned_on);
      }
      return [] as CHOfficer[];
    },
    enabled: !!entityId && !!companyNumber,
  });
}

// Hook: cached filing history for an entity  
export function useCHFilingHistory(entityId: string | undefined, companyNumber: string | null) {
  return useQuery({
    queryKey: ['ch_filing_history', entityId],
    queryFn: async () => {
      const { data: cached } = await supabase
        .from('companies_house_cache')
        .select('response_data')
        .eq('entity_id', entityId!)
        .eq('data_type', 'filing_history')
        .maybeSingle();
      
      const row = cached as Pick<CompaniesHouseCacheRow, 'response_data'> | null;
      const responseData = row?.response_data as unknown as FilingHistoryCacheResponse | undefined;
      if (responseData?.items) {
        return responseData.items;
      }
      return [] as CHFilingHistoryItem[];
    },
    enabled: !!entityId && !!companyNumber,
  });
}
