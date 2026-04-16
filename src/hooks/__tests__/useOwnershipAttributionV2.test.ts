/**
 * Regression tests for useOwnershipAttributionV2.
 *
 * This hook is pure-compute over `useOwnershipData`, so we mock that hook
 * directly. Asserts the two public shapes:
 *   - usePropertyOwnershipV2 returns { directOwners, effectiveOwners, groupOwnership }
 *   - usePortfolioOwnershipV2 aggregates effectiveOwners across properties
 *     into the portfolioOwners array keyed by ultimate owner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAppHook } from '@/test/renderHook';
import type { OwnershipDataBundle } from '@/hooks/useOwnershipData';

// Mock bundle: one parent "Acme Group Ltd" owning two subsidiaries A & B,
// each holding one property. The ultimate owner is the group parent.
let bundle: OwnershipDataBundle | null;

vi.mock('@/hooks/useOwnershipData', () => ({
  useOwnershipData: () => ({ data: bundle, isLoading: false }),
}));

beforeEach(() => {
  bundle = {
    entities: [
      { id: 'parent', entity_name: 'Acme Group Ltd', is_group_parent: true },
      { id: 'subA', entity_name: 'Sub A Ltd', is_group_parent: false },
      { id: 'subB', entity_name: 'Sub B Ltd', is_group_parent: false },
    ] as unknown as OwnershipDataBundle['entities'],
    shareClasses: [
      { id: 'scA', entity_id: 'subA', class_name: 'Ordinary', issued_shares: 100 },
      { id: 'scB', entity_id: 'subB', class_name: 'Ordinary', issued_shares: 100 },
    ] as unknown as OwnershipDataBundle['shareClasses'],
    shareholders: [
      {
        id: 'sh1',
        entity_id: 'subA',
        shareholder_name: 'Acme Group Ltd',
        shareholder_entity_id: 'parent',
        shareholder_type: 'entity',
        share_class_id: 'scA',
        shares_held: 100,
        percentage: 100,
        effective_date: '2020-01-01',
        effective_to: null,
      },
      {
        id: 'sh2',
        entity_id: 'subB',
        shareholder_name: 'Acme Group Ltd',
        shareholder_entity_id: 'parent',
        shareholder_type: 'entity',
        share_class_id: 'scB',
        shares_held: 100,
        percentage: 100,
        effective_date: '2020-01-01',
        effective_to: null,
      },
    ] as unknown as OwnershipDataBundle['shareholders'],
  };
});

describe('usePropertyOwnershipV2', () => {
  it('returns null when entityId is undefined', async () => {
    const { usePropertyOwnershipV2 } = await import('@/hooks/useOwnershipAttributionV2');
    const { result } = renderAppHook(() => usePropertyOwnershipV2(undefined));
    expect(result.current.data).toBeNull();
  });

  it('returns null when ownership bundle is missing', async () => {
    bundle = null;
    const { usePropertyOwnershipV2 } = await import('@/hooks/useOwnershipAttributionV2');
    const { result } = renderAppHook(() => usePropertyOwnershipV2('subA'));
    expect(result.current.data).toBeNull();
  });

  it('returns effective ownership rolled up to the group parent for a subsidiary', async () => {
    const { usePropertyOwnershipV2 } = await import('@/hooks/useOwnershipAttributionV2');
    const { result } = renderAppHook(() => usePropertyOwnershipV2('subA'));

    const data = result.current.data;
    expect(data).not.toBeNull();

    // Direct owner is the parent entity holding 100%
    expect(data?.directOwners.length).toBeGreaterThan(0);
    // Effective owner(s) rolls up to the ultimate owner (parent)
    expect(data?.effectiveOwners.length).toBeGreaterThan(0);
    const ultimate = data?.effectiveOwners[0];
    expect(ultimate?.effectivePercent).toBeCloseTo(100);
  });
});

describe('usePortfolioOwnershipV2', () => {
  it('returns null when no properties are provided', async () => {
    const { usePortfolioOwnershipV2 } = await import('@/hooks/useOwnershipAttributionV2');
    const { result } = renderAppHook(() => usePortfolioOwnershipV2(undefined));
    expect(result.current.data).toBeNull();
  });

  it('aggregates effective ownership across properties into portfolioOwners', async () => {
    const { usePortfolioOwnershipV2 } = await import('@/hooks/useOwnershipAttributionV2');

    const properties = [
      { id: 'prop1', address_line_1: '1 Street', city: 'Oxford', entity_id: 'subA' },
      { id: 'prop2', address_line_1: '2 Street', city: 'Oxford', entity_id: 'subB' },
    ];

    const { result } = renderAppHook(() => usePortfolioOwnershipV2(properties));

    const data = result.current.data;
    expect(data).not.toBeNull();

    // Parent owns 100% of both subsidiaries -> one aggregated portfolioOwner
    // whose `properties` array contains both.
    expect(data?.portfolioOwners.length).toBeGreaterThan(0);
    const topOwner = data?.portfolioOwners[0];
    expect(topOwner?.properties.length).toBe(2);
    expect(topOwner?.totalEffectiveProperties).toBe(2);

    // Group parent metadata is exposed
    expect(data?.groupParent?.entityName).toBe('Acme Group Ltd');

    // Per-property attribution is exposed too
    expect(data?.propertyAttributions).toHaveLength(2);
    expect(data?.propertyAttributions[0].propertyAddress).toBe('1 Street, Oxford');
  });
});
