import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateProperty, useCreateLoan } from '@/hooks/useProperties';
import { useUpsertPropertyIncomeBudget, yearToTaxYear } from '@/hooks/usePropertyIncomeBudgets';
import { extractPostcodeArea } from '@/lib/calculations';
import { useUnitUsage } from '@/hooks/useUnitUsage';
import { PropertyForm } from '@/components/property/PropertyForm';
import type { PropertyFormData } from '@/components/property/propertyFormSchema';
import { AddressData } from '@/components/maps/AddressAutocomplete';
import { toast } from "sonner";

function PropertyNewPage() {
  const navigate = useNavigate();
  const createProperty = useCreateProperty();
  const createLoan = useCreateLoan();
  const upsertIncome = useUpsertPropertyIncomeBudget();
  const { atLimit, totalUnits, limit } = useUnitUsage();

  const handleSubmit = async (data: PropertyFormData, _geocodeData: AddressData | null) => {
    const listedValue = data.listed_status || '';
    const isListed = listedValue !== '' && listedValue !== 'Not listed';
    const epcRequired = !isListed;

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
        tax_year: yearToTaxYear(currentYear),
        annual_rent_gbp: data.annual_rent_gbp,
      });
    }

    toast.success('Property added', { description: 'Your property has been successfully added.' });

    navigate('/properties');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button aria-label="Back" variant="ghost" size="icon" onClick={() => navigate('/properties')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Property</h1>
            <p className="text-muted-foreground">Enter the property details</p>
          </div>
        </div>

        {atLimit && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You've reached your plan limit of {limit === Infinity ? 'unlimited' : limit} properties/rooms ({totalUnits} used).{' '}
              <a href="/settings" className="underline font-medium">Upgrade your plan</a> to add more.
            </AlertDescription>
          </Alert>
        )}

        <PropertyForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={() => navigate('/properties')}
          submitLabel="Add Property"
          disabled={atLimit}
        />
      </div>
    </AppLayout>
  );
}

export default PropertyNewPage;
