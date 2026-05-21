import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';

export type PropertyComplianceLevel = 'valid' | 'expiring' | 'expired' | 'unknown';

export interface PropertyComplianceStatus {
  level: PropertyComplianceLevel;
  valid: number;
  expiring: number;
  expired: number;
  missing: number;
  notRequired: number;
  total: number;
  /** Most-severe summary label suitable for badges */
  label: string;
}

interface MatrixRow {
  property_id: string | null;
  calculated_status: string | null;
}

/**
 * Single source of truth for "how compliant is property X?" — reads
 * compliance_matrix_v2 once and lets callers (cards, status bars,
 * property detail headers) derive consistent badges and counts.
 *
 * Pass `propertyId` to scope to one property. Omit to receive the
 * full per-property map (useful for grids / tables).
 */
export function usePropertyComplianceStatus(propertyId?: string) {
  const { data: matrixRows, isLoading } = useQuery({
    queryKey: ['compliance_matrix_v2_per_property'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('compliance_matrix_v2')
        .select('property_id, calculated_status');
      if (error) throw error;
      return (data || []) as MatrixRow[];
    },
    staleTime: 60_000,
  });

  const byProperty = useMemo(() => {
    const map = new Map<string, PropertyComplianceStatus>();
    if (!matrixRows) return map;

    for (const row of matrixRows) {
      if (!row.property_id) continue;
      const existing = map.get(row.property_id) ?? emptyStatus();
      switch (row.calculated_status) {
        case 'valid': existing.valid++; break;
        case 'expiring_soon': existing.expiring++; break;
        case 'expired': existing.expired++; break;
        case 'missing': existing.missing++; break;
        case 'not_required': existing.notRequired++; break;
      }
      existing.total++;
      map.set(row.property_id, existing);
    }

    for (const status of map.values()) {
      status.level = deriveLevel(status);
      status.label = deriveLabel(status);
    }

    return map;
  }, [matrixRows]);

  const status = useMemo<PropertyComplianceStatus | null>(() => {
    if (!propertyId) return null;
    return byProperty.get(propertyId) ?? emptyStatus();
  }, [propertyId, byProperty]);

  return { status, byProperty, isLoading };
}

function emptyStatus(): PropertyComplianceStatus {
  return {
    level: 'unknown',
    valid: 0,
    expiring: 0,
    expired: 0,
    missing: 0,
    notRequired: 0,
    total: 0,
    label: 'No data',
  };
}

function deriveLevel(s: PropertyComplianceStatus): PropertyComplianceLevel {
  if (s.total === 0) return 'unknown';
  if (s.expired > 0 || s.missing > 0) return 'expired';
  if (s.expiring > 0) return 'expiring';
  if (s.valid > 0) return 'valid';
  return 'unknown';
}

function deriveLabel(s: PropertyComplianceStatus): string {
  if (s.total === 0) return 'No data';
  if (s.expired > 0 || s.missing > 0) {
    const n = s.expired + s.missing;
    return `${n} expired/missing`;
  }
  if (s.expiring > 0) return `${s.expiring} expiring`;
  return 'All valid';
}
