import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LifecycleFilterProvider } from "@/contexts/LifecycleFilterContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";

// Pages
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyNew from "./pages/PropertyNew";
import PropertyEdit from "./pages/PropertyEdit";
import PropertyDetail from "./pages/PropertyDetail";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Ownership from "./pages/Ownership";
import Inbox from "./pages/Inbox";
import Import from "./pages/Import";
import ImportPassport from "./pages/ImportPassport";
import Insights from "./pages/Insights";
import MissingInfo from "./pages/MissingInfo";
import Settings from "./pages/Settings";
import DashboardMap from "./pages/DashboardMap";
import Timeline from "./pages/Timeline";
import RefinanceCalendar from "./pages/RefinanceCalendar";
import ComplianceCalendar from "./pages/ComplianceCalendar";
import Compliance from "./pages/Compliance";
import Reports from "./pages/Reports";
import Actions from "./pages/Actions";
import Chat from "./pages/Chat";
import Passport from "./pages/Passport";
import Pipeline from "./pages/Pipeline";
import SharedDocument from "./pages/SharedDocument";
import NotFound from "./pages/NotFound";

// Marketing pages
import {
  MarketingHome,
  MarketingProduct,
  MarketingPortfolio,
  MarketingCaseStudies,
  MarketingAbout,
  MarketingContact,
  MarketingDemo,
} from "./pages/marketing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <LifecycleFilterProvider>
            <GoogleMapsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
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
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
              </Routes>
              </BrowserRouter>
            </GoogleMapsProvider>
          </LifecycleFilterProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
