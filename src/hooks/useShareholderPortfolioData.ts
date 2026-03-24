import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShareholderSession } from './useShareholderSession';
import { createSignedStorageUrl } from '@/lib/storagePaths';

export interface PortalPropertyV2 {
  id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  postcode: string;
  property_type: string;
  lifecycle_stage: string;
  current_valuation: number | null;
  total_lettable_rooms: number | null;
  entity_id: string;
  entity?: {
    id: string;
    entity_name: string;
  } | null;
}

export interface PortalLoanV2 {
  id: string;
  property_id: string;
  entity_id: string;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number | null;
  rate_expiry_date: string | null;
  rate_type: string;
  status: string;
  lender?: {
    id: string;
    lender_name: string;
  } | null;
}

export interface PortalPerformanceV2 {
  property_id: string | null;
  property_address: string | null;
  entity_name: string | null;
  current_valuation: number | null;
  annual_rent_received: number | null;
  annual_costs: number | null;
  annual_mortgage_payments: number | null;
  annual_noi: number | null;
  annual_cash_flow: number | null;
  net_yield_pct: number | null;
  avg_occupancy: number | null;
  avg_collection_rate: number | null;
}

export interface PortalComplianceRowV2 {
  property_id: string | null;
  property_address: string | null;
  document_type: string | null;
  calculated_status: string | null;
  expiry_date: string | null;
  issue_date: string | null;
  is_required: boolean | null;
  days_remaining: number | null;
}

interface PortalCoverPhoto {
  id: string;
  property_id: string;
  file_url: string;
  is_cover: boolean;
}

const PROPERTY_ANNUAL_PERFORMANCE_TABLE = 'property_annual_performance' as never;
const COMPLIANCE_MATRIX_V2_TABLE = 'compliance_matrix_v2' as never;

interface UseShareholderPortfolioDataOptions {
  includeFinancials?: boolean;
  includeCompliance?: boolean;
  includePhotos?: boolean;
}

export function useShareholderPortfolioData(options?: UseShareholderPortfolioDataOptions) {
  const { orgId, isShareholderUser } = useShareholderSession();
  const includeFinancials = options?.includeFinancials ?? true;
  const includeCompliance = options?.includeCompliance ?? true;
  const includePhotos = options?.includePhotos ?? true;

  // Properties with entity
  const { data: properties, isLoading: propertiesLoading } = useQuery<PortalPropertyV2[]>({
    queryKey: ['shareholder-properties-v2', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('properties_v2')
        .select(`
          id, address_line_1, address_line_2, city, postcode,
          property_type, lifecycle_stage, current_valuation,
          total_lettable_rooms, entity_id,
          entity:legal_entities!properties_v2_entity_id_fkey (
            id, entity_name
          )
        `)
        .eq('org_id', orgId)
        .eq('lifecycle_stage', 'core_rental')
        .order('address_line_1');
      if (error) throw error;
      return (data || []) as PortalPropertyV2[];
    },
    enabled: !!orgId && isShareholderUser,
  });

  // Loan facilities
  const { data: loans, isLoading: loansLoading } = useQuery<PortalLoanV2[]>({
    queryKey: ['shareholder-loans-v2', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('loan_facilities')
        .select(`
          id, property_id, entity_id, current_balance,
          interest_rate, monthly_payment, rate_expiry_date,
          rate_type, status,
          lender:lenders!loan_facilities_lender_id_fkey (
            id, lender_name
          )
        `)
        .eq('org_id', orgId)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as PortalLoanV2[];
    },
    enabled: includeFinancials && !!orgId && isShareholderUser,
  });

  // Annual performance
  const { data: performance, isLoading: perfLoading } = useQuery<PortalPerformanceV2[]>({
    queryKey: ['shareholder-performance-v2', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from(PROPERTY_ANNUAL_PERFORMANCE_TABLE)
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data || []) as PortalPerformanceV2[];
    },
    enabled: includeFinancials && !!orgId && isShareholderUser,
  });

  // Compliance matrix
  const { data: complianceRows, isLoading: complianceLoading } = useQuery<PortalComplianceRowV2[]>({
    queryKey: ['shareholder-compliance-v2', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from(COMPLIANCE_MATRIX_V2_TABLE)
        .select('property_id, property_address, document_type, calculated_status, expiry_date, issue_date, is_required, days_remaining')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data || []) as PortalComplianceRowV2[];
    },
    enabled: includeCompliance && !!orgId && isShareholderUser,
  });

  // Cover photos — scoped to shareholder's property IDs only
  const propertyIds = (properties || []).map((property) => property.id);
  const { data: coverPhotos, isLoading: photosLoading } = useQuery<PortalCoverPhoto[]>({
    queryKey: ['shareholder-cover-photos', orgId, propertyIds],
    queryFn: async () => {
      if (!orgId || propertyIds.length === 0) return [];
      const { data, error } = await supabase
        .from('photos')
        .select('id, property_id, file_url, is_cover')
        .eq('is_cover', true)
        .in('property_id', propertyIds);
      if (error) throw error;
      return Promise.all(
        (data || []).map(async (photo) => ({
          ...photo,
          file_url: await createSignedStorageUrl('photos', photo.file_url),
        }))
      );
    },
    enabled: includePhotos && !!orgId && isShareholderUser && !!properties && properties.length > 0,
  });

  const coverPhotoMap = new Map<string, string>();
  coverPhotos?.forEach((photo) => {
    if (photo.is_cover) {
      coverPhotoMap.set(photo.property_id, photo.file_url);
    }
  });

  // Build loan map: property_id → loans
  const loansByProperty = new Map<string, PortalLoanV2[]>();
  loans?.forEach((loan) => {
    const existing = loansByProperty.get(loan.property_id) || [];
    existing.push(loan);
    loansByProperty.set(loan.property_id, existing);
  });

  // Build performance map: property_id → performance
  const performanceByProperty = new Map<string, PortalPerformanceV2>();
  performance?.forEach((perf) => {
    if (perf.property_id) {
      performanceByProperty.set(perf.property_id, perf);
    }
  });

  return {
    properties,
    loans,
    loansByProperty,
    performance,
    performanceByProperty,
    complianceRows,
    coverPhotoMap,
    isLoading: propertiesLoading || loansLoading || perfLoading || complianceLoading || photosLoading,
  };
}
