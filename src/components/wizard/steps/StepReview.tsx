import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { calculateCompletenessScore } from '@/lib/wizard/scoring';
import type { WizardPayload, ComplianceItem, WizardRoom } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepReview({ payload }: StepProps) {
  const score = calculateCompletenessScore(payload);
  const rooms = (payload.rooms as WizardRoom[]) || [];
  const complianceItems = (payload.compliance_items as ComplianceItem[]) || [];
  const requiredCompliance = complianceItems.filter((c) => c.is_required);

  return (
    <div className="space-y-6">
      {/* Completeness Score */}
      <div className="rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Completeness Score</h3>
          <span className={`text-2xl font-bold ${score.total >= 80 ? 'text-success' : score.total >= 50 ? 'text-warning' : 'text-destructive'}`}>
            {score.total}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${score.total >= 80 ? 'bg-success' : score.total >= 50 ? 'bg-warning' : 'bg-destructive'}`}
            style={{ width: `${score.total}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {score.categories.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{cat.label}</span>
              <span className={cat.percent === 100 ? 'text-success' : 'text-foreground'}>{cat.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary sections */}
      <Section title="Address" icon={payload.address_line_1 ? 'complete' : 'error'}>
        {payload.address_line_1 ? (
          <p className="text-sm">{payload.address_line_1 as string}, {payload.city as string} {payload.postcode as string}</p>
        ) : (
          <p className="text-sm text-destructive">Missing address</p>
        )}
      </Section>

      <Section title="Property Type" icon={payload.property_type ? 'complete' : 'error'}>
        <p className="text-sm">{(payload.property_type as string)?.replace(/_/g, ' ') || 'Not set'} · {(payload.lifecycle_stage as string) || 'No stage'}</p>
      </Section>

      <Section title="Ownership" icon={payload.entity_id ? 'complete' : 'error'}>
        <p className="text-sm">{payload.entity_id ? 'Entity linked' : 'No entity selected'}</p>
      </Section>

      <Section title="Rooms" icon={rooms.length > 0 ? 'complete' : 'warning'}>
        <p className="text-sm">{rooms.length} room{rooms.length !== 1 ? 's' : ''} configured</p>
      </Section>

      <Section title="Compliance" icon={requiredCompliance.length > 0 ? 'complete' : 'warning'}>
        <p className="text-sm">{requiredCompliance.length} required item{requiredCompliance.length !== 1 ? 's' : ''}</p>
      </Section>

      <Section title="Finance" icon={payload.has_mortgage === true && !payload.lender_name ? 'error' : 'complete'}>
        {payload.has_mortgage ? (
          <p className="text-sm">{payload.lender_name as string || 'Unknown lender'} · £{(payload.original_amount as number)?.toLocaleString() || '?'}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No mortgage</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: 'complete' | 'warning' | 'error'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      {icon === 'complete' && <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />}
      {icon === 'warning' && <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />}
      {icon === 'error' && <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        {children}
      </div>
    </div>
  );
}
