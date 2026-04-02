/** Performance budgets for Core Web Vitals. */
export const PERFORMANCE_BUDGETS = {
  /** Largest Contentful Paint — max 2.5 s */
  LCP: 2500,
  /** Cumulative Layout Shift — max 0.1 */
  CLS: 0.1,
  /** Interaction to Next Paint — max 200 ms */
  INP: 200,
  /** First Contentful Paint — max 1.8 s */
  FCP: 1800,
  /** Time to First Byte — max 800 ms */
  TTFB: 800,
  /** First Input Delay — max 100 ms */
  FID: 100,
  /** Main JS bundle size (gzipped) — max 500 KB */
  BUNDLE_SIZE_KB: 500,
} as const;

type BudgetKey = keyof typeof PERFORMANCE_BUDGETS;

/**
 * Check a metric value against its performance budget.
 * In development mode, logs a warning when a budget is exceeded.
 * Returns whether the value is within budget.
 */
export function checkBudget(name: string, value: number): boolean {
  const budget = PERFORMANCE_BUDGETS[name as BudgetKey];
  if (budget === undefined) return true;

  const withinBudget = value <= budget;

  if (!withinBudget && import.meta.env.DEV) {
    const unit = name === 'CLS' ? '' : 'ms';
    console.warn(
      `[Perf Budget] ${name} exceeded: ${value.toFixed(2)}${unit} (budget: ${budget}${unit})`,
    );
  }

  return withinBudget;
}
