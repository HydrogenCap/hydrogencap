import { toast } from 'sonner';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';

/**
 * Build and download a CSV from filtered compliance rows.
 * Behaviour is identical to the inline implementation on ComplianceV2 page.
 */
export function exportComplianceCsv(rows: ComplianceMatrixRow[], opts: {
  filtersActive: boolean;
  statusFilter: string;
}) {
  if (rows.length === 0) {
    toast.info('Nothing to export with the current filters');
    return;
  }
  const headers = ['Property', 'Property Type', 'Document', 'Status', 'Days Remaining', 'Expiry Date', 'Issue Date', 'Issuer', 'Certificate #', 'Cost (£)'];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.property_address,
      r.property_type ?? '',
      DOC_TYPE_DISPLAY_NAMES[r.document_type],
      r.calculated_status,
      r.days_remaining ?? '',
      r.expiry_date ?? '',
      r.issue_date ?? '',
      r.issuer_name ?? '',
      r.certificate_number ?? '',
      r.cost ?? '',
    ].map(escape).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = opts.filtersActive ? `-${opts.statusFilter}` : '';
  a.download = `compliance-register${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} compliance item${rows.length === 1 ? '' : 's'}${opts.filtersActive ? ' (filtered)' : ''}`);
}
