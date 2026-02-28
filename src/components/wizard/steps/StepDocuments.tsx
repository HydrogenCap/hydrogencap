import { Info } from 'lucide-react';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepDocuments({ payload: _payload, updatePayload: _updatePayload }: StepProps) {
  return (
    <div className="text-center py-12">
      <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
      <h3 className="text-lg font-medium mb-2">Document Uploads</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Document upload functionality is available after the property is created.
        You can upload certificates, photos, and supporting documents from the property detail page.
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        Skip this step if you want to add documents later.
      </p>
    </div>
  );
}
