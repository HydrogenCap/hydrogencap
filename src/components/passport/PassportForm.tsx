import React, { useEffect, useState } from 'react';
import { captureError } from '@/lib/sentry';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, ChevronDown, ChevronRight, Settings2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePropertyPassport, useUpsertPassport, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useToast } from '@/hooks/use-toast';
import { useManagementCompanies, useCreateManagementCompany, useSeedDefaultManagementCompany } from '@/hooks/useManagementCompanies';
import { ExtendableSelect } from './ExtendableSelect';
import { AutofillSuggestionsModal } from './AutofillSuggestionsModal';
import { useGenerateSuggestions } from '@/hooks/usePassportAutofill';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';

// Simplified schema - only essential fields
const passportSchema = z.object({
  // TIER 1 - CORE DATA
  // Classification
  asset_agreement_category: z.string().nullable().optional(),
  
  // Accommodation (ensuites, kitchens, living rooms - beds/bathrooms are in properties table)
  ensuites: z.coerce.number().min(0).max(50).nullable().optional(),
  kitchens: z.coerce.number().min(0).max(50).nullable().optional(),
  living_rooms_communal: z.coerce.number().min(0).max(50).nullable().optional(),
  
  // Management
  management_company_id: z.string().nullable().optional(),
  property_management_fee_percent: z.coerce.number().min(0).max(100).nullable().optional(),

  // TIER 2 - ADVANCED/OPTIONAL
  // Construction
  construction_date_band: z.string().nullable().optional(),
  
  // Access & Emergencies
  keysafe_code: z.string().nullable().optional(),
  loft_access: z.string().nullable().optional(),
  block_communal_entrance: z.string().nullable().optional(),
  
  // Utilities (simplified)
  has_gas_supply: z.boolean().default(true),
  meter_notes: z.string().nullable().optional(), // Single free text field
  
  // Amenities
  has_bin_store: z.boolean().default(false),
  has_cycle_store: z.boolean().default(false),
});

type PassportFormData = z.infer<typeof passportSchema>;

interface PassportFormProps {
  propertyId: string;
  highlightMissing?: boolean;
}

export function PassportForm({ propertyId, highlightMissing = false }: PassportFormProps) {
  const { toast } = useToast();
  const { data: passport, isLoading } = usePropertyPassport(propertyId);
  const upsertPassport = useUpsertPassport();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autofillModalOpen, setAutofillModalOpen] = useState(false);
  const [constructionEstimate, setConstructionEstimate] = useState<{
    estimatedYear: number;
    constructionDateBand: string;
    confidence: string;
    reasoning: string;
  } | null>(null);
  const [isEstimatingConstruction, setIsEstimatingConstruction] = useState(false);
  const generateSuggestions = useGenerateSuggestions();
  
  // Management companies
  const { data: managementCompanies = [] } = useManagementCompanies();
  const createManagementCompany = useCreateManagementCompany();
  const seedDefaultManagement = useSeedDefaultManagementCompany();

  // Seed default management company on mount
  useEffect(() => {
    seedDefaultManagement.mutate();
  }, [seedDefaultManagement]);

  const form = useForm<PassportFormData>({
    resolver: zodResolver(passportSchema),
    defaultValues: getDefaultValues(null),
  });

  // Update form when data loads
  useEffect(() => {
    if (passport) {
      form.reset(getDefaultValues(passport));
      // Auto-expand advanced section if it has data
      const hasAdvancedData = !!(
        passport.construction_date_band ||
        passport.keysafe_code ||
        passport.loft_access ||
        passport.has_bin_store ||
        passport.has_cycle_store
      );
      if (hasAdvancedData) {
        setAdvancedOpen(true);
      }
    }
  }, [passport, form]);

  const onSubmit = async (data: PassportFormData) => {
    try {
      // Extract meter_notes and map to existing DB field
      const { meter_notes, ...dbFields } = data;
      
      await upsertPassport.mutateAsync({
        property_id: propertyId,
        ...dbFields,
        // Store combined meter notes in electric_meter_location field
        electric_meter_location: meter_notes || null,
      });
      toast({
        title: 'Passport saved',
        description: "Your changes are now part of this property's passport.",
      });
    } catch (err) {
      console.error('Passport save error:', err);
      captureError(err, 'PassportForm.save');
      toast({
        title: "Passport didn't save",
        description: 'Something blocked the save — try once more.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if advanced section has any data
  const hasAdvancedData = !!(
    form.watch('construction_date_band') ||
    form.watch('keysafe_code') ||
    form.watch('loft_access') ||
    form.watch('has_bin_store') ||
    form.watch('has_cycle_store') ||
    form.watch('meter_notes')
  );

  const handleAutofillClick = async () => {
    try {
      await generateSuggestions.mutateAsync(propertyId);
      setAutofillModalOpen(true);
    } catch (error) {
      toast({
        title: 'AI suggestions unavailable',
        description: error instanceof Error ? error.message : 'Failed to generate suggestions',
        variant: 'destructive',
      });
    }
  };

  const handleEstimateConstruction = async () => {
    setIsEstimatingConstruction(true);
    setConstructionEstimate(null);
    try {
      const data = await invokeEdgeFunction<{ success: boolean; error?: string; suggestion: { estimatedYear: number; constructionDateBand: string; confidence: string; reasoning: string } }>('estimate-construction-year', { propertyId });
      if (!data?.success) throw new Error(data?.error || 'Failed to estimate');

      setConstructionEstimate(data.suggestion);
      // Auto-expand advanced section to show result
      setAdvancedOpen(true);
      
      toast({
        title: 'Build period inferred',
        description: `AI suggests ~${data.suggestion.estimatedYear} (${data.suggestion.confidence} confidence)`,
      });
    } catch (error) {
      console.error('Construction estimate error:', error);
      toast({
        title: "Estimate didn't run",
        description: error instanceof Error ? error.message : 'Could not estimate construction year',
        variant: 'destructive',
      });
    } finally {
      setIsEstimatingConstruction(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <Card className="bg-muted/30 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Operational Details
            </CardTitle>
            <CardDescription>
              Property-specific operational data. Core property info (value, mortgage, rent) is managed in the Finance tab. 
              Ownership is managed in the Overview tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleAutofillClick}
                disabled={generateSuggestions.isPending}
                className="gap-2"
              >
                {generateSuggestions.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Auto-fill with AI
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Autofill Modal */}
        <AutofillSuggestionsModal
          propertyId={propertyId}
          open={autofillModalOpen}
          onOpenChange={setAutofillModalOpen}
        />


        {/* ═══════════════════════════════════════════════════════════════════
            TIER 1 — CORE PROPERTY DATA (always visible)
           ═══════════════════════════════════════════════════════════════════ */}


        {/* Classification & Title */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Classification & Title</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="asset_agreement_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Single Let">Single Let</SelectItem>
                      <SelectItem value="Licensed HMO">Licensed HMO</SelectItem>
                      <SelectItem value="Unlicensed HMO">Unlicensed HMO</SelectItem>
                      <SelectItem value="SA">Serviced Accommodation</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Owner Occupier">Owner Occupier</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Note: Beds, Bathrooms, Tenure, and Title Number are now managed in the Properties table */}

        {/* Accommodation Schedule (additional rooms only) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Additional Accommodation</CardTitle>
            <CardDescription>
              Beds and bathrooms are managed in the main property details. Use this for additional room counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="ensuites"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ensuites</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kitchens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kitchens</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="living_rooms_communal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Living Rooms</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Note: HMO Licence is managed in the Compliance tab */}

        {/* Management */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Management</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="management_company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Management Company</FormLabel>
                  <FormControl>
                    <ExtendableSelect
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                      options={managementCompanies.map(mc => ({ id: mc.id, name: mc.name }))}
                      placeholder="Select or add company..."
                      addLabel="Add new company"
                      dialogTitle="Add Management Company"
                      dialogDescription="Enter the name of the management company."
                      inputLabel="Company Name"
                      inputPlaceholder="e.g. Property Management Ltd"
                      onAddNew={async (name) => {
                        const result = await createManagementCompany.mutateAsync(name);
                        return { id: result.id, name: result.name };
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="property_management_fee_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Management Fee (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" min="0" max="100" {...field} value={field.value ?? ''} placeholder="e.g. 10" />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            TIER 2 — ADVANCED / OPTIONAL (collapsed by default)
           ═══════════════════════════════════════════════════════════════════ */}
        
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-lg">Advanced Details</CardTitle>
                    {hasAdvancedData && !advancedOpen && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Has data</span>
                    )}
                  </div>
                  {advancedOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <CardDescription>Construction, access, utilities & amenities</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
                {/* Construction */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Construction</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEstimateConstruction}
                      disabled={isEstimatingConstruction}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {isEstimatingConstruction ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      AI Estimate
                    </Button>
                  </div>
                  
                  {constructionEstimate && (
                    <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">~{constructionEstimate.estimatedYear}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          constructionEstimate.confidence === 'high' 
                            ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                            : constructionEstimate.confidence === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {constructionEstimate.confidence} confidence
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 text-xs"
                          onClick={() => {
                            form.setValue('construction_date_band', constructionEstimate.constructionDateBand);
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{constructionEstimate.reasoning}</p>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="construction_date_band"
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>Construction Period</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Pre-1900">Pre-1900</SelectItem>
                            <SelectItem value="1900-1929">1900-1929</SelectItem>
                            <SelectItem value="1930-1949">1930-1949</SelectItem>
                            <SelectItem value="1950-1966">1950-1966</SelectItem>
                            <SelectItem value="1967-1975">1967-1975</SelectItem>
                            <SelectItem value="1976-1982">1976-1982</SelectItem>
                            <SelectItem value="1983-1990">1983-1990</SelectItem>
                            <SelectItem value="1991-1995">1991-1995</SelectItem>
                            <SelectItem value="1996-2002">1996-2002</SelectItem>
                            <SelectItem value="2003-2006">2003-2006</SelectItem>
                            <SelectItem value="2007 onwards">2007 onwards</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Access & Emergencies */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Access & Emergencies</h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="keysafe_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Keysafe Code</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value ?? ''} 
                              placeholder="e.g. 1234"
                              className={highlightMissing && !field.value ? 'border-warning bg-warning/5' : ''}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">For emergency contractor access</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="loft_access"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loft Access Notes</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. Padlocked - code 4963" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="block_communal_entrance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Notes</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. Communal entrance code" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Utilities */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Utilities</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="has_gas_supply"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl>
                            <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Mains Gas Supply</FormLabel>
                            <FormDescription className="text-xs">Toggle off for oil or electric-only</FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="meter_notes"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Meter Locations</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. Electric: under stairs; Gas: external cupboard; Stop tap: kitchen" />
                          </FormControl>
                          <FormDescription className="text-xs">Free text notes on meter and stop tap locations</FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Amenities</h4>
                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="has_bin_store"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Bin Store</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_cycle_store"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Cycle Store</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={upsertPassport.isPending}>
            {upsertPassport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Passport
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function getDefaultValues(passport: PropertyPassport | null): PassportFormData {
  return {
    // TIER 1 - CORE
    asset_agreement_category: passport?.asset_agreement_category ?? null,
    // Note: beds, bathrooms, tenure are now in properties table, not passport
    ensuites: passport?.ensuites ?? null,
    kitchens: passport?.kitchens ?? null,
    living_rooms_communal: passport?.living_rooms_communal ?? null,
    // Note: HMO Licence is managed in Compliance tab
    management_company_id: passport?.management_company_id ?? null,
    property_management_fee_percent: passport?.property_management_fee_percent ? Number(passport.property_management_fee_percent) : null,
    
    // TIER 2 - ADVANCED
    construction_date_band: passport?.construction_date_band ?? null,
    keysafe_code: passport?.keysafe_code ?? null,
    loft_access: passport?.loft_access ?? null,
    block_communal_entrance: passport?.block_communal_entrance ?? null,
    has_gas_supply: passport?.has_gas_supply ?? true,
    // Use electric_meter_location to store meter notes
    meter_notes: passport?.electric_meter_location ?? null,
    has_bin_store: passport?.has_bin_store ?? false,
    has_cycle_store: passport?.has_cycle_store ?? false,
  };
}
