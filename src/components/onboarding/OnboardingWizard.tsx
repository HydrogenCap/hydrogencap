import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Home, Rocket, ArrowRight, ArrowLeft, CheckCircle2, User, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { AddressAutocomplete, type AddressData } from '@/components/maps/AddressAutocomplete';

const STEPS = ['Welcome', 'About You', 'Organization', 'First Property', 'Your Goals', 'Complete'];

const ROLES = [
  { value: 'individual_landlord', label: 'Individual Landlord' },
  { value: 'portfolio_manager', label: 'Portfolio Manager' },
  { value: 'property_developer', label: 'Property Developer' },
  { value: 'letting_agent', label: 'Letting Agent' },
  { value: 'other', label: 'Other' },
];

const PORTFOLIO_SIZES = [
  { value: '1-5', label: '1–5 properties' },
  { value: '6-20', label: '6–20 properties' },
  { value: '20-50', label: '20–50 properties' },
  { value: '50+', label: '50+' },
];

const PROPERTY_TYPES = [
  { value: 'single_let', label: 'Single Let' },
  { value: 'hmo_licensed', label: 'HMO (Licensed)' },
  { value: 'hmo_mandatory', label: 'HMO (Mandatory)' },
  { value: 'multi_unit', label: 'Multi-Unit' },
];

const GOALS = [
  { id: 'compliance', label: 'Compliance tracking', description: 'Never miss an expiry' },
  { id: 'rent', label: 'Rent collection & arrears', description: 'Monitor payments' },
  { id: 'cashflow', label: 'Financial performance', description: 'Cashflow & reporting' },
  { id: 'tenants', label: 'Tenant management', description: 'Manage tenancies' },
  { id: 'lending', label: 'Mortgage & lender reporting', description: 'Track LTV & rates' },
  { id: 'team', label: 'Team collaboration', description: 'Work with partners' },
];

export function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [step, setStep] = useState(0);
  // About You
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  // Organization
  const [orgName, setOrgName] = useState('');
  const [portfolioSize, setPortfolioSize] = useState('');
  // Property
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState('single_let');
  const [rooms, setRooms] = useState('');
  // Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const isHmo = propertyType.includes('hmo');

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
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
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, role })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
  });

  const saveGoals = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_goals: selectedGoals })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
  });

  const createProperty = useMutation({
    mutationFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data: entities } = await supabase
        .from('legal_entities')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);
      let resolvedEntityId = entities?.[0]?.id;
      if (!resolvedEntityId) {
        const { data: newEntity, error: entErr } = await supabase
          .from('legal_entities')
          .insert({ org_id: orgId, entity_name: orgName.trim() || 'My Company', entity_type: 'personal' })
          .select('id')
          .single();
        if (entErr) throw entErr;
        resolvedEntityId = newEntity.id;
      }
      const { error } = await supabase
        .from('properties_v2')
        .insert({
          org_id: orgId,
          entity_id: resolvedEntityId,
          address_line_1: address.trim(),
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'England',
          property_type: propertyType,
          lifecycle_stage: 'pipeline',
          total_lettable_rooms: parseInt(rooms) || 0,
        });
      if (error) throw error;
    },
  });

  const handleNext = async () => {
    try {
      // Step 1 — About You: save profile
      if (step === 1 && firstName.trim()) {
        await saveAboutYou.mutateAsync();
      }
      // Step 2 — Organization: save org name + portfolio size
      if (step === 2 && orgName.trim() && org?.id) {
        updateOrg.mutate({ orgId: org.id, name: orgName.trim() });
        if (portfolioSize) {
          await supabase
            .from('organizations')
            .update({ estimated_portfolio_size: portfolioSize })
            .eq('id', org.id);
        }
      }
      // Step 3 — Property: create if address provided
      if (step === 3 && address.trim()) {
        await createProperty.mutateAsync();
        queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
      }
      // Step 4 — Goals: save selections
      if (step === 4 && selectedGoals.length > 0) {
        await saveGoals.mutateAsync();
      }
      // Step 5 — Complete: finish onboarding
      if (step === STEPS.length - 1) {
        await completeOnboarding.mutateAsync();
        navigate('/dashboard');
        return;
      }
      setStep(s => s + 1);
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
  };

  const canProceed = () => {
    if (step === 1) return firstName.trim().length > 0;
    if (step === 2) return orgName.trim().length > 0;
    if (step === 3) return true; // optional
    return true;
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
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
                className={`h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                } ${i === step ? 'w-6' : 'w-2'}`}
              />
            ))}
          </div>

          {step === 0 && (
            <>
              <Rocket className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-2xl">Welcome to Hydrogen Capital</CardTitle>
              <CardDescription>
                Set up your portfolio in under 2 minutes. Track compliance, manage tenants, monitor cashflow — all in one place.
              </CardDescription>
            </>
          )}
          {step === 1 && (
            <>
              <User className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>About You</CardTitle>
              <CardDescription>Tell us a bit about yourself so we can tailor your experience.</CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <Building2 className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>Your Organisation</CardTitle>
              <CardDescription>Name your property portfolio or company.</CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <Home className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>Add your first property</CardTitle>
              <CardDescription>You can skip this and add properties later.</CardDescription>
            </>
          )}
          {step === 4 && (
            <>
              <Target className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle>What matters most to you?</CardTitle>
              <CardDescription>We'll tailor your dashboard and checklist accordingly.</CardDescription>
            </>
          )}
          {step === 5 && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
              <CardTitle>You're all set{firstName ? `, ${firstName}` : ''}!</CardTitle>
              <CardDescription>
                {orgName && <span className="block">{orgName}</span>}
                Your setup checklist will guide you through the next steps.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 — About You */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="David"
                    className="bg-input border-border"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Your role</Label>
                <RadioGroup value={role} onValueChange={setRole} className="grid grid-cols-1 gap-2">
                  {ROLES.map(r => (
                    <div key={r.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={r.value} id={`role-${r.value}`} />
                      <Label htmlFor={`role-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 2 — Organization */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Smith Property Holdings"
                  className="bg-input border-border"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Portfolio size</Label>
                <RadioGroup value={portfolioSize} onValueChange={setPortfolioSize} className="grid grid-cols-2 gap-2">
                  {PORTFOLIO_SIZES.map(s => (
                    <div key={s.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={s.value} id={`size-${s.value}`} />
                      <Label htmlFor={`size-${s.value}`} className="font-normal cursor-pointer">{s.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 3 — First Property */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <AddressAutocomplete
                  value={address}
                  onChange={val => setAddress(val)}
                  onAddressSelect={(data: AddressData) => {
                    setAddress(data.address_line);
                    if (data.postcode) setPostcode(data.postcode);
                    if (data.town_city) setCity(data.town_city);
                  }}
                  placeholder="Start typing an address..."
                  className="bg-input border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="London"
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={postcode}
                    onChange={e => setPostcode(e.target.value)}
                    placeholder="SW1A 2AA"
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Property type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isHmo && (
                <div className="space-y-2">
                  <Label htmlFor="rooms">How many lettable rooms?</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min="1"
                    value={rooms}
                    onChange={e => setRooms(e.target.value)}
                    placeholder="e.g. 5"
                    className="bg-input border-border"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Goals */}
          {step === 4 && (
            <div className="space-y-3">
              {GOALS.map(goal => (
                <label
                  key={goal.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedGoals.includes(goal.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <Checkbox
                    checked={selectedGoals.includes(goal.id)}
                    onCheckedChange={() => toggleGoal(goal.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-sm">{goal.label}</div>
                    <div className="text-xs text-muted-foreground">{goal.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Navigation buttons */}
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
              {step === 2 && 'Continue'}
              {step === 3 && (address.trim() ? 'Add & Continue' : 'Skip')}
              {step === 4 && (selectedGoals.length > 0 ? 'Continue' : 'Skip')}
              {step === 5 && 'Go to Dashboard'}
              {step < 5 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
