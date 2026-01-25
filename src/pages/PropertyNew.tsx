import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateProperty, useCreateLoan, useUpsertIncome } from '@/hooks/useProperties';
import { extractPostcodeArea } from '@/lib/calculations';
import { AutoPopulateButton } from '@/components/property/AutoPopulateButton';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { AddressAutocomplete, AddressData } from '@/components/maps/AddressAutocomplete';
import { GeocodeStatusBadge } from '@/components/geocoding';

const propertySchema = z.object({
  address_line: z.string().min(1, 'Address is required').max(255),
  address_line2: z.string().max(255).optional(),
  town_city: z.string().max(100).optional(),
  area_name: z.string().max(100).optional(),
  postcode: z.string().max(10).optional(),
  property_type: z.string().max(50).optional(),
  beds: z.coerce.number().int().min(0).max(50).optional(),
  bathrooms: z.coerce.number().int().min(0).max(50).optional(),
  ownership_entity: z.string().max(100).optional(),
  ownership_percent: z.coerce.number().min(0).max(100).optional(),
  purchase_price_gbp: z.coerce.number().min(0).optional(),
  original_purchase_date: z.string().optional(),
  current_value_gbp: z.coerce.number().min(0).optional(),
  epc_rating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'N/A', '']).optional(),
  listed_status: z.enum(['Not listed', 'Grade II', 'Grade II*', 'Grade I', '']).optional(),
  notes: z.string().max(2000).optional(),
  // Land Registry fields
  title_number: z.string().max(50).optional(),
  tenure: z.enum(['Freehold', 'Leasehold', 'Share of Freehold', 'Commonhold', '']).optional(),
  lease_years_remaining: z.coerce.number().int().min(0).max(999).optional(),
  uprn: z.string().max(20).optional(),
  // Loan fields
  lender: z.string().max(100).optional(),
  interest_rate_percent: z.coerce.number().min(0).max(100).optional(),
  fixed_or_variable: z.enum(['fixed', 'variable', '']).optional(),
  current_mortgage_balance_gbp: z.coerce.number().min(0).optional(),
  mortgage_payment_gbp: z.coerce.number().min(0).optional(),
  fixed_rate_expires: z.string().optional(),
  // Income
  annual_rent_gbp: z.coerce.number().min(0).optional(),
  // Geocoding fields (hidden, auto-populated)
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  place_id: z.string().optional(),
  formatted_address: z.string().optional(),
  county: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  geocode_status: z.enum(['NOT_STARTED', 'SUCCESS', 'PARTIAL', 'FAILED']).optional(),
  geocode_source: z.enum(['PLACES', 'GEOCODE']).optional(),
  geocode_confidence: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

function PropertyNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createProperty = useCreateProperty();
  const createLoan = useCreateLoan();
  const upsertIncome = useUpsertIncome();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geocodeData, setGeocodeData] = useState<AddressData | null>(null);

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address_line: '',
      ownership_percent: 100,
      country: 'United Kingdom',
      geocode_status: 'NOT_STARTED',
    },
  });

  // Watch postcode and address for auto-populate
  const watchedPostcode = useWatch({ control: form.control, name: 'postcode' });
  const watchedAddress = useWatch({ control: form.control, name: 'address_line' });
  const watchedGeocodeStatus = useWatch({ control: form.control, name: 'geocode_status' });

  // Handle address selection from autocomplete
  const handleAddressSelect = (data: AddressData) => {
    setGeocodeData(data);
    form.setValue('address_line', data.address_line);
    form.setValue('address_line2', data.address_line2 || '');
    form.setValue('postcode', data.postcode || '');
    form.setValue('town_city', data.town_city || '');
    form.setValue('county', data.county || '');
    form.setValue('area_name', data.county || ''); // Also set area_name for compatibility
    form.setValue('country', data.country);
    form.setValue('latitude', data.latitude);
    form.setValue('longitude', data.longitude);
    form.setValue('place_id', data.place_id);
    form.setValue('formatted_address', data.formatted_address);
    form.setValue('geocode_confidence', data.geocode_confidence);
    form.setValue('geocode_source', data.geocode_source);
    form.setValue('geocode_status', data.geocode_confidence === 'exact' ? 'SUCCESS' : 'PARTIAL');
  };

  // Handle auto-populate data (EPC lookup)
  const handleAutoPopulate = (data: PropertyLookupResult) => {
    if (data.epc) {
      if (data.epc.epcRating) {
        const rating = data.epc.epcRating.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(rating)) {
          form.setValue('epc_rating', rating as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G');
        }
      }
      if (data.epc.propertyType && !form.getValues('property_type')) {
        form.setValue('property_type', data.epc.propertyType);
      }
      if (data.epc.bedrooms && !form.getValues('beds')) {
        form.setValue('beds', data.epc.bedrooms);
      }
      if (data.epc.tenure) {
        const tenureMap: Record<string, 'Freehold' | 'Leasehold'> = {
          'Freehold': 'Freehold',
          'Leasehold': 'Leasehold',
        };
        if (tenureMap[data.epc.tenure] && !form.getValues('tenure')) {
          form.setValue('tenure', tenureMap[data.epc.tenure]);
        }
      }
    }

    // Don't override geocode data from address autocomplete with EPC location
    if (data.location && !geocodeData) {
      if (data.location.county && !form.getValues('area_name')) {
        form.setValue('area_name', data.location.county);
      }
      if (data.location.latitude && !form.getValues('latitude')) {
        form.setValue('latitude', data.location.latitude);
      }
      if (data.location.longitude && !form.getValues('longitude')) {
        form.setValue('longitude', data.location.longitude);
      }
    }
  };

  const onSubmit = async (data: PropertyFormData) => {
    setIsSubmitting(true);
    
    try {
      // Determine if EPC is required based on listed status
      const listedValue = data.listed_status || '';
      const isListed = listedValue !== '' && listedValue !== 'Not listed';
      const epcRequired = !isListed;
      
      // Create property with geocoding data
      const property = await createProperty.mutateAsync({
        address_line: data.address_line,
        address_line2: data.address_line2 || null,
        town_city: data.town_city || null,
        county: data.county || null,
        country: data.country || 'United Kingdom',
        area_name: data.area_name || null,
        postcode: data.postcode || null,
        postcode_area: data.postcode ? extractPostcodeArea(data.postcode) : null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        place_id: data.place_id || null,
        formatted_address: data.formatted_address || null,
        geocode_status: data.geocode_status || 'NOT_STARTED',
        geocode_source: data.geocode_source || null,
        geocode_confidence: data.geocode_confidence || null,
        geocoded_at: data.latitude ? new Date().toISOString() : null,
        property_type: data.property_type || null,
        beds: data.beds || null,
        bathrooms: data.bathrooms || null,
        ownership_entity: data.ownership_entity || null,
        ownership_percent: data.ownership_percent || 100,
        purchase_price_gbp: data.purchase_price_gbp || null,
        original_purchase_date: data.original_purchase_date || null,
        current_value_gbp: data.current_value_gbp || null,
        epc_rating: data.epc_rating === 'N/A' ? null : (data.epc_rating || null),
        epc_required: epcRequired,
        listed_status: data.listed_status || null,
        title_number: data.title_number || null,
        tenure: data.tenure || null,
        lease_years_remaining: data.lease_years_remaining || null,
        uprn: data.uprn || null,
        notes: data.notes || null,
      });

      // Create loan if provided
      if (data.lender || data.current_mortgage_balance_gbp) {
        await createLoan.mutateAsync({
          property_id: property.id,
          lender: data.lender || null,
          interest_rate_percent: data.interest_rate_percent || null,
          fixed_or_variable: data.fixed_or_variable || null,
          current_mortgage_balance_gbp: data.current_mortgage_balance_gbp || null,
          mortgage_payment_gbp: data.mortgage_payment_gbp || null,
          fixed_rate_expires: data.fixed_rate_expires || null,
        });
      }

      // Create income if provided
      if (data.annual_rent_gbp) {
        const currentYear = new Date().getFullYear();
        await upsertIncome.mutateAsync({
          property_id: property.id,
          year: currentYear,
          annual_rent_gbp: data.annual_rent_gbp,
        });
      }

      toast({
        title: 'Property added',
        description: 'Your property has been successfully added.',
      });
      
      navigate('/properties');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add property. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/properties')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Property</h1>
            <p className="text-muted-foreground">Enter the property details</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Property Details */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Property Details</CardTitle>
                  <CardDescription>Basic information about the property</CardDescription>
                </div>
                <AutoPopulateButton
                  postcode={watchedPostcode}
                  addressLine={watchedAddress}
                  onDataReceived={handleAutoPopulate}
                />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address_line"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex items-center justify-between">
                        <FormLabel>Address *</FormLabel>
                        {watchedGeocodeStatus && watchedGeocodeStatus !== 'NOT_STARTED' && (
                          <GeocodeStatusBadge 
                            status={watchedGeocodeStatus} 
                            confidence={form.getValues('geocode_confidence')}
                          />
                        )}
                      </div>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          onAddressSelect={handleAddressSelect}
                          placeholder="Start typing an address..."
                        />
                      </FormControl>
                      <FormDescription>
                        Select from suggestions for automatic location mapping
                      </FormDescription>
                      <FormMessage />
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
                        <Input {...field} placeholder="OX1 1AA" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="area_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Oxfordshire" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="property_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Terraced House" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="beds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" className="bg-input" />
                      </FormControl>
                      <FormMessage />
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
                        <Input {...field} type="number" min="0" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="listed_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listed Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Not listed">Not listed</SelectItem>
                          <SelectItem value="Grade II">Grade II</SelectItem>
                          <SelectItem value="Grade II*">Grade II*</SelectItem>
                          <SelectItem value="Grade I">Grade I</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="epc_rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EPC Rating</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((rating) => (
                            <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                          ))}
                          <SelectItem value="N/A">N/A (Listed building)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ownership_entity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership Entity</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Personal / Ltd Company" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Land Registry */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Land Registry</CardTitle>
                <CardDescription>Title and tenure details (optional)</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. BK123456" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tenure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenure</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select tenure" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Freehold">Freehold</SelectItem>
                          <SelectItem value="Leasehold">Leasehold</SelectItem>
                          <SelectItem value="Share of Freehold">Share of Freehold</SelectItem>
                          <SelectItem value="Commonhold">Commonhold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(form.watch('tenure') === 'Leasehold' || form.watch('tenure') === 'Share of Freehold') && (
                  <FormField
                    control={form.control}
                    name="lease_years_remaining"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Years Remaining</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="e.g. 125" className="bg-input" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="uprn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UPRN</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 10023456789" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Valuation */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Valuation</CardTitle>
                <CardDescription>Purchase and current value</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="purchase_price_gbp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="1000" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="original_purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_value_gbp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="1000" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Mortgage */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Mortgage</CardTitle>
                <CardDescription>Loan details (optional)</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="lender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lender</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bank name" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_mortgage_balance_gbp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mortgage Balance (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="1000" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interest_rate_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" max="100" step="0.01" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fixed_or_variable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="variable">Variable</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fixed_rate_expires"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fixed Rate Expires</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mortgage_payment_gbp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Payment (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="10" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Income */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Income</CardTitle>
                <CardDescription>Annual rental income</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="annual_rent_gbp"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Annual Rent (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="100" className="bg-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Any additional notes about this property..."
                          className="bg-input min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Property
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/properties')}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}

export default PropertyNewPage;
