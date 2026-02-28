import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyCompliance, useAllCompliance } from './useCompliance';
import { useProperties, useProperty } from './useProperties';
import { 
  calculateComplianceRequirements, 
  type PropertyComplianceFeatures,
  type PropertyComplianceSummary,
  type ComplianceRequirement,
  getComplianceIssues,
} from '@/lib/complianceRequirements';

// Fetch property with compliance features
export function usePropertyWithFeatures(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_features', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address_line,
          has_gas,
          has_fire_alarm_system,
          fire_alarm_grade,
          has_emergency_lighting,
          asset_category,
          occupancy_status,
          is_hmo_licensed,
          selective_licence_required,
          co_alarm_required,
          epc_required,
          listed_status,
          has_solar
        `)
        .eq('id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data as PropertyComplianceFeatures | null;
    },
    enabled: !!propertyId,
  });
}

// Fetch all properties with compliance features - only CORE RENTAL properties
export function useAllPropertiesWithFeatures() {
  return useQuery({
    queryKey: ['all_property_features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address_line,
          has_gas,
          has_fire_alarm_system,
          fire_alarm_grade,
          has_emergency_lighting,
          asset_category,
          occupancy_status,
          is_hmo_licensed,
          selective_licence_required,
          co_alarm_required,
          epc_required,
          listed_status,
          has_solar,
          lifecycle_type
        `)
        // Only include core_rental properties for compliance tracking
        .eq('lifecycle_type', 'core_rental');

      if (error) throw error;
      return data as (PropertyComplianceFeatures & { lifecycle_type?: string })[];
    },
  });
}

// Hook for single property compliance requirements
export function usePropertyComplianceRequirements(propertyId: string | undefined) {
  const { data: property, isLoading: loadingProperty } = usePropertyWithFeatures(propertyId);
  const { data: complianceItems, isLoading: loadingCompliance } = usePropertyCompliance(propertyId);
  
  const summary = useMemo(() => {
    if (!property || !complianceItems) return null;
    
    return calculateComplianceRequirements(property, complianceItems);
  }, [property, complianceItems]);
  
  return {
    data: summary,
    isLoading: loadingProperty || loadingCompliance,
  };
}

// Hook for portfolio-wide compliance requirements
export function usePortfolioComplianceRequirements() {
  const { data: properties, isLoading: loadingProperties } = useAllPropertiesWithFeatures();
  const { data: allComplianceData, isLoading: loadingCompliance } = useAllCompliance();
  const allComplianceItems = allComplianceData?.items;
  
  const summaries = useMemo(() => {
    if (!properties || !allComplianceItems) return [];
    
    // Group compliance items by property
    const itemsByProperty = new Map<string, typeof allComplianceItems>();
    allComplianceItems.forEach(item => {
      const existing = itemsByProperty.get(item.property_id) || [];
      existing.push(item);
      itemsByProperty.set(item.property_id, existing);
    });
    
    // Calculate requirements for each property
    return properties.map(property => 
      calculateComplianceRequirements(
        property,
        itemsByProperty.get(property.id) || []
      )
    );
  }, [properties, allComplianceItems]);
  
  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const stats = {
      totalProperties: summaries.length,
      propertiesWithIssues: 0,
      totalMissing: 0,
      totalExpired: 0,
      totalExpiringSoon: 0,
      totalValid: 0,
      averageComplianceScore: 0,
    };
    
    let scoreSum = 0;
    
    summaries.forEach(summary => {
      if (summary.missingCount > 0 || summary.expiredCount > 0 || summary.expiringSoonCount > 0) {
        stats.propertiesWithIssues++;
      }
      stats.totalMissing += summary.missingCount;
      stats.totalExpired += summary.expiredCount;
      stats.totalExpiringSoon += summary.expiringSoonCount;
      stats.totalValid += summary.validCount;
      scoreSum += summary.complianceScore;
    });
    
    stats.averageComplianceScore = summaries.length > 0 
      ? Math.round(scoreSum / summaries.length) 
      : 100;
    
    return stats;
  }, [summaries]);
  
  return {
    data: summaries,
    stats: aggregateStats,
    isLoading: loadingProperties || loadingCompliance,
  };
}

// Hook for missing compliance across portfolio
export function useMissingCompliance() {
  const { data: summaries, isLoading } = usePortfolioComplianceRequirements();
  
  const missingItems = useMemo(() => {
    if (!summaries) return [];
    
    const items: Array<{
      propertyId: string;
      propertyAddress: string;
      requirement: ComplianceRequirement;
    }> = [];
    
    summaries.forEach(summary => {
      const issues = getComplianceIssues(summary.requirements);
      issues.forEach(req => {
        items.push({
          propertyId: summary.propertyId,
          propertyAddress: summary.propertyAddress,
          requirement: req,
        });
      });
    });
    
    // Sort by status (expired first, then missing, then expiring soon)
    return items.sort((a, b) => {
      const statusOrder = { expired: 0, missing: 1, expiring_soon: 2 };
      return (statusOrder[a.requirement.status as keyof typeof statusOrder] || 3) - 
             (statusOrder[b.requirement.status as keyof typeof statusOrder] || 3);
    });
  }, [summaries]);
  
  return {
    data: missingItems,
    isLoading,
  };
}

// Hook for properties with compliance issues
export function usePropertiesWithComplianceIssues() {
  const { data: summaries, isLoading } = usePortfolioComplianceRequirements();
  
  const propertiesWithIssues = useMemo(() => {
    if (!summaries) return [];
    
    return summaries
      .filter(s => s.missingCount > 0 || s.expiredCount > 0 || s.expiringSoonCount > 0)
      .sort((a, b) => {
        // Sort by severity: expired first, then missing, then expiring
        const aScore = a.expiredCount * 1000 + a.missingCount * 100 + a.expiringSoonCount;
        const bScore = b.expiredCount * 1000 + b.missingCount * 100 + b.expiringSoonCount;
        return bScore - aScore;
      });
  }, [summaries]);
  
  return {
    data: propertiesWithIssues,
    isLoading,
  };
}
