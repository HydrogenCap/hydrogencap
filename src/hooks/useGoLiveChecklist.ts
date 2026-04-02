import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActivityLoggers } from './useActivityLog';
import type { PropertyWithFinancials } from './useProperties';

export interface GoLiveChecklistData {
  id: string;
  property_id: string;
  // Property Setup
  setup_legal_owner_confirmed: boolean;
  setup_ownership_confirmed: boolean;
  setup_tenure_confirmed: boolean;
  setup_address_verified: boolean;
  setup_local_authority_confirmed: boolean;
  // Build / Readiness
  build_practical_completion: boolean;
  build_major_works_complete: boolean;
  build_utilities_live: boolean;
  build_heating_operational: boolean;
  build_fire_alarm_installed: boolean;
  // Compliance
  compliance_epc_uploaded: boolean;
  compliance_eicr_uploaded: boolean;
  compliance_gas_safety_uploaded: boolean;
  compliance_gas_safety_not_applicable: boolean;
  compliance_fire_alarm_cert_uploaded: boolean;
  compliance_emergency_lighting_uploaded: boolean;
  compliance_emergency_lighting_not_applicable: boolean;
  compliance_hmo_licence_uploaded: boolean;
  compliance_hmo_licence_not_applicable: boolean;
  compliance_legionella_uploaded: boolean;
  // Finance
  finance_rental_strategy_selected: boolean;
  finance_rent_values_entered: boolean;
  finance_expected_income_populated: boolean;
  finance_mortgage_added: boolean;
  finance_unencumbered: boolean;
  finance_mortgage_rate_entered: boolean;
  // Final
  final_confirmation: boolean;
  go_live_approved_at: string | null;
  go_live_approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemStatus {
  key: string;
  label: string;
  checked: boolean;
  autoValidated?: boolean;
  notApplicable?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  icon: string;
  items: ChecklistItemStatus[];
}

// Validate data against actual property/compliance records
interface ComplianceItemBasic {
  compliance_type: string;
  expiry_date: string | null;
  issue_date: string | null;
}

interface OwnershipLinkBasic {
  subject_type: string;
  subject_id: string;
  effective_to: string | null;
  percent: number | null;
}

interface PassportBasic {
  local_authority_id?: string | null;
  local_authority_text?: string | null;
  local_authority?: string | null;
}

interface PropertyIncomeBasic {
  year: number;
  annual_rent_gbp: number | null;
}

export function validatePropertyData(
  property: PropertyWithFinancials | null,
  complianceItems: ComplianceItemBasic[],
  ownershipLinks: OwnershipLinkBasic[],
  passport?: PassportBasic
): {
  hasLegalOwner: boolean;
  ownershipComplete: boolean;
  hasTenure: boolean;
  hasAddress: boolean;
  hasLocalAuthority: boolean;
  hasEpc: boolean;
  hasEicr: boolean;
  hasGasSafety: boolean;
  hasFireAlarm: boolean;
  hasEmergencyLighting: boolean;
  hasHmoLicence: boolean;
  hasLegionella: boolean;
  hasIncome: boolean;
  hasMortgage: boolean;
  hasMortgageRate: boolean;
  hasGas: boolean;
} {
  if (!property) {
    return {
      hasLegalOwner: false,
      ownershipComplete: false,
      hasTenure: false,
      hasAddress: false,
      hasLocalAuthority: false,
      hasEpc: false,
      hasEicr: false,
      hasGasSafety: false,
      hasFireAlarm: false,
      hasEmergencyLighting: false,
      hasHmoLicence: false,
      hasLegionella: false,
      hasIncome: false,
      hasMortgage: false,
      hasMortgageRate: false,
      hasGas: false,
    };
  }

  // Check legal owner
  const hasLegalOwner = !!(property.legal_owner_company_id || property.legal_owner_party_id);

  // Check ownership totals to 100%
  // For SPV-owned properties, ownership is derived from company shareholders
  // For directly-owned properties, check direct property ownership links
  let ownershipComplete = false;
  
  if (property.legal_owner_company_id) {
    // SPV-owned: ownership is managed at company level, consider complete if SPV is assigned
    // The actual ownership % validation happens on the company page
    ownershipComplete = true;
  } else if (property.legal_owner_party_id) {
    // Single individual owner - 100% by definition
    ownershipComplete = true;
  } else {
    // Check direct property ownership links
    const propertyOwnership = ownershipLinks.filter(
      (l) => l.subject_type === 'PROPERTY' && l.subject_id === property.id && !l.effective_to
    );
    if (propertyOwnership.length > 0) {
      const totalOwnership = propertyOwnership.reduce((sum: number, l) => sum + (l.percent || 0), 0);
      ownershipComplete = totalOwnership >= 99.9 && totalOwnership <= 100.1;
    }
  }

  // Property basics
  const hasTenure = !!property.tenure;
  const hasAddress = !!(property.address_line && property.postcode);
  const hasGas = property.has_gas !== false; // Default to true if null

  // Local authority - check passport fields or property area_name
  const hasLocalAuthority = !!(
    passport?.local_authority_id ||
    passport?.local_authority_text ||
    passport?.local_authority ||
    property.area_name ||
    property.county
  );

  // Check compliance documents
  const hasValidDoc = (type: string) => {
    const item = complianceItems.find((c) => c.compliance_type === type);
    if (!item) return false;
    // Check if has valid (non-expired) document
    if (!item.expiry_date) return !!item.issue_date;
    return new Date(item.expiry_date) > new Date();
  };

  const hasEpc = hasValidDoc('epc') || !!property.epc_rating;
  const hasEicr = hasValidDoc('eicr');
  const hasGasSafety = hasValidDoc('gas_safety');
  const hasFireAlarm = hasValidDoc('fire_alarm');
  const hasEmergencyLighting = hasValidDoc('emergency_lighting');
  const hasHmoLicence = hasValidDoc('hmo_licence');
  const hasLegionella = hasValidDoc('legionella');

  // Finance
  const currentYearIncome = (property.income as PropertyIncomeBasic[] | undefined)?.find(
    (income) => income.year === new Date().getFullYear()
  );
  const hasIncome = !!(currentYearIncome?.annual_rent_gbp && currentYearIncome.annual_rent_gbp > 0);
  
  const loan = property.loans?.[0];
  const hasMortgage = !!loan;
  const hasMortgageRate = !!(loan?.interest_rate_percent);

  return {
    hasLegalOwner,
    ownershipComplete,
    hasTenure,
    hasAddress,
    hasLocalAuthority,
    hasEpc,
    hasEicr,
    hasGasSafety,
    hasFireAlarm,
    hasEmergencyLighting,
    hasHmoLicence,
    hasLegionella,
    hasIncome,
    hasMortgage,
    hasMortgageRate,
    hasGas,
  };
}

export function buildChecklistSections(
  checklist: GoLiveChecklistData | null,
  validation: ReturnType<typeof validatePropertyData>
): ChecklistSection[] {
  const c = checklist;

  return [
    {
      id: 'setup',
      title: 'Property Setup',
      icon: '🏠',
      items: [
        { 
          key: 'setup_legal_owner_confirmed', 
          label: 'Legal owner (SPV) assigned', 
          checked: c?.setup_legal_owner_confirmed || validation.hasLegalOwner,
          autoValidated: validation.hasLegalOwner
        },
        { 
          key: 'setup_ownership_confirmed', 
          label: 'Ownership percentages total 100%', 
          checked: c?.setup_ownership_confirmed || validation.ownershipComplete,
          autoValidated: validation.ownershipComplete
        },
        { 
          key: 'setup_tenure_confirmed', 
          label: 'Tenure confirmed (Freehold / Leasehold)', 
          checked: c?.setup_tenure_confirmed || validation.hasTenure,
          autoValidated: validation.hasTenure
        },
        { 
          key: 'setup_address_verified', 
          label: 'Property address verified', 
          checked: c?.setup_address_verified || validation.hasAddress,
          autoValidated: validation.hasAddress
        },
        { 
          key: 'setup_local_authority_confirmed', 
          label: 'Local authority confirmed', 
          checked: c?.setup_local_authority_confirmed || validation.hasLocalAuthority,
          autoValidated: validation.hasLocalAuthority
        },
      ],
    },
    {
      id: 'build',
      title: 'Build / Readiness',
      icon: '🔧',
      items: [
        { key: 'build_practical_completion', label: 'Practical Completion confirmed', checked: c?.build_practical_completion ?? false },
        { key: 'build_major_works_complete', label: 'All major works completed', checked: c?.build_major_works_complete ?? false },
        { key: 'build_utilities_live', label: 'Utilities live (gas / electric / water)', checked: c?.build_utilities_live ?? false },
        { key: 'build_heating_operational', label: 'Heating operational', checked: c?.build_heating_operational ?? false },
        { key: 'build_fire_alarm_installed', label: 'Fire alarm system installed and commissioned', checked: c?.build_fire_alarm_installed ?? false },
      ],
    },
    {
      id: 'compliance',
      title: 'Compliance (Mandatory)',
      icon: '📄',
      items: [
        { 
          key: 'compliance_epc_uploaded', 
          label: 'EPC uploaded (valid)', 
          checked: c?.compliance_epc_uploaded || validation.hasEpc,
          autoValidated: validation.hasEpc
        },
        { 
          key: 'compliance_eicr_uploaded', 
          label: 'EICR uploaded (in date)', 
          checked: c?.compliance_eicr_uploaded || validation.hasEicr,
          autoValidated: validation.hasEicr
        },
        { 
          key: 'compliance_gas_safety_uploaded', 
          label: 'Gas Safety Certificate uploaded', 
          checked: c?.compliance_gas_safety_uploaded || validation.hasGasSafety || c?.compliance_gas_safety_not_applicable,
          autoValidated: validation.hasGasSafety,
          notApplicable: c?.compliance_gas_safety_not_applicable || !validation.hasGas
        },
        { 
          key: 'compliance_fire_alarm_cert_uploaded', 
          label: 'Fire Alarm Certificate uploaded', 
          checked: c?.compliance_fire_alarm_cert_uploaded || validation.hasFireAlarm,
          autoValidated: validation.hasFireAlarm
        },
        { 
          key: 'compliance_emergency_lighting_uploaded', 
          label: 'Emergency Lighting Certificate uploaded', 
          checked: c?.compliance_emergency_lighting_uploaded || validation.hasEmergencyLighting || c?.compliance_emergency_lighting_not_applicable,
          autoValidated: validation.hasEmergencyLighting,
          notApplicable: c?.compliance_emergency_lighting_not_applicable
        },
        { 
          key: 'compliance_hmo_licence_uploaded', 
          label: 'HMO Licence uploaded OR exemption noted', 
          checked: c?.compliance_hmo_licence_uploaded || validation.hasHmoLicence || c?.compliance_hmo_licence_not_applicable,
          autoValidated: validation.hasHmoLicence,
          notApplicable: c?.compliance_hmo_licence_not_applicable
        },
        { 
          key: 'compliance_legionella_uploaded', 
          label: 'Legionella Risk Assessment uploaded', 
          checked: c?.compliance_legionella_uploaded || validation.hasLegionella,
          autoValidated: validation.hasLegionella
        },
      ],
    },
    {
      id: 'finance',
      title: 'Finance & Income',
      icon: '💰',
      items: [
        { key: 'finance_rental_strategy_selected', label: 'Rental strategy selected (per room / AST / lease)', checked: c?.finance_rental_strategy_selected ?? false },
        { 
          key: 'finance_rent_values_entered', 
          label: 'Rent values entered', 
          checked: c?.finance_rent_values_entered || validation.hasIncome,
          autoValidated: validation.hasIncome
        },
        { 
          key: 'finance_expected_income_populated', 
          label: 'Expected monthly income populated', 
          checked: c?.finance_expected_income_populated || validation.hasIncome,
          autoValidated: validation.hasIncome
        },
        { 
          key: 'finance_mortgage_added', 
          label: 'Mortgage added OR marked "unencumbered"', 
          checked: c?.finance_mortgage_added || validation.hasMortgage || c?.finance_unencumbered,
          autoValidated: validation.hasMortgage
        },
        { 
          key: 'finance_mortgage_rate_entered', 
          label: 'Mortgage interest rate entered (if applicable)', 
          checked: c?.finance_mortgage_rate_entered || validation.hasMortgageRate || c?.finance_unencumbered,
          autoValidated: validation.hasMortgageRate,
          notApplicable: c?.finance_unencumbered
        },
      ],
    },
    {
      id: 'confirmation',
      title: 'Confirmation & Sign-off',
      icon: '✅',
      items: [
        { 
          key: 'final_confirmation', 
          label: 'I confirm this property is operational and income-producing', 
          checked: c?.final_confirmation ?? false 
        },
      ],
    },
  ];
}

export function calculateChecklistProgress(sections: ChecklistSection[]): { completed: number; total: number; percentage: number } {
  let completed = 0;
  let total = 0;

  for (const section of sections) {
    for (const item of section.items) {
      total++;
      if (item.checked || item.notApplicable) {
        completed++;
      }
    }
  }

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function isChecklistComplete(sections: ChecklistSection[]): boolean {
  const { completed, total } = calculateChecklistProgress(sections);
  return completed === total;
}

export function useGoLiveChecklist(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['go_live_checklist', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;

      const { data, error } = await (supabase as any)
        .from('go_live_checklists')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data as GoLiveChecklistData | null;
    },
    enabled: !!propertyId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<GoLiveChecklistData>) => {
      if (!propertyId) throw new Error('No property ID');

      const { data: existing } = await (supabase as any)
        .from('go_live_checklists')
        .select('id')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await (supabase as any)
          .from('go_live_checklists')
          .update(updates)
          .eq('property_id', propertyId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from('go_live_checklists')
          .insert({ property_id: propertyId, ...updates })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['go_live_checklist', propertyId] });
    },
  });

  const approveGoLive = useMutation({
    mutationFn: async (propertyAddress: string) => {
      if (!propertyId) throw new Error('No property ID');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update checklist with approval
      const { error: checklistError } = await (supabase as any)
        .from('go_live_checklists')
        .update({
          go_live_approved_at: new Date().toISOString(),
          go_live_approved_by: user.id,
        })
        .eq('property_id', propertyId);

      if (checklistError) throw checklistError;

      // Update property lifecycle
      const { error: propertyError } = await (supabase as any)
        .from('properties_v2')
        .update({
          lifecycle_stage: 'operational',
          lifecycle_status_date: new Date().toISOString(),
          operational_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', propertyId);

      if (propertyError) throw propertyError;

      // Log the activity
      await ActivityLoggers.goLive(propertyId, propertyAddress);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['go_live_checklist', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    },
  });

  return {
    checklist: query.data,
    isLoading: query.isLoading,
    updateChecklist: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
    approveGoLive: approveGoLive.mutate,
    isApproving: approveGoLive.isPending,
  };
}
