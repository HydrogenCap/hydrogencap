import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LifecycleFilterProvider } from "@/contexts/LifecycleFilterContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProtectedRoute } from "@/components/portal";
import { TenantPortalProtectedRoute } from "@/components/tenant-portal/TenantPortalProtectedRoute";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { LoadingState, ErrorBoundary, RouteBoundary } from "@/components/common";
import { SessionExpiryModal } from "@/components/auth/SessionExpiryModal";
import { CookieConsent } from "@/components/common/CookieConsent";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const PropertyNew = lazy(() => import("./pages/PropertyNew"));
const PropertyEdit = lazy(() => import("./pages/PropertyEdit"));


const Entities = lazy(() => import("./pages/Entities"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const Ownership = lazy(() => import("./pages/Ownership"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Import = lazy(() => import("./pages/Import"));
const ImportPassport = lazy(() => import("./pages/ImportPassport"));
const Insights = lazy(() => import("./pages/Insights"));
const MissingInfo = lazy(() => import("./pages/MissingInfo"));
const Settings = lazy(() => import("./pages/Settings"));
const DashboardMap = lazy(() => import("./pages/DashboardMap"));
const Timeline = lazy(() => import("./pages/Timeline"));
// RefinanceCalendar removed — merged into ComplianceCalendar
const ComplianceCalendar = lazy(() => import("./pages/ComplianceCalendar"));

const Reports = lazy(() => import("./pages/Reports"));
const Actions = lazy(() => import("./pages/Actions"));
const Chat = lazy(() => import("./pages/Chat"));
const Passport = lazy(() => import("./pages/Passport"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const SharedDocument = lazy(() => import("./pages/SharedDocument"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const Contractors = lazy(() => import("./pages/Contractors"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));


const Voids = lazy(() => import("./pages/Voids"));
const LettingsPipeline = lazy(() => import("./pages/LettingsPipeline"));
const RentCollection = lazy(() => import("./pages/RentCollection"));
const PaymentDetail = lazy(() => import("./pages/PaymentDetail"));
const TenancyLedger = lazy(() => import("./pages/TenancyLedger"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const MaintenanceRequests = lazy(() => import("./pages/MaintenanceRequests"));
const MaintenanceRequestDetail = lazy(() => import("./pages/MaintenanceRequestDetail"));
const WorkOrders = lazy(() => import("./pages/WorkOrders"));
const WorkOrderDetail = lazy(() => import("./pages/WorkOrderDetail"));
const Documents = lazy(() => import("./pages/Documents"));
const PropertiesV2 = lazy(() => import("./pages/PropertiesV2"));
const PropertyDetailV2 = lazy(() => import("./pages/PropertyDetailV2"));
const RoomDetailV2 = lazy(() => import("./pages/RoomDetailV2"));
const TenantsV2 = lazy(() => import("./pages/TenantsV2"));
const TenantDetailV2 = lazy(() => import("./pages/TenantDetailV2"));
const Lending = lazy(() => import("./pages/Lending"));
const ComplianceV2 = lazy(() => import("./pages/ComplianceV2"));
const ComplianceTasks = lazy(() => import("./pages/ComplianceTasks"));
const Financials = lazy(() => import("./pages/Financials"));
const Investors = lazy(() => import("./pages/Investors"));
const InvestorDetail = lazy(() => import("./pages/InvestorDetail"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Tax = lazy(() => import("./pages/Tax"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const MigrationDashboard = lazy(() => import("./pages/MigrationDashboard"));
const CapExPage = lazy(() => import("./pages/CapEx"));
const CapExDetail = lazy(() => import("./pages/CapExDetail"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

// Wizard pages
const Wizards = lazy(() => import("./pages/Wizards"));
const AddPropertyWizard = lazy(() => import("./pages/AddPropertyWizard"));
const AddEntityWizard = lazy(() => import("./pages/AddEntityWizard"));
const AddComplianceWizard = lazy(() => import("./pages/AddComplianceWizard"));

const AcceptInvite = lazy(() => import("./pages/portal/AcceptInvite"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalProperties = lazy(() => import("./pages/portal/PortalProperties"));
const PortalCompliance = lazy(() => import("./pages/portal/PortalCompliance"));
const PortalInvestments = lazy(() => import("./pages/portal/PortalInvestments"));
const PortalStatements = lazy(() => import("./pages/portal/PortalStatements"));

// Tenant portal pages
const TenantAcceptInvite = lazy(() => import("./pages/tenant-portal/TenantAcceptInvite"));
const TenantPortalHome = lazy(() => import("./pages/tenant-portal/TenantPortalHome"));
const TenantRentHistory = lazy(() => import("./pages/tenant-portal/TenantRentHistory"));
const TenantMaintenance = lazy(() => import("./pages/tenant-portal/TenantMaintenance"));
const TenantDocuments = lazy(() => import("./pages/tenant-portal/TenantDocuments"));
const AcceptTeamInvite = lazy(() => import("./pages/AcceptTeamInvite"));

// Marketing pages
const MarketingHome = lazy(() => import("./pages/marketing/Home"));
const MarketingProduct = lazy(() => import("./pages/marketing/Product"));
const MarketingPortfolio = lazy(() => import("./pages/marketing/Portfolio"));
const MarketingCaseStudies = lazy(() => import("./pages/marketing/CaseStudies"));
const MarketingAbout = lazy(() => import("./pages/marketing/About"));
const MarketingContact = lazy(() => import("./pages/marketing/Contact"));
const MarketingDemo = lazy(() => import("./pages/marketing/Demo"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

// V1 → V2 redirect helpers
function PropertyV1Redirect() {
  const { id } = useParams();
  return <Navigate to={`/properties-v2/${id}`} replace />;
}

function TenantV1Redirect() {
  const { tenantId } = useParams();
  return <Navigate to={`/tenants-v2/${tenantId}`} replace />;
}

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
          <LifecycleFilterProvider>
            <GoogleMapsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <SessionExpiryModal />
                <CookieConsent />
                <ErrorBoundary>
                <RouteBoundary>
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
              path="/entities"
              element={
                <ProtectedRoute>
                  <Entities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entities/:id"
              element={
                <ProtectedRoute>
                  <EntityDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties-v2"
              element={
                <ProtectedRoute>
                  <PropertiesV2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties-v2/:id"
              element={
                <ProtectedRoute>
                  <PropertyDetailV2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms-v2/:id"
              element={
                <ProtectedRoute>
                  <RoomDetailV2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenants-v2"
              element={
                <ProtectedRoute>
                  <TenantsV2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenants-v2/:id"
              element={
                <ProtectedRoute>
                  <TenantDetailV2 />
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
              element={<Navigate to="/compliance-calendar" replace />}
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
              path="/lending"
              element={
                <ProtectedRoute>
                  <Lending />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance-v2"
              element={
                <ProtectedRoute>
                  <ComplianceV2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance-tasks"
              element={
                <ProtectedRoute>
                  <ComplianceTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financials"
              element={
                <ProtectedRoute>
                  <Financials />
                </ProtectedRoute>
              }
            />
            <Route
              path="/investors"
              element={
                <ProtectedRoute>
                  <Investors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/investors/:id"
              element={
                <ProtectedRoute>
                  <InvestorDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounting"
              element={
                <ProtectedRoute>
                  <Accounting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tax"
              element={
                <ProtectedRoute>
                  <Tax />
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


            <Route path="/voids" element={<ProtectedRoute><Voids /></ProtectedRoute>} />
            <Route path="/lettings" element={<ProtectedRoute><LettingsPipeline /></ProtectedRoute>} />
            <Route path="/rent" element={<ProtectedRoute><RentCollection /></ProtectedRoute>} />
            <Route path="/rent/tenancy/:tenancyId" element={<ProtectedRoute><TenancyLedger /></ProtectedRoute>} />
            <Route path="/rent/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
            <Route path="/rent/:scheduleId" element={<ProtectedRoute><PaymentDetail /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><MaintenanceRequests /></ProtectedRoute>} />
            <Route path="/maintenance/:requestId" element={<ProtectedRoute><MaintenanceRequestDetail /></ProtectedRoute>} />
            <Route path="/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
            <Route path="/work-orders/:id" element={<ProtectedRoute><WorkOrderDetail /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
            <Route path="/migrate" element={<ProtectedRoute><MigrationDashboard /></ProtectedRoute>} />
            <Route path="/capex" element={<ProtectedRoute><CapExPage /></ProtectedRoute>} />
            <Route path="/capex/:id" element={<ProtectedRoute><CapExDetail /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

            {/* Wizard routes */}
            <Route path="/wizards" element={<ProtectedRoute><Wizards /></ProtectedRoute>} />
            <Route path="/wizards/add-property" element={<ProtectedRoute><AddPropertyWizard /></ProtectedRoute>} />
            <Route path="/wizards/add-entity" element={<ProtectedRoute><AddEntityWizard /></ProtectedRoute>} />
            <Route path="/wizards/add-compliance" element={<ProtectedRoute><AddComplianceWizard /></ProtectedRoute>} />

            <Route path="/properties" element={<Navigate to="/properties-v2" replace />} />
            <Route path="/properties/:id" element={<PropertyV1Redirect />} />

            <Route path="/companies" element={<Navigate to="/entities" replace />} />
            <Route path="/companies/:id" element={<Navigate to="/entities" replace />} />
            <Route path="/tenants" element={<Navigate to="/tenants-v2" replace />} />
            <Route path="/tenants/:tenantId" element={<TenantV1Redirect />} />
            <Route path="/compliance" element={<Navigate to="/compliance-v2" replace />} />

            {/* Marketing pages (public) */}
            <Route path="/" element={<MarketingHome />} />
            <Route path="/product" element={<MarketingProduct />} />
            <Route path="/portfolio" element={<MarketingPortfolio />} />
            <Route path="/case-studies" element={<MarketingCaseStudies />} />
            <Route path="/about" element={<MarketingAbout />} />
            <Route path="/contact" element={<MarketingContact />} />
            <Route path="/demo" element={<MarketingDemo />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/install" element={<Install />} />
            
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
            <Route
              path="/portal/investments"
              element={
                <PortalProtectedRoute>
                  <PortalInvestments />
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/statements"
              element={
                <PortalProtectedRoute>
                  <PortalStatements />
                </PortalProtectedRoute>
              }
            />
            
            {/* Tenant portal routes */}
            <Route path="/tenant-portal/accept/:token" element={<TenantAcceptInvite />} />
            <Route path="/tenant-portal" element={<TenantPortalProtectedRoute><TenantPortalHome /></TenantPortalProtectedRoute>} />
            <Route path="/tenant-portal/rent" element={<TenantPortalProtectedRoute><TenantRentHistory /></TenantPortalProtectedRoute>} />
            <Route path="/tenant-portal/maintenance" element={<TenantPortalProtectedRoute><TenantMaintenance /></TenantPortalProtectedRoute>} />
            <Route path="/tenant-portal/documents" element={<TenantPortalProtectedRoute><TenantDocuments /></TenantPortalProtectedRoute>} />
            
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
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;