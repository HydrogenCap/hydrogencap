import { useNavigate } from 'react-router-dom';
import { WizardShell } from '@/components/wizard/WizardShell';
import { PROPERTY_STEPS } from '@/lib/wizard/propertySteps';
import { PROPERTY_CROSS_CHECKS } from '@/lib/wizard/crossChecks';
import { generatePropertyTasks } from '@/lib/wizard/taskGenerator';
import { useCreateTasks } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload, WizardRoom, ComplianceItem } from '@/lib/wizard/types';

import { StepAddress } from '@/components/wizard/steps/StepAddress';
import { StepPropertyType } from '@/components/wizard/steps/StepPropertyType';
import { StepOwnership } from '@/components/wizard/steps/StepOwnership';
import { StepRooms } from '@/components/wizard/steps/StepRooms';
import { StepCompliance } from '@/components/wizard/steps/StepCompliance';
import { StepFinance } from '@/components/wizard/steps/StepFinance';
import { StepDocuments } from '@/components/wizard/steps/StepDocuments';
import { StepReview } from '@/components/wizard/steps/StepReview';

const STEP_COMPONENTS = [
  StepAddress,
  StepPropertyType,
  StepOwnership,
  StepRooms,
  StepCompliance,
  StepFinance,
  StepDocuments,
  StepReview,
];

export default function AddPropertyWizard() {
  const navigate = useNavigate();
  const createTasks = useCreateTasks();

  const handleSubmit = async (payload: WizardPayload, draftId: string) => {
    const orgId = await fetchUserOrgId();

    // 1. Create property
    const { data: property, error: propErr } = await (supabase as any)
      .from('properties_v2')
      .insert({
        org_id: orgId,
        entity_id: payload.entity_id as string,
        address_line_1: payload.address_line_1 as string,
        address_line_2: (payload.address_line_2 as string) || null,
        city: payload.city as string,
        county: (payload.county as string) || null,
        postcode: payload.postcode as string,
        country: (payload.country as string) || 'United Kingdom',
        property_type: payload.property_type as string,
        lifecycle_stage: (payload.lifecycle_stage as string) || 'stabilised',
        has_gas_supply: !!payload.has_gas_supply,
        year_built: (payload.year_built as number) || null,
        total_lettable_rooms: (payload.total_lettable_rooms as number) || 0,
        current_valuation: (payload.current_valuation as number) || null,
        purchase_price: (payload.purchase_price as number) || null,
        purchase_date: (payload.purchase_date as string) || null,
        listing_grade: (payload.listing_grade as string) || null,
      })
      .select('id')
      .single();

    if (propErr) throw propErr;

    // 2. Create rooms
    const rooms = (payload.rooms as WizardRoom[]) || [];
    if (rooms.length > 0) {
      await supabase.from('rooms_v2').insert(
        rooms.map((r) => ({
          property_id: property.id,
          org_id: orgId,
          room_name: r.room_name || 'Room',
          room_type: r.room_type,
          floor: r.floor,
          has_ensuite: r.has_ensuite,
          is_lettable: r.is_lettable,
          target_rent_pcm: r.target_rent_pcm || null,
        }))
      );
    }

    // 3. Create compliance requirements
    const complianceItems = (payload.compliance_items as ComplianceItem[]) || [];
    if (complianceItems.length > 0) {
      await supabase.from('compliance_requirements_v2').insert(
        complianceItems.map((c) => ({
          property_id: property.id,
          org_id: orgId,
          document_type: c.document_type,
          is_required: c.is_required,
          review_frequency_months: c.review_frequency_months,
          lead_time_days: c.lead_time_days,
          requirement_reason: c.reason || null,
          override_reason: c.override_reason || null,
        }))
      );
    }

    // 4. Create loan facility if mortgage exists
    if (payload.has_mortgage && payload.lender_name) {
      // Upsert lender
      const { data: lender } = await (supabase as any)
        .from('lenders')
        .upsert(
          { org_id: orgId, lender_name: payload.lender_name as string, lender_type: 'bank' },
          { onConflict: 'org_id,lender_name' }
        )
        .select('id')
        .single();

      if (lender) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from('loan_facilities').insert({
          property_id: property.id,
          lender_id: lender.id,
          entity_id: payload.entity_id as string,
          org_id: orgId,
          original_amount: (payload.original_amount as number) || 0,
          current_balance: (payload.current_balance as number) || (payload.original_amount as number) || 0,
          interest_rate: (payload.interest_rate as number) || 0,
          rate_type: (payload.rate_type as string) || 'fixed',
          facility_type: (payload.facility_type as string) || 'buy_to_let',
          monthly_payment: (payload.monthly_payment as number) || null,
          rate_expiry_date: (payload.rate_expiry_date as string) || null,
          term_start_date: today,
          term_end_date: (payload.rate_expiry_date as string) || new Date(Date.now() + 365 * 5 * 86400000).toISOString().slice(0, 10),
          status: 'active',
        });
      }
    }

    // 5. Generate tasks
    const address = `${payload.address_line_1}, ${payload.postcode}`;
    const tasks = generatePropertyTasks(payload, address);
    if (tasks.length > 0) {
      await createTasks.mutateAsync(
        tasks.map((t) => ({
          ...t,
          property_id: property.id,
          due_date: new Date(Date.now() + t.due_days_from_now * 86400000).toISOString().slice(0, 10),
          source: 'wizard',
          source_wizard_id: draftId,
        }))
      );
    }

    // 6. Update draft with property ID
    await (supabase as any)
      .from('wizard_drafts')
      .update({ property_id: property.id, entity_id: payload.entity_id as string })
      .eq('id', draftId);

    navigate(`/properties-v2/${property.id}`);
  };

  return (
    <WizardShell
      title="Add Property"
      steps={PROPERTY_STEPS}
      wizardType="add_property"
      crossChecks={PROPERTY_CROSS_CHECKS}
      onSubmit={handleSubmit}
    >
      {({ payload, updatePayload, currentStep }) => {
        const Component = STEP_COMPONENTS[currentStep];
        return <Component payload={payload} updatePayload={updatePayload} />;
      }}
    </WizardShell>
  );
}
