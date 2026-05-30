import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { AffectedProperty, ExemptedProperty, QualityAnalysis, QualityIssue } from './types';
import { formatFieldName } from './formatFieldName';
import { checkFieldExemption } from './checkFieldExemption';

// Data quality analyzer with exemption support
export function analyzeDataQuality(
  properties: PropertyWithFinancials[], 
  companyMap: Map<string, string>
): QualityAnalysis {
  const categories = {
    mortgageDetails: {
      label: 'Mortgage Details',
      fields: [
        { key: 'lender', path: (p: PropertyWithFinancials) => p.loans?.[0]?.lender },
        { key: 'balance', path: (p: PropertyWithFinancials) => p.loans?.[0]?.current_mortgage_balance_gbp },
        { key: 'interestRate', path: (p: PropertyWithFinancials) => p.loans?.[0]?.interest_rate_percent },
        { key: 'fixedRateExpiry', path: (p: PropertyWithFinancials) => p.loans?.[0]?.fixed_rate_expires },
      ],
      priority: 'high' as const,
    },
    epcRating: {
      label: 'EPC Rating',
      fields: [
        { key: 'epcRating', path: (p: PropertyWithFinancials) => p.epc_rating },
      ],
      priority: 'high' as const,
    },
    rentalIncome: {
      label: 'Rental Income',
      fields: [
        { key: 'annualRent', path: (p: PropertyWithFinancials) => p.income?.[0]?.annual_rent_gbp },
      ],
      priority: 'high' as const,
    },
    propertyValue: {
      label: 'Property Valuation',
      fields: [
        { key: 'currentValue', path: (p: PropertyWithFinancials) => p.current_value_gbp },
        { key: 'purchasePrice', path: (p: PropertyWithFinancials) => p.purchase_price_gbp },
        { key: 'purchaseDate', path: (p: PropertyWithFinancials) => p.original_purchase_date },
      ],
      priority: 'high' as const,
    },
    tenure: {
      label: 'Tenure & Type',
      fields: [
        { key: 'tenure', path: (p: PropertyWithFinancials) => p.tenure },
        { key: 'propertyType', path: (p: PropertyWithFinancials) => p.property_type },
      ],
      priority: 'medium' as const,
    },
    bedrooms: {
      label: 'Bedrooms',
      fields: [
        { key: 'beds', path: (p: PropertyWithFinancials) => p.beds },
      ],
      priority: 'low' as const,
    },
    coordinates: {
      label: 'Map Location',
      fields: [
        { key: 'latitude', path: (p: PropertyWithFinancials) => p.latitude && p.longitude ? 'valid' : null },
      ],
      priority: 'low' as const,
    },
  };

  const issues: QualityIssue[] = [];
  let totalFields = 0;
  let totalRequiredFields = 0;
  let completeFields = 0;
  let totalExemptedFields = 0;

  Object.entries(categories).forEach(([categoryKey, category]) => {
    const affectedProperties: AffectedProperty[] = [];
    const exemptedProperties: ExemptedProperty[] = [];
    let categoryComplete = 0;
    let categoryTotal = 0;
    let categoryRequired = 0;
    let categoryExempted = 0;

    properties.forEach(property => {
      const missingFields: string[] = [];
      let propertyExemptionReason: string | null = null;
      
      category.fields.forEach(field => {
        categoryTotal++;
        totalFields++;
        
        // Check for exemption
        const exemption = checkFieldExemption(property, field.key);
        
        if (exemption.exempt) {
          categoryExempted++;
          totalExemptedFields++;
          if (!propertyExemptionReason) {
            propertyExemptionReason = exemption.reason;
          }
        } else {
          // Field is required
          categoryRequired++;
          totalRequiredFields++;
          
          const value = field.path(property);
          
          if (value === null || value === undefined || value === '' || 
              (typeof value === 'string' && value.trim() === '')) {
            missingFields.push(formatFieldName(field.key));
          } else {
            categoryComplete++;
            completeFields++;
          }
        }
      });

      // Track exempted properties for this category
      if (propertyExemptionReason) {
        exemptedProperties.push({
          id: property.id,
          address: property.address_line,
          exemptionReason: propertyExemptionReason,
        });
      }

      if (missingFields.length > 0) {
        // Get ownership display name
        let ownership: string | null = null;
        if (property.legal_owner_company_id && companyMap) {
          ownership = companyMap.get(property.legal_owner_company_id) || null;
        }
        if (!ownership) {
          ownership = property.ownership_entity || null;
        }

        affectedProperties.push({
          id: property.id,
          address: property.address_line,
          area: property.postcode || null,
          ownership,
          missingFields,
        });
      }
    });

    issues.push({
      category: categoryKey,
      label: category.label,
      priority: category.priority,
      completeCount: categoryComplete,
      totalCount: categoryTotal,
      requiredCount: categoryRequired,
      exemptedCount: categoryExempted,
      affectedProperties,
      exemptedProperties,
    });
  });

  // Sort: high priority first, then by completion percentage (lowest first)
  issues.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const aPercent = a.completeCount / a.totalCount;
    const bPercent = b.completeCount / b.totalCount;
    return aPercent - bPercent;
  });

  return {
    overallCompleteness: totalRequiredFields > 0 ? completeFields / totalRequiredFields : 1,
    completeFields,
    totalFields,
    requiredFields: totalRequiredFields,
    exemptedFields: totalExemptedFields,
    issues,
  };
}
