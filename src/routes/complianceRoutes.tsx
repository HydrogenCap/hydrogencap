/**
 * Compliance, regulatory monitor, calendar, and compliance hub routes.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteBoundary } from "@/components/common";

const ComplianceCalendar = lazy(() => import("@/pages/ComplianceCalendar"));
const ComplianceV2 = lazy(() => import("@/pages/ComplianceV2"));
const ComplianceTasks = lazy(() => import("@/pages/ComplianceTasks"));
const ComplianceHub = lazy(() => import("@/pages/ComplianceHub"));
const RegulatoryMonitor = lazy(() => import("@/pages/RegulatoryMonitor"));
const RentersRightsBill = lazy(() => import("@/pages/RentersRightsBill"));

export const complianceRoutes = (
  <>
    <Route path="/refinance-calendar" element={<Navigate to="/compliance-calendar" replace />} />
    <Route path="/compliance-calendar" element={<ProtectedRoute><RouteBoundary><ComplianceCalendar /></RouteBoundary></ProtectedRoute>} />
    <Route path="/compliance-v2" element={<ProtectedRoute><RouteBoundary><ComplianceV2 /></RouteBoundary></ProtectedRoute>} />
    <Route path="/renters-rights" element={<ProtectedRoute><RouteBoundary><RentersRightsBill /></RouteBoundary></ProtectedRoute>} />
    <Route path="/compliance-tasks" element={<ProtectedRoute><RouteBoundary><ComplianceTasks /></RouteBoundary></ProtectedRoute>} />
    <Route path="/regulatory-monitor" element={<ProtectedRoute><RouteBoundary><RegulatoryMonitor /></RouteBoundary></ProtectedRoute>} />
    <Route path="/compliance" element={<ProtectedRoute><RouteBoundary><ComplianceHub /></RouteBoundary></ProtectedRoute>} />
  </>
);
