import { useMemo } from 'react';
import { useAllCompliance } from './useCompliance';
import { useProperties } from './useProperties';
import {
  generateComplianceItemsWithMissing,
  calculateComplianceStats,
  type PropertyForCompliance,
} from '@/lib/complianceItemsWithMissing';

/**
 * Shared hook that provides compliance stats using the SAME calculation
 * as the Compliance Register page (generateComplianceItemsWithMissing + calculateComplianceStats).
 * Used by the dashboard widget and sidebar badge to ensure consistent numbers.
 */
export function usePortfolioComplianceStats() {
  const { data: items, isLoading: loadingItems } = useAllCompliance();
  const { data: properties, isLoading: loadingProperties } = useProperties();

  const stats = useMemo(() => {
    if (!items || !properties) {
      return { valid: 0, expiring: 0, expired: 0, total: 0, notRequired: 0 };
    }

    const propertiesForCompliance: PropertyForCompliance[] = properties.map(p => ({
      id: p.id,
      address_line: p.address_line || '',
      postcode: p.postcode,
      has_gas: p.has_gas,
      has_fire_alarm_system: p.has_fire_alarm_system,
      fire_alarm_grade: p.fire_alarm_grade,
      has_emergency_lighting: p.has_emergency_lighting,
      asset_category: p.asset_category,
      is_hmo_licensed: p.is_hmo_licensed,
      selective_licence_required: p.selective_licence_required,
      lifecycle_type: p.lifecycle_type,
      is_grade_listed: p.is_grade_listed,
      listing_grade: p.listing_grade,
      has_solar: p.has_solar,
    }));

    const allItemsWithMissing = generateComplianceItemsWithMissing(items, propertiesForCompliance);
    return calculateComplianceStats(allItemsWithMissing);
  }, [items, properties]);

  return {
    stats,
    isLoading: loadingItems || loadingProperties,
  };
}
