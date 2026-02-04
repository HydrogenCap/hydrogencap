import { z } from 'zod';

// Compliance Types (from complianceTypes.ts)
export const COMPLIANCE_TYPES = [
  'Gas Safety Certificate (CP12)',
  'Electrical Safety Certificate (EICR)',
  'Fire Alarm Certificate',
  'Emergency Lighting Certificate',
  'Fire Risk Assessment (FRA)',
  'PAT Testing',
  'Legionella Risk Assessment',
  'EPC',
  'HMO Licence',
  'Selective Licence',
  'Asbestos Survey',
  'Building Control Certificate',
  'Fire Door Certification',
  'Fire Panel Commissioning Certificate',
  'Fire Suppression System Certificate',
  'Insurance Schedule',
  'Floor Plans / Fire Plans',
  'Smoke Alarm Declaration',
  'CO Alarm Declaration',
] as const;

export type ComplianceType = typeof COMPLIANCE_TYPES[number];

// Compliance Item validation schema
export const complianceItemSchema = z.object({
  compliance_type: z
    .string()
    .min(1, 'Compliance type is required'),
  
  property_id: z
    .string()
    .uuid('Invalid property ID'),
  
  issue_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid issue date format'
    ),
  
  expiry_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid expiry date format'
    ),
  
  notes: z
    .string()
    .max(2000, 'Notes are too long')
    .optional()
    .nullable(),
  
  responsible_party: z
    .string()
    .max(200, 'Responsible party name is too long')
    .optional()
    .nullable(),
  
  is_required: z
    .boolean()
    .optional()
    .nullable(),
  
  is_manually_excluded: z
    .boolean()
    .optional()
    .nullable(),
  
  exclusion_reason: z
    .string()
    .max(500, 'Exclusion reason is too long')
    .optional()
    .nullable(),
  
  is_coho_required: z
    .boolean()
    .optional()
    .nullable(),
  
  reminder_days: z
    .array(z.number().int().min(1).max(365))
    .optional()
    .nullable(),
});

// For creating a new compliance item
export const createComplianceItemSchema = complianceItemSchema.extend({
  compliance_type: z.string().min(1, 'Compliance type is required'),
  property_id: z.string().uuid('Property is required'),
});

// For updating a compliance item
export const updateComplianceItemSchema = complianceItemSchema.partial();

// Compliance Document validation schema
export const complianceDocumentSchema = z.object({
  compliance_item_id: z
    .string()
    .uuid('Invalid compliance item ID'),
  
  file_url: z
    .string()
    .url('Invalid file URL'),
  
  original_file_name: z
    .string()
    .min(1, 'File name is required')
    .max(500, 'File name is too long'),
  
  file_type: z
    .string()
    .max(100, 'File type is too long')
    .optional()
    .nullable(),
  
  notes: z
    .string()
    .max(1000, 'Notes are too long')
    .optional()
    .nullable(),
  
  version_number: z
    .number()
    .int('Version must be a whole number')
    .min(1, 'Version must be at least 1')
    .optional()
    .nullable(),
  
  is_current: z
    .boolean()
    .default(true),
});

// Type exports
export type ComplianceItemFormData = z.infer<typeof complianceItemSchema>;
export type CreateComplianceItemFormData = z.infer<typeof createComplianceItemSchema>;
export type UpdateComplianceItemFormData = z.infer<typeof updateComplianceItemSchema>;
export type ComplianceDocumentFormData = z.infer<typeof complianceDocumentSchema>;

// Validation helpers
export function validateComplianceItem(data: unknown) {
  return complianceItemSchema.safeParse(data);
}

export function validateComplianceItemCreate(data: unknown) {
  return createComplianceItemSchema.safeParse(data);
}

export function validateComplianceItemUpdate(data: unknown) {
  return updateComplianceItemSchema.safeParse(data);
}

export function validateComplianceDocument(data: unknown) {
  return complianceDocumentSchema.safeParse(data);
}

// Date validation helpers
export function validateExpiryDate(issueDate: string | null, expiryDate: string | null): {
  valid: boolean;
  error?: string;
} {
  if (!issueDate || !expiryDate) {
    return { valid: true };
  }
  
  const issue = new Date(issueDate);
  const expiry = new Date(expiryDate);
  
  if (expiry <= issue) {
    return {
      valid: false,
      error: 'Expiry date must be after issue date',
    };
  }
  
  return { valid: true };
}
