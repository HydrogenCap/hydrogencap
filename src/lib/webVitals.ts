import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';
import { checkBudget } from '@/lib/performance-budget';

export interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

function toVitalMetric(metric: Metric): VitalMetric {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };
}

function defaultReporter(metric: VitalMetric) {
  // Dev: pretty-print with budget check
  if (import.meta.env.DEV) {
    const colour =
      metric.rating === 'good' ? '🟢' : metric.rating === 'needs-improvement' ? '🟡' : '🔴';
    console.log(`${colour} ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`);
    checkBudget(metric.name, metric.value);
    return;
  }

  // Production: forward to Sentry metrics if available
  if (typeof window !== 'undefined' && window.__SENTRY__) {
    try {
      window.__SENTRY__.metrics?.distribution(metric.name, metric.value, {
        unit: 'millisecond',
        tags: { rating: metric.rating },
      });
    } catch {
      // Sentry not available, silently ignore
    }
  }
}

interface SentryMetrics {
  distribution?: (
    name: string,
    value: number,
    options: { unit: string; tags: { rating: VitalMetric['rating'] } },
  ) => void;
}

declare global {
  interface Window {
    __SENTRY__?: { metrics?: SentryMetrics };
  }
}

/**
 * Start tracking Core Web Vitals.
 * Optionally pass a custom reporter callback; otherwise uses the built-in
 * reporter that logs in dev and sends to Sentry in production.
 */
export function reportWebVitals(onReport?: (metric: VitalMetric) => void) {
  const report = (raw: Metric) => {
    const metric = toVitalMetric(raw);
    (onReport ?? defaultReporter)(metric);
  };

  onCLS(report);
  onFID(report);
  onLCP(report);
  onFCP(report);
  onTTFB(report);
  onINP(report);
}
