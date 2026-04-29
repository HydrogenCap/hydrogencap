import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  v2PropertyToV1Shape,
  wrapWithV1OnlyWarnings,
  __resetCompatWarnings,
} from '../usePropertyCompat';
import type { PropertyWithEntity } from '@/hooks/usePropertiesV2';

const baseV2: PropertyWithEntity = {
  id: 'prop-1',
  org_id: 'org-1',
  entity_id: 'ent-1',
  entity_name: 'Acme Holdings Ltd',
  entity_type: 'spv',
  address_line_1: '10 High Street',
  address_line_2: 'Flat 2',
  city: 'Manchester',
  county: 'Greater Manchester',
  postcode: 'M1 1AA',
  country: 'United Kingdom',
  property_type: 'hmo_licensed',
  lifecycle_stage: 'stabilised',
  council_name: null,
  council_area: null,
  listing_grade: 'none',
  rent_basis: 'room',
  whole_house_rent_pcm: null,
  has_gas_supply: true,
  year_built: 1900,
  total_floors: 3,
  total_lettable_rooms: 5,
  purchase_date: '2024-06-01',
  purchase_price: 250000,
  current_valuation: 320000,
  valuation_date: '2026-01-15',
  latitude: 53.48,
  longitude: -2.24,
  notes: 'Refurb done 2024',
  epc_rating: 'C',
  epc_expiry_date: '2030-01-01',
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

describe('v2PropertyToV1Shape — renames', () => {
  it('renames address_line_1 → address_line, city → town_city/area_name', () => {
    const v1 = v2PropertyToV1Shape(baseV2);
    expect(v1.address_line).toBe('10 High Street');
    expect(v1.address_line2).toBe('Flat 2');
    expect(v1.town_city).toBe('Manchester');
    expect(v1.area_name).toBe('Manchester');
  });

  it('renames current_valuation → current_value_gbp and purchase_price → purchase_price_gbp', () => {
    const v1 = v2PropertyToV1Shape(baseV2);
    expect(v1.current_value_gbp).toBe(320000);
    expect(v1.purchase_price_gbp).toBe(250000);
    expect(v1.last_valuation_date).toBe('2026-01-15');
  });

  it('renames has_gas_supply → has_gas', () => {
    const v1 = v2PropertyToV1Shape(baseV2);
    expect(v1.has_gas).toBe(true);
  });
});

describe('v2PropertyToV1Shape — derived fields', () => {
  it('derives lifecycle_type from lifecycle_stage (stabilised → core_rental)', () => {
    expect(v2PropertyToV1Shape(baseV2).lifecycle_type).toBe('core_rental');
    expect(v2PropertyToV1Shape({ ...baseV2, lifecycle_stage: 'letting' }).lifecycle_type).toBe(
      'core_rental'
    );
    expect(v2PropertyToV1Shape({ ...baseV2, lifecycle_stage: 'pipeline' }).lifecycle_type).toBe(
      'development'
    );
    expect(
      v2PropertyToV1Shape({ ...baseV2, lifecycle_stage: 'refurbishment' }).lifecycle_type
    ).toBe('development');
  });

  it('derives is_grade_listed from listing_grade', () => {
    expect(v2PropertyToV1Shape({ ...baseV2, listing_grade: 'none' }).is_grade_listed).toBe(false);
    expect(v2PropertyToV1Shape({ ...baseV2, listing_grade: 'grade_ii' }).is_grade_listed).toBe(
      true
    );
  });

  it('derives formatted_address from address_line_1 + city + postcode', () => {
    expect(v2PropertyToV1Shape(baseV2).formatted_address).toBe(
      '10 High Street, Manchester, M1 1AA'
    );
  });
});

describe('v2PropertyToV1Shape — defaults for V1-only fields', () => {
  it('returns null/false safe defaults for fields that have no V2 source', () => {
    const v1 = v2PropertyToV1Shape(baseV2);
    expect(v1.legal_owner_company_id).toBeNull();
    expect(v1.legal_owner_party_id).toBeNull();
    expect(v1.is_hmo_licensed).toBeNull();
    expect(v1.epc_rating).toBeNull();
    expect(v1.bathrooms).toBeNull();
    expect(v1.conservation_area).toBe(false);
  });
});

describe('v2PropertyToV1Shape — V2-only extras are not surfaced', () => {
  it('does not include entity_id / entity_name / rent_basis / total_floors', () => {
    const v1 = v2PropertyToV1Shape(baseV2) as Record<string, unknown>;
    expect(v1).not.toHaveProperty('entity_id');
    expect(v1).not.toHaveProperty('entity_name');
    expect(v1).not.toHaveProperty('entity_type');
    expect(v1).not.toHaveProperty('rent_basis');
    expect(v1).not.toHaveProperty('total_floors');
    expect(v1).not.toHaveProperty('council_name');
  });
});

describe('wrapWithV1OnlyWarnings', () => {
  beforeEach(() => {
    __resetCompatWarnings();
  });

  it('warns once per V1-only field accessed and stays silent for mapped fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v1 = wrapWithV1OnlyWarnings(v2PropertyToV1Shape(baseV2));

    // Access mapped fields — no warnings.
    void v1.address_line;
    void v1.town_city;
    void v1.lifecycle_type;
    expect(warn).not.toHaveBeenCalled();

    // Access V1-only fields — warning emitted.
    void v1.legal_owner_company_id;
    void v1.tenure;
    expect(warn).toHaveBeenCalledTimes(2);

    // Same V1-only field accessed again — no duplicate warning.
    void v1.legal_owner_company_id;
    void v1.legal_owner_company_id;
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });

  it('still returns the underlying value when a V1-only field is read', () => {
    const v1 = wrapWithV1OnlyWarnings(v2PropertyToV1Shape(baseV2));
    expect(v1.legal_owner_company_id).toBeNull();
    expect(v1.conservation_area).toBe(false);
  });
});
