import { CheckCircle2, XCircle } from 'lucide-react';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepComplianceReview({ payload }: StepProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Compliance Record Summary</h3>
      <Row label="Property" value={payload._property_address as string} required />
      {payload._room_name && <Row label="Room" value={payload._room_name as string} />}
      <Row label="Document type" value={payload._document_display_name as string} required />
      <Row label="Issue date" value={payload.issue_date as string} required />
      <Row label="Expiry date" value={payload.expiry_date as string} />
      <Row label="Issuer" value={payload.issuer_name as string} />
      <Row label="Certificate number" value={payload.certificate_number as string} />
      {payload.cost && <Row label="Cost" value={`£${(payload.cost as number).toLocaleString()}`} />}
    </div>
  );
}

function Row({ label, value, required }: { label: string; value?: string; required?: boolean }) {
  const filled = !!value;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      {filled ? (
        <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
      ) : (
        <XCircle className={`h-5 w-5 shrink-0 mt-0.5 ${required ? 'text-destructive' : 'text-muted-foreground'}`} />
      )}
      <div>
        <h4 className="text-sm font-medium">{label}</h4>
        <p className="text-sm text-muted-foreground">{value || (required ? 'Required' : 'Not provided')}</p>
      </div>
    </div>
  );
}
