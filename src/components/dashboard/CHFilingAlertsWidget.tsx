import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEntityVerificationStatus, type EntityVerification } from '@/hooks/useCompaniesHouseV2';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';

function FilingRow({ label, dueDate, status }: { label: string; dueDate: string | null; status: string }) {
  if (!dueDate) return null;
  const date = parseISO(dueDate);
  const daysUntil = differenceInDays(date, new Date());

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-medium",
          status === 'overdue' && 'text-destructive',
          status === 'due_soon' && 'text-warning',
          status === 'ok' && 'text-muted-foreground',
        )}>
          {format(date, 'dd MMM yyyy')}
        </span>
        {status === 'overdue' && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>}
        {status === 'due_soon' && (
          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30 text-[10px] px-1.5 py-0">
            {daysUntil}d
          </Badge>
        )}
      </div>
    </div>
  );
}

function EntityRow({ entity }: { entity: EntityVerification }) {
  const hasIssue = entity.accounts_filing_status !== 'ok' || entity.confirmation_filing_status !== 'ok' || entity.verification_status === 'status_mismatch';

  return (
    <Link
      to={`/entities/${entity.entity_id}`}
      className={cn(
        "block p-3 rounded-lg border transition-colors hover:bg-muted/50",
        hasIssue ? "border-warning/30 bg-warning/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm truncate">{entity.entity_name}</span>
        {entity.verification_status === 'status_mismatch' && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">Mismatch</Badge>
        )}
        {entity.verification_status === 'not_synced' && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">Not synced</Badge>
        )}
      </div>
      <div className="space-y-1 pl-6">
        <FilingRow label="Accounts" dueDate={entity.ch_accounts_next_due} status={entity.accounts_filing_status} />
        <FilingRow label="Confirmation" dueDate={entity.ch_confirmation_next_due} status={entity.confirmation_filing_status} />
      </div>
    </Link>
  );
}

export function CHFilingAlertsWidget() {
  const { data: entities, isLoading } = useEntityVerificationStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Companies House</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  const allEntities = entities || [];
  const withIssues = allEntities.filter(e =>
    e.accounts_filing_status !== 'ok' || e.confirmation_filing_status !== 'ok' || e.verification_status === 'status_mismatch'
  );
  const notSynced = allEntities.filter(e => e.verification_status === 'not_synced' || e.verification_status === 'no_company_number');
  const verified = allEntities.filter(e => e.verification_status === 'verified' && e.accounts_filing_status === 'ok' && e.confirmation_filing_status === 'ok');

  // Sort: issues first, then not synced, then verified
  const sorted = [...withIssues, ...notSynced, ...verified];

  if (allEntities.length === 0) return null;

  const overdueCount = allEntities.filter(e => e.accounts_filing_status === 'overdue' || e.confirmation_filing_status === 'overdue').length;
  const dueSoonCount = allEntities.filter(e => e.accounts_filing_status === 'due_soon' || e.confirmation_filing_status === 'due_soon').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Companies House
          </CardTitle>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
            {dueSoonCount > 0 && (
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                {dueSoonCount} due soon
              </Badge>
            )}
            {overdueCount === 0 && dueSoonCount === 0 && withIssues.length === 0 && (
              <Badge variant="secondary" className="bg-success/10 text-success border-success/30">
                All clear
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-2">
            {sorted.map(entity => (
              <EntityRow key={entity.entity_id} entity={entity} />
            ))}
          </div>
        </ScrollArea>
        <div className="mt-3 pt-3 border-t">
          <Link
            to="/entities"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all entities <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
