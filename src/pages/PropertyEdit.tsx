import React, { useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useProperty, useUpdateProperty, useUpdateLoan, useCreateLoan } from '@/hooks/useProperties';
import { useUpsertPropertyIncomeBudget, yearToTaxYear } from '@/hooks/usePropertyIncomeBudgets';
import { extractPostcodeArea } from '@/lib/calculations';
import { calculateMortgagePaymentDetailed } from '@/lib/mortgageCalculations';
import { notifyPropertyUpdated } from '@/components/dashboard';
import { PropertyForm } from '@/components/property/PropertyForm';
import type { PropertyFormData } from '@/components/property/propertyFormSchema';
import { AddressData } from '@/components/maps/AddressAutocomplete';

function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: property, isLoading, error } = useProperty(id);
  const updateProperty = useUpdateProperty();
  const updateLoan = useUpdateLoan();
  const createLoan = useCreateLoan();
  const upsertIncome = useUpsertPropertyIncomeBudget();

  // Compute default values from loaded property
  const defaultValues = useMemo<Partial<PropertyFormData> | undefined>(() => {
    if (!property) return undefined;
    const currentYear = new Date().getFullYear();
    const loan = property.loans?.[0];
    const income = property.income?.find(i => i.year === currentYear);

    return {
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
    };
  }, [property]);

  const existingCoords = useMemo(() => {
    if (property?.latitude && property?.longitude) {
      return { latitude: property.latitude, longitude: property.longitude };
    }
    return null;
  }, [property]);

  const handleSubmit = async (data: PropertyFormData, geocodeData: AddressData | null) => {
    if (!id) return;

    const listedValue = data.listed_status || '';
    const isListed = listedValue !== '' && listedValue !== 'Not listed';
    const epcRequired = !isListed;

    // Compute mortgage auto-calc for loan save
    const mortgageCalc = calculateMortgagePaymentDetailed({
      balance: data.current_mortgage_balance_gbp || null,
      interestRatePercent: data.interest_rate_percent || null,
      termYears: data.term_years || null,
      capitalOrInterest: data.capital_or_interest === 'capital' || data.capital_or_interest === 'interest'
        ? data.capital_or_interest
        : null,
      paymentOverride: data.mortgage_payment_gbp || null,
    });

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
        tax_year: yearToTaxYear(currentYear),
        annual_rent_gbp: data.annual_rent_gbp || 0,
      });
    }

    notifyPropertyUpdated(id);

    toast({
      title: 'Property updated',
      description: 'Your changes have been saved.',
    });

    navigate(`/properties/${id}`);
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

        <PropertyForm
          key={property.id}
          mode="edit"
          defaultValues={defaultValues}
          propertyId={id}
          existingCoords={existingCoords}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/properties/${id}`)}
          submitLabel="Save Changes"
        />
      </div>
    </AppLayout>
  );
}

export default PropertyEditPage;
