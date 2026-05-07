import { format } from 'date-fns';

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; }
}

export function fmtRent(v: number | null | undefined) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}
