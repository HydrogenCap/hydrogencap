import { formatGBP } from '@/lib/calculations';

export const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  individual: { label: 'Individual', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  company: { label: 'Company', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  trust: { label: 'Trust', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  family_office: { label: 'Family Office', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  fund: { label: 'Fund', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  jv_partner: { label: 'JV Partner', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
};

export const COMMITMENT_TYPE_LABEL: Record<string, string> = {
  equity: 'Equity',
  loan: 'Loan',
  convertible_loan: 'Convertible',
  preference_shares: 'Preference',
  mezzanine: 'Mezzanine',
};

export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  fully_drawn: { label: 'Fully Drawn', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  partially_returned: { label: 'Partial Return', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  fully_returned: { label: 'Fully Returned', className: 'bg-muted text-muted-foreground border-border' },
  defaulted: { label: 'Defaulted', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const DIST_TYPE_LABEL: Record<string, string> = {
  dividend: 'Dividend',
  interest: 'Interest',
  loan_repayment: 'Loan Repayment',
  profit_share: 'Profit Share',
  capital_return: 'Capital Return',
  other: 'Other',
};

export function fmt(amount: number | null | undefined): string {
  return formatGBP(amount || 0);
}
