import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, History, ShieldOff, ShieldCheck, Copy, RotateCcw, AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow, ComplianceStatusV2 } from '@/lib/complianceV2Types';
import { useComplianceDocumentsV2, useToggleRequirementV2 } from '@/hooks/useComplianceV2';
import type { MissingCellDiagnostic, DiagnosticDoc } from '@/hooks/useMissingComplianceDiagnostics';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createSignedStorageUrl } from '@/lib/storagePaths';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });

interface ComplianceDetailModalProps {
  row: ComplianceMatrixRow | null;
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  /** Per-cell "why missing?" diagnostics for this property+type. */
  diagnostics?: MissingCellDiagnostic;
  /** Accepted org-level orphan docs (no property assigned) of the same v2 type. */
  orphanDocs?: DiagnosticDoc[];
}

interface ComplianceHistoryDocument {
  id: string;
  issue_date: string | null;
  expiry_date: string | null;
  issuer_name: string | null;
  is_current: boolean;
}

function statusBadge(status: ComplianceStatusV2) {
  const map: Record<ComplianceStatusV2, { label: string; className: string }> = {
    valid: { label: 'Valid', className: 'bg-success/20 text-success border-success/30' },
    expiring_soon: { label: 'Expiring Soon', className: 'bg-warning/20 text-warning border-warning/30' },
    critical: { label: 'Critical', className: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse' },
    expired: { label: 'Expired', className: 'bg-destructive/20 text-destructive border-destructive/30' },
    missing: { label: 'Missing', className: 'bg-destructive/10 text-destructive border-destructive/30' },
    not_required: { label: 'Not Required', className: 'bg-muted text-muted-foreground border-border' },
  };
  const s = map[status];
  return <Badge variant="outline" className={cn('text-sm font-semibold', s.className)}>{s.label}</Badge>;
}

export function ComplianceDetailModal({ row, open, onClose, onUpload }: ComplianceDetailModalProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const overrideRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showOverrideInput) {
      // Defer to allow Input to mount
      const t = setTimeout(() => overrideRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showOverrideInput]);

  // Reset transient state when row changes or modal closes
  useEffect(() => {
    if (!open) {
      setShowHistory(false);
      setShowOverrideInput(false);
      setOverrideReason('');
    }
  }, [open, row?.requirement_id]);

  const toggleReq = useToggleRequirementV2();

  const { data: history } = useComplianceDocumentsV2(
    showHistory ? row?.property_id : undefined,
    showHistory ? row?.document_type : undefined,
  );

  if (!row) return null;

  const typedHistory = (history || []) as ComplianceHistoryDocument[];

  const handleToggle = async () => {
    if (row.is_required && !showOverrideInput) {
      setShowOverrideInput(true);
      return;
    }
    try {
      await toggleReq.mutateAsync({
        requirementId: row.requirement_id,
        isRequired: !row.is_required,
        overrideReason: row.is_required ? overrideReason : undefined,
      });
      toast.success(row.is_required ? 'Marked as not required' : 'Marked as required');
      setShowOverrideInput(false);
      setOverrideReason('');
      onClose();
    } catch (error) {
      console.error('Failed to toggle compliance requirement:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update requirement');
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(row.property_address);
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy address');
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{DOC_TYPE_DISPLAY_NAMES[row.document_type]}</DialogTitle>
          <DialogDescription className="text-sm flex items-center gap-1.5">
            <span className="truncate">{row.property_address}</span>
            <button
              type="button"
              onClick={copyAddress}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Copy property address"
              title="Copy address"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </DialogDescription>
          {row.entity_name && (
            <p className="text-xs text-muted-foreground">Owned by {row.entity_name}</p>
          )}
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            {statusBadge(row.calculated_status)}
            {row.review_frequency_months && (
              <Badge variant="outline" className="text-xs gap-1">
                <RotateCcw className="h-3 w-3" />
                Renews every {row.review_frequency_months} {row.review_frequency_months === 1 ? 'month' : 'months'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {row.document_id ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Issue Date</span>
                  <p className="font-medium">{row.issue_date ? format(new Date(row.issue_date), 'dd/MM/yyyy') : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expiry Date</span>
                  <p className={cn('font-medium', row.calculated_status === 'expired' && 'text-destructive', row.calculated_status === 'critical' && 'text-destructive')}>
                    {row.expiry_date ? `${format(new Date(row.expiry_date), 'dd/MM/yyyy')} (${row.days_remaining}d)` : 'No expiry'}
                  </p>
                </div>
              </div>
              {row.issuer_name && (
                <div>
                  <span className="text-muted-foreground">Issuer / Contractor</span>
                  <p className="font-medium">{row.issuer_name}</p>
                </div>
              )}
              {row.certificate_number && (
                <div>
                  <span className="text-muted-foreground">Certificate Number</span>
                  <p className="font-medium font-mono text-xs">{row.certificate_number}</p>
                </div>
              )}
              {row.cost != null && (
                <div>
                  <span className="text-muted-foreground">Cost</span>
                  <p className="font-medium">{GBP.format(Number(row.cost))}</p>
                </div>
              )}
              {row.ai_extracted && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">AI Extracted</Badge>
              )}
              {row.file_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const signedUrl = await createSignedStorageUrl('compliance', row.file_url!);
                      window.open(signedUrl, '_blank');
                    } catch (error) {
                      console.error('Failed to open compliance document:', error);
                      toast.error(error instanceof Error ? error.message : 'Failed to open document');
                    }
                  }}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> View / Download
                </Button>
              )}
              {row.document_notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="text-sm">{row.document_notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-center">
              <p className="font-medium text-destructive">No current {DOC_TYPE_DISPLAY_NAMES[row.document_type]} on file</p>
              {row.override_reason && <p className="text-sm text-muted-foreground mt-1">{row.override_reason}</p>}
            </div>
          )}

          {/* History toggle */}
          {showHistory && typedHistory.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Document History</p>
              {typedHistory.map((doc) => (
                <div key={doc.id} className={cn('text-xs border-b pb-2 last:border-b-0', !doc.is_current && 'opacity-60')}>
                  <div className="flex justify-between">
                    <span>{doc.issue_date ? format(new Date(doc.issue_date), 'dd/MM/yyyy') : '—'}</span>
                    <span>{doc.expiry_date ? format(new Date(doc.expiry_date), 'dd/MM/yyyy') : 'No expiry'}</span>
                  </div>
                  {doc.issuer_name && <span className="text-muted-foreground">{doc.issuer_name}</span>}
                  {!doc.is_current && <Badge variant="outline" className="text-[10px] ml-1">Superseded</Badge>}
                </div>
              ))}
            </div>
          )}

          {/* Override reason input */}
          {showOverrideInput && (
            <div className="space-y-1.5 border-l-2 border-warning/40 pl-3">
              <Label htmlFor="override-reason" className="text-xs text-muted-foreground">
                Reason for marking as not required <span className="text-destructive">*</span>
              </Label>
              <Input
                id="override-reason"
                ref={overrideRef}
                placeholder="e.g. Commercial unit — not subject to residential gas regs"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleToggle}
                  disabled={toggleReq.isPending || overrideReason.trim().length < 3}
                >
                  Confirm Mark Not Required
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowOverrideInput(false); setOverrideReason(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showOverrideInput && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={onUpload} size="sm">
                <Upload className="h-4 w-4 mr-1" /> Upload Document
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                <History className="h-4 w-4 mr-1" /> {showHistory ? 'Hide' : 'View'} History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                disabled={toggleReq.isPending}
              >
                {row.is_required ? (
                  <><ShieldOff className="h-4 w-4 mr-1" /> Mark Not Required</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-1" /> Mark Required</>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
