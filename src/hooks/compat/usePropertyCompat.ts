/**
 * @deprecated Compat shim — wraps V2 (`usePropertyV2`) and reshapes the result
 * into the V1 `PropertyWithFinancials` shape so older consumers compile.
 *
 * Prefer `usePropertyV2` from `@/hooks/usePropertiesV2` directly. This adapter
 * exists only as a stop-gap during the V1 → V2 migration. See
 * `docs/release/v1-compat-design-2026-04-29.md` for the field-by-field map and
 * the list of V1-only fields that block full cutover.
 *
 * Behaviour:
 *  - Renames + derived fields are populated from the V2 row.
 *  - Fields with no V2 source are returned as `null` / safe defaults.
 *  - Reading any V1-only field that has no V2 source emits a one-shot
 *    `console.warn(...)` so we can grep call sites that still depend on legacy
 *    columns.
 *  - V2-only extras (entity_name, etc.) are NOT surfaced — callers that need
 *    them should use `usePropertyV2` directly.
 *
 * Scope: properties only. Rooms / tenants are handled by their own V2 hooks.
 */
import { useMemo } from 'react';
import { usePropertyV2, type PropertyWithEntity } from '@/hooks/usePropertiesV2';
import type { PropertyWithFinancials } from '@/hooks/useProperties';

// Set of field names with NO V2 source. Reading any of these via the proxy
// triggers a once-per-session console.warn so we can find load-bearing callers.
const V1_ONLY_FIELDS = new Set<string>([
  'legal_owner_company_id',
  'legal_owner_party_id',
  'tenure',
  'geocode_status',
  'geocode_error',
  'property_name',
  'uprn',
  'planning_authority',
  'listed_status',
  'place_id',
  'postcode_area',
  'is_hmo_licensed',
  'epc_rating',
  'conservation_area',
  'bathrooms',
]);

const warned = new Set<string>();
function warnOnce(field: string) {
  if (warned.has(field)) return;
  warned.add(field);
  // eslint-disable-next-line no-console
  console.warn(
    `[usePropertyCompat] Field "${field}" is V1-only and has no V2 source. ` +
      `Caller should migrate to usePropertyV2 / property_passport. ` +
      `See docs/release/v1-compat-design-2026-04-29.md`
  );
}

// Test-only: clear the dedupe set so each test sees a fresh warning state.
export function __resetCompatWarnings() {
  warned.clear();
}

/**
 * Map a V2 property row → V1-shaped object (no nested arrays).
 * Nested loans / income / costs / tenancies are NOT populated by this singular
 * hook — callers that need those should use the list compat hook
 * (`usePropertiesCompat`) which pulls the joined data, or move to native V2.
 */
export function v2PropertyToV1Shape(
  v2: PropertyWithEntity
): Omit<PropertyWithFinancials, 'loans' | 'income' | 'costs' | 'tenancies'> {
  return {
    // ── Renames / unchanged ────────────────────────────────────────────
    id: v2.id,
    org_id: v2.org_id,
    address_line: v2.address_line_1,
    address_line2: v2.address_line_2,
    town_city: v2.city,
    area_name: v2.city,
    postcode: v2.postcode,
    county: v2.county,
    country: v2.country,
    property_type: v2.property_type,
    latitude: v2.latitude,
    longitude: v2.longitude,
    current_value_gbp: v2.current_valuation,
    purchase_price_gbp: v2.purchase_price,
    purchase_date: v2.purchase_date,
    notes: v2.notes,
    created_at: v2.created_at,
    updated_at: v2.updated_at,

    // ── Derived ────────────────────────────────────────────────────────
    beds: v2.total_lettable_rooms,
    has_gas: v2.has_gas_supply,
    is_grade_listed: v2.listing_grade !== 'none',
    listing_grade: v2.listing_grade,
    lifecycle_type: ['stabilised', 'letting'].includes(v2.lifecycle_stage)
      ? 'core_rental'
      : 'development',
    formatted_address: `${v2.address_line_1}, ${v2.city}, ${v2.postcode}`,
    last_valuation_date: v2.valuation_date,
    last_valuation_estimate: v2.current_valuation,
    capital_invested_gbp: v2.purchase_price,

    // ── Defaults for V1-only fields (warn on access via the proxy) ─────
    bathrooms: null,
    is_hmo_licensed: null,
    epc_rating: null,
    conservation_area: false,
    legal_owner_company_id: null,
    legal_owner_party_id: null,
  } as unknown as Omit<PropertyWithFinancials, 'loans' | 'income' | 'costs' | 'tenancies'>;
}

/**
 * Wrap a plain object so that reading a V1-only field emits a console.warn.
 * Returns the object unchanged in production-mode call sites (the values are
 * still readable — we just instrument the access).
 */
export function wrapWithV1OnlyWarnings<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && V1_ONLY_FIELDS.has(prop)) {
        warnOnce(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Singular V1-shaped property reader, backed by the V2 hook.
 *
 * @deprecated Migrate to `usePropertyV2(id)` from `@/hooks/usePropertiesV2`.
 */
export function usePropertyCompat(id: string | undefined) {
  const v2Query = usePropertyV2(id);

  const compatData = useMemo(() => {
    if (!v2Query.data) return null;
    const shaped = v2PropertyToV1Shape(v2Query.data);
    // Stitch in empty financial sub-arrays so the shape matches V1 exactly.
    const v1Shape: PropertyWithFinancials = {
      ...(shaped as PropertyWithFinancials),
      loans: [],
      income: [],
      costs: [],
      tenancies: [],
    };
    return wrapWithV1OnlyWarnings(v1Shape);
  }, [v2Query.data]);

  return {
    ...v2Query,
    data: compatData,
  };
}
