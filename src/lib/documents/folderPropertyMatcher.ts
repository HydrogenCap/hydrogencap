/**
 * Folder-name → property matcher for the Bulk Document Scanner v2.
 *
 * When a user drops a folder like:
 *
 *   12 Acacia Avenue/
 *     EICR.pdf
 *     Gas-Safety.pdf
 *   Flat 4 Marlborough Rd SW1A 1AA/
 *     EPC_2025-03-15.pdf
 *
 * each file arrives with a `relativePath` (e.g. "12 Acacia Avenue/EICR.pdf").
 * The folder segment(s) usually identify the property. This matcher tries to
 * resolve that folder name to one of the user's `properties_v2` records BEFORE
 * the AI extraction runs so the row in the review queue is already routed.
 *
 * Pure / synchronous — easy to unit test, no Supabase calls.
 */

export interface PropertyLite {
  id: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
  display_name?: string | null;
}

const POSTCODE_RE = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[,_/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPostcode(s: string): string {
  return s.replace(POSTCODE_RE, '').trim();
}

function getPostcode(s: string): string | null {
  const m = s.match(POSTCODE_RE);
  return m ? m[0].replace(/\s/g, '').toLowerCase() : null;
}

/** Folder segments only (drops the filename). Returns "" if flat. */
export function folderSegmentsOf(relativePath: string): string {
  if (!relativePath) return '';
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join(' ');
}

/**
 * Returns the best property id for a given relative path, or null if no
 * confident match. Order of confidence:
 *   1. Postcode in folder name matches property postcode.
 *   2. Folder name contains the property's address_line_1.
 *   3. address_line_1 contains the folder name (e.g. folder = "Acacia Ave").
 */
export function matchPropertyFromFolder(
  relativePath: string,
  properties: PropertyLite[],
): string | null {
  const folder = folderSegmentsOf(relativePath);
  if (!folder || !properties?.length) return null;

  const folderNorm = normalise(folder);
  const folderPc = getPostcode(folderNorm);
  const folderNoPc = normalise(stripPostcode(folderNorm));

  // 1. Postcode match — strongest signal.
  if (folderPc) {
    for (const p of properties) {
      const propPc = (p.postcode || '').replace(/\s/g, '').toLowerCase();
      if (propPc && propPc === folderPc) return p.id;
    }
  }

  // 2 & 3. Address substring either direction. Prefer longer matches so
  // "12 Acacia Avenue" beats a generic "Acacia" hit.
  let best: { id: string; score: number } | null = null;
  for (const p of properties) {
    const addr = normalise(p.address_line_1 || '');
    if (!addr) continue;
    let score = 0;
    if (folderNoPc.includes(addr)) score = addr.length;
    else if (addr.includes(folderNoPc) && folderNoPc.length >= 4) score = folderNoPc.length;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: p.id, score };
    }
  }
  return best?.id ?? null;
}
