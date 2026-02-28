import { CheckCircle2, XCircle } from 'lucide-react';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepEntityReview({ payload }: StepProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Entity Summary</h3>
      <Row label="Entity name" value={payload.entity_name as string} required />
      <Row label="Entity type" value={(payload.entity_type as string)?.replace(/_/g, ' ')} required />
      {payload.entity_type === 'ltd_company' && (
        <>
          <Row label="Company number" value={payload.company_number as string} />
          <Row label="Incorporation date" value={payload.incorporation_date as string} />
        </>
      )}
      <Row label="Registered address" value={payload.registered_address as string} />
      {payload.entity_notes && <Row label="Notes" value={payload.entity_notes as string} />}
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
