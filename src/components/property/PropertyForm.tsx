import React, { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { AddressData } from '@/components/maps/AddressAutocomplete';
import { isSuspiciousGeocodeChange } from '@/hooks/useGeocoding';
import { calculateMortgagePaymentDetailed } from '@/lib/mortgageCalculations';
import { useToast } from '@/hooks/use-toast';
import {
  PropertyDetailsSection,
  LandRegistrySection,
  ValuationSection,
  MortgageSection,
  IncomeSection,
  NotesSection,
} from '@/components/property/PropertyEditFormSections';
import { LeaseholdFormSection } from '@/components/property/LeaseholdFormSection';

// Unified schema covering all fields used by both create and edit forms
export const propertyFormSchema = z.object({
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
  // Valuation extras (edit mode)
  stamp_duty_gbp: z.coerce.number().min(0).optional(),
  refurb_cost_gbp: z.coerce.number().min(0).optional(),
  legal_fees_gbp: z.coerce.number().min(0).optional(),
  other_acquisition_costs_gbp: z.coerce.number().min(0).optional(),
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

export type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface PropertyFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<PropertyFormData>;
  /** Property ID — passed to LandRegistrySection for MultiTitleNumberInput in edit mode */
  propertyId?: string;
  /** Existing property coordinates for suspicious-change detection in edit mode */
  existingCoords?: { latitude: number; longitude: number } | null;
  onSubmit: (data: PropertyFormData, geocodeData: AddressData | null) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}

export function PropertyForm({
  mode,
  defaultValues,
  propertyId,
  existingCoords,
  onSubmit,
  onCancel,
  submitLabel,
  disabled,
}: PropertyFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geocodeData, setGeocodeData] = useState<AddressData | null>(null);
  const [suspiciousChange, setSuspiciousChange] = useState(false);

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      address_line: '',
      ownership_percent: 100,
      country: 'United Kingdom',
      geocode_status: 'NOT_STARTED',
      ...defaultValues,
    },
  });

  // Watch fields for auto-populate and geocoding
  const watchedPostcode = useWatch({ control: form.control, name: 'postcode' });
  const watchedAddress = useWatch({ control: form.control, name: 'address_line' });
  const watchedGeocodeStatus = useWatch({ control: form.control, name: 'geocode_status' });

  // Watch tenure for leasehold form section
  const watchedTenure = useWatch({ control: form.control, name: 'tenure' });

  // Watch fields for mortgage auto-calculation
  const watchedBalance = useWatch({ control: form.control, name: 'current_mortgage_balance_gbp' });
  const watchedRate = useWatch({ control: form.control, name: 'interest_rate_percent' });
  const watchedCapitalOrInterest = useWatch({ control: form.control, name: 'capital_or_interest' });
  const watchedTermYears = useWatch({ control: form.control, name: 'term_years' });
  const watchedPaymentOverride = useWatch({ control: form.control, name: 'mortgage_payment_gbp' });

  // Calculate mortgage payment (used in edit mode's enhanced mortgage section)
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
    // Check for suspicious geocode change in edit mode
    if (existingCoords && isSuspiciousGeocodeChange(
      existingCoords.latitude, existingCoords.longitude,
      data.latitude, data.longitude
    )) {
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
    form.setValue('area_name', data.county || '');
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
      if (mode === 'create') {
        if (data.location.latitude && !form.getValues('latitude')) {
          form.setValue('latitude', data.location.latitude);
        }
        if (data.location.longitude && !form.getValues('longitude')) {
          form.setValue('longitude', data.location.longitude);
        }
      }
    }
  };

  const handleSubmit = async (data: PropertyFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data, geocodeData);
    } catch (error) {
      console.error(`Failed to ${mode === 'create' ? 'add' : 'update'} property:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error
          ? error.message
          : `Failed to ${mode === 'create' ? 'add' : 'update'} property. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <PropertyDetailsSection
          form={form as any}
          watchedPostcode={watchedPostcode}
          watchedAddress={watchedAddress}
          watchedGeocodeStatus={watchedGeocodeStatus}
          suspiciousChange={suspiciousChange}
          onAddressSelect={handleAddressSelect}
          onAutoPopulate={handleAutoPopulate}
        />

        <LandRegistrySection form={form as any} propertyId={propertyId} />

        <LeaseholdFormSection propertyId={propertyId} tenure={watchedTenure} />

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
          <Button type="submit" disabled={isSubmitting || disabled}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
