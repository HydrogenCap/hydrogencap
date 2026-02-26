import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ComplianceMatrixRow, ComplianceStatusV2, ComplianceDocType } from '@/lib/complianceV2Types';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { format } from 'date-fns';
import { ComplianceDetailModal } from './ComplianceDetailModal';
import { UploadComplianceDocModal } from './UploadComplianceDocModal';

interface PropertyComplianceSectionProps {
  matrixRows: ComplianceMatrixRow[];
  propertyId: string;
  orgId: string;
}

function statusConfig(status: ComplianceStatusV2) {
  const map: Record<ComplianceStatusV2, { label: string; border: string; bg: string; badge: string }> = {
    valid: { label: 'Valid', border: 'border-l-success', bg: '', badge: 'bg-success/20 text-success' },
    expiring_soon: { label: 'Expiring Soon', border: 'border-l-warning', bg: '', badge: 'bg-warning/20 text-warning' },
    critical: { label: 'Critical', border: 'border-l-destructive', bg: '', badge: 'bg-destructive/20 text-destructive animate-pulse' },
    expired: { label: 'Expired', border: 'border-l-destructive', bg: 'bg-destructive/5', badge: 'bg-destructive/20 text-destructive' },
    missing: { label: 'Missing', border: 'border-l-destructive', bg: 'bg-destructive/5', badge: 'bg-destructive/10 text-destructive' },
    not_required: { label: 'Not Required', border: 'border-l-muted', bg: 'opacity-60', badge: 'bg-muted text-muted-foreground' },
  };
  return map[status];
}

const statusOrder: ComplianceStatusV2[] = ['missing', 'expired', 'critical', 'expiring_soon', 'valid', 'not_required'];

export function PropertyComplianceSection({ matrixRows, propertyId, orgId }: PropertyComplianceSectionProps) {
  const [selectedRow, setSelectedRow] = useState<ComplianceMatrixRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const sorted = useMemo(() => {
    return [...matrixRows].sort((a, b) => {
      const ai = statusOrder.indexOf(a.calculated_status);
      const bi = statusOrder.indexOf(b.calculated_status);
      if (ai !== bi) return ai - bi;
      return (a.urgency_score ?? 9999) - (b.urgency_score ?? 9999);
    });
  }, [matrixRows]);

  const validRequired = matrixRows.filter(r => r.is_required && r.calculated_status === 'valid').length;
  const totalRequired = matrixRows.filter(r => r.is_required).length;
  const scorePct = totalRequired > 0 ? Math.round((validRequired / totalRequired) * 100) : 100;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Compliance</h3>
            <Badge
              variant="outline"
              className={cn(
                'font-bold text-sm',
                scorePct === 100 && 'bg-success/20 text-success',
                scorePct >= 90 && scorePct < 100 && 'bg-warning/20 text-warning',
                scorePct < 90 && 'bg-destructive/20 text-destructive',
              )}
            >
              {scorePct}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(row => {
            const cfg = statusConfig(row.calculated_status);
            return (
              <button
                key={row.requirement_id}
                className={cn(
                  'border-l-4 rounded-lg border p-3 text-left hover:bg-muted/30 transition-colors',
                  cfg.border,
                  cfg.bg,
                )}
                onClick={() => setSelectedRow(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{DOC_TYPE_DISPLAY_NAMES[row.document_type]}</span>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', cfg.badge)}>{cfg.label}</Badge>
                </div>
                {row.expiry_date && (
                  <p className={cn('text-xs mt-1', row.calculated_status === 'expired' ? 'text-destructive' : 'text-muted-foreground')}>
                    {row.calculated_status === 'expired'
                      ? `Expired ${format(new Date(row.expiry_date), 'dd/MM/yyyy')} (${Math.abs(row.days_remaining || 0)}d overdue)`
                      : `Expires ${format(new Date(row.expiry_date), 'dd/MM/yyyy')} (${row.days_remaining}d)`}
                  </p>
                )}
                {row.issuer_name && <p className="text-[10px] text-muted-foreground mt-1">{row.issuer_name}</p>}
              </button>
            );
          })}
        </div>
      </div>

      <ComplianceDetailModal
        row={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        onUpload={() => {
          setSelectedRow(null);
          setShowUpload(true);
        }}
      />

      <UploadComplianceDocModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        propertyId={propertyId}
        orgId={orgId}
        documentType={selectedRow?.document_type}
        reviewFrequencyMonths={selectedRow?.review_frequency_months}
      />
    </>
  );
}
