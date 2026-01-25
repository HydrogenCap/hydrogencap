import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useProperty, useUpdateProperty, useUpdateLoan, useCreateLoan, useUpsertIncome } from '@/hooks/useProperties';
import { extractPostcodeArea } from '@/lib/calculations';
import { calculateMortgagePaymentDetailed, formatPaymentGBP } from '@/lib/mortgageCalculations';
import { AutoPopulateButton } from '@/components/property/AutoPopulateButton';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { AddressAutocomplete, AddressData } from '@/components/maps/AddressAutocomplete';
import { GeocodeStatusBadge } from '@/components/geocoding';
import { isSuspiciousGeocodeChange } from '@/hooks/useGeocoding';

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
  capital_or_interest: z.enum(['capital', 'interest', '']).optional(),
  mortgage_type: z.enum(['BTL', 'Bridging', '']).optional(),
  term_years: z.coerce.number().int().min(1).max(50).optional(),
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

function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: property, isLoading, error } = useProperty(id);
  const updateProperty = useUpdateProperty();
  const updateLoan = useUpdateLoan();
  const createLoan = useCreateLoan();
  const upsertIncome = useUpsertIncome();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geocodeData, setGeocodeData] = useState<AddressData | null>(null);
  const [suspiciousChange, setSuspiciousChange] = useState(false);

  // Debug logging
  console.log('PropertyEditPage mounted', { id, isLoading, error: error?.message, hasProperty: !!property });

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address_line: '',
      ownership_percent: 100,
      country: 'United Kingdom',
    },
  });

  // Populate form when property data loads
  useEffect(() => {
    if (property) {
      const currentYear = new Date().getFullYear();
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);

      form.reset({
        address_line: property.address_line || '',
        address_line2: property.address_line2 || '',
        town_city: property.town_city || '',
        county: property.county || '',
        country: property.country || 'United Kingdom',
        area_name: property.area_name || '',
        postcode: property.postcode || '',
        property_type: property.property_type || '',
        beds: property.beds ?? undefined,
        bathrooms: property.bathrooms ?? undefined,
        ownership_entity: property.ownership_entity || '',
        ownership_percent: property.ownership_percent ?? 100,
        purchase_price_gbp: property.purchase_price_gbp ?? undefined,
        original_purchase_date: property.original_purchase_date || '',
        current_value_gbp: property.current_value_gbp ?? undefined,
        epc_rating: (property.epc_rating as PropertyFormData['epc_rating']) || '',
        listed_status: (property.listed_status as PropertyFormData['listed_status']) || '',
        notes: property.notes || '',
        title_number: property.title_number || '',
        tenure: (property.tenure as PropertyFormData['tenure']) || '',
        lease_years_remaining: property.lease_years_remaining ?? undefined,
        uprn: property.uprn || '',
        // Geocode fields
        latitude: property.latitude ?? undefined,
        longitude: property.longitude ?? undefined,
        place_id: property.place_id || '',
        formatted_address: property.formatted_address || '',
        geocode_status: (property.geocode_status as PropertyFormData['geocode_status']) || 'NOT_STARTED',
        geocode_source: (property.geocode_source as PropertyFormData['geocode_source']) || undefined,
        geocode_confidence: property.geocode_confidence || '',
        // Loan fields
        lender: loan?.lender || '',
        interest_rate_percent: loan?.interest_rate_percent ?? undefined,
        fixed_or_variable: (loan?.fixed_or_variable as PropertyFormData['fixed_or_variable']) || '',
        current_mortgage_balance_gbp: loan?.current_mortgage_balance_gbp ?? undefined,
        capital_or_interest: (loan?.capital_or_interest === 'capital' || loan?.capital_or_interest === 'interest') 
          ? loan.capital_or_interest as 'capital' | 'interest' 
          : '',
        mortgage_type: (loan?.mortgage_type === 'BTL' || loan?.mortgage_type === 'Bridging')
          ? loan.mortgage_type as 'BTL' | 'Bridging'
          : '',
        term_years: (loan as any)?.term_years ?? undefined,
        mortgage_payment_gbp: loan?.payment_override_gbp ?? undefined,
        fixed_rate_expires: loan?.fixed_rate_expires || '',
        // Income
        annual_rent_gbp: income?.annual_rent_gbp ?? undefined,
      });
    }
  }, [property, form]);

  // Watch fields for mortgage auto-calculation
  const watchedBalance = useWatch({ control: form.control, name: 'current_mortgage_balance_gbp' });
  const watchedRate = useWatch({ control: form.control, name: 'interest_rate_percent' });
  const watchedCapitalOrInterest = useWatch({ control: form.control, name: 'capital_or_interest' });
  const watchedTermYears = useWatch({ control: form.control, name: 'term_years' });
  const watchedPaymentOverride = useWatch({ control: form.control, name: 'mortgage_payment_gbp' });

  // Watch postcode and address for auto-populate
  const watchedPostcode = useWatch({ control: form.control, name: 'postcode' });
  const watchedAddress = useWatch({ control: form.control, name: 'address_line' });
  const watchedGeocodeStatus = useWatch({ control: form.control, name: 'geocode_status' });

  // Calculate mortgage payment
  const mortgageCalc = useMemo(() => {
    return calculateMortgagePaymentDetailed({
      balance: watchedBalance || null,
      interestRatePercent: watchedRate || null,
      termYears: watchedTermYears || null,
      capitalOrInterest: watchedCapitalOrInterest === 'capital' || watchedCapitalOrInterest === 'interest' 
        ? watchedCapitalOrInterest 
        : null,
      paymentOverride: watchedPaymentOverride || null,
    });
  }, [watchedBalance, watchedRate, watchedCapitalOrInterest, watchedTermYears, watchedPaymentOverride]);

  // Handle address selection from autocomplete
  const handleAddressSelect = (data: AddressData) => {
    // Check for suspicious geocode change (>25 miles from existing location)
    const oldLat = property?.latitude;
    const oldLng = property?.longitude;
    if (oldLat && oldLng && isSuspiciousGeocodeChange(oldLat, oldLng, data.latitude, data.longitude)) {
      setSuspiciousChange(true);
      toast({
        title: 'Location Change Warning',
        description: 'The new address is more than 25 miles from the current location. Please verify this is correct.',
        variant: 'destructive',
      });
    } else {
      setSuspiciousChange(false);
    }

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
    }
  };

  const onSubmit = async (data: PropertyFormData) => {
    if (!id) return;
    setIsSubmitting(true);
    
    try {
      // Determine if EPC is required based on listed status
      const listedValue = data.listed_status || '';
      const isListed = listedValue !== '' && listedValue !== 'Not listed';
      const epcRequired = !isListed;
      
      // Update property with geocoding data
      await updateProperty.mutateAsync({
        id,
        previousValue: property?.current_value_gbp ?? null,
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
        geocode_status: data.geocode_status || property?.geocode_status || 'NOT_STARTED',
        geocode_source: data.geocode_source || property?.geocode_source || null,
        geocode_confidence: data.geocode_confidence || property?.geocode_confidence || null,
        geocoded_at: geocodeData ? new Date().toISOString() : property?.geocoded_at || null,
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

      // Handle loan - update existing or create new
      const existingLoan = property?.loans?.[0];
      const loanData = {
        lender: data.lender || null,
        interest_rate_percent: data.interest_rate_percent || null,
        fixed_or_variable: data.fixed_or_variable || null,
        current_mortgage_balance_gbp: data.current_mortgage_balance_gbp || null,
        capital_or_interest: data.capital_or_interest || null,
        mortgage_type: data.mortgage_type || null,
        term_years: data.term_years || null,
        // Store manual payment as override, auto-calc as the regular field
        payment_override_gbp: data.mortgage_payment_gbp || null,
        payment_auto_calculated_gbp: mortgageCalc.autoCalculated,
        payment_source: mortgageCalc.source,
        fixed_rate_expires: data.fixed_rate_expires || null,
      };

      if (existingLoan) {
        await updateLoan.mutateAsync({
          id: existingLoan.id,
          previousRate: existingLoan.interest_rate_percent,
          ...loanData,
        });
      } else if (data.lender || data.current_mortgage_balance_gbp) {
        await createLoan.mutateAsync({
          property_id: id,
          ...loanData,
        });
      }

      // Update income
      if (data.annual_rent_gbp !== undefined) {
        const currentYear = new Date().getFullYear();
        await upsertIncome.mutateAsync({
          property_id: id,
          year: currentYear,
          annual_rent_gbp: data.annual_rent_gbp || 0,
        });
      }

      toast({
        title: 'Property updated',
        description: 'Your changes have been saved.',
      });
      
      navigate(`/properties/${id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update property. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </AppLayout>
    );
  }

  if (error || !property) {
    console.error('PropertyEdit: Failed to load property', { id, error, property });
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <div className="text-6xl font-bold text-muted-foreground/50">404</div>
          <h1 className="text-2xl font-semibold">Property not found</h1>
          <p className="text-muted-foreground">
            This property may have been deleted or you don't have access to it.
          </p>
          <Button asChild>
            <Link to="/properties">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/properties/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Property</h1>
            <p className="text-muted-foreground">{property.address_line}</p>
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
                        <div className="flex items-center gap-2">
                          {suspiciousChange && (
                            <Badge variant="destructive" className="text-xs">
                              Large location change
                            </Badge>
                          )}
                          {watchedGeocodeStatus && watchedGeocodeStatus !== 'NOT_STARTED' && (
                            <GeocodeStatusBadge 
                              status={watchedGeocodeStatus} 
                              confidence={form.getValues('geocode_confidence')}
                            />
                          )}
                        </div>
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
                  name="capital_or_interest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="interest">Interest Only</SelectItem>
                          <SelectItem value="capital">Capital & Interest (Repayment)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mortgage_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mortgage Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-input">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BTL">Buy-to-Let (BTL)</SelectItem>
                          <SelectItem value="Bridging">Bridging Loan</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedCapitalOrInterest === 'capital' && (
                  <FormField
                    control={form.control}
                    name="term_years"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Term (Years)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="1" max="50" className="bg-input" placeholder="e.g. 25" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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

                {/* Auto-calculated payment display */}
                <div className="md:col-span-2 p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Payment (Auto-calculated)</span>
                    {mortgageCalc.source && (
                      <Badge variant={mortgageCalc.source === 'manual' ? 'secondary' : 'outline'}>
                        {mortgageCalc.source === 'manual' ? 'Override active' : 'Auto'}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-2xl font-bold text-primary">
                    {mortgageCalc.needsTerm ? (
                      <span className="text-muted-foreground text-base">Enter term to calculate</span>
                    ) : mortgageCalc.effective !== null ? (
                      formatPaymentGBP(mortgageCalc.effective)
                    ) : (
                      <span className="text-muted-foreground text-base">—</span>
                    )}
                  </div>

                  {mortgageCalc.autoCalculated !== null && mortgageCalc.source === 'manual' && (
                    <p className="text-xs text-muted-foreground">
                      Auto-calculated: {formatPaymentGBP(mortgageCalc.autoCalculated)}
                    </p>
                  )}
                  
                  {mortgageCalc.formula && (
                    <p className="text-xs text-muted-foreground">{mortgageCalc.formula}</p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="mortgage_payment_gbp"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex items-center gap-2">
                        <FormLabel>Manual Payment Override (£)</FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Leave blank to use auto-calculated payment. Enter a value to override the calculation.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          className="bg-input max-w-xs" 
                          placeholder="Leave blank for auto"
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: Override the auto-calculated payment
                      </FormDescription>
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
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/properties/${id}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}

export default PropertyEditPage;
