import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, Plus, Building2, User, Handshake, Shield, Home, AlertCircle, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useLegalEntity,
  useEntityDirectors,
  useEntityShareholders,
  useDeleteLegalEntity,
  useDeleteDirector,
  useDeleteShareholder,
  useUpdateLegalEntity,
  useCreateDirector,
  useCreateShareholder,
  type EntityDirector,
  type EntityShareholder,
} from '@/hooks/useLegalEntities';
import {
  useShareClassesWithAllocation,
  useDeleteShareClass,
  validateShareIntegrity,
  type ShareClassWithAllocation,
} from '@/hooks/useShareCapital';
import { supabase } from '@/integrations/supabase/client';
import { useCompaniesHouse, type CHLookupResult } from '@/hooks/useCompaniesHouse';
import { useEntityVerification, useSyncEntity } from '@/hooks/useCompaniesHouseV2';
import { useFreeAgentConnectionForEntity } from '@/hooks/useFreeAgentIntegration';
import { useToast } from '@/hooks/use-toast';
import { EntityFormModal } from '@/components/entities/EntityFormModal';
import { DirectorFormModal } from '@/components/entities/DirectorFormModal';
import { ShareholderFormModal } from '@/components/entities/ShareholderFormModal';
import { ShareClassFormModal } from '@/components/entities/ShareClassFormModal';
import { CHVerificationBanner } from '@/components/entities/CHVerificationBanner';
import { CHDataPanel } from '@/components/entities/CHDataPanel';
import { ComplianceFilingsCard } from '@/components/companies/ComplianceFilingsCard';
import { useEntityPropertiesV2, PROPERTY_TYPES, LIFECYCLE_STAGES } from '@/hooks/usePropertiesV2';
import { format } from 'date-fns';
import { EntityFinancialSection } from '@/components/financials/EntityFinancialSection';
import { EntityInvestorSection } from '@/components/entities/EntityInvestorSection';
import { EntityOwnershipCard } from '@/components/entities/EntityOwnershipCard';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';
import { EntityAccountingSection } from '@/components/accounting/EntityAccountingSection';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  spv: Building2,
  personal: User,
  joint_venture: Handshake,
  trust: Shield,
};

const TYPE_LABELS: Record<string, string> = {
  spv: 'SPV',
  personal: 'Personal',
  joint_venture: 'Joint Venture',
  trust: 'Trust',
};

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  dormant: 'bg-muted text-muted-foreground border-border',
  dissolved: 'bg-destructive/10 text-destructive border-destructive/20',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: entity, isLoading } = useLegalEntity(id);
  const { data: directors } = useEntityDirectors(id);
  const { data: shareholders } = useEntityShareholders(id);
  const { data: entityProperties } = useEntityPropertiesV2(id);
  const { data: verification } = useEntityVerification(id);
  const { data: shareClassesWithAllocation } = useShareClassesWithAllocation(id);
  const deleteShareClassMutation = useDeleteShareClass();
  const syncEntity = useSyncEntity();
  const deleteEntity = useDeleteLegalEntity();
  const deleteDirector = useDeleteDirector();
  const deleteShareholder = useDeleteShareholder();
  const createDirector = useCreateDirector();
  const createShareholder = useCreateShareholder();

  const { lookupCompany, isLookingUp } = useCompaniesHouse();
  const updateEntity = useUpdateLegalEntity();
  const { data: freeAgentConnection } = useFreeAgentConnectionForEntity(id || '');

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'An unexpected error occurred';

  // Share capital integrity
  const integrityErrors = shareClassesWithAllocation
    ? validateShareIntegrity(shareClassesWithAllocation)
    : [];

  // Import officers & PSCs from CH result, skipping duplicates
  const importFromCH = useCallback(async (
    result: CHLookupResult,
    entityId: string,
    existingDirectors: typeof directors,
    existingShareholders: typeof shareholders,
  ) => {
    const imported = { directors: 0, shareholders: 0 };

    if (result.officers?.length) {
      const existingNames = new Set((existingDirectors || []).map(d => d.director_name.toLowerCase()));
      for (const officer of result.officers) {
        if (existingNames.has(officer.name.toLowerCase())) continue;
        try {
          await createDirector.mutateAsync({
            entity_id: entityId,
            director_name: officer.name,
            appointment_date: officer.appointed_on || new Date().toISOString().slice(0, 10),
            resignation_date: null,
            is_current: true,
          });
          imported.directors++;
        } catch (e) {
          console.error('Failed to import director:', officer.name, e);
        }
      }
    }

    if (result.significant_controllers?.length) {
      const existingNames = new Set((existingShareholders || []).map(s => s.shareholder_name.toLowerCase()));
      for (const psc of result.significant_controllers) {
        if (existingNames.has(psc.name.toLowerCase())) continue;
        try {
          await createShareholder.mutateAsync({
            entity_id: entityId,
            shareholder_name: psc.name,
            share_class: 'Ordinary',
            shares_held: 0,
            percentage: 0,
            effective_date: psc.notified_on || new Date().toISOString().slice(0, 10),
          });
          imported.shareholders++;
        } catch (e) {
          console.error('Failed to import shareholder:', psc.name, e);
        }
      }
    }

    return imported;
  }, [createDirector, createShareholder]);
  const hasAutoSynced = useRef(false);

  const [showEditEntity, setShowEditEntity] = useState(false);
  const [showAddDirector, setShowAddDirector] = useState(false);
  const [editingDirector, setEditingDirector] = useState<EntityDirector | null>(null);
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<EntityShareholder | null>(null);
  const [showAddShareClass, setShowAddShareClass] = useState(false);
  const [editingShareClass, setEditingShareClass] = useState<ShareClassWithAllocation | null>(null);

  // Auto-sync from CH if stale (>24hrs)
  const performAutoSync = useCallback(async () => {
    if (!entity?.company_number || isLookingUp || hasAutoSynced.current) return;

    const lastSynced = entity.ch_last_synced_at ? new Date(entity.ch_last_synced_at) : null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (!lastSynced || lastSynced < twentyFourHoursAgo) {
      hasAutoSynced.current = true;
      try {
        const result = await lookupCompany(entity.company_number);
        if (result) {
          await updateEntity.mutateAsync({
            id: entity.id,
            registered_address: result.company.registered_address,
            incorporation_date: result.company.date_of_creation,
            ch_last_synced_at: new Date().toISOString(),
            ch_company_status: result.company.company_status,
            ch_company_type: result.company.company_type,
            accounts_due_date: result.compliance.accounts_due_date,
            accounts_period_end: result.compliance.accounts_period_end,
            accounts_last_filed_date: result.compliance.accounts_last_filed_date,
            confirmation_statement_due_date: result.compliance.confirmation_statement_due_date,
            confirmation_statement_last_made_up_to: result.compliance.confirmation_statement_last_made_up_to,
            confirmation_statement_last_filed_date: result.compliance.confirmation_statement_last_filed_date,
          });
          const imported = await importFromCH(result, entity.id, directors, shareholders);
          const parts = [];
          if (imported.directors > 0) parts.push(`${imported.directors} director(s)`);
          if (imported.shareholders > 0) parts.push(`${imported.shareholders} shareholder(s)`);
          toast({ title: 'Auto-synced from Companies House', description: parts.length ? `Imported ${parts.join(' and ')}` : undefined });
        }
      } catch (err) {
        console.error('Auto-sync failed:', err);
      }
    }
  }, [entity, isLookingUp, lookupCompany, updateEntity, toast, importFromCH, directors, shareholders]);

  useEffect(() => {
    if (entity && !isLoading) {
      performAutoSync();
    }
  }, [entity, isLoading, performAutoSync]);

  const handleRefreshFromCH = async () => {
    if (!entity?.company_number) return;
    try {
      const result = await lookupCompany(entity.company_number);
      if (result) {
        await updateEntity.mutateAsync({
          id: entity.id,
          registered_address: result.company.registered_address,
          incorporation_date: result.company.date_of_creation,
          ch_last_synced_at: new Date().toISOString(),
          ch_company_status: result.company.company_status,
          ch_company_type: result.company.company_type,
          accounts_due_date: result.compliance.accounts_due_date,
          accounts_period_end: result.compliance.accounts_period_end,
          accounts_last_filed_date: result.compliance.accounts_last_filed_date,
          confirmation_statement_due_date: result.compliance.confirmation_statement_due_date,
          confirmation_statement_last_made_up_to: result.compliance.confirmation_statement_last_made_up_to,
          confirmation_statement_last_filed_date: result.compliance.confirmation_statement_last_filed_date,
        });
        const imported = await importFromCH(result, entity.id, directors, shareholders);
        const parts = [];
        if (imported.directors > 0) parts.push(`${imported.directors} director(s)`);
        if (imported.shareholders > 0) parts.push(`${imported.shareholders} shareholder(s)`);
        toast({ title: 'Synced from Companies House', description: `Company details updated${parts.length ? '. Imported ' + parts.join(' and ') : ''}` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to sync from Companies House', variant: 'destructive' });
    }
  };

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
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

  const TypeIcon = TYPE_ICONS[entity.entity_type] || Building2;
  const totalShares = shareholders?.reduce((s, sh) => s + sh.shares_held, 0) || 0;
  const totalPercent = shareholders?.reduce((s, sh) => s + Number(sh.percentage), 0) || 0;

  const showShareCapital = entity.entity_type === 'spv';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* CH Verification Banner */}
        {entity.entity_type === 'spv' && (
          <CHVerificationBanner
            verification={verification ?? null}
            isSyncing={syncEntity.isPending}
            onSync={() => entity.company_number && syncEntity.mutate({ entityId: entity.id, companyNumber: entity.company_number })}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/entities')} className="mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Entities
            </Button>
            <div className="flex items-center gap-3">
              <TypeIcon className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">{entity.entity_name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{TYPE_LABELS[entity.entity_type]}</Badge>
              <Badge variant="outline" className={STATUS_CLASSES[entity.status]}>
                {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
              </Badge>
              {entity.company_number && (
                <span className="text-sm text-muted-foreground font-mono">#{entity.company_number}</span>
              )}
              {entity.ch_company_status && (
                <Badge variant="outline" className="text-xs">
                  CH: {entity.ch_company_status}
                </Badge>
              )}
              {(['ltd', 'llp'] as string[]).includes(entity.entity_type) && (
                freeAgentConnection ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    FreeAgent Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    FreeAgent: Not connected
                  </Badge>
                )
              )}
              {entity.entity_type !== 'personal' && (
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    checked={entity.is_group_parent || false}
                    onCheckedChange={async (checked) => {
                      try {
                        if (checked) {
                          await supabase
                            .from('legal_entities')
                            .update({ is_group_parent: false })
                            .eq('org_id', entity.org_id)
                            .eq('is_group_parent', true);
                        }
                        await supabase
                          .from('legal_entities')
                          .update({ is_group_parent: checked })
                          .eq('id', entity.id);
                        queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
                        queryClient.invalidateQueries({ queryKey: ['legal_entity', entity.id] });
                        queryClient.invalidateQueries({ queryKey: ['ownership_data_v2'] });
                        toast({ title: checked ? 'Set as group parent' : 'Removed group parent status' });
                      } catch (error: unknown) {
                        toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                      }
                    }}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">Group parent</span>
                  {entity.is_group_parent && (
                    <Badge variant="default" className="text-[10px]">Group Parent</Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entity.company_number && (
              <Button variant="outline" onClick={handleRefreshFromCH} disabled={isLookingUp}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isLookingUp && 'animate-spin')} />
                Sync from CH
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditEntity(true)}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Entity?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{entity.entity_name}" and all its directors and shareholders. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEntity} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Entity Details */}
        {(entity.registered_address || entity.corporation_tax_ref || entity.vat_number || entity.incorporation_date || entity.notes || entity.company_number) && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {entity.incorporation_date && (
                  <div>
                    <span className="text-muted-foreground">Incorporation Date</span>
                    <p className="font-medium">{formatDate(entity.incorporation_date)}</p>
                  </div>
                )}
                {entity.registered_address && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Registered Address</span>
                    <p className="font-medium">{entity.registered_address}</p>
                  </div>
                )}
                {entity.corporation_tax_ref && (
                  <div>
                    <span className="text-muted-foreground">Corporation Tax Ref</span>
                    <p className="font-medium font-mono">{entity.corporation_tax_ref}</p>
                  </div>
                )}
                {entity.vat_registered && (
                  <div>
                    <span className="text-muted-foreground">VAT Number</span>
                    <p className="font-medium font-mono">{entity.vat_number || 'Registered (no number)'}</p>
                  </div>
                )}
                {entity.company_number && (
                  <div>
                    <span className="text-muted-foreground">Companies House</span>
                    <p>
                      <a
                        href={`https://find-and-update.company-information.service.gov.uk/company/${entity.company_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        View on Companies House ↗
                      </a>
                    </p>
                  </div>
                )}
                {entity.ch_last_synced_at && (
                  <div>
                    <span className="text-muted-foreground">Last CH Sync</span>
                    <p className="font-medium">{formatDate(entity.ch_last_synced_at)}</p>
                  </div>
                )}
                {entity.notes && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground">Notes</span>
                    <p className="font-medium">{entity.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Companies House Filings */}
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

        {/* Directors Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Directors</CardTitle>
            <Button size="sm" onClick={() => { setEditingDirector(null); setShowAddDirector(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Director
            </Button>
          </CardHeader>
          <CardContent>
            {directors && directors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Director Name</TableHead>
                    <TableHead>Appointment Date</TableHead>
                    <TableHead>Resignation Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directors.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.director_name}</TableCell>
                      <TableCell>{formatDate(d.appointment_date)}</TableCell>
                      <TableCell>{formatDate(d.resignation_date)}</TableCell>
                      <TableCell>
                        <Badge variant={d.is_current ? 'default' : 'secondary'}>
                          {d.is_current ? 'Current' : 'Resigned'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingDirector(d); setShowAddDirector(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={async () => {
                              try {
                                await deleteDirector.mutateAsync({ id: d.id, entityId: d.entity_id });
                                toast({ title: 'Director removed' });
                              } catch (error: unknown) {
                                toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-6">No directors added yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Share Capital — only for SPV entity types */}
        {showShareCapital && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Share Capital</CardTitle>
                <CardDescription>
                  Total issued shares: {shareClassesWithAllocation?.reduce((s, sc) => s + sc.issued_shares, 0).toLocaleString() || 0}
                  {' '}across {shareClassesWithAllocation?.length || 0} class{(shareClassesWithAllocation?.length || 0) !== 1 ? 'es' : ''}
                  {shareClassesWithAllocation && shareClassesWithAllocation.length > 0 && (
                    <span className="ml-2">
                      · Total capital: £{shareClassesWithAllocation.reduce((s, sc) => s + sc.issued_shares * (sc.nominal_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingShareClass(null); setShowAddShareClass(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Share Class
              </Button>
            </CardHeader>
            <CardContent>
              {integrityErrors.length > 0 && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Share Integrity Error
                  </div>
                  {integrityErrors.map(err => (
                    <p key={err.classId} className="text-xs text-destructive">{err.error}</p>
                  ))}
                </div>
              )}

              {shareClassesWithAllocation && shareClassesWithAllocation.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Unallocated</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareClassesWithAllocation.map(sc => (
                      <TableRow key={sc.id}>
                        <TableCell className="font-medium">
                          {sc.class_name}
                          {sc.is_primary && <Badge variant="secondary" className="ml-2 text-[10px]">Primary</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{sc.issued_shares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={sc.allocated_shares > sc.issued_shares ? 'text-destructive font-semibold' : ''}>
                            {sc.allocated_shares.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {sc.unallocated_shares >= 0 ? (
                            <span className="text-muted-foreground">{sc.unallocated_shares.toLocaleString()}</span>
                          ) : (
                            <span className="text-destructive">{sc.unallocated_shares.toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sc.nominal_value ? `£${sc.nominal_value}` : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingShareClass(sc); setShowAddShareClass(true); }}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={async () => {
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
                              }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-6">No share classes defined yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Shareholders Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Shareholders</CardTitle>
              {showShareCapital && shareClassesWithAllocation && shareClassesWithAllocation.length === 0 && (
                <CardDescription className="text-warning">
                  Add a share class above before adding shareholders
                </CardDescription>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => { setEditingShareholder(null); setShowAddShareholder(true); }}
              disabled={showShareCapital && (!shareClassesWithAllocation || shareClassesWithAllocation.length === 0)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Shareholder
            </Button>
          </CardHeader>
          <CardContent>
            {shareholders && shareholders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shareholder Name</TableHead>
                    <TableHead>Share Class</TableHead>
                    <TableHead className="text-right">Shares Held</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareholders.map((sh) => (
                    <TableRow key={sh.id}>
                      <TableCell className="font-medium">{sh.shareholder_name}</TableCell>
                      <TableCell>{sh.share_class}</TableCell>
                      <TableCell className="text-right">{sh.shares_held.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(sh.percentage).toFixed(2)}%</TableCell>
                      <TableCell>{formatDate(sh.effective_date)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingShareholder(sh); setShowAddShareholder(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={async () => {
                              try {
                                await deleteShareholder.mutateAsync({ id: sh.id, entityId: sh.entity_id });
                                toast({ title: 'Shareholder removed' });
                              } catch (error: unknown) {
                                toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{totalShares.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={totalPercent > 100.01 ? 'text-destructive' : totalPercent >= 99.99 ? 'text-primary' : ''}>
                        {totalPercent.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-6">No shareholders added yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Ownership Structure (V2 Engine) */}
        <EntityOwnershipCard entityId={entity.id} entityName={entity.entity_name} />

        {/* Companies House Data */}
        {entity.entity_type === 'spv' && entity.company_number && (
          <CHDataPanel
            entityId={entity.id}
            companyNumber={entity.company_number}
            verification={verification ?? null}
            localDirectors={directors || []}
          />
        )}

        {/* Financial Summary */}
        <EntityFinancialSection entityId={entity.id} entityProperties={entityProperties} />

        {/* Accounting */}
        <EntityAccountingSection entityId={entity.id} entityName={entity.entity_name} />

        {/* Investor Capital */}
        <EntityInvestorSection entityId={entity.id} />

        {/* Change History */}
        <Card>
          <CardContent className="pt-4">
            <InlineAuditHistory tableName="legal_entities" recordId={id} title="Entity Change History" />
          </CardContent>
        </Card>

        {/* Properties */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Properties <Badge variant="secondary" className="ml-2">{entityProperties?.length || 0}</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            {entityProperties && entityProperties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {entityProperties.map(p => {
                  const typeLabel = PROPERTY_TYPES.find(t => t.value === p.property_type)?.label || p.property_type;
                  const stageLabel = LIFECYCLE_STAGES.find(s => s.value === p.lifecycle_stage)?.label || p.lifecycle_stage;
                  return (
                    <Card
                      key={p.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/properties-v2/${p.id}`)}
                    >
                      <CardContent className="pt-3 pb-2 space-y-1">
                        <p className="font-semibold text-sm text-foreground">{p.address_line_1}, {p.city}</p>
                        <p className="text-xs text-muted-foreground">{p.postcode}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                          <Badge variant="secondary" className="text-xs">{stageLabel}</Badge>
                          <span className="text-xs text-muted-foreground">{p.total_lettable_rooms || 0} rooms</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">
                No properties linked to this entity yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <EntityFormModal open={showEditEntity} onOpenChange={setShowEditEntity} editingEntity={entity} />
      <DirectorFormModal open={showAddDirector} onOpenChange={setShowAddDirector} entityId={entity.id} editingDirector={editingDirector} />
      <ShareholderFormModal open={showAddShareholder} onOpenChange={setShowAddShareholder} entityId={entity.id} editingShareholder={editingShareholder} />
      <ShareClassFormModal open={showAddShareClass} onOpenChange={setShowAddShareClass} entityId={entity.id} editingShareClass={editingShareClass} />
    </AppLayout>
  );
}
