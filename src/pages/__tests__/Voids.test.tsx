import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let untrackedVoids: Array<Record<string, unknown>> | undefined;
const createVoidMutate = vi.fn();
let createVoidPending = false;

vi.mock('@/hooks/useVoidPeriods', () => ({
  useUntrackedVoids: () => ({ data: untrackedVoids }),
  useCreateVoidPeriod: () => ({ mutate: createVoidMutate, isPending: createVoidPending }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/voids/VoidDashboard', () => ({
  VoidDashboard: () => <div data-testid="void-dashboard" />,
}));

import Voids from '../Voids';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Voids />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Voids page', () => {
  beforeEach(() => {
    untrackedVoids = [];
    createVoidMutate.mockReset();
    createVoidPending = false;
  });

  it('renders the header and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Void Management', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Track empty rooms and their financial impact/)).toBeInTheDocument();
  });

  it('renders the void dashboard', () => {
    renderPage();
    expect(screen.getByTestId('void-dashboard')).toBeInTheDocument();
  });

  it('hides the untracked-voids alert when there are none', () => {
    untrackedVoids = [];
    renderPage();
    expect(screen.queryByText(/rooms may be void/)).not.toBeInTheDocument();
  });

  it('hides the untracked-voids alert when data is undefined', () => {
    untrackedVoids = undefined;
    renderPage();
    expect(screen.queryByText(/rooms may be void/)).not.toBeInTheDocument();
  });

  it('shows the untracked-voids alert with count when rooms are present', () => {
    untrackedVoids = [
      { roomId: 'r1', roomName: 'Room 1', propertyId: 'p1', propertyAddress: '10 High St' },
      { roomId: 'r2', roomName: 'Room 2', propertyId: 'p1', propertyAddress: '10 High St' },
    ];
    renderPage();
    expect(screen.getByText(/2 rooms may be void/)).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();
  });

  it('shows Record Void buttons for each untracked void', () => {
    untrackedVoids = [
      { roomId: 'r1', roomName: 'Room 1', propertyId: 'p1', propertyAddress: '10 High St' },
      { roomId: 'r2', roomName: 'Room 2', propertyId: 'p2', propertyAddress: '5 Low Rd' },
    ];
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /Record Void/i });
    expect(buttons).toHaveLength(2);
  });

  it('calls createVoid.mutate with the correct payload when Record Void is clicked', () => {
    untrackedVoids = [
      { roomId: 'r-xyz', roomName: 'Room X', propertyId: 'p-abc', propertyAddress: 'Anywhere' },
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Record Void/i }));
    expect(createVoidMutate).toHaveBeenCalledTimes(1);
    const payload = createVoidMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.roomId).toBe('r-xyz');
    expect(payload.propertyId).toBe('p-abc');
    expect(payload.reason).toBe('between_tenants');
    // startDate should be YYYY-MM-DD for today
    expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('disables the Record Void button while the mutation is pending', () => {
    untrackedVoids = [
      { roomId: 'r1', roomName: 'Room 1', propertyId: 'p1', propertyAddress: '10 High St' },
    ];
    createVoidPending = true;
    renderPage();
    const btn = screen.getByRole('button', { name: /Record Void/i });
    expect(btn).toBeDisabled();
  });

  it('renders the property address next to each room name', () => {
    untrackedVoids = [
      { roomId: 'r1', roomName: 'Master', propertyId: 'p1', propertyAddress: '42 Oak Street' },
    ];
    renderPage();
    expect(screen.getByText('42 Oak Street')).toBeInTheDocument();
  });
});
