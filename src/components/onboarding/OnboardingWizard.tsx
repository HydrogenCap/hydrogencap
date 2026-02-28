import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Home, Rocket, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { AddressAutocomplete, type AddressData } from '@/components/maps/AddressAutocomplete';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

const STEPS = ['Welcome', 'Organization', 'First Property', 'Complete'];

export function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const createProperty = useMutation({
    mutationFn: async () => {
      const orgId = await fetchUserOrgId();
      // OnboardingWizard needs an entity_id for V2 — find or create a default entity
      const { data: entities } = await supabase
        .from('legal_entities')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);
      const entityId = entities?.[0]?.id;
      if (!entityId) {
        // Create a default entity for the org
        const { data: newEntity, error: entErr } = await supabase
          .from('legal_entities')
          .insert({ org_id: orgId, entity_name: 'My Company', entity_type: 'individual' })
          .select('id')
          .single();
        if (entErr) throw entErr;
        var resolvedEntityId = newEntity.id;
      } else {
        var resolvedEntityId = entityId;
      }
      const { error } = await supabase
        .from('properties_v2')
        .insert({
          org_id: orgId,
          entity_id: resolvedEntityId,
          address_line_1: address.trim(),
          city: city || '',
          postcode: postcode.trim().toUpperCase(),
          property_type: 'single_let',
          lifecycle_stage: 'stabilised',
        });
      if (error) throw error;
    },
  });

  const handleNext = async () => {
    if (step === 1 && orgName.trim() && org?.id) {
      updateOrg.mutate({ orgId: org.id, name: orgName.trim() });
    }
    if (step === 2 && address.trim()) {
      try {
        await createProperty.mutateAsync();
        queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
      } catch {
        toast({ title: 'Failed to add property', variant: 'destructive' });
        return;
      }
    }
    if (step === STEPS.length - 1) {
      await completeOnboarding.mutateAsync();
      navigate('/dashboard');
      return;
    }
    setStep(s => s + 1);
  };

  const canProceed = () => {
    if (step === 1) return orgName.trim().length > 0;
    if (step === 2) return true; // optional
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg bg-card border-border">
        <CardHeader className="text-center">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <>
              <Rocket className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-2xl">Welcome to Hydrogen Capital</CardTitle>
              <CardDescription>
                Let's set up your portfolio in under 2 minutes.
              </CardDescription>
            </>
          )}
          {step === 1 && (
            <>
              <Building2 className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>Name your organization</CardTitle>
              <CardDescription>This is the name of your property portfolio or company.</CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <Home className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>Add your first property</CardTitle>
              <CardDescription>You can skip this and add properties later.</CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <CardTitle>You're all set!</CardTitle>
              <CardDescription>Your portfolio is ready. Head to the dashboard to get started.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Smith Property Holdings"
                className="bg-input border-border"
                autoFocus
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <GoogleMapsProvider>
                  <AddressAutocomplete
                    value={address}
                    onChange={(val) => setAddress(val)}
                    onAddressSelect={(data: AddressData) => {
                      setAddress(data.address_line);
                      if (data.postcode) setPostcode(data.postcode);
                      if (data.town_city) setCity(data.town_city);
                    }}
                    placeholder="Start typing an address..."
                    className="bg-input border-border"
                  />
                </GoogleMapsProvider>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="e.g. SW1A 2AA"
                  className="bg-input border-border"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            {step > 0 && step < STEPS.length - 1 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleNext} disabled={!canProceed()}>
              {step === 0 && 'Get Started'}
              {step === 1 && 'Continue'}
              {step === 2 && (address.trim() ? 'Add & Continue' : 'Skip')}
              {step === 3 && 'Go to Dashboard'}
              {step < 3 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
