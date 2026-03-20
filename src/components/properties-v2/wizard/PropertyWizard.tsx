import { useState } from 'react';
import { captureError } from '@/lib/sentry';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCreatePropertyV2 } from '@/hooks/usePropertiesV2';
import { useBulkCreateRooms } from '@/hooks/useRoomsV2';
import { useCreateLoanFacility } from '@/hooks/useLoanFacilities';
import { useLenders, useCreateLender } from '@/hooks/useLenders';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

import { StepAddress } from './StepAddress';
import { StepClassification } from './StepClassification';
import { StepRooms } from './StepRooms';
import { StepFinancials } from './StepFinancials';
import { StepCompliance } from './StepCompliance';
import { StepReview } from './StepReview';
import { INITIAL_WIZARD_DATA, STEP_LABELS, type WizardData } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PropertyWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...INITIAL_WIZARD_DATA });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const createProperty = useCreatePropertyV2();
  const bulkCreateRooms = useBulkCreateRooms();
  const createLoan = useCreateLoanFacility();
  const createLender = useCreateLender();

  const TOTAL_STEPS = STEP_LABELS.length;

  const onChange = (partial: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0: // Address
        return !!(data.postcode && data.address_line_1 && data.city);
      case 1: // Classification
        return !!(data.entity_id && data.property_type && data.lifecycle_stage);
      case 2: // Rooms
        // Single let skips rooms or at least 1 room
        if (data.property_type === 'single_let') return true;
        return data.rooms.length > 0;
      case 3: // Financials - all optional
        return true;
      case 4: // Compliance - all optional
        return true;
      case 5: // Review
        return true;
      default:
        return false;
    }
  };

  // For single let, auto-create a whole-property room if step 2 is skipped
  const shouldSkipRooms = data.property_type === 'single_let';

  const goNext = () => {
    let next = step + 1;
    if (next === 2 && shouldSkipRooms && data.rooms.length === 0) {
      // Auto-create a single room for single-let
      onChange({
        rooms: [{
          room_name: 'Whole Property',
          room_type: 'double',
          floor: 0,
          has_ensuite: false,
          is_lettable: true,
          target_rent_pcm: null,
        }],
      });
      next = 3; // Skip rooms step
    }
    setStep(Math.min(next, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    let prev = step - 1;
    if (prev === 2 && shouldSkipRooms) prev = 1;
    setStep(Math.max(prev, 0));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const orgId = await fetchUserOrgId();

      // 1. Create property
      const property = await createProperty.mutateAsync({
        entity_id: data.entity_id,
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || null,
        city: data.city,
        county: data.county || null,
        postcode: data.postcode,
        country: data.country || 'England',
        property_type: data.property_type,
        lifecycle_stage: data.lifecycle_stage,
        has_gas_supply: data.has_gas_supply,
        year_built: data.year_built ? parseInt(data.year_built) : null,
        total_floors: data.total_floors ? parseInt(data.total_floors) : null,
        total_lettable_rooms: data.rooms.filter(r => r.is_lettable).length,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : null,
        current_valuation: data.current_valuation ? parseFloat(data.current_valuation) : null,
        valuation_date: data.valuation_date || null,
        council_name: null,
        council_area: null,
        listing_grade: 'none',
        rent_basis: 'room',
        whole_house_rent_pcm: null,
        latitude: null,
        longitude: null,
        notes: null,
      });

      // Update HMO licence number if provided (column added via migration)
      if (data.hmo_licence_number) {
        await supabase
          .from('properties_v2')
          .update({ hmo_licence_number: data.hmo_licence_number } as any)
          .eq('id', property.id);
      }

      // 2. Create rooms
      if (data.rooms.length > 0) {
        try {
          await bulkCreateRooms.mutateAsync(
            data.rooms.map(r => ({
              property_id: property.id,
              room_name: r.room_name,
              room_type: r.room_type as any,
              floor: r.floor,
              has_ensuite: r.has_ensuite,
              is_lettable: r.is_lettable,
              current_rent_pcm: null,
              target_rent_pcm: r.target_rent_pcm,
              occupancy_status: 'vacant' as const,
              notes: null,
            }))
          );
        } catch (err) {
          console.error('Room creation failed:', err);
        }
      }

      // 3. Create loan facility if mortgage
      if (data.has_mortgage && data.lender_name && data.original_amount) {
        try {
          // Upsert lender
          const { data: lenderData } = await supabase
            .from('lenders')
            .upsert(
              { org_id: orgId, lender_name: data.lender_name, lender_type: 'specialist_btl' },
              { onConflict: 'org_id,lender_name' }
            )
            .select('id')
            .single();

          if (lenderData) {
            const today = new Date().toISOString().slice(0, 10);
            await createLoan.mutateAsync({
              property_id: property.id,
              lender_id: lenderData.id,
              entity_id: data.entity_id,
              facility_type: data.facility_type || 'term_mortgage',
              original_amount: parseFloat(data.original_amount) || 0,
              current_balance: parseFloat(data.current_balance) || parseFloat(data.original_amount) || 0,
              interest_rate: parseFloat(data.interest_rate) || 0,
              rate_type: data.rate_type || 'fixed',
              rate_expiry_date: data.rate_expiry_date || null,
              revert_rate: null,
              monthly_payment: data.monthly_payment ? parseFloat(data.monthly_payment) : null,
              term_start_date: today,
              term_end_date: data.term_end_date || new Date(Date.now() + 365 * 25 * 86400000).toISOString().slice(0, 10),
              early_repayment_charge_until: null,
              erc_percentage: null,
              ltv_at_drawdown: null,
              current_ltv: null,
              interest_only: true,
              repayment_type: 'interest_only',
              arrangement_fee: null,
              valuation_fee: null,
              legal_fee: null,
              total_setup_costs: null,
              covenant_ltv_max: data.ltv_covenant ? parseFloat(data.ltv_covenant) : null,
              covenant_icr_min: null,
              product_name: null,
              account_reference: null,
              status: 'active',
              notes: null,
            });
          }
        } catch (err) {
          console.error('Loan creation failed:', err);
          toast({ title: 'Property created', description: 'Mortgage details could not be saved. You can add them on the property page.', variant: 'default' });
        }
      }

      // 4. Create compliance requirements
      const enabledCompliance = data.compliance_items.filter(c => c.is_required);
      if (enabledCompliance.length > 0) {
        try {
          await supabase.from('compliance_requirements_v2').insert(
            enabledCompliance.map(c => ({
              property_id: property.id,
              org_id: orgId,
              document_type: c.document_type,
              is_required: true,
              review_frequency_months: c.review_frequency_months,
              lead_time_days: c.lead_time_days,
            }))
          );

          // Create compliance documents for items with dates
          const withDates = enabledCompliance.filter(c => c.issue_date);
          if (withDates.length > 0) {
            await supabase.from('compliance_documents_v2').insert(
              withDates.map(c => ({
                property_id: property.id,
                org_id: orgId,
                document_type: c.document_type,
                issue_date: c.issue_date,
                expiry_date: c.expiry_date || null,
                certificate_number: c.certificate_number || null,
                status: 'valid',
                is_current: true,
              }))
            );
          }
        } catch (err) {
          console.error('Compliance creation failed:', err);
          toast({ title: 'Property created', description: 'Some compliance details could not be saved.', variant: 'default' });
        }
      }

      toast({ title: `Property created with ${data.rooms.length} room${data.rooms.length !== 1 ? 's' : ''}` });
      onOpenChange(false);
      setData({ ...INITIAL_WIZARD_DATA });
      setStep(0);
      navigate(`/properties-v2/${property.id}`);
    } catch (err: any) {
      console.error('Property creation failed:', err);
      toast({ title: 'Failed to create property', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Don't reset state so user can reopen
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <StepAddress data={data} onChange={onChange} />;
      case 1: return <StepClassification data={data} onChange={onChange} />;
      case 2: return <StepRooms data={data} onChange={onChange} />;
      case 3: return <StepFinancials data={data} onChange={onChange} />;
      case 4: return <StepCompliance data={data} onChange={onChange} />;
      case 5: return <StepReview data={data} goToStep={setStep} />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header with progress */}
        <div className="px-6 pt-6 pb-4 border-b">
          <h2 className="text-lg font-semibold mb-4">Add Property</h2>
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors',
                    i < step ? 'bg-primary text-primary-foreground cursor-pointer' :
                    i === step ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </button>
                <span className={cn(
                  'text-xs font-medium hidden md:inline whitespace-nowrap',
                  i === step ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
                {i < TOTAL_STEPS - 1 && (
                  <div className={cn('h-px flex-1 min-w-2', i < step ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="border-t px-6 py-3 flex justify-between items-center">
          <Button variant="outline" onClick={goBack} disabled={step === 0}>Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={goNext} disabled={!isStepValid()}>Continue</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !isStepValid()}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <><Building2 className="h-4 w-4 mr-2" /> Create Property</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
