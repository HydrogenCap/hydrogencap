import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 md:px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" aria-label="Toggle sidebar" />
          <NotificationBell />
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
