export type LifecycleFilter = 'core_rental' | 'development' | 'all';
export type LoanPurpose = 'refinance' | 'capital_raise' | 'rate_switch' | 'purchase' | '';
export type SelectionMode = 'all' | 'single';

export function fmtGbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
