/**
 * Shared types for the portal pages.
 *
 * NOTE: Types derived from the `investor_distributions` table (and related
 * investor views) are exported from `@/hooks/usePortalInvestorData`.
 *
 * The types below represent the `distributions` table (entity-level quarterly
 * distributions) with its related join data, used on the shareholder portal
 * dashboard.
 */

export interface PortalDistributionEntity {
  id: string;
  entity_name: string;
}

export interface PortalDistributionAllocation {
  distribution_id: string;
  shareholder_name: string;
  ownership_percent: number;
  amount: number;
  paid_at: string | null;
}

export interface PortalEntityDistribution {
  id: string;
  period_label: string;
  total_rental_income: number;
  total_expenses: number;
  total_mortgage_costs: number;
  net_distributable: number;
  total_distributed: number;
  status: string;
  period_start: string;
  entity?: PortalDistributionEntity | null;
  allocations?: PortalDistributionAllocation[];
}
