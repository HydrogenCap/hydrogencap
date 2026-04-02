import { describe, it, expect } from 'vitest';
import {
  generateChecklistDefinitions,
  calculateDueDate,
  buildTenancyChecklist,
  getChecklistSummary,
  groupByCategory,
  CHECKLIST_ITEMS,
  type PropertyContext,
  type ChecklistItemDefinition,
  type ComplianceData,
  type ChecklistItem,
} from '../tenancy-checklist';

function makeComplianceData(overrides: Partial<ComplianceData> = {}): ComplianceData {
  return {
    documents: new Map(),
    tenancyFields: {},
    ...overrides,
  };
}

describe('generateChecklistDefinitions', () => {
  it('returns only "always" items for a standard AST property', () => {
    const defs = generateChecklistDefinitions({ is_hmo: false, is_selective_area: false });
    const alwaysItems = CHECKLIST_ITEMS.filter(i => i.required === 'always');
    expect(defs).toHaveLength(alwaysItems.length);
    defs.forEach(d => expect(d.required).toBe('always'));
  });

  it('includes HMO-only items for an HMO property', () => {
    const defs = generateChecklistDefinitions({ is_hmo: true, is_selective_area: false });
    const hmoItems = defs.filter(d => d.required === 'hmo_only');
    expect(hmoItems.length).toBeGreaterThan(0);
    expect(hmoItems.some(d => d.id === 'hmo_licence')).toBe(true);
    expect(hmoItems.some(d => d.id === 'fire_risk_assessment')).toBe(true);
  });

  it('includes selective-only items for selective licensing area', () => {
    const defs = generateChecklistDefinitions({ is_hmo: false, is_selective_area: true });
    const selectiveItems = defs.filter(d => d.required === 'selective_only');
    expect(selectiveItems.length).toBeGreaterThan(0);
    expect(selectiveItems.some(d => d.id === 'selective_licence')).toBe(true);
  });

  it('includes both HMO and selective items when both apply', () => {
    const defs = generateChecklistDefinitions({ is_hmo: true, is_selective_area: true });
    expect(defs.length).toBe(CHECKLIST_ITEMS.length);
  });

  it('excludes HMO items when is_hmo is undefined', () => {
    const defs = generateChecklistDefinitions({});
    const hmoItems = defs.filter(d => d.required === 'hmo_only');
    expect(hmoItems).toHaveLength(0);
  });

  it('excludes selective items when is_selective_area is undefined', () => {
    const defs = generateChecklistDefinitions({});
    const selectiveItems = defs.filter(d => d.required === 'selective_only');
    expect(selectiveItems).toHaveLength(0);
  });
});

describe('calculateDueDate', () => {
  it('returns tenancy start date for before_move_in', () => {
    expect(calculateDueDate('before_move_in', '2025-06-01')).toBe('2025-06-01');
  });

  it('adds 28 days for within_28_days', () => {
    expect(calculateDueDate('within_28_days', '2025-06-01')).toBe('2025-06-29');
  });

  it('adds 30 days for within_30_days', () => {
    expect(calculateDueDate('within_30_days', '2025-06-01')).toBe('2025-07-01');
  });

  it('adds 1 year for annually', () => {
    expect(calculateDueDate('annually', '2025-06-01')).toBe('2026-06-01');
  });

  it('adds 5 years for every_5_years', () => {
    expect(calculateDueDate('every_5_years', '2025-06-01')).toBe('2030-06-01');
  });
});

describe('buildTenancyChecklist', () => {
  const tenancyStart = '2025-06-01';
  const alwaysDefs = generateChecklistDefinitions({ is_hmo: false, is_selective_area: false });

  it('builds a checklist with all items as pending when no compliance data', () => {
    const items = buildTenancyChecklist(alwaysDefs, makeComplianceData(), new Map(), tenancyStart);
    expect(items.length).toBe(alwaysDefs.length);
    // All should be pending or overdue (depending on current date), but none done
    items.forEach(item => {
      expect(['pending', 'overdue']).toContain(item.status);
      expect(item.auto_verified).toBe(false);
    });
  });

  it('auto-verifies items with matching compliance documents', () => {
    const docs = new Map<string, { status: string; expiry_date: string | null }>();
    docs.set('gas_safety_certificate', { status: 'valid', expiry_date: '2026-06-01' });
    const complianceData = makeComplianceData({ documents: docs as ComplianceData['documents'] });

    const items = buildTenancyChecklist(alwaysDefs, complianceData, new Map(), tenancyStart);
    const gasItem = items.find(i => i.id === 'gas_safety');
    expect(gasItem?.status).toBe('done');
    expect(gasItem?.auto_verified).toBe(true);
  });

  it('auto-verifies items with matching tenancy fields', () => {
    const complianceData = makeComplianceData({
      tenancyFields: { how_to_rent_served_date: '2025-05-28' },
    });

    const items = buildTenancyChecklist(alwaysDefs, complianceData, new Map(), tenancyStart);
    const howToRentItem = items.find(i => i.id === 'how_to_rent');
    expect(howToRentItem?.status).toBe('done');
    expect(howToRentItem?.auto_verified).toBe(true);
  });

  it('uses manual completion when existingItems has a completed_date', () => {
    const existingItems = new Map<string, { completed_date: string | null; completed_by: string | null; notes: string | null; document_url: string | null }>();
    existingItems.set('gas_safety', {
      completed_date: '2025-05-15',
      completed_by: 'John',
      notes: 'Uploaded cert',
      document_url: 'https://example.com/cert.pdf',
    });

    const items = buildTenancyChecklist(alwaysDefs, makeComplianceData(), existingItems, tenancyStart);
    const gasItem = items.find(i => i.id === 'gas_safety');
    expect(gasItem?.status).toBe('done');
    expect(gasItem?.auto_verified).toBe(false);
    expect(gasItem?.completed_by).toBe('John');
  });

  it('assigns due dates based on deadline type', () => {
    const items = buildTenancyChecklist(alwaysDefs, makeComplianceData(), new Map(), tenancyStart);
    const depositItem = items.find(i => i.id === 'deposit_protection');
    expect(depositItem?.due_date).toBe('2025-07-01'); // 30 days after June 1
  });
});

describe('getChecklistSummary', () => {
  function makeItem(status: 'done' | 'pending' | 'overdue'): ChecklistItem {
    return {
      id: 'test',
      title: 'Test',
      description: '',
      legal_reference: '',
      required: 'always',
      deadline: 'before_move_in',
      category: 'safety',
      status,
      completed_date: status === 'done' ? '2025-01-01' : null,
      completed_by: null,
      notes: null,
      document_url: null,
      due_date: '2025-06-01',
      auto_verified: false,
    };
  }

  it('calculates correct totals', () => {
    const items = [makeItem('done'), makeItem('done'), makeItem('pending'), makeItem('overdue')];
    const summary = getChecklistSummary(items);
    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(2);
    expect(summary.pending).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.completionRate).toBe(50);
  });

  it('returns 100% completion for empty list', () => {
    expect(getChecklistSummary([]).completionRate).toBe(100);
  });

  it('returns 0% when nothing is completed', () => {
    const items = [makeItem('pending'), makeItem('overdue')];
    expect(getChecklistSummary(items).completionRate).toBe(0);
  });

  it('returns 100% when all completed', () => {
    const items = [makeItem('done'), makeItem('done'), makeItem('done')];
    expect(getChecklistSummary(items).completionRate).toBe(100);
  });
});

describe('groupByCategory', () => {
  function makeItemWithCategory(category: 'safety' | 'legal' | 'financial' | 'documentation'): ChecklistItem {
    return {
      id: `item-${category}`,
      title: `${category} item`,
      description: '',
      legal_reference: '',
      required: 'always',
      deadline: 'before_move_in',
      category,
      status: 'pending',
      completed_date: null,
      completed_by: null,
      notes: null,
      document_url: null,
      due_date: '2025-06-01',
      auto_verified: false,
    };
  }

  it('groups items into correct categories', () => {
    const items = [
      makeItemWithCategory('safety'),
      makeItemWithCategory('legal'),
      makeItemWithCategory('financial'),
      makeItemWithCategory('documentation'),
      makeItemWithCategory('safety'),
    ];
    const grouped = groupByCategory(items);
    expect(grouped.safety).toHaveLength(2);
    expect(grouped.legal).toHaveLength(1);
    expect(grouped.financial).toHaveLength(1);
    expect(grouped.documentation).toHaveLength(1);
  });

  it('returns empty arrays for categories with no items', () => {
    const grouped = groupByCategory([]);
    expect(grouped.safety).toHaveLength(0);
    expect(grouped.legal).toHaveLength(0);
    expect(grouped.financial).toHaveLength(0);
    expect(grouped.documentation).toHaveLength(0);
  });
});
