import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { PropertyWithExemptions } from './types';

// Check if a field is exempted for a specific property
export function checkFieldExemption(
  property: PropertyWithFinancials, 
  fieldKey: string
): { exempt: boolean; reason: string | null } {
  const exemptionAwareProperty = property as PropertyWithExemptions;

  // EPC Rating - exempt if Grade Listed building
  if (fieldKey === 'epcRating') {
    // Check explicit epc_required flag first
    if (exemptionAwareProperty.epc_required === false) {
      return { exempt: true, reason: 'EPC not required' };
    }
    // Check if Grade Listed
    if (exemptionAwareProperty.is_grade_listed === true) {
      const grade = exemptionAwareProperty.listing_grade || 'Listed';
      return { exempt: true, reason: `Grade ${grade} Listed Building - legally exempt` };
    }
  }
  
  // Gas Safety fields - exempt if no gas at property
  if (fieldKey === 'gasExpiry' || fieldKey === 'gasSafety') {
    if (exemptionAwareProperty.has_gas === false) {
      return { exempt: true, reason: 'No gas supply at property' };
    }
  }
  
  return { exempt: false, reason: null };
}
