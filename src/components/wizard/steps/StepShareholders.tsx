import { Info } from 'lucide-react';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepShareholders({ payload: _payload, updatePayload: _updatePayload }: StepProps) {
  return (
    <div className="text-center py-12">
      <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
      <h3 className="text-lg font-medium mb-2">Shareholders & Ownership</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Shareholder details can be managed from the Entity Detail page after creation.
        You can set up individual and corporate shareholders, share classes, and ownership percentages.
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        Skip this step to add shareholders later.
      </p>
    </div>
  );
}
