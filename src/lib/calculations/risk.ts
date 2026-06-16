/**
 * Risk/status helpers: expiries, LTV/EPC status, postcodes.
 */

export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(
  expiryDate: string | Date | null | undefined
): 'expired' | 'critical' | 'warning' | 'ok' | null {
  const days = daysUntil(expiryDate);
  if (days === null) return null;
  if (days <= 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'ok';
}

export function getLTVStatus(ltv: number | null): 'danger' | 'warning' | 'ok' | null {
  if (ltv === null) return null;
  if (ltv > 85) return 'danger';
  if (ltv > 75) return 'warning';
  return 'ok';
}

export function getEPCStatus(
  rating: string | null | undefined,
  epcRequired: boolean = true
): 'warning' | 'ok' | 'exempt' | null {
  if (!epcRequired) return 'exempt';

  if (!rating) return null;

  const upperRating = rating.toUpperCase();

  if (upperRating === 'N/A') return 'exempt';

  if (['D', 'E', 'F', 'G'].includes(upperRating)) return 'warning';

  return 'ok';
}

export function isValidEPCRating(rating: string | null | undefined): boolean {
  if (!rating) return false;
  const validRatings = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'N/A'];
  return validRatings.includes(rating.toUpperCase());
}

export function extractPostcodeArea(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const match = postcode.toUpperCase().match(/^([A-Z]{1,2})/);
  return match ? match[1] : null;
}
