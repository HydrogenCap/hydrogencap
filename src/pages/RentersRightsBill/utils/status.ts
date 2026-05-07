export function awaaabStatus(daysElapsed: number): { label: string; variant: 'destructive' | 'secondary'; color: string } {
  if (daysElapsed > 14) return { label: `${daysElapsed}d — OVERDUE`, variant: 'destructive', color: 'text-destructive' };
  if (daysElapsed >= 8) return { label: `${daysElapsed}d — Urgent`, variant: 'destructive', color: 'text-amber-600' };
  return { label: `${daysElapsed}d`, variant: 'secondary', color: 'text-emerald-600' };
}
