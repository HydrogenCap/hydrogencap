import { useCallback, useEffect, useRef } from 'react';
import { useCompaniesHouse, type CHLookupResult } from '@/hooks/useCompaniesHouse';
import { useUpdateLegalEntity, useCreateDirector, useCreateShareholder } from '@/hooks/useLegalEntities';
import { useToast } from '@/hooks/use-toast';
import type { LegalEntity, EntityDirector, EntityShareholder } from '@/hooks/useLegalEntities';
import { logError } from '@/lib/errorLogger';

interface UseEntityCHSyncOptions {
  entity: LegalEntity | undefined;
  isLoading: boolean;
  directors: EntityDirector[] | undefined;
  shareholders: EntityShareholder[] | undefined;
}

export function useEntityCHSync({ entity, isLoading, directors, shareholders }: UseEntityCHSyncOptions) {
  const { lookupCompany, isLookingUp } = useCompaniesHouse();
  const updateEntity = useUpdateLegalEntity();
  const createDirector = useCreateDirector();
  const createShareholder = useCreateShareholder();
  const { toast } = useToast();
  const hasAutoSynced = useRef(false);

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
          logError({ source: 'useEntityCHSync.importDirector', message: 'Failed to import director from Companies House', severity: 'error', error: e });
          toast({ title: 'Error', description: `Failed to import director ${officer.name}`, variant: 'destructive' });
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
          logError({ source: 'useEntityCHSync.importShareholder', message: 'Failed to import shareholder from Companies House', severity: 'error', error: e });
          toast({ title: 'Error', description: `Failed to import shareholder ${psc.name}`, variant: 'destructive' });
        }
      }
    }

    return imported;
  }, [createDirector, createShareholder, toast]);

  const applyUpdateFromCH = useCallback(async (result: CHLookupResult, targetEntity: LegalEntity) => {
    await updateEntity.mutateAsync({
      id: targetEntity.id,
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
    return importFromCH(result, targetEntity.id, directors, shareholders);
  }, [updateEntity, importFromCH, directors, shareholders]);

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
          const imported = await applyUpdateFromCH(result, entity);
          const parts = [];
          if (imported.directors > 0) parts.push(`${imported.directors} director(s)`);
          if (imported.shareholders > 0) parts.push(`${imported.shareholders} shareholder(s)`);
          toast({ title: 'Auto-synced from Companies House', description: parts.length ? `Imported ${parts.join(' and ')}` : undefined });
        }
      } catch (err) {
        console.error('Failed to auto-sync entity from Companies House:', err);
        logError({ source: 'useEntityCHSync.autoSync', message: 'Auto-sync from Companies House failed', severity: 'error', error: err });
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to auto-sync from Companies House', variant: 'destructive' });
      }
    }
  }, [entity, isLookingUp, lookupCompany, applyUpdateFromCH, toast]);

  useEffect(() => {
    if (entity && !isLoading) {
      performAutoSync();
    }
  }, [entity, isLoading, performAutoSync]);

  const handleRefreshFromCH = useCallback(async () => {
    if (!entity?.company_number) return;
    try {
      const result = await lookupCompany(entity.company_number);
      if (result) {
        const imported = await applyUpdateFromCH(result, entity);
        const parts = [];
        if (imported.directors > 0) parts.push(`${imported.directors} director(s)`);
        if (imported.shareholders > 0) parts.push(`${imported.shareholders} shareholder(s)`);
        toast({ title: 'Synced from Companies House', description: `Company details updated${parts.length ? '. Imported ' + parts.join(' and ') : ''}` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to sync from Companies House', variant: 'destructive' });
    }
  }, [entity, lookupCompany, applyUpdateFromCH, toast]);

  return {
    isLookingUp,
    updateEntity,
    handleRefreshFromCH,
  };
}
