import { z } from 'zod';

// UK Postcode regex - validates standard UK postcodes
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

// EPC Ratings
export const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type EPCRating = typeof EPC_RATINGS[number];

// Asset Categories
export const ASSET_CATEGORIES = ['Single Let', 'HMO', 'HMO (Licensed)', 'Commercial', 'Mixed Use'] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];

// Lifecycle Types
export const LIFECYCLE_TYPES = ['development', 'core_rental'] as const;
export type LifecycleType = typeof LIFECYCLE_TYPES[number];

// Tenure Types
export const TENURE_TYPES = ['Freehold', 'Leasehold', 'Share of Freehold', 'Commonhold'] as const;
export type TenureType = typeof TENURE_TYPES[number];

// Occupancy Statuses
export const OCCUPANCY_STATUSES = ['Occupied', 'Void', 'In Works'] as const;
export type OccupancyStatus = typeof OCCUPANCY_STATUSES[number];

// Property validation schema
export const propertySchema = z.object({
  address_line: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(200, 'Address is too long'),
  
  postcode: z
    .string()
    .regex(UK_POSTCODE_REGEX, 'Invalid UK postcode format')
    .transform(v => v.toUpperCase().replace(/\s+/g, ' ').trim()),
  
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City name is too long')
    .optional()
    .nullable(),
  
  county: z
    .string()
    .max(100, 'County name is too long')
    .optional()
    .nullable(),
  
  current_value_gbp: z
    .number()
    .min(10000, 'Property value seems too low (minimum £10,000)')
    .max(100000000, 'Property value seems too high (maximum £100M)')
    .optional()
    .nullable(),
  
  purchase_price_gbp: z
    .number()
    .min(1000, 'Purchase price seems too low')
    .max(100000000, 'Purchase price seems too high')
    .optional()
    .nullable(),
  
  purchase_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid date format'
    ),
  
  beds: z
    .number()
    .int('Bedrooms must be a whole number')
    .min(0, 'Bedrooms cannot be negative')
    .max(50, 'Bedrooms seems too high')
    .optional()
    .nullable(),
  
  bathrooms: z
    .number()
    .min(0, 'Bathrooms cannot be negative')
    .max(30, 'Bathrooms seems too high')
    .optional()
    .nullable(),
  
  square_feet: z
    .number()
    .min(50, 'Square footage seems too low')
    .max(100000, 'Square footage seems too high')
    .optional()
    .nullable(),
  
  epc_rating: z
    .enum(EPC_RATINGS)
    .optional()
    .nullable(),
  
  epc_required: z
    .boolean()
    .optional()
    .nullable(),
  
  is_grade_listed: z
    .boolean()
    .optional()
    .nullable(),
  
  listing_grade: z
    .enum(['I', 'II*', 'II'])
    .optional()
    .nullable(),
  
  tenure: z
    .enum(TENURE_TYPES)
    .optional()
    .nullable(),
  
  title_number: z
    .string()
    .max(50, 'Title number is too long')
    .optional()
    .nullable(),
  
  asset_category: z
    .enum(ASSET_CATEGORIES)
    .optional()
    .nullable(),
  
  lifecycle_type: z
    .enum(LIFECYCLE_TYPES)
    .default('development'),
  
  occupancy_status: z
    .enum(OCCUPANCY_STATUSES)
    .optional()
    .nullable(),
  
  is_hmo_licensed: z
    .boolean()
    .optional()
    .nullable(),
  
  has_gas: z
    .boolean()
    .optional()
    .nullable(),
  
  co_alarm_required: z
    .boolean()
    .optional()
    .nullable(),
  
  has_fire_alarm_system: z
    .boolean()
    .optional()
    .nullable(),
  
  fire_alarm_grade: z
    .string()
    .max(20)
    .optional()
    .nullable(),
  
  has_emergency_lighting: z
    .boolean()
    .optional()
    .nullable(),
  
  selective_licence_required: z
    .boolean()
    .optional()
    .nullable(),
  
  local_authority: z
    .string()
    .max(100, 'Local authority name is too long')
    .optional()
    .nullable(),
});

// For creating a new property (required fields)
export const createPropertySchema = propertySchema.extend({
  address_line: z.string().min(5, 'Address is required'),
  postcode: z.string().regex(UK_POSTCODE_REGEX, 'Valid UK postcode is required'),
});

// For updating a property (all fields optional)
export const updatePropertySchema = propertySchema.partial();

// Type exports
export type PropertyFormData = z.infer<typeof propertySchema>;
export type CreatePropertyFormData = z.infer<typeof createPropertySchema>;
export type UpdatePropertyFormData = z.infer<typeof updatePropertySchema>;

// Validation helper
export function validateProperty(data: unknown) {
  return propertySchema.safeParse(data);
}

export function validatePropertyCreate(data: unknown) {
  return createPropertySchema.safeParse(data);
}

export function validatePropertyUpdate(data: unknown) {
  return updatePropertySchema.safeParse(data);
}
