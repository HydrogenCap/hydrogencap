import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { usePropertyPassport, useUpsertPassport, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useToast } from '@/hooks/use-toast';
import { formatDateUK } from '@/lib/calculations';
import { useLocalAuthorities, useFindOrCreateLocalAuthority } from '@/hooks/useLocalAuthorities';
import { useManagementCompanies, useCreateManagementCompany, useSeedDefaultManagementCompany } from '@/hooks/useManagementCompanies';
import { ExtendableSelect } from './ExtendableSelect';
import { usePropertyLookup, PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const passportSchema = z.object({
  // Location & classification
  town_city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  local_authority: z.string().nullable().optional(),
  local_authority_id: z.string().nullable().optional(),
  maintenance_area: z.string().nullable().optional(),
  asset_agreement_category: z.string().nullable().optional(),
  occupation_status: z.string().nullable().optional(),
  owned_by: z.string().nullable().optional(),
  owner_tenure: z.string().nullable().optional(),
  land_registry_title_number: z.string().nullable().optional(),
  council_tax_band: z.string().nullable().optional(),

  // Building basics
  built_in_year: z.coerce.number().min(1600).max(2100).nullable().optional(),
  construction_date_band: z.string().nullable().optional(),
  construction_type: z.string().nullable().optional(),
  number_of_storeys: z.coerce.number().min(1).max(200).nullable().optional(),
  basement: z.boolean().default(false),
  parking: z.string().nullable().optional(),

  // Access & safety
  keysafe_code: z.string().nullable().optional(),
  loft_access: z.string().nullable().optional(),
  has_loft_access: z.boolean().default(false),
  access_ramp: z.boolean().default(false),
  block_communal_entrance: z.string().nullable().optional(),
  communal_tv_supply: z.boolean().default(false),

  // Utilities & meters
  water_stop_tap_location: z.string().nullable().optional(),
  electric_meter_location: z.string().nullable().optional(),
  gas_meter_location: z.string().nullable().optional(),
  water_meter_location: z.string().nullable().optional(),
  electric_meter_number: z.string().nullable().optional(),
  gas_meter_number: z.string().nullable().optional(),
  water_meter_number: z.string().nullable().optional(),

  // Accommodation schedule
  kitchens: z.coerce.number().min(0).max(50).nullable().optional(),
  bedrooms: z.coerce.number().min(0).max(100).nullable().optional(),
  hmo_bed_spaces: z.coerce.number().min(0).max(200).nullable().optional(),
  bathrooms: z.coerce.number().min(0).max(50).nullable().optional(),
  wc_cloakroom: z.coerce.number().min(0).max(50).nullable().optional(),
  ensuites: z.coerce.number().min(0).max(50).nullable().optional(),
  living_rooms_communal: z.coerce.number().min(0).max(50).nullable().optional(),

  // Licensing & compliance
  hmo_licence_required: z.boolean().default(false),
  hmo_licence: z.boolean().default(false),
  hmo_licence_number: z.string().nullable().optional(),
  hmo_licence_expiry: z.string().nullable().optional(),
  asset_performance_rating: z.string().nullable().optional(),
  base_clarification: z.string().nullable().optional(),

  // Storage / amenities
  has_bin_store: z.boolean().default(false),
  has_cycle_store: z.boolean().default(false),
  has_guest_room: z.boolean().default(false),
  carport: z.boolean().default(false),

  // Links
  photographs_link: z.string().url().nullable().optional().or(z.literal('')),
  dropbox_link: z.string().url().nullable().optional().or(z.literal('')),

  // Management
  property_management_company: z.string().nullable().optional(),
  management_company_id: z.string().nullable().optional(),
  property_management_fee_percent: z.coerce.number().min(0).max(100).nullable().optional(),
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
  
  // Property lookup for auto-populate
  const { lookupProperty, isLooking } = usePropertyLookup();
  
  // Local authorities and management companies
  const { data: localAuthorities = [] } = useLocalAuthorities();
  const findOrCreateLocalAuthority = useFindOrCreateLocalAuthority();
  const { data: managementCompanies = [] } = useManagementCompanies();
  const createManagementCompany = useCreateManagementCompany();
  const seedDefaultManagement = useSeedDefaultManagementCompany();

  // Seed default management company on mount
  useEffect(() => {
    seedDefaultManagement.mutate();
  }, []);

  const form = useForm<PassportFormData>({
    resolver: zodResolver(passportSchema),
    defaultValues: getDefaultValues(null),
  });

  // Watch postcode for auto-populate
  const watchedPostcode = useWatch({ control: form.control, name: 'postcode' });

  // Update form when data loads
  useEffect(() => {
    if (passport) {
      form.reset(getDefaultValues(passport));
    }
  }, [passport, form]);

  // Handle auto-populate for passport fields
  const handleAutoPopulate = async () => {
    const postcode = watchedPostcode || passport?.postcode;
    if (!postcode) {
      toast({
        title: 'Postcode required',
        description: 'Please enter a postcode first.',
        variant: 'destructive',
      });
      return;
    }

    const result = await lookupProperty(postcode);
    if (!result) return;

    let updatedFields: string[] = [];

    // Auto-populate council tax band
    if (result.councilTax?.councilTaxBand && !form.getValues('council_tax_band')) {
      form.setValue('council_tax_band', result.councilTax.councilTaxBand);
      updatedFields.push('Council Tax Band');
    }

    // Auto-populate from EPC data
    if (result.epc) {
      if (result.epc.builtYear && !form.getValues('built_in_year')) {
        form.setValue('built_in_year', result.epc.builtYear);
        updatedFields.push('Built Year');
      }
      if (result.epc.constructionAgeBand && !form.getValues('construction_date_band')) {
        form.setValue('construction_date_band', result.epc.constructionAgeBand);
        updatedFields.push('Construction Age Band');
      }
      if (result.epc.bedrooms && !form.getValues('bedrooms')) {
        form.setValue('bedrooms', result.epc.bedrooms);
        updatedFields.push('Bedrooms');
      }
    }

    // Auto-populate local authority (match or create)
    if (result.location?.localAuthority) {
      const laName = result.location.localAuthority;
      const existingLA = localAuthorities.find(
        la => la.name.toLowerCase() === laName.toLowerCase()
      );

      if (existingLA) {
        form.setValue('local_authority_id', existingLA.id);
        updatedFields.push('Local Authority');
      } else {
        // Find or create the local authority
        try {
          const newLA = await findOrCreateLocalAuthority.mutateAsync(laName);
          form.setValue('local_authority_id', newLA.id);
          updatedFields.push('Local Authority');
        } catch {
          // Just update the text field as fallback
          form.setValue('local_authority', laName);
          updatedFields.push('Local Authority');
        }
      }

      // Also set county if available
      if (result.location.county && !form.getValues('county')) {
        form.setValue('county', result.location.county);
        updatedFields.push('County');
      }
    }

    if (updatedFields.length > 0) {
      toast({
        title: 'Passport data updated',
        description: `Auto-populated: ${updatedFields.join(', ')}`,
      });
    } else {
      toast({
        title: 'No new data found',
        description: 'All available fields are already filled.',
      });
    }
  };

  const onSubmit = async (data: PassportFormData) => {
    try {
      await upsertPassport.mutateAsync({
        property_id: propertyId,
        ...data,
        photographs_link: data.photographs_link || null,
        dropbox_link: data.dropbox_link || null,
      });
      toast({
        title: 'Passport saved',
        description: 'Property passport has been updated.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save passport.',
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

  const criticalFields = [
    'keysafe_code',
    'electric_meter_location',
    'gas_meter_location',
    'water_meter_location',
    'electric_meter_number',
    'gas_meter_number',
    'water_meter_number',
    'water_stop_tap_location',
  ];

  const getMissingClass = (fieldName: string) => {
    if (!highlightMissing) return '';
    const value = form.watch(fieldName as keyof PassportFormData);
    if (!value && criticalFields.includes(fieldName)) {
      return 'border-warning bg-warning/5';
    }
    return '';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Overview Section */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Location, authority, category & occupancy</CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoPopulate}
                    disabled={isLooking}
                    className="gap-2"
                  >
                    {isLooking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Looking up...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Auto-populate
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Fetch council tax band, built year, local authority from public registers
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="town_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Town/City</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="county"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="local_authority_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local Authority</FormLabel>
                  <FormControl>
                    <ExtendableSelect
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                      options={localAuthorities.map(la => ({ id: la.id, name: la.name }))}
                      placeholder="Select local authority..."
                      addLabel="Add new council"
                      dialogTitle="Add Local Authority"
                      dialogDescription="Enter the name of the local council."
                      inputLabel="Council Name"
                      inputPlaceholder="e.g. Birmingham City Council"
                      onAddNew={async (name) => {
                        const result = await findOrCreateLocalAuthority.mutateAsync(name);
                        return { id: result.id, name: result.name };
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maintenance_area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maintenance Area</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="asset_agreement_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BTL">BTL</SelectItem>
                      <SelectItem value="Licensed HMO">Licensed HMO</SelectItem>
                      <SelectItem value="Unlicensed HMO">Unlicensed HMO</SelectItem>
                      <SelectItem value="SA">Serviced Accommodation</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="occupation_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Occupied">Occupied</SelectItem>
                      <SelectItem value="Vacant">Vacant</SelectItem>
                      <SelectItem value="Refurbishment">Refurbishment</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="owned_by"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owned By</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g. SPV name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="owner_tenure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner Tenure</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenure" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Freehold">Freehold</SelectItem>
                      <SelectItem value="Leasehold">Leasehold</SelectItem>
                      <SelectItem value="Share of Freehold">Share of Freehold</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="land_registry_title_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="council_tax_band"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Council Tax Band</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select band" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(band => (
                        <SelectItem key={band} value={band}>{band}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Building Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Building</CardTitle>
            <CardDescription>Construction details & features</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="built_in_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Built In Year</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="construction_date_band"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Construction Date Band</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select band" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pre 1900">Pre 1900</SelectItem>
                      <SelectItem value="1900-1929">1900-1929</SelectItem>
                      <SelectItem value="1930-1949">1930-1949</SelectItem>
                      <SelectItem value="1950-1966">1950-1966</SelectItem>
                      <SelectItem value="1967-1975">1967-1975</SelectItem>
                      <SelectItem value="1976-1982">1976-1982</SelectItem>
                      <SelectItem value="1983-1990">1983-1990</SelectItem>
                      <SelectItem value="1991-1995">1991-1995</SelectItem>
                      <SelectItem value="1996-2002">1996-2002</SelectItem>
                      <SelectItem value="2003-2006">2003-2006</SelectItem>
                      <SelectItem value="2007-2011">2007-2011</SelectItem>
                      <SelectItem value="2012 onwards">2012 onwards</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="construction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Construction Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Solid Wall Construction">Solid Wall</SelectItem>
                      <SelectItem value="Cavity Wall Construction">Cavity Wall</SelectItem>
                      <SelectItem value="Timber Frame">Timber Frame</SelectItem>
                      <SelectItem value="Steel Frame">Steel Frame</SelectItem>
                      <SelectItem value="Concrete">Concrete</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="number_of_storeys"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Storeys</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parking</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g. Off-street, Garage" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="basement"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Has Basement</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Access Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>Keysafe, loft access & entry details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="keysafe_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keysafe Code</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('keysafe_code')} />
                  </FormControl>
                  <FormDescription>Critical for emergency access</FormDescription>
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
                    <Input {...field} value={field.value ?? ''} placeholder="e.g. Padlocked - 4963" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="has_loft_access"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Has Loft Access</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="access_ramp"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Access Ramp</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="block_communal_entrance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Block/Communal Entrance</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="N/A or notes" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="communal_tv_supply"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Communal TV Supply</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Utilities Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Utilities</CardTitle>
            <CardDescription>Meter locations & numbers</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="water_stop_tap_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Water Stop Tap Location</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('water_stop_tap_location')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="hidden sm:block" />
            <FormField
              control={form.control}
              name="electric_meter_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Electric Meter Location</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('electric_meter_location')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="electric_meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Electric Meter Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('electric_meter_number')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gas_meter_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gas Meter Location</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('gas_meter_location')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gas_meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gas Meter Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('gas_meter_number')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="water_meter_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Water Meter Location</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('water_meter_location')} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="water_meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Water Meter Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} className={getMissingClass('water_meter_number')} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Schedule Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Accommodation Schedule</CardTitle>
            <CardDescription>Rooms & bed spaces</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="bedrooms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bedrooms</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hmo_bed_spaces"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HMO Bed Spaces</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bathrooms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bathrooms</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ensuites"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ensuites</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="wc_cloakroom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WC/Cloakroom</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
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
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="living_rooms_communal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Living Rooms (Communal)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Licensing Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Licensing & Compliance</CardTitle>
            <CardDescription>HMO licence details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="hmo_licence_required"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">HMO Licence Required</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hmo_licence"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">HMO Licence Held</FormLabel>
                </FormItem>
              )}
            />
            <div />
            <FormField
              control={form.control}
              name="hmo_licence_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Licence Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hmo_licence_expiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Licence Expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  {field.value && (
                    <FormDescription>{formatDateUK(field.value)}</FormDescription>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="asset_performance_rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Performance Rating</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="base_clarification"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-3">
                  <FormLabel>Base Clarification</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Amenities Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Amenities</CardTitle>
            <CardDescription>Storage & facilities</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="has_bin_store"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
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
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Cycle Store</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="has_guest_room"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Guest Room</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="carport"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Carport</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Management Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Management</CardTitle>
            <CardDescription>Property management company details</CardDescription>
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
                      placeholder="Select company..."
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
                    <Input type="number" step="0.1" {...field} value={field.value ?? ''} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Links Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Links</CardTitle>
            <CardDescription>External resources</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="photographs_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photographs Link</FormLabel>
                  <FormControl>
                    <Input type="url" {...field} value={field.value ?? ''} placeholder="https://" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dropbox_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dropbox/Documents Link</FormLabel>
                  <FormControl>
                    <Input type="url" {...field} value={field.value ?? ''} placeholder="https://" />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

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
    town_city: passport?.town_city ?? null,
    county: passport?.county ?? null,
    postcode: passport?.postcode ?? null,
    local_authority: passport?.local_authority ?? null,
    local_authority_id: (passport as any)?.local_authority_id ?? null,
    maintenance_area: passport?.maintenance_area ?? null,
    asset_agreement_category: passport?.asset_agreement_category ?? null,
    occupation_status: passport?.occupation_status ?? null,
    owned_by: passport?.owned_by ?? null,
    owner_tenure: passport?.owner_tenure ?? null,
    land_registry_title_number: passport?.land_registry_title_number ?? null,
    council_tax_band: passport?.council_tax_band ?? null,
    built_in_year: passport?.built_in_year ?? null,
    construction_date_band: passport?.construction_date_band ?? null,
    construction_type: passport?.construction_type ?? null,
    number_of_storeys: passport?.number_of_storeys ?? null,
    basement: passport?.basement ?? false,
    parking: passport?.parking ?? null,
    keysafe_code: passport?.keysafe_code ?? null,
    loft_access: passport?.loft_access ?? null,
    has_loft_access: passport?.has_loft_access ?? false,
    access_ramp: passport?.access_ramp ?? false,
    block_communal_entrance: passport?.block_communal_entrance ?? null,
    communal_tv_supply: passport?.communal_tv_supply ?? false,
    water_stop_tap_location: passport?.water_stop_tap_location ?? null,
    electric_meter_location: passport?.electric_meter_location ?? null,
    gas_meter_location: passport?.gas_meter_location ?? null,
    water_meter_location: passport?.water_meter_location ?? null,
    electric_meter_number: passport?.electric_meter_number ?? null,
    gas_meter_number: passport?.gas_meter_number ?? null,
    water_meter_number: passport?.water_meter_number ?? null,
    kitchens: passport?.kitchens ?? null,
    bedrooms: passport?.bedrooms ?? null,
    hmo_bed_spaces: passport?.hmo_bed_spaces ?? null,
    bathrooms: passport?.bathrooms ?? null,
    wc_cloakroom: passport?.wc_cloakroom ?? null,
    ensuites: passport?.ensuites ?? null,
    living_rooms_communal: passport?.living_rooms_communal ?? null,
    hmo_licence_required: passport?.hmo_licence_required ?? false,
    hmo_licence: passport?.hmo_licence ?? false,
    hmo_licence_number: passport?.hmo_licence_number ?? null,
    hmo_licence_expiry: passport?.hmo_licence_expiry ?? null,
    asset_performance_rating: passport?.asset_performance_rating ?? null,
    base_clarification: passport?.base_clarification ?? null,
    has_bin_store: passport?.has_bin_store ?? false,
    has_cycle_store: passport?.has_cycle_store ?? false,
    has_guest_room: passport?.has_guest_room ?? false,
    carport: passport?.carport ?? false,
    photographs_link: passport?.photographs_link ?? null,
    dropbox_link: passport?.dropbox_link ?? null,
    property_management_company: passport?.property_management_company ?? null,
    management_company_id: (passport as any)?.management_company_id ?? null,
    property_management_fee_percent: passport?.property_management_fee_percent ? Number(passport.property_management_fee_percent) : null,
  };
}
