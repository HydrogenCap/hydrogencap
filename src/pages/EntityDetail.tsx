import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, Building2, User, Handshake, Shield, Home, AlertCircle, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/hooks/useLegalEntities';
import { useCompaniesHouse } from '@/hooks/useCompaniesHouse';
import { useEntityVerification, useSyncEntity } from '@/hooks/useCompaniesHouseV2';
import { useToast } from '@/hooks/use-toast';
import { EntityFormModal } from '@/components/entities/EntityFormModal';
import { DirectorFormModal } from '@/components/entities/DirectorFormModal';
import { ShareholderFormModal } from '@/components/entities/ShareholderFormModal';
import { CHVerificationBanner } from '@/components/entities/CHVerificationBanner';
import { CHDataPanel } from '@/components/entities/CHDataPanel';
import { ComplianceFilingsCard } from '@/components/companies/ComplianceFilingsCard';
import { useEntityPropertiesV2, PROPERTY_TYPES, LIFECYCLE_STAGES } from '@/hooks/usePropertiesV2';
import { format } from 'date-fns';
import { EntityFinancialSection } from '@/components/financials/EntityFinancialSection';
import { EntityInvestorSection } from '@/components/entities/EntityInvestorSection';
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
  const { data: entity, isLoading } = useLegalEntity(id);
  const { data: directors } = useEntityDirectors(id);
  const { data: shareholders } = useEntityShareholders(id);
  const { data: entityProperties } = useEntityPropertiesV2(id);
  const { data: verification } = useEntityVerification(id);
  const syncEntity = useSyncEntity();
  const deleteEntity = useDeleteLegalEntity();
  const deleteDirector = useDeleteDirector();
  const deleteShareholder = useDeleteShareholder();

  const { lookupCompany, isLookingUp } = useCompaniesHouse();
  const updateEntity = useUpdateLegalEntity();
  const hasAutoSynced = useRef(false);

  const [showEditEntity, setShowEditEntity] = useState(false);
  const [showAddDirector, setShowAddDirector] = useState(false);
  const [editingDirector, setEditingDirector] = useState<any>(null);
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<any>(null);

  // Auto-sync from CH if stale (>24hrs)
  const performAutoSync = useCallback(async () => {
    if (!entity?.company_number || isLookingUp || hasAutoSynced.current) return;

    const lastSynced = (entity as any).ch_last_synced_at ? new Date((entity as any).ch_last_synced_at as string) : null;
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
          } as any);
          toast({ title: 'Auto-synced from Companies House' });
        }
      } catch (err) {
        console.error('Auto-sync failed:', err);
      }
    }
  }, [entity, isLookingUp, lookupCompany, updateEntity, toast]);

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
        } as any);
        toast({ title: 'Synced from Companies House', description: 'Company details and compliance dates updated' });
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
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
  const issuedShares = entity.issued_shares;
  const sharesExceedIssued = issuedShares != null && totalShares > issuedShares;
  const percentExceeds100 = totalPercent > 100.01;

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
              {(entity as any).ch_company_status && (
                <Badge variant="outline" className="text-xs">
                  CH: {(entity as any).ch_company_status}
                </Badge>
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
                {(entity as any).ch_last_synced_at && (
                  <div>
                    <span className="text-muted-foreground">Last CH Sync</span>
                    <p className="font-medium">{formatDate((entity as any).ch_last_synced_at)}</p>
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
              accounts_due_date: (entity as any).accounts_due_date,
              accounts_period_end: (entity as any).accounts_period_end,
              accounts_last_filed_date: (entity as any).accounts_last_filed_date,
              confirmation_statement_due_date: (entity as any).confirmation_statement_due_date,
              confirmation_statement_last_made_up_to: (entity as any).confirmation_statement_last_made_up_to,
              confirmation_statement_last_filed_date: (entity as any).confirmation_statement_last_filed_date,
              ch_last_synced_at: (entity as any).ch_last_synced_at,
              company_number: entity.company_number,
            }}
            onUpdate={async (updates) => {
              await updateEntity.mutateAsync({ id: entity.id, ...updates } as any);
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
                              } catch (err: any) {
                                toast({ title: 'Error', description: err.message, variant: 'destructive' });
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

        {/* Shareholders Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Shareholders</CardTitle>
              {issuedShares != null && (
                <span className="text-sm text-muted-foreground font-normal">
                  {issuedShares.toLocaleString()} shares issued
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => { setEditingShareholder(null); setShowAddShareholder(true); }}>
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
                              } catch (err: any) {
                                toast({ title: 'Error', description: err.message, variant: 'destructive' });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      <span className={sharesExceedIssued ? 'text-destructive' : ''}>
                        {totalShares.toLocaleString()}
                        {issuedShares != null && (
                          <span className="font-normal text-muted-foreground"> / {issuedShares.toLocaleString()}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={percentExceeds100 ? 'text-destructive' : ''}>
                        {totalPercent.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                  {(sharesExceedIssued || percentExceeds100) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-destructive text-sm py-2">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {sharesExceedIssued && `Total shares held (${totalShares.toLocaleString()}) exceeds issued shares (${issuedShares!.toLocaleString()}). `}
                        {percentExceeds100 && `Total ownership (${totalPercent.toFixed(2)}%) exceeds 100%.`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-6">No shareholders added yet.</p>
            )}
          </CardContent>
        </Card>

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
    </AppLayout>
  );
}
