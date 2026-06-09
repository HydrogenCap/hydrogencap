import type { Color } from '@/types/pdf';
import { BRAND_SUCCESS, BRAND_WARNING, BRAND_DANGER, BRAND_SECONDARY } from './colors';
import type { ComplianceItemData } from './types';

export function getComplianceStatus(item: ComplianceItemData): 'valid' | 'expiring_soon' | 'expired' | 'missing' {
  if (!item.issue_date && !item.expiry_date) return 'missing';
  if (!item.expiry_date) return 'valid'; // No expiry = perpetual

  const expiry = new Date(item.expiry_date);
  const now = new Date();
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) return 'expired';
  if (daysUntil <= 60) return 'expiring_soon';
  return 'valid';
}

export function getStatusColor(status: string): Color {
  switch (status) {
    case 'valid': return BRAND_SUCCESS;
    case 'expiring_soon': return BRAND_WARNING;
    case 'expired': return BRAND_DANGER;
    case 'missing': return BRAND_SECONDARY;
    default: return BRAND_SECONDARY;
  }
}
