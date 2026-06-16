/**
 * Currency/date/percent formatters.
 */

export function formatGBP(amount: number | null | undefined): string {
  if (amount == null) return '\u2014';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatGBPDecimal(amount: number | null | undefined): string {
  if (amount == null) return '\u2014';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return '\u2014';
  return `${value.toFixed(decimals)}%`;
}

export function formatDateUK(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export function formatGBPCompact(amount: number | null | undefined): string {
  if (amount == null) return '\u2014';
  if (Math.abs(amount) >= 1_000_000) return `\u00A3${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `\u00A3${(amount / 1_000).toFixed(0)}K`;
  return `\u00A3${amount.toFixed(0)}`;
}

export function formatDateTimeUK(date: string | Date | null | undefined): string {
  if (!date) return '\u2014';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
