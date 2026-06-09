import { describe, expect, it } from 'vitest';
import type { PropertyV2 } from '@/hooks/usePropertiesV2';
import {
  beds,
  formattedAddress,
  hasGas,
  isGradeListed,
  lastValuationDate,
  lastValuationEstimate,
  lifecycleType,
} from '../v2FieldAccessors';

const base = (overrides: Partial<PropertyV2> = {}): PropertyV2 => ({
  id: 'p1',
  org_id: 'org',
  entity_id: 'e1',
  address_line_1: '10 High Street',
  address_line_2: null,
  city: 'Oxford',
  county: null,
  postcode: 'OX1 1AA',
  country: 'United Kingdom',
  property_type: 'Terraced',
  lifecycle_stage: 'stabilised',
  council_name: null,
  council_area: null,
  listing_grade: 'none',
  rent_basis: 'whole_house',
  whole_house_rent_pcm: null,
  has_gas_supply: true,
  year_built: null,
  total_floors: null,
  total_lettable_rooms: 3,
  purchase_date: null,
  purchase_price: 280_000,
  current_valuation: 350_000,
  valuation_date: '2026-04-01',
  latitude: null,
  longitude: null,
  notes: null,
  epc_rating: null,
  epc_expiry_date: null,
  created_at: '2025-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

describe('v2FieldAccessors', () => {
  it('lifecycleType maps stabilised/letting to core_rental', () => {
    expect(lifecycleType(base({ lifecycle_stage: 'stabilised' }))).toBe('core_rental');
    expect(lifecycleType(base({ lifecycle_stage: 'letting' }))).toBe('core_rental');
  });

  it('lifecycleType maps everything else to development', () => {
    for (const s of ['acquiring', 'refurb', 'planning', 'sold', '']) {
      expect(lifecycleType(base({ lifecycle_stage: s }))).toBe('development');
    }
  });

  it('formattedAddress reproduces the compat layer string', () => {
    expect(formattedAddress(base())).toBe('10 High Street, Oxford, OX1 1AA');
  });

  it('isGradeListed is true for any grade other than "none"', () => {
    expect(isGradeListed(base({ listing_grade: 'none' }))).toBe(false);
    expect(isGradeListed(base({ listing_grade: 'II' }))).toBe(true);
    expect(isGradeListed(base({ listing_grade: 'I' }))).toBe(true);
  });

  it('hasGas and beds passthrough the V2 columns', () => {
    expect(hasGas(base({ has_gas_supply: false }))).toBe(false);
    expect(hasGas(base({ has_gas_supply: null }))).toBe(null);
    expect(beds(base({ total_lettable_rooms: 5 }))).toBe(5);
  });

  it('last_valuation_* accessors mirror V2 columns', () => {
    const p = base({ valuation_date: '2026-04-01', current_valuation: 425_000 });
    expect(lastValuationDate(p)).toBe('2026-04-01');
    expect(lastValuationEstimate(p)).toBe(425_000);
  });
});
