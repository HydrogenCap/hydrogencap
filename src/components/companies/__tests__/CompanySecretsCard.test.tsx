import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useCompanySecrets', () => ({
  // Auth code populated, UTR null — mirrors 9/10 of the migrated SPV rows.
  useCompanySecretsMasked: () => ({
    data: {
      company_id: 'ent-1',
      auth_code_masked: '••••AB12',
      utr_masked: null,
      auth_code_last4: 'AB12',
      utr_last4: null,
      updated_at: '2024-01-01T00:00:00Z',
    },
    isLoading: false,
  }),
  useRevealSecrets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCompanySecrets: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { CompanySecretsCard } from '../CompanySecretsCard';

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompanySecretsCard companyId="ent-1" />
    </QueryClientProvider>,
  );
}

describe('CompanySecretsCard — partial secrets gating', () => {
  it('renders masked auth code and Reveal button when only auth_code_last4 is set (no UTR)', () => {
    renderCard();

    // Masked auth code visible.
    expect(screen.getByText('••••AB12')).toBeInTheDocument();

    // Reveal button must render — proves we didn't fall through to the empty state.
    expect(screen.getByRole('button', { name: /Reveal/i })).toBeInTheDocument();

    // Empty-state copy must NOT appear.
    expect(
      screen.queryByText(/No sensitive details stored/i),
    ).not.toBeInTheDocument();

    // UTR row still rendered with em-dash placeholder.
    expect(screen.getByText('HMRC UTR')).toBeInTheDocument();
  });
});
