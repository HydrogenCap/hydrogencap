import React, { useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Building2, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Dna,
  MapPin,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AddressEditor, type AddressFormValues } from './AddressEditor';
import { MultiTitleNumberInput } from './MultiTitleNumberInput';
import { 
  useUpdateCoreIdentity,
  useTitleNumbers, 
  calculateCoreIdentityCompleteness,
  PROPERTY_TYPES,
  CONSTRUCTION_TYPES,
  LISTED_STATUSES,
  isValidUKPostcode,
} from '@/hooks/useCoreIdentity';
import { useProperty } from '@/hooks/useProperties';
import { usePropertyPassport, useUpsertPassport } from '@/hooks/usePropertyPassport';
import { useLocalAuthorities, useFindOrCreateLocalAuthority } from '@/hooks/useLocalAuthorities';
import { ExtendableSelect } from './ExtendableSelect';
import { toast } from "sonner";

// Validation schema
const coreIdentitySchema = z.object({
  property_name: z.string().nullable().optional(),
  address_line: z.string().min(1, 'Address is required'),
  address_line2: z.string().nullable().optional(),
  town_city: z.string().min(1, 'City/Town is required'),
  county: z.string().nullable().optional(),
  postcode: z.string()
    .min(1, 'Postcode is required')
    .refine((val) => isValidUKPostcode(val), 'Invalid UK postcode format'),
  uprn: z.string().nullable().optional(),
  planning_authority: z.string().min(1, 'Planning authority is required'),
  property_type: z.string().min(1, 'Property type is required'),
  construction_type: z.string().min(1, 'Construction type is required'),
  year_built: z.string().nullable().optional(),
  listed_status: z.string().min(1, 'Listed status is required'),
  conservation_area: z.boolean().default(false),
});

type CoreIdentityFormData = z.infer<typeof coreIdentitySchema>;

interface CoreIdentityCardProps {
  propertyId: string;
}

export function CoreIdentityCard({ propertyId }: CoreIdentityCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: passport } = usePropertyPassport(propertyId);
  const { data: titleNumbers = [] } = useTitleNumbers(propertyId);
  const updateCoreIdentity = useUpdateCoreIdentity();
  const upsertPassport = useUpsertPassport();
  
  // Local authorities for planning authority field
  const { data: localAuthorities = [] } = useLocalAuthorities();
  const findOrCreateLA = useFindOrCreateLocalAuthority();
  
  const form = useForm<CoreIdentityFormData>({
    resolver: zodResolver(coreIdentitySchema),
    defaultValues: {
      property_name: null,
      address_line: '',
      address_line2: null,
      town_city: null,
      county: null,
      postcode: null,
      uprn: null,
      planning_authority: null,
      property_type: null,
      construction_type: null,
      year_built: null,
      listed_status: 'Not listed',
      conservation_area: false,
    },
  });

  // Update form when property data loads
  useEffect(() => {
    if (property) {
      form.reset({
        property_name: property.property_name ?? null,
        address_line: property.address_line ?? '',
        address_line2: property.address_line2 ?? null,
        town_city: property.town_city ?? null,
        county: property.county ?? null,
        postcode: property.postcode ?? null,
        uprn: property.uprn ?? null,
        planning_authority: property.planning_authority ?? null,
        property_type: property.property_type ?? null,
        // Read construction_type and year_built from property_passport
        construction_type: passport?.construction_type ?? null,
        year_built: passport?.built_in_year?.toString() ?? null,
        listed_status: property.listed_status ?? 'Not listed',
        conservation_area: property.conservation_area ?? false,
      });
    }
  }, [property, passport, form]);

  const onSubmit = async (data: CoreIdentityFormData) => {
    try {
      // Save identity fields to properties (exclude construction_type/year_built)
      const { construction_type, year_built, ...identityData } = data;
      await updateCoreIdentity.mutateAsync({
        propertyId,
        data: {
          ...identityData,
          conservation_area: data.conservation_area ?? false,
        },
      });

      // Save construction_type and year_built to property_passport
      await upsertPassport.mutateAsync({
        property_id: propertyId,
        construction_type: construction_type || null,
        built_in_year: year_built ? parseInt(year_built) : null,
      });
      toast.success('Core Identity saved', { description: 'Property identity information has been updated.' });
    } catch (error) {
      console.error('Core identity save error:', error);
      toast.error('Error', { description: 'Failed to save core identity.' });
    }
  };

  // Calculate completeness
  const completeness = calculateCoreIdentityCompleteness(
    property ? { ...property, construction_type_from_passport: passport?.construction_type ?? null } : null,
    titleNumbers
  );

  if (propertyLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Dna className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Core Property Identity (DNA)
              </CardTitle>
              <CardDescription>
                Permanent identifying information for this property
              </CardDescription>
            </div>
          </div>
          
          {/* Completeness indicator */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">
                {completeness.completed}/{completeness.total} completed
              </p>
              <Progress value={completeness.percentage} className="w-24 h-2 mt-1" />
            </div>
            {completeness.percentage === 100 ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : completeness.missingRequired.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-warning" />
            ) : null}
          </div>
        </div>

        {/* Missing fields warning */}
        {completeness.missingRequired.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning">Missing required fields</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completeness.missingRequired.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {completeness.missingSoftRequired.length > 0 && completeness.missingRequired.length === 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recommended fields</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completeness.missingSoftRequired.join(', ')} - adding these improves data quality
                </p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Property Name */}
            <FormField
              control={form.control}
              name="property_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. The Mill House, Riverside Apartments Block A" 
                      {...field} 
                      value={field.value ?? ''} 
                    />
                  </FormControl>
                  <FormDescription>
                    A friendly name for this property, if applicable
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Address Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Full Address</h4>
              </div>
              <AddressEditor form={form as unknown as UseFormReturn<AddressFormValues>} />
            </div>

            <Separator />

            {/* Identifiers Section */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* UPRN */}
              <FormField
                control={form.control}
                name="uprn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      UPRN
                      {!field.value && (
                        <Badge variant="outline" className="text-xs font-normal text-warning border-warning/30">
                          Recommended
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. 10023456789" 
                        {...field} 
                        value={field.value ?? ''} 
                      />
                    </FormControl>
                    <FormDescription>
                      Unique Property Reference Number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Title Numbers */}
              <div>
                <MultiTitleNumberInput propertyId={propertyId} />
              </div>
            </div>

            <Separator />

            {/* Authority Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Local & Planning Authority</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="planning_authority"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        Planning Authority <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <ExtendableSelect
                          value={field.value ?? null}
                          onValueChange={field.onChange}
                          options={localAuthorities.map(la => ({ id: la.name, name: la.name }))}
                          placeholder="Select or add authority..."
                          addLabel="Add new authority"
                          dialogTitle="Add Planning Authority"
                          dialogDescription="Enter the name of the planning authority."
                          inputLabel="Authority Name"
                          inputPlaceholder="e.g. Manchester City Council"
                          onAddNew={async (name) => {
                            await findOrCreateLA.mutateAsync(name);
                            return { id: name, name };
                          }}
                          useNameAsValue
                        />
                      </FormControl>
                      <FormDescription>
                        The local authority responsible for planning decisions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Property Classification */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Property Classification</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="property_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Property Type <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROPERTY_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="construction_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Construction Type <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONSTRUCTION_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year_built"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year Built</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. 1920 or c.1890" 
                          {...field} 
                          value={field.value ?? ''} 
                        />
                      </FormControl>
                      <FormDescription>
                        Year or approximate period (e.g., "c.1890")
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="listed_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Listed Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LISTED_STATUSES.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conservation_area"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Conservation Area
                        </FormLabel>
                        <FormDescription>
                          Is this property in a conservation area?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={updateCoreIdentity.isPending}
                className="gap-2"
              >
                {updateCoreIdentity.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Core Identity
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
