import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

interface VitalsReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

function sendToAnalytics(metric: Metric) {
  const report: VitalsReport = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };

  if (import.meta.env.DEV) {
    const colour = report.rating === 'good' ? '🟢' : report.rating === 'needs-improvement' ? '🟡' : '🔴';
    console.log(`${colour} ${report.name}: ${Math.round(report.value)}ms (${report.rating})`);
    return;
  }

  if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
    try {
      const Sentry = (window as any).__SENTRY__;
      Sentry.metrics?.distribution(report.name, report.value, {
        unit: 'millisecond',
        tags: { rating: report.rating },
      });
    } catch {
      // Sentry not available, silently ignore
    }
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}