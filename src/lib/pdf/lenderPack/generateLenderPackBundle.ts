/**
 * Top-level orchestrator for the refinancing lender pack.
 *
 * Produces either a single combined PDF or a ZIP bundle containing
 * the PDF + every referenced vault document. Vault docs are streamed
 * from existing storage links — nothing is re-uploaded.
 */
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { buildLenderPackPdf } from './PortfolioLenderPack';
import { computePropertyChecklist, type VaultDocRef } from './checklist';
import type { MortgageBrokerPackData } from './context';

export type LenderPackOutput = 'pdf' | 'zip';

export interface GenerateLenderPackOptions {
  packs: MortgageBrokerPackData[];
  vaultDocs: VaultDocRef[];
  output: LenderPackOutput;
  /** Base filename without extension. */
  filenameBase?: string;
}

export interface GenerateLenderPackResult {
  blob: Blob;
  filename: string;
}

function sanitise(text: string): string {
  return text.replace(/[\\/:"*?<>|]+/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 60);
}

function extractStoragePath(fileUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(fileUrl);
    const m = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

async function downloadVaultDoc(fileUrl: string): Promise<Blob | null> {
  const parsed = extractStoragePath(fileUrl);
  if (parsed) {
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path);
    if (error) {
      console.warn(`Vault download failed for ${parsed.bucket}/${parsed.path}:`, error.message);
      return null;
    }
    return data;
  }
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch (err) {
    console.warn('Vault fetch failed:', err);
    return null;
  }
}

export async function generateLenderPack({
  packs,
  vaultDocs,
  output,
  filenameBase,
}: GenerateLenderPackOptions): Promise<GenerateLenderPackResult> {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const baseFromPacks = packs.length === 1
    ? sanitise(packs[0].property.address_line)
    : `Portfolio_${packs.length}_properties`;
  const base = sanitise(filenameBase ?? baseFromPacks);

  const pdfBlob = buildLenderPackPdf(packs);

  if (output === 'pdf') {
    return { blob: pdfBlob, filename: `Lender_Pack_${base}_${dateStr}.pdf` };
  }

  // ZIP mode — bundle the PDF + referenced vault docs.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(`Lender_Pack_${base}_${dateStr}.pdf`, pdfBlob);

  for (const pack of packs) {
    const items = computePropertyChecklist(pack.property, vaultDocs);
    const propFolder = `${sanitise(pack.property.address_line)}${pack.property.postcode ? '-' + sanitise(pack.property.postcode) : ''}`;
    const usedNames = new Set<string>();

    for (const item of items) {
      for (const link of item.vaultLinks) {
        let name = link.fileName;
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf('.');
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : '';
          let n = 2;
          while (usedNames.has(`${stem}_${n}${ext}`)) n++;
          name = `${stem}_${n}${ext}`;
        }
        usedNames.add(name);
        const blob = await downloadVaultDoc(link.fileUrl);
        if (blob) {
          zip.file(`${propFolder}/${item.key}/${name}`, blob);
        }
      }
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { blob: zipBlob, filename: `Lender_Pack_${base}_${dateStr}.zip` };
}
