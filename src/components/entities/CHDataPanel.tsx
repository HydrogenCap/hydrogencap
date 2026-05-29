import { useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Clock, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EntityVerification, useCHOfficers, useCHFilingHistory } from '@/hooks/useCompaniesHouseV2';
import { EntityDirector, LegalEntity } from '@/hooks/useLegalEntities';
import { useUpdateLegalEntity, useCreateDirector } from '@/hooks/useLegalEntities';
import { format } from 'date-fns';
import { toast } from "sonner";

interface Props {
  entityId: string;
  companyNumber: string | null;
  verification: EntityVerification | null;
  localDirectors: EntityDirector[];
}

type LegalEntityUpdateInput = Partial<LegalEntity> & { id: string };
type UpdatableField = 'entity_name' | 'status' | 'incorporation_date' | 'registered_address';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function MatchBadge({ match }: { match: boolean }) {
  return match
    ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> Match</span>
    : <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Mismatch</span>;
}

function FilingBadge({ status, dueDate }: { status: string; dueDate: string | null }) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  const formatted = format(new Date(dueDate), 'dd/MM/yyyy');
  if (status === 'overdue') return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{formatted}</Badge>;
  if (status === 'due_soon') return <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1"><Clock className="h-3 w-3" />{formatted}</Badge>;
  return <Badge variant="outline" className="border-emerald-300 text-emerald-700">{formatted}</Badge>;
}

function normalizeForCompare(s: string | null): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function CHDataPanel({ entityId, companyNumber, verification, localDirectors }: Props) {
  const [showFilings, setShowFilings] = useState(false);
  const { data: chOfficers = [] } = useCHOfficers(entityId, companyNumber);
  const { data: chFilings = [] } = useCHFilingHistory(entityId, companyNumber);
  const updateEntity = useUpdateLegalEntity();
  const createDirector = useCreateDirector();
  if (!companyNumber || !verification || verification.verification_status === 'not_synced') {
    return null;
  }

  const v = verification;

  // Build comparison rows
  const nameMatch = normalizeForCompare(v.entity_name) === normalizeForCompare(v.ch_company_name);
  const statusMatch = normalizeForCompare(v.local_status) === normalizeForCompare(v.ch_company_status);
  const incorpMatch = v.local_incorporation_date === v.ch_incorporation_date;
  
  const chAddress = [v.ch_address_line_1, v.ch_postcode].filter(Boolean).join(', ');
  const addressMatch = normalizeForCompare(v.local_registered_address).includes(normalizeForCompare(v.ch_postcode));

  const handleUpdateField = async (field: UpdatableField, value: string) => {
    try {
      let updates: LegalEntityUpdateInput;
      switch (field) {
        case 'entity_name':
          updates = { id: entityId, entity_name: value };
          break;
        case 'status':
          updates = { id: entityId, status: value as LegalEntity['status'] };
          break;
        case 'incorporation_date':
          updates = { id: entityId, incorporation_date: value };
          break;
        case 'registered_address':
          updates = { id: entityId, registered_address: value };
          break;
      }
      await updateEntity.mutateAsync(updates);
      toast.success(`${field.replace('_', ' ')} updated from Companies House`);
    } catch (err: unknown) {
      toast.error("Field didn't save", { description: getErrorMessage(err) });
    }
  };

  const handleImportOfficers = async () => {
    const activeOfficers = chOfficers.filter(o => !o.resigned_on);
    let imported = 0;
    for (const officer of activeOfficers) {
      const alreadyExists = localDirectors.some(d => namesMatch(d.director_name, officer.name));
      if (!alreadyExists) {
        try {
          await createDirector.mutateAsync({
            entity_id: entityId,
            director_name: officer.name,
            appointment_date: officer.appointed_on || new Date().toISOString().split('T')[0],
            resignation_date: null,
            is_current: true,
          });
          imported++;
        } catch (err) {
          console.error('Failed to import officer:', officer.name, err);
          toast.error('Officer import failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
        }
      }
    }
    toast.success(imported > 0 ? `${imported} officer(s) added from Companies House` : "Already up to date — every officer's on file");
  };

  const handleImportAll = async () => {
    const updates: LegalEntityUpdateInput = { id: entityId };
    if (v.ch_company_name) updates.entity_name = v.ch_company_name;
    if (v.ch_incorporation_date) updates.incorporation_date = v.ch_incorporation_date;
    if (chAddress) updates.registered_address = chAddress;
    if (v.ch_company_status) {
      const statusMap: Record<string, LegalEntity['status']> = {
        active: 'active',
        dissolved: 'dissolved',
        liquidation: 'dissolved',
      };
      updates.status = statusMap[v.ch_company_status] ?? v.local_status as LegalEntity['status'];
    }
    try {
      await updateEntity.mutateAsync(updates);
      await handleImportOfficers();
      toast.success('Synced from Companies House');
    } catch (err: unknown) {
      toast.error("Sync didn't complete", { description: getErrorMessage(err) });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Companies House Data</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleImportOfficers} disabled={createDirector.isPending}>
            {createDirector.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            <Download className="h-3 w-3 mr-1" /> Import Officers
          </Button>
          <Button size="sm" onClick={handleImportAll} disabled={updateEntity.isPending}>
            {updateEntity.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            <Download className="h-3 w-3 mr-1" /> Import All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comparison Table */}
        <div>
          <h4 className="text-sm font-medium mb-2">Company Profile</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Tenure IQ</TableHead>
                <TableHead>Companies House</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Company Name</TableCell>
                <TableCell>{v.entity_name}</TableCell>
                <TableCell>{v.ch_company_name || '—'}</TableCell>
                <TableCell><MatchBadge match={nameMatch} /></TableCell>
                <TableCell>
                  {!nameMatch && v.ch_company_name && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUpdateField('entity_name', v.ch_company_name!)}>
                      Update Local
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Status</TableCell>
                <TableCell className="capitalize">{v.local_status}</TableCell>
                <TableCell className="capitalize">{v.ch_company_status || '—'}</TableCell>
                <TableCell><MatchBadge match={statusMatch} /></TableCell>
                <TableCell>
                  {!statusMatch && v.ch_company_status && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                      const map: Record<string, string> = { active: 'active', dissolved: 'dissolved', liquidation: 'dissolved' };
                      handleUpdateField('status', map[v.ch_company_status!] || v.local_status);
                    }}>
                      Update Local
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Incorporation Date</TableCell>
                <TableCell>{v.local_incorporation_date || '—'}</TableCell>
                <TableCell>{v.ch_incorporation_date || '—'}</TableCell>
                <TableCell><MatchBadge match={incorpMatch} /></TableCell>
                <TableCell>
                  {!incorpMatch && v.ch_incorporation_date && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUpdateField('incorporation_date', v.ch_incorporation_date!)}>
                      Update Local
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Registered Address</TableCell>
                <TableCell className="max-w-48 truncate">{v.local_registered_address || '—'}</TableCell>
                <TableCell className="max-w-48 truncate">{chAddress || '—'}</TableCell>
                <TableCell><MatchBadge match={addressMatch} /></TableCell>
                <TableCell>
                  {!addressMatch && chAddress && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUpdateField('registered_address', chAddress)}>
                      Update Local
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Filing Status */}
        <div>
          <h4 className="text-sm font-medium mb-2">Filing Status</h4>
          {(v.accounts_filing_status === 'overdue' || v.confirmation_filing_status === 'overdue') && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 mb-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>OVERDUE FILING:</strong>{' '}
                {v.accounts_filing_status === 'overdue' && `Annual accounts were due ${v.ch_accounts_next_due}. `}
                {v.confirmation_filing_status === 'overdue' && `Confirmation statement was due ${v.ch_confirmation_next_due}. `}
                This may result in Companies House striking off the company.
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Annual Accounts Due</span>
              <div className="mt-1"><FilingBadge status={v.accounts_filing_status} dueDate={v.ch_accounts_next_due} /></div>
            </div>
            <div>
              <span className="text-muted-foreground">Confirmation Statement Due</span>
              <div className="mt-1"><FilingBadge status={v.confirmation_filing_status} dueDate={v.ch_confirmation_next_due} /></div>
            </div>
          </div>
        </div>

        {/* Officers Cross-Reference */}
        {chOfficers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Officers (Companies House)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Appointed</TableHead>
                  <TableHead>Local Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chOfficers.filter(o => !o.resigned_on).map((officer, i) => {
                  const localMatch = localDirectors.some(d => namesMatch(d.director_name, officer.name));
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{officer.name}</TableCell>
                      <TableCell className="capitalize">{officer.officer_role?.replace(/-/g, ' ')}</TableCell>
                      <TableCell>{officer.appointed_on || '—'}</TableCell>
                      <TableCell>
                        {localMatch
                          ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Found</span>
                          : <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Not in local records</span>
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Filing History (collapsed) */}
        {chFilings.length > 0 && (
          <Collapsible open={showFilings} onOpenChange={setShowFilings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-sm">
                {showFilings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Filing History ({chFilings.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chFilings.slice(0, 10).map((filing, i) => (
                    <TableRow key={i}>
                      <TableCell>{filing.date}</TableCell>
                      <TableCell>{filing.description}</TableCell>
                      <TableCell className="text-muted-foreground">{filing.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
