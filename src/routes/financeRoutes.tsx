/**
 * Finance workspace and all legacy finance surfaces that now redirect into it.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteBoundary } from "@/components/common";

const Finance = lazy(() => import("@/pages/Finance"));
const InvestorDetail = lazy(() => import("@/pages/InvestorDetail"));

export const financeRoutes = (
  <>
    {/* Finance workspace (Overview / Lending / Refinancing / Investors / Tax / etc. tabs) */}
    <Route path="/finance" element={<ProtectedRoute><RouteBoundary><Finance /></RouteBoundary></ProtectedRoute>} />

    {/* Legacy redirects into the workspace */}
    <Route path="/financials" element={<Navigate to="/finance?view=overview" replace />} />
    <Route path="/lending" element={<Navigate to="/finance?view=lending" replace />} />
    <Route path="/refinancing-opportunities" element={<Navigate to="/finance?view=refinancing" replace />} />
    <Route path="/investors" element={<Navigate to="/finance?view=investors" replace />} />
    <Route path="/accounting" element={<Navigate to="/finance?view=accounting" replace />} />
    <Route path="/tax" element={<Navigate to="/finance?view=tax" replace />} />
    <Route path="/tax-engine" element={<Navigate to="/finance?view=tax-engine" replace />} />
    <Route path="/financial-forecast" element={<Navigate to="/finance?view=forecast" replace />} />
    <Route path="/distributions" element={<Navigate to="/finance?view=distributions" replace />} />
    <Route path="/insurance" element={<Navigate to="/finance?view=insurance" replace />} />

    {/* Investor detail keeps its URL */}
    <Route path="/investors/:id" element={<ProtectedRoute><RouteBoundary><InvestorDetail /></RouteBoundary></ProtectedRoute>} />
  </>
);
