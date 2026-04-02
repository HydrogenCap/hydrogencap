import { useNavigate } from 'react-router-dom';
import { WizardShell } from '@/components/wizard/WizardShell';
import { ENTITY_STEPS, ENTITY_CROSS_CHECKS } from '@/lib/wizard/entitySteps';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload } from '@/lib/wizard/types';

import { StepEntityDetails } from '@/components/wizard/steps/StepEntityDetails';
import { StepShareholders } from '@/components/wizard/steps/StepShareholders';
import { StepDocuments } from '@/components/wizard/steps/StepDocuments';
import { StepEntityReview } from '@/components/wizard/steps/StepEntityReview';

const STEP_COMPONENTS = [StepEntityDetails, StepShareholders, StepDocuments, StepEntityReview];

export default function AddEntityWizard() {
  const navigate = useNavigate();

  const handleSubmit = async (payload: WizardPayload, draftId: string) => {
    const orgId = await fetchUserOrgId();

    const { data: entity, error } = await (supabase as any)
      .from('legal_entities')
      .insert({
        org_id: orgId,
        entity_name: payload.entity_name as string,
        entity_type: payload.entity_type as string,
        company_number: (payload.company_number as string) || null,
        incorporation_date: (payload.incorporation_date as string) || null,
        registered_address: (payload.registered_address as string) || null,
        notes: (payload.entity_notes as string) || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    await (supabase as any)
      .from('wizard_drafts')
      .update({ entity_id: entity.id })
      .eq('id', draftId);

    navigate(`/entities/${entity.id}`);
  };

  return (
    <WizardShell
      title="Add Entity"
      steps={ENTITY_STEPS}
      wizardType="add_entity"
      crossChecks={ENTITY_CROSS_CHECKS}
      onSubmit={handleSubmit}
    >
      {({ payload, updatePayload, currentStep }) => {
        const Component = STEP_COMPONENTS[currentStep];
        return <Component payload={payload} updatePayload={updatePayload} />;
      }}
    </WizardShell>
  );
}
