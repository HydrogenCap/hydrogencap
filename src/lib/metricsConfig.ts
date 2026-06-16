/**
 * Metrics Configuration — public barrel.
 * Split into focused submodules in `./metricsConfig/`.
 * Public import path (`@/lib/metricsConfig`) is unchanged.
 */
import type { MetricKey, MetricConfig } from './metricsConfig/types';
import {
  equityMetric,
  valueMetric,
  mortgageMetric,
  debtMetric,
  cashflowMetric,
} from './metricsConfig/metrics/financial';
import { ltvMetric, dscrMetric } from './metricsConfig/metrics/leverage';
import { rentMetric, noiMetric, netYieldMetric } from './metricsConfig/metrics/income';
import {
  healthMetric,
  risksMetric,
  actionsMetric,
  missingInfoMetric,
} from './metricsConfig/metrics/health';

export type {
  MetricKey,
  MetricConfig,
  MetricBreakdown,
  PropertyBreakdownRow,
  EntityBreakdownRow,
} from './metricsConfig/types';

export const METRICS_CONFIG: Record<MetricKey, MetricConfig> = {
  equity: equityMetric,
  value: valueMetric,
  mortgage: mortgageMetric,
  debt: debtMetric,
  cashflow: cashflowMetric,
  ltv: ltvMetric,
  dscr: dscrMetric,
  health: healthMetric,
  risks: risksMetric,
  actions: actionsMetric,
  missing_info: missingInfoMetric,
  rent: rentMetric,
  noi: noiMetric,
  net_yield: netYieldMetric,
};

export function getMetricConfig(key: MetricKey): MetricConfig {
  return METRICS_CONFIG[key];
}
