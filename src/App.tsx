import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LifecycleFilterProvider } from "@/contexts/LifecycleFilterContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { LoadingState, ErrorBoundary, RouteBoundary, ScrollToTopOnNavigate, BackToTop, GlobalShortcuts, CommandPalette, ShortcutsCheatSheet, ConnectionStatus } from "@/components/common";
import { RecentlyViewedTracker } from "@/hooks/useRecentlyViewed";
import { SessionExpiryModal } from "@/components/auth/SessionExpiryModal";
import { CookieConsent } from "@/components/common/CookieConsent";
import { DensityBridge } from "@/components/DensityToggle";

// Grouped route configs — see src/routes/*
import { marketingRoutes } from "@/routes/marketingRoutes";
import { portalRoutes } from "@/routes/portalRoutes";
import { portfolioRoutes } from "@/routes/portfolioRoutes";
import { complianceRoutes } from "@/routes/complianceRoutes";
import { financeRoutes } from "@/routes/financeRoutes";

// Lazy-loaded pages that don't belong to a grouped router file
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TodayWorkspace = lazy(() => import("./pages/TodayWorkspace"));
const DocumentsWorkspace = lazy(() => import("./pages/DocumentsWorkspace"));
const InsightsWorkspace = lazy(() => import("./pages/InsightsWorkspace"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));

const Inbox = lazy(() => import("./pages/Inbox"));
const Communications = lazy(() => import("./pages/Communications"));
const Import = lazy(() => import("./pages/Import"));
const ImportPassport = lazy(() => import("./pages/ImportPassport"));
const Settings = lazy(() => import("./pages/Settings"));
const DashboardMap = lazy(() => import("./pages/DashboardMap"));

const Reports = lazy(() => import("./pages/Reports"));
const Passport = lazy(() => import("./pages/Passport"));
const SharedDocument = lazy(() => import("./pages/SharedDocument"));
const NotFound = lazy(() => import("./pages/NotFound"));

const BulkUpload = lazy(() => import("./pages/BulkUpload"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const MigrationDashboard = lazy(() => import("./pages/MigrationDashboard"));
const WebhookSettings = lazy(() => import("./pages/WebhookSettings"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

// Wizard pages
const Wizards = lazy(() => import("./pages/Wizards"));
const AddPropertyWizard = lazy(() => import("./pages/AddPropertyWizard"));
const AddEntityWizard = lazy(() => import("./pages/AddEntityWizard"));
const AddComplianceWizard = lazy(() => import("./pages/AddComplianceWizard"));

const AcceptTeamInvite = lazy(() => import("./pages/AcceptTeamInvite"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));

function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (e.status === 401 || e.status === 403) return true;
    if (typeof e.message === 'string' && (e.message.includes('JWT') || e.message.includes('token'))) return true;
  }
  return false;
}

const queryCache = new QueryCache({
  onError: (error) => {
    if (isAuthError(error)) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  },
});

const mutationCache = new MutationCache({
  onError: (error) => {
    if (isAuthError(error)) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  },
});

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
          <OrgProvider>
          <LifecycleFilterProvider>
            <GoogleMapsProvider>
              <Sonner />
              <BrowserRouter>
                <ScrollToTopOnNavigate />
                <RecentlyViewedTracker />
                <GlobalShortcuts />
                <CommandPalette />
                <ShortcutsCheatSheet />
                <BackToTop />
                <ConnectionStatus />
                <DensityBridge />
                <SessionExpiryModal />
                <CookieConsent />
                <ErrorBoundary>
                <RouteBoundary>
                <Suspense fallback={<LoadingState text="Loading..." />}>
          <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Today workspace + redirects from absorbed surfaces */}
            <Route path="/today" element={<ProtectedRoute><RouteBoundary><TodayWorkspace /></RouteBoundary></ProtectedRoute>} />
            <Route path="/fix-it" element={<Navigate to="/today" replace />} />
            <Route path="/missing-info" element={<Navigate to="/today?view=missing-info" replace />} />
            <Route path="/data-quality" element={<Navigate to="/today" replace />} />
            <Route path="/actions" element={<Navigate to="/today?view=actions" replace />} />
            <Route path="/compliance-actions" element={<Navigate to="/compliance" replace />} />

            <Route path="/system-health" element={<ProtectedRoute><RouteBoundary><SystemHealth /></RouteBoundary></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><RouteBoundary><Dashboard /></RouteBoundary></ProtectedRoute>} />
            <Route path="/dashboard/map" element={<ProtectedRoute><RouteBoundary><DashboardMap /></RouteBoundary></ProtectedRoute>} />

            {/* Portfolio: properties, entities, ownership, contractors, lettings */}
            {portfolioRoutes}

            <Route path="/inbox" element={<ProtectedRoute><RouteBoundary><Inbox /></RouteBoundary></ProtectedRoute>} />
            <Route path="/import" element={<ProtectedRoute><RouteBoundary><Import /></RouteBoundary></ProtectedRoute>} />
            <Route path="/import/passport" element={<ProtectedRoute><RouteBoundary><ImportPassport /></RouteBoundary></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RouteBoundary><Settings /></RouteBoundary></ProtectedRoute>} />
            <Route path="/settings/webhooks" element={<ProtectedRoute><RouteBoundary><WebhookSettings /></RouteBoundary></ProtectedRoute>} />

            {/* Insights workspace + redirects from absorbed surfaces */}
            <Route path="/insights" element={<ProtectedRoute><RouteBoundary><InsightsWorkspace /></RouteBoundary></ProtectedRoute>} />
            <Route path="/timeline" element={<Navigate to="/insights?view=timeline" replace />} />
            <Route path="/portfolio-timeline" element={<Navigate to="/insights?view=performance" replace />} />
            <Route path="/valuation-alerts" element={<Navigate to="/insights?view=valuations" replace />} />
            <Route path="/chat" element={<Navigate to="/insights?view=chat" replace />} />
            <Route path="/investor-reports" element={<Navigate to="/insights?view=ai-reports" replace />} />
            <Route path="/acquisition-advisor" element={<Navigate to="/insights?view=acquisition" replace />} />

            <Route path="/reports" element={<ProtectedRoute><RouteBoundary><Reports /></RouteBoundary></ProtectedRoute>} />
            <Route path="/passport" element={<ProtectedRoute><RouteBoundary><Passport /></RouteBoundary></ProtectedRoute>} />

            {/* Compliance */}
            {complianceRoutes}

            {/* Finance */}
            {financeRoutes}

            <Route path="/templates" element={<Navigate to="/documents?view=templates" replace />} />
            <Route path="/bulk-upload" element={<Navigate to="/documents?view=bulk-upload" replace />} />
            <Route path="/bulk-upload-legacy" element={<ProtectedRoute><RouteBoundary><BulkUpload /></RouteBoundary></ProtectedRoute>} />
            <Route path="/bulk-scanner" element={<Navigate to="/documents?view=bulk-scanner" replace />} />

            {/* Documents workspace (Vault / Templates / Bulk tabs) */}
            <Route path="/documents" element={<ProtectedRoute><RouteBoundary><DocumentsWorkspace /></RouteBoundary></ProtectedRoute>} />

            <Route path="/team" element={<ProtectedRoute><RouteBoundary><TeamManagement /></RouteBoundary></ProtectedRoute>} />
            <Route path="/audit-log" element={<ProtectedRoute><RouteBoundary><AuditLog /></RouteBoundary></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><RouteBoundary><Communications /></RouteBoundary></ProtectedRoute>} />
            <Route path="/migrate" element={<ProtectedRoute><RouteBoundary><MigrationDashboard /></RouteBoundary></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><RouteBoundary><NotificationsPage /></RouteBoundary></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminProtectedRoute><RouteBoundary><AdminDashboard /></RouteBoundary></AdminProtectedRoute></ProtectedRoute>} />

            {/* Wizard routes — each wrapped in RouteBoundary so a render error
                in one wizard step doesn't crash the whole app shell. */}
            <Route path="/wizards" element={<ProtectedRoute><RouteBoundary><Wizards /></RouteBoundary></ProtectedRoute>} />
            <Route path="/wizards/add-property" element={<ProtectedRoute><RouteBoundary><AddPropertyWizard /></RouteBoundary></ProtectedRoute>} />
            <Route path="/wizards/add-entity" element={<ProtectedRoute><RouteBoundary><AddEntityWizard /></RouteBoundary></ProtectedRoute>} />
            <Route path="/wizards/add-compliance" element={<ProtectedRoute><RouteBoundary><AddComplianceWizard /></RouteBoundary></ProtectedRoute>} />

            {/* Marketing pages (public) */}
            {marketingRoutes}

            {/* Shared document viewer (public) */}
            <Route path="/shared/:token" element={<SharedDocument />} />

            {/* Shareholder + tenant portals */}
            {portalRoutes}

            {/* Team invite acceptance */}
            <Route path="/team/accept/:token" element={<AcceptTeamInvite />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
                </Suspense>
                </RouteBoundary>
                </ErrorBoundary>
              </BrowserRouter>
            </GoogleMapsProvider>
          </LifecycleFilterProvider>
          </OrgProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
