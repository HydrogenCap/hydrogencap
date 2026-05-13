import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageSkeleton } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useLegalEntity,
  useEntityDirectors,
  useEntityShareholders,
  useDeleteLegalEntity,
  useDeleteDirector,
  useDeleteShareholder,
  type EntityDirector,
  type EntityShareholder,
} from '@/hooks/useLegalEntities';
import {
  useShareClassesWithAllocation,
  useDeleteShareClass,
  validateShareIntegrity,
  type ShareClassWithAllocation,
} from '@/hooks/useShareCapital';
import { useEntityVerification, useSyncEntity } from '@/hooks/useCompaniesHouseV2';
import { useFreeAgentConnectionForEntity } from '@/hooks/useFreeAgentIntegration';
import { useToast } from '@/hooks/use-toast';
import { useEntityPropertiesV2 } from '@/hooks/usePropertiesV2';
import { useEntityCHSync } from '@/hooks/useEntityCHSync';
import { EntityFormModal } from '@/components/entities/EntityFormModal';
import { DirectorFormModal } from '@/components/entities/DirectorFormModal';
import { ShareholderFormModal } from '@/components/entities/ShareholderFormModal';
import { ShareClassFormModal } from '@/components/entities/ShareClassFormModal';
import { CHVerificationBanner } from '@/components/entities/CHVerificationBanner';
import { CHDataPanel } from '@/components/entities/CHDataPanel';
import { ComplianceFilingsCard } from '@/components/companies/ComplianceFilingsCard';
import { EntityFinancialSection } from '@/components/financials/EntityFinancialSection';
import { EntityInvestorSection } from '@/components/entities/EntityInvestorSection';
import { EntityOwnershipCard } from '@/components/entities/EntityOwnershipCard';
import { EntityAccountingSection } from '@/components/accounting/EntityAccountingSection';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';
import { EntityHeader } from '@/components/entities/EntityHeader';
import { EntityDetailsCard } from '@/components/entities/EntityDetailsCard';
import { EntityPortfolioSummaryCard } from '@/components/entities/EntityPortfolioSummaryCard';
import { CompanySecretsCard } from '@/components/companies/CompanySecretsCard';
import { DirectorsSection } from '@/components/entities/DirectorsSection';
import { ShareCapitalSection } from '@/components/entities/ShareCapitalSection';
import { ShareholdersSection } from '@/components/entities/ShareholdersSection';
import { EntityPropertiesCard } from '@/components/entities/EntityPropertiesCard';
import { CompanyFilingDeadlines } from '@/components/entities/CompanyFilingDeadlines';
import { DirectorRegister } from '@/components/entities/DirectorRegister';
import { IntercompanyLoanTracker } from '@/components/entities/IntercompanyLoanTracker';
import { EntityFinancialConsolidation } from '@/components/entities/EntityFinancialConsolidation';

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data fetching
  const { data: entity, isLoading } = useLegalEntity(id);
  const { data: directors } = useEntityDirectors(id);
  const { data: shareholders } = useEntityShareholders(id);
  const { data: entityProperties } = useEntityPropertiesV2(id);
  const { data: verification } = useEntityVerification(id);
  const { data: shareClassesWithAllocation } = useShareClassesWithAllocation(id);
  const { data: freeAgentConnection } = useFreeAgentConnectionForEntity(id || '');

  // Mutations
  const syncEntity = useSyncEntity();
  const deleteEntity = useDeleteLegalEntity();
  const deleteDirector = useDeleteDirector();
  const deleteShareholder = useDeleteShareholder();
  const deleteShareClassMutation = useDeleteShareClass();

  // CH sync (auto-sync + manual refresh)
  const { isLookingUp, updateEntity, handleRefreshFromCH } = useEntityCHSync({
    entity, isLoading, directors, shareholders,
  });

  // Share capital integrity
  const integrityErrors = shareClassesWithAllocation
    ? validateShareIntegrity(shareClassesWithAllocation)
    : [];

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'An unexpected error occurred';

  // Modal state
  const [showEditEntity, setShowEditEntity] = useState(false);
  const [showAddDirector, setShowAddDirector] = useState(false);
  const [editingDirector, setEditingDirector] = useState<EntityDirector | null>(null);
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<EntityShareholder | null>(null);
  const [showAddShareClass, setShowAddShareClass] = useState(false);
  const [editingShareClass, setEditingShareClass] = useState<ShareClassWithAllocation | null>(null);

  // Delete handler
  const handleDeleteEntity = async () => {
    if (!id) return;
    try {
      await deleteEntity.mutateAsync(id);
      toast({ title: 'Entity deleted' });
      navigate('/entities');
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  // Loading / not found states
  if (isLoading) {
    return (
      <AppLayout>
        <PageSkeleton tabs={5} />
      </AppLayout>
    );
  }

  if (!entity) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">Entity not found.</div>
      </AppLayout>
    );
  }

  const showShareCapital = entity.entity_type === 'spv';

  return (
    <AppLayout>
      <div className="space-y-6">
        {entity.entity_type === 'spv' && (
          <CHVerificationBanner
            verification={verification ?? null}
            isSyncing={syncEntity.isPending}
            onSync={() => entity.company_number && syncEntity.mutate({ entityId: entity.id, companyNumber: entity.company_number })}
          />
        )}

        <EntityHeader
          entity={entity}
          isLookingUp={isLookingUp}
          freeAgentConnection={freeAgentConnection}
          onRefreshFromCH={handleRefreshFromCH}
          onShowEdit={() => setShowEditEntity(true)}
          onDelete={handleDeleteEntity}
        />

        <EntityDetailsCard entity={entity} />
        <EntityPortfolioSummaryCard entityId={entity.id} entityProperties={entityProperties} />

        {((entity.entity_type as string) === 'ltd_company' || entity.entity_type === 'spv') && entity.company_number && (
          <CompanySecretsCard companyId={entity.id} />
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="filings">Filings</TabsTrigger>
            <TabsTrigger value="officers">Officers</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {entity.company_number && (
              <ComplianceFilingsCard
                data={{
                  accounts_due_date: entity.accounts_due_date,
                  accounts_period_end: entity.accounts_period_end,
                  accounts_last_filed_date: entity.accounts_last_filed_date,
                  confirmation_statement_due_date: entity.confirmation_statement_due_date,
                  confirmation_statement_last_made_up_to: entity.confirmation_statement_last_made_up_to,
                  confirmation_statement_last_filed_date: entity.confirmation_statement_last_filed_date,
                  ch_last_synced_at: entity.ch_last_synced_at,
                  company_number: entity.company_number,
                }}
                onUpdate={async (updates) => {
                  await updateEntity.mutateAsync({ id: entity.id, ...updates });
                  toast({ title: 'Filing dates updated' });
                }}
                onSyncFromCH={handleRefreshFromCH}
                isSyncing={isLookingUp}
                isUpdating={updateEntity.isPending}
              />
            )}

            <DirectorsSection
              directors={directors}
              onAddDirector={() => { setEditingDirector(null); setShowAddDirector(true); }}
              onEditDirector={(d) => { setEditingDirector(d); setShowAddDirector(true); }}
              onDeleteDirector={async (d) => {
                try {
                  await deleteDirector.mutateAsync({ id: d.id, entityId: d.entity_id });
                  toast({ title: 'Director removed' });
                } catch (error: unknown) {
                  toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                }
              }}
            />

            {showShareCapital && (
              <ShareCapitalSection
                shareClassesWithAllocation={shareClassesWithAllocation}
                integrityErrors={integrityErrors}
                entityId={entity.id}
                onAddShareClass={() => { setEditingShareClass(null); setShowAddShareClass(true); }}
                onEditShareClass={(sc) => { setEditingShareClass(sc); setShowAddShareClass(true); }}
                onDeleteShareClass={async (sc) => {
                  if (sc.allocated_shares > 0) {
                    toast({ title: 'Cannot delete', description: 'Remove all shareholders from this class first', variant: 'destructive' });
                    return;
                  }
                  try {
                    await deleteShareClassMutation.mutateAsync({ id: sc.id, entityId: entity.id });
                    toast({ title: 'Share class deleted' });
                  } catch (error: unknown) {
                    toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                  }
                }}
              />
            )}

            <ShareholdersSection
              shareholders={shareholders}
              showShareCapital={showShareCapital}
              shareClassesWithAllocation={shareClassesWithAllocation}
              onAddShareholder={() => { setEditingShareholder(null); setShowAddShareholder(true); }}
              onEditShareholder={(sh) => { setEditingShareholder(sh); setShowAddShareholder(true); }}
              onDeleteShareholder={async (sh) => {
                try {
                  await deleteShareholder.mutateAsync({ id: sh.id, entityId: sh.entity_id });
                  toast({ title: 'Shareholder removed' });
                } catch (error: unknown) {
                  toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                }
              }}
            />

            <EntityOwnershipCard entityId={entity.id} entityName={entity.entity_name} />

            {entity.entity_type === 'spv' && entity.company_number && (
              <CHDataPanel
                entityId={entity.id}
                companyNumber={entity.company_number}
                verification={verification ?? null}
                localDirectors={directors || []}
              />
            )}

            <EntityFinancialSection entityId={entity.id} entityProperties={entityProperties} />
            <EntityAccountingSection entityId={entity.id} entityName={entity.entity_name} />
            <EntityInvestorSection entityId={entity.id} />

            <Card>
              <CardContent className="pt-4">
                <InlineAuditHistory tableName="legal_entities" recordId={id} title="Entity Change History" />
              </CardContent>
            </Card>

            <EntityPropertiesCard
              entityProperties={entityProperties}
              onNavigateToProperty={(propertyId) => navigate(`/properties-v2/${propertyId}`)}
            />
          </TabsContent>

          <TabsContent value="filings" className="space-y-6 mt-4">
            <CompanyFilingDeadlines entityId={entity.id} entity={entity} />
          </TabsContent>

          <TabsContent value="officers" className="space-y-6 mt-4">
            <DirectorRegister entityId={entity.id} />
          </TabsContent>

          <TabsContent value="loans" className="space-y-6 mt-4">
            <IntercompanyLoanTracker entityId={entity.id} />
          </TabsContent>

          <TabsContent value="financials" className="space-y-6 mt-4">
            <EntityFinancialConsolidation entityId={entity.id} />
          </TabsContent>
        </Tabs>
      </div>

      <EntityFormModal open={showEditEntity} onOpenChange={setShowEditEntity} editingEntity={entity} />
      <DirectorFormModal open={showAddDirector} onOpenChange={setShowAddDirector} entityId={entity.id} editingDirector={editingDirector} />
      <ShareholderFormModal open={showAddShareholder} onOpenChange={setShowAddShareholder} entityId={entity.id} editingShareholder={editingShareholder} />
      <ShareClassFormModal open={showAddShareClass} onOpenChange={setShowAddShareClass} entityId={entity.id} editingShareClass={editingShareClass} />
    </AppLayout>
  );
}
