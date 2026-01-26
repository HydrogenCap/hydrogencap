-- Go Live Checklists table to track readiness state
CREATE TABLE public.go_live_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Property Setup (manual confirmations)
  setup_legal_owner_confirmed BOOLEAN NOT NULL DEFAULT false,
  setup_ownership_confirmed BOOLEAN NOT NULL DEFAULT false,
  setup_tenure_confirmed BOOLEAN NOT NULL DEFAULT false,
  setup_address_verified BOOLEAN NOT NULL DEFAULT false,
  setup_local_authority_confirmed BOOLEAN NOT NULL DEFAULT false,
  
  -- Build / Readiness (manual confirmations)
  build_practical_completion BOOLEAN NOT NULL DEFAULT false,
  build_major_works_complete BOOLEAN NOT NULL DEFAULT false,
  build_utilities_live BOOLEAN NOT NULL DEFAULT false,
  build_heating_operational BOOLEAN NOT NULL DEFAULT false,
  build_fire_alarm_installed BOOLEAN NOT NULL DEFAULT false,
  
  -- Compliance (validated against actual documents - stored as manual override if needed)
  compliance_epc_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_eicr_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_gas_safety_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_gas_safety_not_applicable BOOLEAN NOT NULL DEFAULT false,
  compliance_fire_alarm_cert_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_emergency_lighting_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_emergency_lighting_not_applicable BOOLEAN NOT NULL DEFAULT false,
  compliance_hmo_licence_uploaded BOOLEAN NOT NULL DEFAULT false,
  compliance_hmo_licence_not_applicable BOOLEAN NOT NULL DEFAULT false,
  compliance_legionella_uploaded BOOLEAN NOT NULL DEFAULT false,
  
  -- Finance & Income
  finance_rental_strategy_selected BOOLEAN NOT NULL DEFAULT false,
  finance_rent_values_entered BOOLEAN NOT NULL DEFAULT false,
  finance_expected_income_populated BOOLEAN NOT NULL DEFAULT false,
  finance_mortgage_added BOOLEAN NOT NULL DEFAULT false,
  finance_unencumbered BOOLEAN NOT NULL DEFAULT false,
  finance_mortgage_rate_entered BOOLEAN NOT NULL DEFAULT false,
  
  -- Final Confirmation
  final_confirmation BOOLEAN NOT NULL DEFAULT false,
  
  -- Go Live Approval
  go_live_approved_at TIMESTAMP WITH TIME ZONE,
  go_live_approved_by UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.go_live_checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies (access via property's org)
CREATE POLICY "Users can view go_live_checklists for their org properties"
  ON public.go_live_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = go_live_checklists.property_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert go_live_checklists for their org properties"
  ON public.go_live_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = go_live_checklists.property_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update go_live_checklists for their org properties"
  ON public.go_live_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.memberships m ON m.org_id = p.org_id
      WHERE p.id = go_live_checklists.property_id
      AND m.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_go_live_checklists_updated_at
  BEFORE UPDATE ON public.go_live_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for fast lookups
CREATE INDEX idx_go_live_checklists_property_id ON public.go_live_checklists(property_id);