import { Info } from 'lucide-react';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

export function StepUploadCertificate({ payload: _payload, updatePayload: _updatePayload }: StepProps) {
  return (
    <div className="text-center py-12">
      <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
      <h3 className="text-lg font-medium mb-2">Upload Certificate</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Certificate upload is available after the compliance record is created.
        You can upload PDFs and images from the Compliance page.
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        Skip this step to upload later.
      </p>
    </div>
  );
}
