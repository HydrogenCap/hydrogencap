import { useNavigate } from 'react-router-dom';
import { WizardShell } from '@/components/wizard/WizardShell';
import { COMPLIANCE_STEPS, COMPLIANCE_CROSS_CHECKS } from '@/lib/wizard/complianceSteps';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload } from '@/lib/wizard/types';

import { StepSelectProperty } from '@/components/wizard/steps/StepSelectProperty';
import { StepComplianceType } from '@/components/wizard/steps/StepComplianceType';
import { StepUploadCertificate } from '@/components/wizard/steps/StepUploadCertificate';
import { StepComplianceReview } from '@/components/wizard/steps/StepComplianceReview';

const STEP_COMPONENTS = [StepSelectProperty, StepComplianceType, StepUploadCertificate, StepComplianceReview];

export default function AddComplianceWizard() {
  const navigate = useNavigate();

  const handleSubmit = async (payload: WizardPayload, draftId: string) => {
    const orgId = await fetchUserOrgId();

    const { error } = await supabase
      .from('compliance_documents_v2')
      .insert({
        org_id: orgId,
        property_id: payload.property_id as string,
        document_type: payload.document_type as string,
        issue_date: payload.issue_date as string,
        expiry_date: (payload.expiry_date as string) || null,
        issuer_name: (payload.issuer_name as string) || null,
        certificate_number: (payload.certificate_number as string) || null,
        cost: (payload.cost as number) || null,
        notes: (payload.compliance_notes as string) || null,
        status: 'valid',
        is_current: true,
      });

    if (error) throw error;

    await supabase
      .from('wizard_drafts')
      .update({ property_id: payload.property_id as string })
      .eq('id', draftId);

    navigate(`/properties-v2/${payload.property_id}`);
  };

  return (
    <WizardShell
      title="Add Compliance Record"
      steps={COMPLIANCE_STEPS}
      wizardType="add_compliance"
      crossChecks={COMPLIANCE_CROSS_CHECKS}
      onSubmit={handleSubmit}
    >
      {({ payload, updatePayload, currentStep }) => {
        const Component = STEP_COMPONENTS[currentStep];
        return <Component payload={payload} updatePayload={updatePayload} />;
      }}
    </WizardShell>
  );
}
