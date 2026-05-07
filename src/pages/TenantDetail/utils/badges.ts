export const STATUS_BG: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', prospective: 'bg-blue-100 text-blue-700',
  in_notice: 'bg-amber-100 text-amber-700', departed: 'bg-muted text-muted-foreground',
  evicted: 'bg-red-100 text-red-700', archived: 'bg-muted/50 text-muted-foreground',
};

export const AGREEMENT_STATUS_BG: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', pending: 'bg-blue-100 text-blue-700',
  notice_period: 'bg-amber-100 text-amber-700', ended: 'bg-muted text-muted-foreground',
  terminated: 'bg-red-100 text-red-700',
};

export const SCORE_SEVERITY_BG: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  destructive: 'bg-red-100 text-red-700',
};
