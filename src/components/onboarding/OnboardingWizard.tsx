import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Rocket, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { useDemoData } from '@/hooks/useDemoData';
import type { AddressData } from '@/components/maps/AddressAutocomplete';
import { TEXT } from '@/lib/design-tokens';

import { AboutYouStep } from './AboutYouStep';
import { GoalsStep } from './GoalsStep';
import { OrganizationStep } from './OrganizationStep';
import { FirstPropertyStep } from './FirstPropertyStep';
import { DemoDataStep } from './DemoDataStep';
import { CompletionStep } from './CompletionStep';
import { toast } from "sonner";

const STEPS = ['Welcome', 'About You', 'Your Goals', 'Organisation', 'First Property', 'Demo Data', 'Complete'] as const;
const TOTAL_PROGRESS_STEPS = STEPS.length - 1; // exclude "Complete" from progress

export function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const { seed: seedDemo } = useDemoData();

  const [step, setStep] = useState(0);

  // Step 1: About You
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [portfolioSize, setPortfolioSize] = useState('');

  // Step 2: Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Step 3: Organization
  const [orgName, setOrgName] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [regionFocus, setRegionFocus] = useState('');

  // Step 4: First Property
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [beds, setBeds] = useState('');
  const [propertyType, setPropertyType] = useState('single_let');
  const [currentValue, setCurrentValue] = useState('');

  // Step 5: Demo Data
  const [seedingDemo, setSeedingDemo] = useState(false);

  // --- Mutations ---

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabaseAny
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const saveAboutYou = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {};
      if (fullName.trim()) updates.full_name = fullName.trim();
      if (role) updates.role = role;
      if (Object.keys(updates).length === 0) return;
      const { error } = await supabaseAny
        .from('profiles')
        .update(updates)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
  });

  const saveGoals = useMutation({
    mutationFn: async () => {
      if (selectedGoals.length === 0) return;
      const { error } = await supabaseAny
        .from('profiles')
        .update({ onboarding_goals: selectedGoals })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
  });

  const saveOrganization = useMutation({
    mutationFn: async () => {
      if (!org?.id) return;
      if (orgName.trim()) {
        updateOrg.mutate({ orgId: org.id, name: orgName.trim() });
      }
      if (portfolioSize) {
        await supabaseAny
          .from('organizations')
          .update({ estimated_portfolio_size: portfolioSize })
          .eq('id', org.id);
      }
    },
  });

  const createProperty = useMutation({
    mutationFn: async () => {
      if (!address.trim()) return;
      const orgId = await fetchUserOrgId();
      const { data: entities } = await supabaseAny
        .from('legal_entities')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);
      let resolvedEntityId = entities?.[0]?.id;
      if (!resolvedEntityId) {
        const { data: newEntity, error: entErr } = await supabaseAny
          .from('legal_entities')
          .insert({ org_id: orgId, entity_name: orgName.trim() || 'My Company', entity_type: 'personal' })
          .select('id')
          .single();
        if (entErr) throw entErr;
        resolvedEntityId = newEntity.id;
      }
      const { error } = await supabaseAny
        .from('properties_v2')
        .insert({
          org_id: orgId,
          entity_id: resolvedEntityId,
          address_line_1: address.trim(),
          city: '',
          postcode: postcode.trim().toUpperCase(),
          country: 'England',
          property_type: propertyType,
          lifecycle_stage: 'pipeline',
          total_lettable_rooms: parseInt(beds) || 0,
          current_valuation: parseInt(currentValue) || undefined,
        });
      if (error) throw error;
    },
  });

  // --- Step persistence on navigation ---

  const saveCurrentStep = async () => {
    try {
      switch (step) {
        case 1: // About You
          await saveAboutYou.mutateAsync();
          break;
        case 2: // Goals
          await saveGoals.mutateAsync();
          break;
        case 3: // Organization
          await saveOrganization.mutateAsync();
          break;
        case 4: // First Property
          await createProperty.mutateAsync();
          if (address.trim()) {
            queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
          }
          break;
        // Steps 0, 5, 6 don't need explicit saves
      }
    } catch (error) {
      console.error('Failed to save onboarding step:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Something went wrong' });
      throw error; // prevent advancing
    }
  };

  const handleNext = async () => {
    await saveCurrentStep();
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  const handleSkip = () => {
    setStep(s => s + 1);
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      await seedDemo.mutateAsync();
      await completeOnboarding.mutateAsync();
      navigate('/dashboard');
    } catch {
      setSeedingDemo(false);
    }
  };

  const handleFinish = async () => {
    await completeOnboarding.mutateAsync();
    navigate('/dashboard');
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // --- Progress ---
  const progressPercent = step === 0 ? 0 : Math.min((step / TOTAL_PROGRESS_STEPS) * 100, 100);
  const isLastStep = step === STEPS.length - 1;

  // --- Determine button labels ---
  const getNextLabel = () => {
    if (step === 0) return 'Get Started';
    if (step === 4) return address.trim() ? 'Add & Continue' : undefined; // Skip shown separately
    return 'Next';
  };

  const showSkip = () => {
    return (step >= 1 && step <= 4);
  };

  const canProceed = () => {
    // All steps can be skipped, but "Next" requires minimum data
    if (step === 1) return fullName.trim().length > 0;
    if (step === 3) return orgName.trim().length > 0;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg bg-card border-border">
        {/* Progress bar */}
        {step > 0 && !isLastStep && (
          <div className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Step {step} of {TOTAL_PROGRESS_STEPS}</span>
              <span className="text-xs text-muted-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        )}

        <CardContent className={`${step > 0 && !isLastStep ? 'pt-5' : 'pt-8'} pb-6 px-6 space-y-4`}>
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="space-y-5 text-center">
              <Rocket className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-2">
                <h2 className={TEXT.pageTitle}>Welcome to Tenure IQ</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Set up your portfolio in under 2 minutes. Track compliance, manage tenants, monitor cashflow — all in one place.
                </p>
              </div>
            </div>
          )}

          {/* Step 1 — About You */}
          {step === 1 && (
            <AboutYouStep
              fullName={fullName}
              onFullNameChange={setFullName}
              role={role}
              onRoleChange={setRole}
              portfolioSize={portfolioSize}
              onPortfolioSizeChange={setPortfolioSize}
            />
          )}

          {/* Step 2 — Goals */}
          {step === 2 && (
            <GoalsStep selectedGoals={selectedGoals} onToggleGoal={toggleGoal} />
          )}

          {/* Step 3 — Organization */}
          {step === 3 && (
            <OrganizationStep
              orgName={orgName}
              onOrgNameChange={setOrgName}
              propertyTypes={propertyTypes}
              onTogglePropertyType={togglePropertyType}
              regionFocus={regionFocus}
              onRegionFocusChange={setRegionFocus}
            />
          )}

          {/* Step 4 — First Property */}
          {step === 4 && (
            <FirstPropertyStep
              address={address}
              onAddressChange={setAddress}
              onAddressSelect={(data: AddressData) => {
                setAddress(data.address_line);
                if (data.postcode) setPostcode(data.postcode);
              }}
              postcode={postcode}
              onPostcodeChange={setPostcode}
              beds={beds}
              onBedsChange={setBeds}
              propertyType={propertyType}
              onPropertyTypeChange={setPropertyType}
              currentValue={currentValue}
              onCurrentValueChange={setCurrentValue}
            />
          )}

          {/* Step 5 — Demo Data */}
          {step === 5 && (
            <DemoDataStep
              seeding={seedingDemo}
              onSeedDemo={handleSeedDemo}
              onSkip={async () => {
                await completeOnboarding.mutateAsync();
                navigate('/dashboard');
              }}
            />
          )}

          {/* Step 6 — Complete */}
          {step === 6 && (
            <CompletionStep
              fullName={fullName}
              orgName={orgName}
              selectedGoals={selectedGoals}
              onGoToDashboard={handleFinish}
              onAddProperty={() => {
                completeOnboarding.mutate();
                navigate('/properties-v2');
              }}
              onUploadDocument={() => {
                completeOnboarding.mutate();
                navigate('/compliance-v2');
              }}
            />
          )}

          {/* Navigation — steps 0-4 */}
          {step <= 4 && (
            <div className="flex items-center justify-between pt-2">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                {showSkip() && (
                  <Button variant="ghost" size="sm" onClick={handleSkip}>
                    Skip
                  </Button>
                )}
                {getNextLabel() && (
                  <Button onClick={handleNext} disabled={!canProceed()} size="sm">
                    {getNextLabel()}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                {step === 4 && !address.trim() && (
                  <Button onClick={handleSkip} size="sm">
                    Skip for now
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
