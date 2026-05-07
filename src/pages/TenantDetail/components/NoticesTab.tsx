import { NoticeComposer } from '@/components/tenants/NoticeComposer';
import type { TenantDetailState } from '../hooks/useTenantDetailState';

export function NoticesTab({ state }: { state: TenantDetailState }) {
  const { tenant, activeAgreement } = state;
  if (!tenant) return null;
  return (
    <div className="space-y-6">
      <NoticeComposer
        tenantId={tenant.id}
        tenancyId={activeAgreement?.id}
        tenant={{ first_name: tenant.first_name, last_name: tenant.last_name }}
        property={activeAgreement ? { address: activeAgreement.property_address || undefined } : null}
      />
    </div>
  );
}
