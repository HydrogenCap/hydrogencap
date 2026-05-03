import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { generateStructuredFilename } from '@/lib/documentNaming';

export type RenamePhase = 'idle' | 'scanning' | 'renaming' | 'complete' | 'error';

export interface RenameProgress {
  phase: RenamePhase;
  currentStep: string;
  completed: number;
  total: number;
  renamed: number;
  skipped: number;
  warnings: string[];
}

const INITIAL: RenameProgress = {
  phase: 'idle',
  currentStep: '',
  completed: 0,
  total: 0,
  renamed: 0,
  skipped: 0,
  warnings: [],
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

export function useBatchRenameDocuments() {
  const [progress, setProgress] = useState<RenameProgress>(INITIAL);
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

  const patch = useCallback(
    (partial: Partial<RenameProgress>) => setProgress(prev => ({ ...prev, ...partial })),
    [],
  );

  const startRename = useCallback(async (options: { overwriteExisting: boolean }) => {
    abortRef.current = false;
    const warnings: string[] = [];

    // Phase 1: Scan
    patch({ ...INITIAL, phase: 'scanning', currentStep: 'Scanning documents…' });

    let query = supabaseAny
      .from('documents')
      .select(`
        id,
        original_file_name,
        display_name,
        final_file_name,
        category,
        document_date,
        created_at,
        property_id,
        company_id,
        tenant_id,
        tenancy_id,
        contractor_job_id,
        deleted_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!options.overwriteExisting) {
      query = query.is('final_file_name', null);
    }

    const { data: documents, error } = await query;

    if (error) {
      patch({ phase: 'error', currentStep: `Failed to load documents: ${error.message}` });
      return;
    }

    if (!documents || documents.length === 0) {
      patch({
        phase: 'complete',
        currentStep: 'All documents already have structured filenames.',
        total: 0,
        renamed: 0,
      });
      return;
    }

    // Prefetch entity lookup tables
    patch({ currentStep: 'Loading properties, companies, and tenants…' });

    const propertyIds = [...new Set(documents.map(d => d.property_id).filter(Boolean))] as string[];
    const propertyMap = new Map<string, string>();
    if (propertyIds.length > 0) {
      const { data: props } = await supabaseAny
        .from('properties_v2')
        .select('id, address_line_1')
        .in('id', propertyIds);
      props?.forEach(p => { if (p.address_line_1) propertyMap.set(p.id, p.address_line_1); });
    }

    const companyIds = [...new Set(documents.map(d => d.company_id).filter(Boolean))] as string[];
    const companyMap = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: comps } = await supabaseAny
        .from('companies')
        .select('id, legal_name')
        .in('id', companyIds);
      comps?.forEach(c => { if (c.legal_name) companyMap.set(c.id, c.legal_name); });
    }

    const tenantIds = [...new Set(documents.map(d => d.tenant_id).filter(Boolean))] as string[];
    const tenantMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: tenants } = await supabaseAny
        .from('tenants')
        .select('id, first_name, last_name')
        .in('id', tenantIds);
      tenants?.forEach(t => {
        const name = [t.first_name, t.last_name].filter(Boolean).join(' ');
        if (name) tenantMap.set(t.id, name);
      });
    }

    // Resolve tenancies → property addresses
    const tenancyIds = documents
      .filter(d => !d.property_id && d.tenancy_id)
      .map(d => d.tenancy_id)
      .filter(Boolean) as string[];
    const tenancyPropertyMap = new Map<string, string>();
    if (tenancyIds.length > 0) {
      const { data: tenancies } = await supabaseAny
        .from('tenancies')
        .select('id, property_id')
        .in('id', [...new Set(tenancyIds)]);
      tenancies?.forEach(t => {
        if (t.property_id) {
          const addr = propertyMap.get(t.property_id);
          if (addr) tenancyPropertyMap.set(t.id, addr);
        }
      });
    }

    // Resolve jobs → property addresses
    const jobIds = documents
      .filter(d => !d.property_id && d.contractor_job_id)
      .map(d => d.contractor_job_id)
      .filter(Boolean) as string[];
    const jobPropertyMap = new Map<string, string>();
    if (jobIds.length > 0) {
      const { data: jobs } = await supabaseAny
        .from('contractor_jobs')
        .select('id, property_id')
        .in('id', [...new Set(jobIds)]);
      jobs?.forEach(j => {
        if (j.property_id) {
          const addr = propertyMap.get(j.property_id);
          if (addr) jobPropertyMap.set(j.id, addr);
        }
      });
    }

    // Phase 2: Rename
    patch({
      phase: 'renaming',
      currentStep: `Renaming ${documents.length} documents…`,
      total: documents.length,
      completed: 0,
    });

    let renamed = 0;
    let skipped = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      if (abortRef.current) break;

      const batch = documents.slice(i, i + BATCH_SIZE);
      const updates: Array<{ id: string; final_file_name: string; renamed_at: string }> = [];

      for (const doc of batch) {
        let propertyAddress = doc.property_id ? propertyMap.get(doc.property_id) || null : null;
        const companyName = doc.company_id ? companyMap.get(doc.company_id) || null : null;
        const tenantName = doc.tenant_id ? tenantMap.get(doc.tenant_id) || null : null;

        if (!propertyAddress && doc.tenancy_id) {
          propertyAddress = tenancyPropertyMap.get(doc.tenancy_id) || null;
        }
        if (!propertyAddress && doc.contractor_job_id) {
          propertyAddress = jobPropertyMap.get(doc.contractor_job_id) || null;
        }

        const newName = generateStructuredFilename({
          category: doc.category,
          displayName: doc.display_name,
          originalFilename: doc.original_file_name,
          documentDate: doc.document_date,
          createdAt: doc.created_at,
          propertyAddress,
          companyName,
          tenantName,
        });

        if (doc.final_file_name === newName) {
          skipped++;
          continue;
        }

        updates.push({
          id: doc.id,
          final_file_name: newName,
          renamed_at: new Date().toISOString(),
        });
      }

      for (const update of updates) {
        try {
          await supabaseAny
            .from('documents')
            .update({
              final_file_name: update.final_file_name,
              renamed_at: update.renamed_at,
            })
            .eq('id', update.id);

          // Mirror the rename to any linked compliance register row so the
          // Compliance page picks up the cleaner label without a hard refresh.
          const { data: doc } = await supabaseAny
            .from('documents')
            .select('file_url, property_id')
            .eq('id', update.id)
            .maybeSingle();
          if (doc?.file_url && doc?.property_id) {
            await supabaseAny
              .from('compliance_documents_v2')
              .update({ file_name: update.final_file_name })
              .eq('property_id', doc.property_id)
              .eq('file_url', doc.file_url);
          }

          renamed++;
        } catch (error: unknown) {
          warnings.push(`Failed to rename ${update.id}: ${getErrorMessage(error)}`);
        }
      }

      skipped += batch.length - updates.length;

      patch({
        completed: Math.min(i + BATCH_SIZE, documents.length),
        renamed,
        skipped,
        currentStep: `Renamed ${renamed} of ${documents.length}…`,
        warnings: [...warnings],
      });
    }

    if (abortRef.current) {
      patch({ phase: 'idle', currentStep: 'Cancelled.' });
      return;
    }

    patch({
      phase: 'complete',
      currentStep: `Done — ${renamed} renamed, ${skipped} already up to date.`,
      completed: documents.length,
      renamed,
      skipped,
      warnings: [...warnings],
    });

    // Refresh dependent queries so the UI reflects new labels immediately.
    queryClient.invalidateQueries({ queryKey: ['managed-documents'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-documents-v2'] });
    queryClient.invalidateQueries({ queryKey: ['compliance_matrix_v2_stats'] });
  }, [patch, queryClient]);

  const cancelRename = useCallback(() => { abortRef.current = true; }, []);
  const resetRename = useCallback(() => setProgress(INITIAL), []);

  return { progress, startRename, cancelRename, resetRename };
}
