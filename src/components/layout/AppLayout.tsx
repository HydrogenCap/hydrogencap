import { ReactNode, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PageTransition } from '@/components/common/PageTransition';

import { MobileBottomNav } from './MobileBottomNav';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { SearchErrorBoundary } from '@/components/search/SearchErrorBoundary';
import { Button } from '@/components/ui/button';
import { Search, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ActivitySidebar } from '@/components/activity/ActivitySidebar';
import { useActivitySidebar, type ActivityTab } from '@/state/activitySidebar';
import { useUnreadCount } from '@/hooks/useNotifications';

interface AppLayoutProps {
  children: ReactNode;
}

const VALID_TABS: ActivityTab[] = ['notifications', 'inbox', 'actions', 'audit'];

export function AppLayout({ children }: AppLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const handleSearchOpen = useCallback((open: boolean) => setSearchOpen(open), []);
  const { openSidebar } = useActivitySidebar();
  const { data: unreadCount = 0 } = useUnreadCount();
  const location = useLocation();

  // Parse ?activity= query param to open the sidebar on a specific tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activity = params.get('activity');
    if (activity && (VALID_TABS as string[]).includes(activity)) {
      openSidebar(activity as ActivityTab);
    }
  }, [location.search, openSidebar]);

  const displayCount = unreadCount > 9 ? '9+' : unreadCount;

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
            <Button aria-label="Search"
              variant="ghost"
              size="icon"
              className="md:hidden min-h-[44px] min-w-[44px]"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button aria-label="Notifications"
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => openSidebar('notifications')}
              aria-label={unreadCount > 0 ? `Activity (${unreadCount} unread)` : 'Activity'}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]"
                  aria-hidden="true"
                >
                  {displayCount}
                </Badge>
              )}
            </Button>
            
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
      <ActivitySidebar />
    </SidebarProvider>
  );
}
