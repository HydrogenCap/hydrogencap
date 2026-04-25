import { Info } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddressAutocomplete, AddressData } from '@/components/maps/AddressAutocomplete';
import { AutoPopulateButton } from '@/components/property/AutoPopulateButton';
import { GeocodeStatusBadge } from '@/components/geocoding';
import { MultiTitleNumberInput } from '@/components/passport/MultiTitleNumberInput';
import { PropertyLookupResult } from '@/hooks/usePropertyLookup';
import { formatPaymentGBP } from '@/lib/mortgageCalculations';

interface MortgageCalcResult {
  effective: number | null;
  autoCalculated: number | null;
  source: string | null;
  needsTerm: boolean;
  formula: string | null;
}

export interface PropertyEditFormValues {
  address_line: string;
  area_name?: string;
  postcode?: string;
  property_type?: string;
  beds?: number;
  bathrooms?: number;
  listed_status?: '' | 'Not listed' | 'Grade II' | 'Grade II*' | 'Grade I';
  epc_rating?: '' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'N/A';
  ownership_entity?: string;
  geocode_confidence?: string;
  tenure?: '' | 'Freehold' | 'Leasehold' | 'Share of Freehold' | 'Commonhold';
  lease_years_remaining?: number;
  uprn?: string;
  purchase_price_gbp?: number;
  original_purchase_date?: string;
  current_value_gbp?: number;
  stamp_duty_gbp?: number;
  refurb_cost_gbp?: number;
  legal_fees_gbp?: number;
  other_acquisition_costs_gbp?: number;
  mortgage_type?: '' | 'BTL' | 'Bridging' | 'Commercial' | 'PPR';
  lender?: string;
  current_mortgage_balance_gbp?: number;
  interest_rate_percent?: number;
  fixed_or_variable?: '' | 'fixed' | 'variable';
  capital_or_interest?: '' | 'capital' | 'interest';
  term_years?: number;
  fixed_rate_expires?: string;
  loan_start_date?: string;
  mortgage_payment_gbp?: number;
  annual_rent_gbp?: number;
  notes?: string;
}

// Property Details Section
export function PropertyDetailsSection({ 
  form, 
  watchedPostcode, 
  watchedAddress, 
  watchedGeocodeStatus,
  suspiciousChange,
  onAddressSelect,
  onAutoPopulate,
}: { 
  form: UseFormReturn<PropertyEditFormValues>;
  watchedPostcode?: string;
  watchedAddress?: string;
  watchedGeocodeStatus?: string;
  suspiciousChange: boolean;
  onAddressSelect: (data: AddressData) => void;
  onAutoPopulate: (data: PropertyLookupResult) => void;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>Basic information about the property</CardDescription>
        </div>
        <AutoPopulateButton
          postcode={watchedPostcode}
          addressLine={watchedAddress}
          onDataReceived={onAutoPopulate}
        />
      </CardHeader>
      <CardContent className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
                  onAddressSelect={onAddressSelect}
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

        <FormField control={form.control} name="postcode" render={({ field }) => (
          <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} placeholder="OX1 1AA" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="area_name" render={({ field }) => (
          <FormItem><FormLabel>Area</FormLabel><FormControl><Input {...field} placeholder="Oxfordshire" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="property_type" render={({ field }) => (
          <FormItem><FormLabel>Property Type</FormLabel><FormControl><Input {...field} placeholder="Terraced House" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="beds" render={({ field }) => (
          <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input {...field} type="number" min="0" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="bathrooms" render={({ field }) => (
          <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input {...field} type="number" min="0" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />

        <FormField control={form.control} name="listed_status" render={({ field }) => (
          <FormItem>
            <FormLabel>Listed Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="Not listed">Not listed</SelectItem>
                <SelectItem value="Grade II">Grade II</SelectItem>
                <SelectItem value="Grade II*">Grade II*</SelectItem>
                <SelectItem value="Grade I">Grade I</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="epc_rating" render={({ field }) => (
          <FormItem>
            <FormLabel>EPC Rating</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select rating" /></SelectTrigger></FormControl>
              <SelectContent>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((rating) => (
                  <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                ))}
                <SelectItem value="N/A">N/A (Listed building)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="ownership_entity" render={({ field }) => (
          <FormItem><FormLabel>Ownership Entity</FormLabel><FormControl><Input {...field} placeholder="Personal / Ltd Company" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
      </CardContent>
    </Card>
  );
}

// Land Registry Section
export function LandRegistrySection({ form, propertyId }: { form: UseFormReturn<PropertyEditFormValues>; propertyId?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Land Registry</CardTitle>
        <CardDescription>Title and tenure details (optional)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {propertyId && (
          <div className="md:col-span-2">
            <MultiTitleNumberInput propertyId={propertyId} />
          </div>
        )}

        <FormField control={form.control} name="tenure" render={({ field }) => (
          <FormItem>
            <FormLabel>Tenure</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select tenure" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="Freehold">Freehold</SelectItem>
                <SelectItem value="Leasehold">Leasehold</SelectItem>
                <SelectItem value="Share of Freehold">Share of Freehold</SelectItem>
                <SelectItem value="Commonhold">Commonhold</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {(form.watch('tenure') === 'Leasehold' || form.watch('tenure') === 'Share of Freehold') && (
          <FormField control={form.control} name="lease_years_remaining" render={({ field }) => (
            <FormItem><FormLabel>Lease Years Remaining</FormLabel><FormControl><Input {...field} type="number" min="0" placeholder="e.g. 125" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />
        )}

        <FormField control={form.control} name="uprn" render={({ field }) => (
          <FormItem><FormLabel>UPRN</FormLabel><FormControl><Input {...field} placeholder="e.g. 10023456789" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
      </CardContent>
    </Card>
  );
}

// Valuation Section
export function ValuationSection({ form }: { form: UseFormReturn<PropertyEditFormValues> }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Valuation & Acquisition Costs</CardTitle>
        <CardDescription>Purchase price, current value, and capital invested</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <FormField control={form.control} name="purchase_price_gbp" render={({ field }) => (
          <FormItem><FormLabel>Purchase Price (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="1000" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="original_purchase_date" render={({ field }) => (
          <FormItem><FormLabel>Purchase Date</FormLabel><FormControl><Input {...field} type="date" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="current_value_gbp" render={({ field }) => (
          <FormItem><FormLabel>Current Value (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="1000" className="bg-input" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="stamp_duty_gbp" render={({ field }) => (
          <FormItem><FormLabel>Stamp Duty (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="100" className="bg-input" placeholder="0" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="refurb_cost_gbp" render={({ field }) => (
          <FormItem><FormLabel>Refurbishment Cost (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="100" className="bg-input" placeholder="0" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="legal_fees_gbp" render={({ field }) => (
          <FormItem><FormLabel>Legal Fees (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="100" className="bg-input" placeholder="0" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="other_acquisition_costs_gbp" render={({ field }) => (
          <FormItem><FormLabel>Other Costs (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="100" className="bg-input" placeholder="0" /></FormControl><FormMessage /></FormItem>
        )} />
      </CardContent>
    </Card>
  );
}

// Mortgage Section
export function MortgageSection({ 
  form, 
  watchedCapitalOrInterest,
  mortgageCalc 
}: { 
  form: UseFormReturn<PropertyEditFormValues>;
  watchedCapitalOrInterest?: string;
  mortgageCalc: MortgageCalcResult;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Mortgage</CardTitle>
        <CardDescription>Loan details (optional)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField control={form.control} name="mortgage_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Mortgage Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select mortgage type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="BTL">Buy-to-Let</SelectItem>
                  <SelectItem value="Bridging">Bridging Loan</SelectItem>
                  <SelectItem value="Commercial">Commercial Loan</SelectItem>
                  <SelectItem value="PPR">Principle Primary Residence</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="lender" render={({ field }) => (
            <FormItem><FormLabel>Lender</FormLabel><FormControl><Input {...field} placeholder="Bank name" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="current_mortgage_balance_gbp" render={({ field }) => (
            <FormItem><FormLabel>Mortgage Balance (£)</FormLabel><FormControl><Input {...field} type="number" min="0" step="1000" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="interest_rate_percent" render={({ field }) => (
            <FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input {...field} type="number" min="0" max="100" step="0.01" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="fixed_or_variable" render={({ field }) => (
            <FormItem>
              <FormLabel>Rate Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="capital_or_interest" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="interest">Interest Only</SelectItem>
                  <SelectItem value="capital">Capital & Interest (Repayment)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {watchedCapitalOrInterest === 'capital' && (
            <FormField control={form.control} name="term_years" render={({ field }) => (
              <FormItem><FormLabel>Loan Term (Years)</FormLabel><FormControl><Input {...field} type="number" min="1" max="50" className="bg-input" placeholder="e.g. 25" /></FormControl><FormMessage /></FormItem>
            )} />
          )}

          <FormField control={form.control} name="fixed_rate_expires" render={({ field }) => (
            <FormItem><FormLabel>Fixed Rate Expires</FormLabel><FormControl><Input {...field} type="date" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="loan_start_date" render={({ field }) => (
            <FormItem><FormLabel>Loan Start Date</FormLabel><FormControl><Input {...field} type="date" className="bg-input" /></FormControl><FormMessage /></FormItem>
          )} />

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

          <FormField control={form.control} name="mortgage_payment_gbp" render={({ field }) => (
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
          )} />
        </div>
      </CardContent>
    </Card>
  );
}

// Income Section
export function IncomeSection({ form }: { form: UseFormReturn<PropertyEditFormValues> }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Income</CardTitle>
        <CardDescription>Annual rental income</CardDescription>
      </CardHeader>
      <CardContent>
        <FormField control={form.control} name="annual_rent_gbp" render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>Annual Rent (£)</FormLabel>
            <FormControl><Input {...field} type="number" min="0" step="100" className="bg-input" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </CardContent>
    </Card>
  );
}

// Notes Section
export function NotesSection({ form }: { form: UseFormReturn<PropertyEditFormValues> }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField control={form.control} name="notes" render={({ field }) => (
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
        )} />
      </CardContent>
    </Card>
  );
}
