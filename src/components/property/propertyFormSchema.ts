import { z } from 'zod';

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
