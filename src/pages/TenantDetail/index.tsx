import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, Bell, DoorOpen } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TENANT_TYPES, TENANT_STATUSES } from '@/hooks/useTenantsV2';
import { AddTenantModal } from '@/components/tenants-v2/AddTenantModal';
import { CreateTenancyAgreementModal } from '@/components/tenants-v2/CreateTenancyAgreementModal';
import { ServeNoticeModal } from '@/components/tenants-v2/ServeNoticeModal';
import { EndTenancyModal } from '@/components/tenants-v2/EndTenancyModal';
import { CommunicationTimeline } from '@/components/communications/CommunicationTimeline';
import { MobileDetailsSheet } from '@/components/common';
import { useTenantDetailState } from './hooks/useTenantDetailState';
import { OverviewTab } from './components/OverviewTab';
import { PaymentsTab } from './components/PaymentsTab';
import { LifecycleTab } from './components/LifecycleTab';
import { NoticesTab } from './components/NoticesTab';
import { PaymentScoreBadge } from './components/PaymentScoreBadge';
import { Row } from './components/Row';
import { STATUS_BG } from './utils/badges';
import { getLabel } from './utils/format';

void Row;

export default function TenantDetail() {
  const navigate = useNavigate();
  const state = useTenantDetailState();
  const {
    id, tenant, isLoading, activeAgreement, compliance,
    showEdit, setShowEdit,
    showCreateAgreement, setShowCreateAgreement,
    showNotice, setShowNotice,
    showEnd, setShowEnd,
  } = state;

  if (isLoading) return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div></AppLayout>;
  if (!tenant) return <AppLayout><div className="text-center py-16 text-muted-foreground">Tenant not found.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/tenants-v2')} className="mb-1" aria-label="Back to tenants">
              <ArrowLeft className="h-4 w-4 mr-1" /> Tenants
            </Button>
            <h1 className="text-2xl font-bold text-foreground break-words">{tenant.first_name} {tenant.last_name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_BG[tenant.status]}>{getLabel(TENANT_STATUSES, tenant.status)}</Badge>
              <Badge className="bg-blue-100 text-blue-700">{getLabel(TENANT_TYPES, tenant.tenant_type)}</Badge>
              <PaymentScoreBadge tenantId={tenant.id} />
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowEdit(true)} className="hidden lg:inline-flex shrink-0">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab state={state} /></TabsContent>
          <TabsContent value="payments"><PaymentsTab state={state} /></TabsContent>
          <TabsContent value="lifecycle"><LifecycleTab state={state} /></TabsContent>
          <TabsContent value="notices"><NoticesTab state={state} /></TabsContent>
          <TabsContent value="communications" className="space-y-6">
            <CommunicationTimeline tenantId={id} title="Tenant Communications" />
          </TabsContent>
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-6">
                  Document management is available on the tenant's tenancy agreement.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddTenantModal open={showEdit} onOpenChange={setShowEdit} />
      <CreateTenancyAgreementModal
        open={showCreateAgreement}
        onOpenChange={setShowCreateAgreement}
        preselectedTenantId={id}
        onSuccess={() => {}}
      />
      {activeAgreement && (
        <>
          <ServeNoticeModal
            open={showNotice}
            onOpenChange={setShowNotice}
            tenancyId={activeAgreement.id}
            tenantId={tenant.id}
            compliance={compliance}
          />
          <EndTenancyModal
            open={showEnd}
            onOpenChange={setShowEnd}
            tenancyId={activeAgreement.id}
            tenantId={tenant.id}
          />
        </>
      )}

      <MobileDetailsSheet title="Tenant Actions" triggerLabel="Actions">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-2" /> Edit Tenant
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowCreateAgreement(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Tenancy Agreement
          </Button>
          {activeAgreement && activeAgreement.status === 'active' && (
            <>
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowNotice(true)}>
                <Bell className="h-4 w-4 mr-2" /> Serve Notice
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowEnd(true)}>
                <DoorOpen className="h-4 w-4 mr-2" /> End Tenancy
              </Button>
            </>
          )}
        </div>
      </MobileDetailsSheet>
    </AppLayout>
  );
}
