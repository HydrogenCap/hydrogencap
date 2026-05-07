import { TenantLifecyclePanel } from '@/components/tenants/TenantLifecyclePanel';
import type { TenantDetailState } from '../hooks/useTenantDetailState';

export function LifecycleTab({ state }: { state: TenantDetailState }) {
  const { tenant, activeAgreement, handleStatusTransition } = state;
  if (!tenant) return null;
  return (
    <div className="space-y-6">
      <TenantLifecyclePanel
        tenantId={tenant.id}
        tenantStatus={tenant.status}
        tenancyId={activeAgreement?.id}
        onStatusTransition={handleStatusTransition}
      />
    </div>
  );
}
