import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ChecklistItem } from '@/hooks/useActivationChecklist';

// ── Mocks ────────────────────────────────────────────────────────────────
const useActivationChecklistMock = vi.fn();
vi.mock('@/hooks/useActivationChecklist', () => ({
  useActivationChecklist: () => useActivationChecklistMock(),
}));

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { id: 'org-1' } }),
}));

// Drive the entity + bank-account counts through useQuery's queryKey so we
// can flip individual signals without mocking supabase.
const queryCountMap: Record<string, number> = {};
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      const key = JSON.stringify(queryKey);
      const count = queryCountMap[key] ?? 0;
      return { data: count, isLoading: false, error: null, refetch: vi.fn() };
    },
  };
});

// Avoid pulling in the real supabase client (env vars not set in test env).
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
  supabaseAny: {},
}));

import { ActivationWidget } from './ActivationWidget';

// ── Helpers ──────────────────────────────────────────────────────────────
const ALL_HOOK_IDS = [
  'add_property',
  'add_rooms',
  'upload_compliance',
  'add_tenant',
  'add_mortgage',
  'invite_team',
] as const;

function mockChecklist(completedIds: string[]) {
  const items: ChecklistItem[] = ALL_HOOK_IDS.map(id => ({
    id,
    label: id,
    description: '',
    completed: completedIds.includes(id),
    route: '/',
    optional: id === 'invite_team',
  }));
  useActivationChecklistMock.mockReturnValue({
    items,
    completedCount: completedIds.length,
    totalRequired: 5,
    totalItems: items.length,
    allRequiredComplete: false,
    dismissed: false,
    isLoading: false,
    dismiss: vi.fn(),
  });
}

function setExtras(entityCount: number, bankCount: number) {
  queryCountMap[JSON.stringify(['activation-widget', 'entities', 'org-1'])] = entityCount;
  queryCountMap[JSON.stringify(['activation-widget', 'bank-accounts', 'org-1'])] = bankCount;
}

function renderWidget() {
  return render(
    <MemoryRouter>
      <ActivationWidget />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useActivationChecklistMock.mockReset();
  for (const k of Object.keys(queryCountMap)) delete queryCountMap[k];
});

// ── Tests ────────────────────────────────────────────────────────────────
describe('ActivationWidget', () => {
  it('renders 0% state with all six items incomplete', () => {
    mockChecklist([]);
    setExtras(0, 0);
    renderWidget();

    expect(screen.getByTestId('activation-widget')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Add your first property')).toBeInTheDocument();
    expect(screen.getByText('Add a company or entity')).toBeInTheDocument();
    expect(screen.getByText('Upload a compliance certificate')).toBeInTheDocument();
    expect(screen.getByText('Set up a tenancy')).toBeInTheDocument();
    expect(screen.getByText('Connect a bank account')).toBeInTheDocument();
    expect(screen.getByText('Invite a teammate')).toBeInTheDocument();
    expect(screen.getByText('0 of 6 complete')).toBeInTheDocument();
  });

  it('renders 50% state with three items complete', () => {
    mockChecklist(['add_property', 'upload_compliance']);
    setExtras(1, 0); // entity complete, bank not
    renderWidget();

    expect(screen.getByTestId('activation-widget')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 complete')).toBeInTheDocument();
  });

  it('renders nothing when 100% complete', () => {
    mockChecklist(['add_property', 'upload_compliance', 'add_tenant', 'invite_team']);
    setExtras(1, 1);
    const { container } = renderWidget();

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('activation-widget')).not.toBeInTheDocument();
  });
});
