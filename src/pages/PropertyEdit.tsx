import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useProperty, useUpdateProperty, useUpdateLoan, useCreateLoan, useUpsertIncome } from '@/hooks/useProperties';
import { extractPostcodeArea } from '@/lib/calculations';
import { calculateMortgagePaymentDetailed } from '@/lib/mortgageCalculations';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { AddressData } from '@/components/maps/AddressAutocomplete';
import { isSuspiciousGeocodeChange } from '@/hooks/useGeocoding';
import { notifyPropertyUpdated } from '@/components/dashboard';
import {
  PropertyDetailsSection,
  LandRegistrySection,
  ValuationSection,
  MortgageSection,
  IncomeSection,
  NotesSection,
} from '@/components/property/PropertyEditFormSections';

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
  mortgage_type: z.enum(['BTL', 'Bridging', 'Commercial', 'PPR', '']).optional(),
  term_years: z.coerce.number().int().min(1).max(50).optional(),
  mortgage_payment_gbp: z.coerce.number().min(0).optional(),
  fixed_rate_expires: z.string().optional(),
  loan_start_date: z.string().optional(),
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
        mortgage_type: (loan?.mortgage_type === 'BTL' || loan?.mortgage_type === 'Bridging' || loan?.mortgage_type === 'Commercial' || loan?.mortgage_type === 'PPR')
          ? loan.mortgage_type as 'BTL' | 'Bridging' | 'Commercial' | 'PPR'
          : '',
        term_years: loan?.term_years ?? undefined,
        mortgage_payment_gbp: loan?.payment_override_gbp ?? undefined,
        fixed_rate_expires: loan?.fixed_rate_expires || '',
        loan_start_date: loan?.loan_start_date || '',
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
        loan_start_date: data.loan_start_date || null,
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

      // Notify data quality widget to refresh
      notifyPropertyUpdated(id);

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
            <PropertyDetailsSection
              form={form as any}
              watchedPostcode={watchedPostcode}
              watchedAddress={watchedAddress}
              watchedGeocodeStatus={watchedGeocodeStatus}
              suspiciousChange={suspiciousChange}
              onAddressSelect={handleAddressSelect}
              onAutoPopulate={handleAutoPopulate}
            />

            <LandRegistrySection form={form as any} propertyId={id} />

            <ValuationSection form={form as any} />

            <MortgageSection
              form={form as any}
              watchedCapitalOrInterest={watchedCapitalOrInterest}
              mortgageCalc={mortgageCalc}
            />

            <IncomeSection form={form as any} />

            <NotesSection form={form as any} />

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
