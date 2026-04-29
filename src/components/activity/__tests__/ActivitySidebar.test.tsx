import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivitySidebar } from '../ActivitySidebar';

// Stub all panel components — this test only verifies routing of tab → panel.
vi.mock('../NotificationsPanel', () => ({ NotificationsPanel: () => <div>NOTIF_PANEL</div> }));
vi.mock('../InboxPanel', () => ({ InboxPanel: () => <div>INBOX_PANEL</div> }));
vi.mock('../CommunicationsPanel', () => ({ CommunicationsPanel: () => <div>COMMS_PANEL</div> }));
vi.mock('../ActionsPanel', () => ({ ActionsPanel: () => <div>ACTIONS_PANEL</div> }));
vi.mock('../MissingInfoPanel', () => ({ MissingInfoPanel: () => <div>MISSING_PANEL</div> }));
vi.mock('../AuditPanel', () => ({ AuditPanel: () => <div>AUDIT_PANEL</div> }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ActivitySidebar', () => {
  it('renders Notifications panel when notifications tab is preselected', () => {
    wrap(<ActivitySidebar forceOpen initialTab="notifications" />);
    expect(screen.getByText('NOTIF_PANEL')).toBeInTheDocument();
  });

  it('renders Inbox + Communications panels when inbox tab is preselected', () => {
    wrap(<ActivitySidebar forceOpen initialTab="inbox" />);
    expect(screen.getByText('INBOX_PANEL')).toBeInTheDocument();
    expect(screen.getByText('COMMS_PANEL')).toBeInTheDocument();
  });

  it('renders Actions + MissingInfo panels when actions tab is preselected', () => {
    wrap(<ActivitySidebar forceOpen initialTab="actions" />);
    expect(screen.getByText('ACTIONS_PANEL')).toBeInTheDocument();
    expect(screen.getByText('MISSING_PANEL')).toBeInTheDocument();
  });

  it('renders Audit panel when audit tab is preselected', () => {
    wrap(<ActivitySidebar forceOpen initialTab="audit" />);
    expect(screen.getByText('AUDIT_PANEL')).toBeInTheDocument();
  });
});
