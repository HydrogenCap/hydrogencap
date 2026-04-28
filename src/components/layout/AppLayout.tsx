import { ReactNode, useState, useCallback } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PageTransition } from '@/components/common/PageTransition';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { SearchErrorBoundary } from '@/components/search/SearchErrorBoundary';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const handleSearchOpen = useCallback((open: boolean) => setSearchOpen(open), []);

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 md:px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" aria-label="Toggle sidebar" />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center gap-2 text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search...</span>
              <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden min-h-[44px] min-w-[44px]"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </Button>
            <NotificationBell />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          <ErrorBoundary>
            <PageTransition>
              {children}
            </PageTransition>
          </ErrorBoundary>
        </main>
      </SidebarInset>
      <MobileBottomNav />
      <SearchErrorBoundary>
        <GlobalSearch open={searchOpen} onOpenChange={handleSearchOpen} />
      </SearchErrorBoundary>
    </SidebarProvider>
  );
}
