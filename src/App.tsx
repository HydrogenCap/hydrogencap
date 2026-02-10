import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LifecycleFilterProvider } from "@/contexts/LifecycleFilterContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProtectedRoute } from "@/components/portal";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { LoadingState, ErrorBoundary } from "@/components/common";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyNew = lazy(() => import("./pages/PropertyNew"));
const PropertyEdit = lazy(() => import("./pages/PropertyEdit"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Ownership = lazy(() => import("./pages/Ownership"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Import = lazy(() => import("./pages/Import"));
const ImportPassport = lazy(() => import("./pages/ImportPassport"));
const Insights = lazy(() => import("./pages/Insights"));
const MissingInfo = lazy(() => import("./pages/MissingInfo"));
const Settings = lazy(() => import("./pages/Settings"));
const DashboardMap = lazy(() => import("./pages/DashboardMap"));
const Timeline = lazy(() => import("./pages/Timeline"));
const RefinanceCalendar = lazy(() => import("./pages/RefinanceCalendar"));
const ComplianceCalendar = lazy(() => import("./pages/ComplianceCalendar"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Reports = lazy(() => import("./pages/Reports"));
const Actions = lazy(() => import("./pages/Actions"));
const Chat = lazy(() => import("./pages/Chat"));
const Passport = lazy(() => import("./pages/Passport"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const SharedDocument = lazy(() => import("./pages/SharedDocument"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Contractors = lazy(() => import("./pages/Contractors"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Tenants = lazy(() => import("./pages/Tenants"));
const TenantDetail = lazy(() => import("./pages/TenantDetail"));
const RentCollection = lazy(() => import("./pages/RentCollection"));
const PaymentDetail = lazy(() => import("./pages/PaymentDetail"));
const TenancyLedger = lazy(() => import("./pages/TenancyLedger"));
const MaintenanceRequests = lazy(() => import("./pages/MaintenanceRequests"));

// Portal pages
const AcceptInvite = lazy(() => import("./pages/portal/AcceptInvite"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalProperties = lazy(() => import("./pages/portal/PortalProperties"));
const PortalCompliance = lazy(() => import("./pages/portal/PortalCompliance"));

// Marketing pages
const MarketingHome = lazy(() => import("./pages/marketing/Home"));
const MarketingProduct = lazy(() => import("./pages/marketing/Product"));
const MarketingPortfolio = lazy(() => import("./pages/marketing/Portfolio"));
const MarketingCaseStudies = lazy(() => import("./pages/marketing/CaseStudies"));
const MarketingAbout = lazy(() => import("./pages/marketing/About"));
const MarketingContact = lazy(() => import("./pages/marketing/Contact"));
const MarketingDemo = lazy(() => import("./pages/marketing/Demo"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 min — data stays fresh
      gcTime: 10 * 60 * 1000,           // 10 min garbage collection
      refetchOnWindowFocus: false,       // Stop refetch on tab switch
      retry: 1,                          // Single retry on failure
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
          <LifecycleFilterProvider>
            <GoogleMapsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ErrorBoundary>
                <Suspense fallback={<LoadingState text="Loading..." />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/map"
              element={
                <ProtectedRoute>
                  <DashboardMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties"
              element={
                <ProtectedRoute>
                  <Properties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties/new"
              element={
                <ProtectedRoute>
                  <PropertyNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties/:id/edit"
              element={
                <ProtectedRoute>
                  <PropertyEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties/:id"
              element={
                <ProtectedRoute>
                  <PropertyDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <Companies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies/:id"
              element={
                <ProtectedRoute>
                  <CompanyDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ownership"
              element={
                <ProtectedRoute>
                  <Ownership />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbox"
              element={
                <ProtectedRoute>
                  <Inbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <Import />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import/passport"
              element={
                <ProtectedRoute>
                  <ImportPassport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <ProtectedRoute>
                  <Insights />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <Timeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/missing-info"
              element={
                <ProtectedRoute>
                  <MissingInfo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <Compliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/actions"
              element={
                <ProtectedRoute>
                  <Actions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/passport"
              element={
                <ProtectedRoute>
                  <Passport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pipeline"
              element={
                <ProtectedRoute>
                  <Pipeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/refinance-calendar"
              element={
                <ProtectedRoute>
                  <RefinanceCalendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance-calendar"
              element={
                <ProtectedRoute>
                  <ComplianceCalendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contractors"
              element={
                <ProtectedRoute>
                  <Contractors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId"
              element={
                <ProtectedRoute>
                  <JobDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/tenants" element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
            <Route path="/tenants/:tenantId" element={<ProtectedRoute><TenantDetail /></ProtectedRoute>} />
            <Route path="/rent" element={<ProtectedRoute><RentCollection /></ProtectedRoute>} />
            <Route path="/rent/tenancy/:tenancyId" element={<ProtectedRoute><TenancyLedger /></ProtectedRoute>} />
            <Route path="/rent/:scheduleId" element={<ProtectedRoute><PaymentDetail /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><MaintenanceRequests /></ProtectedRoute>} />

            {/* Marketing pages (public) */}
            <Route path="/" element={<MarketingHome />} />
            <Route path="/product" element={<MarketingProduct />} />
            <Route path="/portfolio" element={<MarketingPortfolio />} />
            <Route path="/case-studies" element={<MarketingCaseStudies />} />
            <Route path="/about" element={<MarketingAbout />} />
            <Route path="/contact" element={<MarketingContact />} />
            <Route path="/demo" element={<MarketingDemo />} />
            
            {/* Shared document viewer (public) */}
            <Route path="/shared/:token" element={<SharedDocument />} />
            
            {/* Portal routes (shareholder access) */}
            <Route path="/portal/accept/:token" element={<AcceptInvite />} />
            <Route
              path="/portal"
              element={
                <PortalProtectedRoute>
                  <PortalDashboard />
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/properties"
              element={
                <PortalProtectedRoute>
                  <PortalProperties />
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/compliance"
              element={
                <PortalProtectedRoute>
                  <PortalCompliance />
                </PortalProtectedRoute>
              }
            />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
                </Suspense>
                </ErrorBoundary>
              </BrowserRouter>
            </GoogleMapsProvider>
          </LifecycleFilterProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;