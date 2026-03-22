import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────

export type ExportPhase = 'idle' | 'loading' | 'downloading' | 'zipping' | 'complete' | 'error';

export interface ExportProgress {
  phase: ExportPhase;
  currentStep: string;
  completed: number;
  total: number;
  percent: number;
  downloaded: number;
  skipped: number;
  errors: string[];
}

const INITIAL: ExportProgress = {
  phase: 'idle',
  currentStep: '',
  completed: 0,
  total: 0,
  percent: 0,
  downloaded: 0,
  skipped: 0,
  errors: [],
};

interface ComplianceExportDocumentRow {
  id: string;
  file_url: string | null;
  original_file_name: string | null;
  is_current: boolean | null;
  archived_at: string | null;
}

interface ComplianceExportPropertyRow {
  address_line: string | null;
  postcode: string | null;
}

interface ComplianceExportItemRow {
  compliance_type: string;
  properties: ComplianceExportPropertyRow | null;
  documents: ComplianceExportDocumentRow[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function sanitiseFolder(text: string): string {
  return text
    .replace(/[,.\\/:"*?<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function typeFolder(complianceType: string): string {
  return complianceType.replace(/\s+/g, '-');
}

function extractStoragePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/compliance\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// ─── Hook ────────────────────────────────────────────────────────

export function useComplianceDocumentExport() {
  const [progress, setProgress] = useState<ExportProgress>(INITIAL);
  const abortRef = useRef(false);

  const patch = useCallback(
    (partial: Partial<ExportProgress>) => setProgress(prev => ({ ...prev, ...partial })),
    [],
  );

  const startExport = useCallback(async (options?: { propertyId?: string }) => {
    abortRef.current = false;
    const errors: string[] = [];

    // ── Phase 1: Load data ─────────────────────────────────

    patch({ ...INITIAL, phase: 'loading', currentStep: 'Loading compliance data…' });

    let query = supabase
      .from('compliance_items')
      .select(`
        id,
        compliance_type,
        expiry_date,
        property_id,
        is_required,
        is_manually_excluded,
        properties!inner(address_line, postcode),
        documents:compliance_documents(
          id,
          file_url,
          original_file_name,
          file_type,
          is_current,
          archived_at
        )
      `)
      .order('property_id');

    if (options?.propertyId) {
      query = query.eq('property_id', options.propertyId);
    }

    const { data: items, error: queryError } = await query;

    if (queryError) {
      patch({ phase: 'error', currentStep: `Query failed: ${queryError.message}` });
      return;
    }

    if (!items || items.length === 0) {
      patch({ phase: 'error', currentStep: 'No compliance items found' });
      return;
    }

    interface DocEntry {
      fileUrl: string;
      fileName: string;
      propertyAddress: string;
      postcode: string | null;
      complianceType: string;
    }

    const docsToDownload: DocEntry[] = [];

    for (const item of (items ?? []) as ComplianceExportItemRow[]) {
      const currentDocs = (item.documents ?? []).filter(
        (document) => document.is_current && !document.archived_at && document.file_url
      );

      if (currentDocs.length === 0) continue;

      const property = item.properties;
      if (!property) continue;

      for (const doc of currentDocs) {
        docsToDownload.push({
          fileUrl: doc.file_url,
          fileName: doc.original_file_name || `document-${doc.id}.pdf`,
          propertyAddress: property.address_line || 'Unknown-Property',
          postcode: property.postcode || null,
          complianceType: item.compliance_type,
        });
      }
    }

    if (docsToDownload.length === 0) {
      patch({ phase: 'error', currentStep: 'No compliance documents found to download' });
      return;
    }

    // ── Phase 2: Download files ────────────────────────────

    patch({
      phase: 'downloading',
      currentStep: `Downloading 0 of ${docsToDownload.length} documents…`,
      total: docsToDownload.length,
      completed: 0,
      percent: 0,
    });

    const zip = new JSZip();
    const dateStr = new Date().toISOString().split('T')[0];
    const rootFolder = `compliance-documents-${dateStr}`;

    let downloaded = 0;
    let skipped = 0;

    const usedNames = new Map<string, Set<string>>();

    for (let i = 0; i < docsToDownload.length; i++) {
      if (abortRef.current) break;

      const entry = docsToDownload[i];

      patch({
        currentStep: `Downloading ${i + 1} of ${docsToDownload.length}: ${entry.complianceType}`,
        completed: i,
        percent: Math.round((i / docsToDownload.length) * 90),
      });

      const propFolder = sanitiseFolder(
        entry.postcode
          ? `${entry.propertyAddress} ${entry.postcode}`
          : entry.propertyAddress
      );
      const compFolder = typeFolder(entry.complianceType);
      const folderPath = `${rootFolder}/${propFolder}/${compFolder}`;

      const folderKey = folderPath;
      if (!usedNames.has(folderKey)) usedNames.set(folderKey, new Set());
      let finalName = entry.fileName;
      const names = usedNames.get(folderKey)!;
      if (names.has(finalName)) {
        const ext = finalName.includes('.') ? '.' + finalName.split('.').pop() : '';
        const base = finalName.replace(ext, '');
        let counter = 2;
        while (names.has(`${base}_${counter}${ext}`)) counter++;
        finalName = `${base}_${counter}${ext}`;
      }
      names.add(finalName);

      try {
        const storagePath = extractStoragePath(entry.fileUrl);
        let blob: Blob | null = null;

        if (storagePath) {
          const { data, error: dlError } = await supabase.storage
            .from('compliance')
            .download(storagePath);

          if (dlError) throw dlError;
          blob = data;
        } else {
          const response = await fetch(entry.fileUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          blob = await response.blob();
        }

        if (blob) {
          zip.file(`${folderPath}/${finalName}`, blob);
          downloaded++;
        } else {
          throw new Error('Empty response');
        }
      } catch (error) {
        skipped++;
        errors.push(`${entry.propertyAddress} / ${entry.complianceType}: ${getErrorMessage(error)}`);
      }
    }

    if (abortRef.current) {
      patch({ ...INITIAL });
      return;
    }

    if (downloaded === 0) {
      patch({ phase: 'error', currentStep: 'All downloads failed', errors });
      return;
    }

    // ── Phase 3: Build ZIP ─────────────────────────────────

    patch({
      phase: 'zipping',
      currentStep: 'Building ZIP archive…',
      percent: 92,
      downloaded,
      skipped,
    });

    try {
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          patch({ percent: 92 + Math.round(meta.percent * 0.08) });
        },
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rootFolder}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();

      patch({
        phase: 'complete',
        currentStep: `Done — ${downloaded} document${downloaded !== 1 ? 's' : ''} downloaded`,
        percent: 100,
        completed: docsToDownload.length,
        downloaded,
        skipped,
        errors,
      });
    } catch (error) {
      patch({ phase: 'error', currentStep: `ZIP creation failed: ${getErrorMessage(error)}`, errors });
    }
  }, [patch]);

  const cancelExport = useCallback(() => {
    abortRef.current = true;
    setProgress(INITIAL);
  }, []);

  const resetExport = useCallback(() => {
    setProgress(INITIAL);
  }, []);

  return { progress, startExport, cancelExport, resetExport };
}
