/**
 * Properties, entities, ownership, lettings, contractors — the core asset
 * management surfaces (a.k.a. "portfolio") and their legacy redirects.
 */
import { lazy } from "react";
import { Navigate, Route, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteBoundary } from "@/components/common";

const PropertyNew = lazy(() => import("@/pages/PropertyNew"));
const PropertyEdit = lazy(() => import("@/pages/PropertyEdit"));
const Entities = lazy(() => import("@/pages/Entities"));
const EntityDetail = lazy(() => import("@/pages/EntityDetail"));
const Ownership = lazy(() => import("@/pages/Ownership"));
const PropertiesV2 = lazy(() => import("@/pages/PropertiesV2"));
const PropertyDetailV2 = lazy(() => import("@/pages/PropertyDetail"));
const RoomDetailV2 = lazy(() => import("@/pages/RoomDetail"));
const TenantsV2 = lazy(() => import("@/pages/TenantsV2"));
const TenantDetailV2 = lazy(() => import("@/pages/TenantDetail"));

const ContractorsWorkspace = lazy(() => import("@/pages/ContractorsWorkspace"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const MaintenanceRequestDetail = lazy(() => import("@/pages/MaintenanceRequestDetail"));
const WorkOrderDetail = lazy(() => import("@/pages/WorkOrderDetail"));
const CapExDetail = lazy(() => import("@/pages/CapExDetail"));

const Lettings = lazy(() => import("@/pages/Lettings"));
const TenancyLedger = lazy(() => import("@/pages/TenancyLedger"));
const Reconciliation = lazy(() => import("@/pages/Reconciliation"));
const PaymentDetail = lazy(() => import("@/pages/PaymentDetail"));

const Inspections = lazy(() => import("@/pages/Inspections"));

// V1 → V2 redirect helpers
function PropertyV1Redirect() {
  const { id } = useParams();
  return <Navigate to={`/properties-v2/${id}`} replace />;
}

function TenantV1Redirect() {
  const { tenantId } = useParams();
  return <Navigate to={`/tenants-v2/${tenantId}`} replace />;
}

export const portfolioRoutes = (
  <>
    <Route path="/properties/new" element={<ProtectedRoute><RouteBoundary><PropertyNew /></RouteBoundary></ProtectedRoute>} />
    <Route path="/properties/:id/edit" element={<ProtectedRoute><RouteBoundary><PropertyEdit /></RouteBoundary></ProtectedRoute>} />

    <Route path="/entities" element={<ProtectedRoute><RouteBoundary><Entities /></RouteBoundary></ProtectedRoute>} />
    <Route path="/entities/:id" element={<ProtectedRoute><RouteBoundary><EntityDetail /></RouteBoundary></ProtectedRoute>} />

    <Route path="/properties-v2" element={<ProtectedRoute><RouteBoundary><PropertiesV2 /></RouteBoundary></ProtectedRoute>} />
    <Route path="/properties-v2/:id" element={<ProtectedRoute><RouteBoundary><PropertyDetailV2 /></RouteBoundary></ProtectedRoute>} />
    <Route path="/rooms-v2/:id" element={<ProtectedRoute><RouteBoundary><RoomDetailV2 /></RouteBoundary></ProtectedRoute>} />
    <Route path="/tenants-v2" element={<ProtectedRoute><RouteBoundary><TenantsV2 /></RouteBoundary></ProtectedRoute>} />
    <Route path="/tenants-v2/:id" element={<ProtectedRoute><RouteBoundary><TenantDetailV2 /></RouteBoundary></ProtectedRoute>} />

    <Route path="/ownership" element={<ProtectedRoute><RouteBoundary><Ownership /></RouteBoundary></ProtectedRoute>} />

    {/* Pipeline now lives as a Properties filter */}
    <Route path="/pipeline" element={<Navigate to="/properties-v2?lifecycle=development" replace />} />

    {/* Contractors workspace + legacy redirects */}
    <Route path="/contractors" element={<ProtectedRoute><RouteBoundary><ContractorsWorkspace /></RouteBoundary></ProtectedRoute>} />
    <Route path="/jobs-and-works" element={<Navigate to="/contractors?view=jobs" replace />} />
    <Route path="/jobs" element={<Navigate to="/contractors?view=jobs" replace />} />
    <Route path="/maintenance" element={<Navigate to="/contractors?view=jobs" replace />} />
    <Route path="/work-orders" element={<Navigate to="/contractors?view=jobs" replace />} />
    <Route path="/jobs/:jobId" element={<ProtectedRoute><RouteBoundary><JobDetail /></RouteBoundary></ProtectedRoute>} />
    <Route path="/maintenance/:requestId" element={<ProtectedRoute><RouteBoundary><MaintenanceRequestDetail /></RouteBoundary></ProtectedRoute>} />
    <Route path="/work-orders/:id" element={<ProtectedRoute><RouteBoundary><WorkOrderDetail /></RouteBoundary></ProtectedRoute>} />
    <Route path="/capex" element={<Navigate to="/contractors?view=capex" replace />} />
    <Route path="/capex/:id" element={<ProtectedRoute><RouteBoundary><CapExDetail /></RouteBoundary></ProtectedRoute>} />

    {/* Lettings workspace + redirects */}
    <Route path="/lettings" element={<ProtectedRoute><RouteBoundary><Lettings /></RouteBoundary></ProtectedRoute>} />
    <Route path="/voids" element={<Navigate to="/lettings?view=voids" replace />} />
    <Route path="/rent" element={<Navigate to="/lettings?view=rent" replace />} />
    <Route path="/rent/tenancy/:tenancyId" element={<ProtectedRoute><RouteBoundary><TenancyLedger /></RouteBoundary></ProtectedRoute>} />
    <Route path="/rent/reconciliation" element={<ProtectedRoute><RouteBoundary><Reconciliation /></RouteBoundary></ProtectedRoute>} />
    <Route path="/rent/:scheduleId" element={<ProtectedRoute><RouteBoundary><PaymentDetail /></RouteBoundary></ProtectedRoute>} />

    <Route path="/inspections" element={<ProtectedRoute><RouteBoundary><Inspections /></RouteBoundary></ProtectedRoute>} />

    {/* V1 legacy redirects */}
    <Route path="/properties" element={<Navigate to="/properties-v2" replace />} />
    <Route path="/properties/:id" element={<ProtectedRoute><RouteBoundary><PropertyV1Redirect /></RouteBoundary></ProtectedRoute>} />
    <Route path="/companies" element={<Navigate to="/entities" replace />} />
    <Route path="/companies/:id" element={<Navigate to="/entities" replace />} />
    <Route path="/tenants" element={<Navigate to="/tenants-v2" replace />} />
    <Route path="/tenants/:tenantId" element={<ProtectedRoute><RouteBoundary><TenantV1Redirect /></RouteBoundary></ProtectedRoute>} />
  </>
);
