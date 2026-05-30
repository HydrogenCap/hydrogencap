// Row-level status colours (thresholds 100 / 70)
export const getRowStatusColor = (pct: number) => {
  if (pct >= 100) return 'text-success';
  if (pct >= 70) return 'text-warning';
  return 'text-destructive';
};

export const getRowProgressColor = (pct: number) => {
  if (pct >= 100) return 'bg-success';
  if (pct >= 70) return 'bg-warning';
  return 'bg-destructive';
};

// Overall status colours (thresholds 90 / 70)
export const getOverallStatusColor = (percentage: number) => {
  if (percentage >= 90) return 'text-success';
  if (percentage >= 70) return 'text-warning';
  return 'text-destructive';
};

export const getOverallProgressColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-success';
  if (percentage >= 70) return 'bg-warning';
  return 'bg-destructive';
};
