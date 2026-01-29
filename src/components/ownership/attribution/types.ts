// Types for the Financial Attribution component suite

export interface AttributionOwner {
  ownerId: string;
  ownerName: string;
  ownerType: string;
  effectivePercent: number;
  pathDescription: string;
  attributableValue: number;
  attributableEquity: number;
  attributableDebt: number;
  attributableRent: number;
  attributableNOI: number;
  attributableCashflow: number;
}

export interface AttributionTotals {
  value: number;
  equity: number;
  debt: number;
  rent: number;
  noi: number;
  cashflow: number;
}

export type ViewMode = 'attributed' | 'gross';

export interface OwnershipScenario {
  id: string;
  label: string;
  splits: { ownerId: string; percent: number }[];
}
