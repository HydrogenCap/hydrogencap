import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useToast } from '@/hooks/use-toast';
import { useCreateProperty, useCreateLoan, useUpsertIncome } from '@/hooks/useProperties';
import { extractPostcodeArea } from '@/lib/calculations';

const propertySchema = z.object({
  address_line: z.string().min(1, 'Address is required').max(255),
  area_name: z.string().max(100).optional(),
  postcode: z.string().max(10).optional(),
  property_type: z.string().max(50).optional(),
  beds: z.coerce.number().int().min(0).max(50).optional(),
  ownership_entity: z.string().max(100).optional(),
  ownership_percent: z.coerce.number().min(0).max(100).optional(),
  purchase_price_gbp: z.coerce.number().min(0).optional(),
  original_purchase_date: z.string().optional(),
  current_value_gbp: z.coerce.number().min(0).optional(),
  epc_rating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', '']).optional(),
  notes: z.string().max(2000).optional(),
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

function PropertyNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createProperty = useCreateProperty();
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

  const onSubmit = async (data: PropertyFormData) => {
    setIsSubmitting(true);
    
    try {
      // Create property
      const property = await createProperty.mutateAsync({
        address_line: data.address_line,
        area_name: data.area_name || null,
        postcode: data.postcode || null,
        postcode_area: data.postcode ? extractPostcodeArea(data.postcode) : null,
        property_type: data.property_type || null,
        beds: data.beds || null,
        ownership_entity: data.ownership_entity || null,
        ownership_percent: data.ownership_percent || 100,
        purchase_price_gbp: data.purchase_price_gbp || null,
        original_purchase_date: data.original_purchase_date || null,
        current_value_gbp: data.current_value_gbp || null,
        epc_rating: data.epc_rating || null,
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
