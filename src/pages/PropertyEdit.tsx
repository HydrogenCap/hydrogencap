import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useProperty, useUpdateProperty, useUpdateLoan, useCreateLoan, useUpsertIncome } from '@/hooks/useProperties';
import { extractPostcodeArea } from '@/lib/calculations';

const propertySchema = z.object({
  address_line: z.string().min(1, 'Address is required').max(255),
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

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address_line: '',
      ownership_percent: 100,
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
        // Loan fields
        lender: loan?.lender || '',
        interest_rate_percent: loan?.interest_rate_percent ?? undefined,
        fixed_or_variable: (loan?.fixed_or_variable as PropertyFormData['fixed_or_variable']) || '',
        current_mortgage_balance_gbp: loan?.current_mortgage_balance_gbp ?? undefined,
        mortgage_payment_gbp: loan?.mortgage_payment_gbp ?? undefined,
        fixed_rate_expires: loan?.fixed_rate_expires || '',
        // Income
        annual_rent_gbp: income?.annual_rent_gbp ?? undefined,
      });
    }
  }, [property, form]);

  const onSubmit = async (data: PropertyFormData) => {
    if (!id) return;
    setIsSubmitting(true);
    
    try {
      // Determine if EPC is required based on listed status
      const listedValue = data.listed_status || '';
      const isListed = listedValue !== '' && listedValue !== 'Not listed';
      const epcRequired = !isListed;
      
      // Update property
      await updateProperty.mutateAsync({
        id,
        previousValue: property?.current_value_gbp ?? null,
        address_line: data.address_line,
        area_name: data.area_name || null,
        postcode: data.postcode || null,
        postcode_area: data.postcode ? extractPostcodeArea(data.postcode) : null,
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
      if (existingLoan) {
        await updateLoan.mutateAsync({
          id: existingLoan.id,
          previousRate: existingLoan.interest_rate_percent,
          lender: data.lender || null,
          interest_rate_percent: data.interest_rate_percent || null,
          fixed_or_variable: data.fixed_or_variable || null,
          current_mortgage_balance_gbp: data.current_mortgage_balance_gbp || null,
          mortgage_payment_gbp: data.mortgage_payment_gbp || null,
          fixed_rate_expires: data.fixed_rate_expires || null,
        });
      } else if (data.lender || data.current_mortgage_balance_gbp) {
        await createLoan.mutateAsync({
          property_id: id,
          lender: data.lender || null,
          interest_rate_percent: data.interest_rate_percent || null,
          fixed_or_variable: data.fixed_or_variable || null,
          current_mortgage_balance_gbp: data.current_mortgage_balance_gbp || null,
          mortgage_payment_gbp: data.mortgage_payment_gbp || null,
          fixed_rate_expires: data.fixed_rate_expires || null,
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
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-destructive mb-4">Property not found</p>
          <Button asChild>
            <Link to="/properties">Back to Properties</Link>
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
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
                <CardDescription>Basic information about the property</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address_line"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123 High Street" className="bg-input" />
                      </FormControl>
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
