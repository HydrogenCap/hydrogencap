/**
 * Shareholder/investor portal and tenant portal routes.
 * Each route is wrapped in its own protected route component.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { PortalProtectedRoute } from "@/components/portal";
import { TenantPortalProtectedRoute } from "@/components/tenant-portal/TenantPortalProtectedRoute";

const AcceptInvite = lazy(() => import("@/pages/portal/AcceptInvite"));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const PortalProperties = lazy(() => import("@/pages/portal/PortalProperties"));
const PortalCompliance = lazy(() => import("@/pages/portal/PortalCompliance"));
const PortalInvestments = lazy(() => import("@/pages/portal/PortalInvestments"));
const PortalStatements = lazy(() => import("@/pages/portal/PortalStatements"));

const TenantAcceptInvite = lazy(() => import("@/pages/tenant-portal/TenantAcceptInvite"));
const TenantDashboard = lazy(() => import("@/pages/tenant-portal/TenantDashboard"));
const TenantPayments = lazy(() => import("@/pages/tenant-portal/TenantPayments"));
const MaintenanceRequest = lazy(() => import("@/pages/tenant-portal/MaintenanceRequest"));
const TenantCertificates = lazy(() => import("@/pages/tenant-portal/TenantCertificates"));

export const portalRoutes = (
  <>
    {/* Shareholder portal */}
    <Route path="/portal/accept/:token" element={<AcceptInvite />} />
    <Route
      path="/portal"
      element={
        <PortalProtectedRoute requiredPermission="shareholder">
          <PortalDashboard />
        </PortalProtectedRoute>
      }
    />
    <Route
      path="/portal/properties"
      element={
        <PortalProtectedRoute requiredPermission="shareholder">
          <PortalProperties />
        </PortalProtectedRoute>
      }
    />
    <Route
      path="/portal/compliance"
      element={
        <PortalProtectedRoute requiredPermission="compliance">
          <PortalCompliance />
        </PortalProtectedRoute>
      }
    />
    <Route
      path="/portal/investments"
      element={
        <PortalProtectedRoute requiredPermission="investor">
          <PortalInvestments />
        </PortalProtectedRoute>
      }
    />
    <Route
      path="/portal/statements"
      element={
        <PortalProtectedRoute requiredPermission="investor">
          <PortalStatements />
        </PortalProtectedRoute>
      }
    />

    {/* Tenant portal */}
    <Route path="/tenant-portal/accept/:token" element={<TenantAcceptInvite />} />
    <Route path="/tenant-portal" element={<TenantPortalProtectedRoute><TenantDashboard /></TenantPortalProtectedRoute>} />
    <Route path="/tenant-portal/payments" element={<TenantPortalProtectedRoute requiredPermission="rent"><TenantPayments /></TenantPortalProtectedRoute>} />
    <Route path="/tenant-portal/maintenance" element={<TenantPortalProtectedRoute requiredPermission="maintenance"><MaintenanceRequest /></TenantPortalProtectedRoute>} />
    <Route path="/tenant-portal/certificates" element={<TenantPortalProtectedRoute><TenantCertificates /></TenantPortalProtectedRoute>} />
    {/* Legacy V1 tenant portal routes — redirect to V2 */}
    <Route path="/tenant-portal/rent" element={<Navigate to="/tenant-portal/payments" replace />} />
    <Route path="/tenant-portal/documents" element={<Navigate to="/tenant-portal/certificates" replace />} />
  </>
);
