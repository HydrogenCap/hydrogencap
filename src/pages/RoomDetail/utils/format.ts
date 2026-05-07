export function fmtRent(v: number | null | undefined) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}
