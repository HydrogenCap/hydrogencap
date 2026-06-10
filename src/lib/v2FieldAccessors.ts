/**
 * Pure helpers that replace V1-shaped derived fields with explicit
 * functions over `PropertyV2`. Centralising the expressions here lets
 * call-sites migrate off the V1 compat layer without re-deriving the
 * same rules in N places.
 *
 * Behaviour is byte-for-byte identical to the reshape logic that lived
 * in `src/hooks/compat/usePropertyCompat.ts` so the migration is
 * mechanical and the V1 → V2 cutover preserves dashboards exactly.
 */
import type { PropertyV2 } from '@/hooks/usePropertiesV2';

export type V1LifecycleType = 'core_rental' | 'development';

/** Mirrors compat: stabilised/letting → core_rental, everything else → development. */
export function lifecycleType(p: Pick<PropertyV2, 'lifecycle_stage'>): V1LifecycleType {
  return ['stabilised', 'letting'].includes(p.lifecycle_stage) ? 'core_rental' : 'development';
}

/** "address_line_1, city, postcode" — same string the compat layer produced. */
export function formattedAddress(
  p: Pick<PropertyV2, 'address_line_1' | 'city' | 'postcode'>,
): string {
  return `${p.address_line_1}, ${p.city}, ${p.postcode}`;
}

export function isGradeListed(p: Pick<PropertyV2, 'listing_grade'>): boolean {
  return p.listing_grade !== 'none';
}

export function hasGas(p: Pick<PropertyV2, 'has_gas_supply'>): boolean | null {
  return p.has_gas_supply;
}

export function beds(p: Pick<PropertyV2, 'total_lettable_rooms'>): number | null {
  return p.total_lettable_rooms;
}

export function lastValuationDate(p: Pick<PropertyV2, 'valuation_date'>): string | null {
  return p.valuation_date;
}

export function lastValuationEstimate(p: Pick<PropertyV2, 'current_valuation'>): number | null {
  return p.current_valuation;
}

/**
 * Field map from the legacy V1 shape to its V2 source. Exported as a
 * data structure so migration tooling / docs can render the table
 * without it drifting from the runtime helpers.
 */
export const V1_TO_V2_FIELD_MAP = {
  address_line: 'address_line_1',
  area_name: 'city',
  town_city: 'city',
  current_value_gbp: 'current_valuation',
  purchase_price_gbp: 'purchase_price',
  has_gas: 'has_gas_supply',
  beds: 'total_lettable_rooms',
  is_grade_listed: 'listing_grade !== "none"',
  lifecycle_type: 'lifecycleType(p) helper',
  formatted_address: 'formattedAddress(p) helper',
  last_valuation_date: 'valuation_date',
  last_valuation_estimate: 'current_valuation',
  capital_invested_gbp: 'purchase_price',
} as const;
