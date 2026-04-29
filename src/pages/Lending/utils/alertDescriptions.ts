import type { LoanAlert } from '@/hooks/useLoanFacilities';

export function getAlertDescription(a: LoanAlert): string {
  if (a.ltv_covenant_alert === 'covenant_breach') return `LTV breach: ${a.current_ltv?.toFixed(1)}% vs max ${a.covenant_ltv_max}%`;
  if (a.term_alert === 'term_expired') return 'Loan term expired';
  if (a.rate_alert === 'rate_expired') return `Rate expired, on SVR at ${a.revert_rate || '?'}%`;
  if (a.rate_alert === 'rate_expiring_soon') return `Rate expires in ${a.days_to_rate_expiry}d`;
  if (a.term_alert === 'term_ending_soon') return `Term ends in ${a.days_to_term_end}d`;
  if (a.term_alert === 'term_ending_within_year') return `Term ends within 12 months`;
  if (a.ltv_covenant_alert === 'covenant_warning') return `LTV approaching covenant: ${a.current_ltv?.toFixed(1)}%`;
  if (a.erc_alert === 'erc_ending_soon') return `ERC ends in ${a.days_to_erc_end}d — refinance window`;
  return '';
}
