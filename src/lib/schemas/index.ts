// Property schemas
export {
  propertySchema,
  createPropertySchema,
  updatePropertySchema,
  validateProperty,
  validatePropertyCreate,
  validatePropertyUpdate,
  EPC_RATINGS,
  ASSET_CATEGORIES,
  LIFECYCLE_TYPES,
  TENURE_TYPES,
  OCCUPANCY_STATUSES,
  type EPCRating,
  type AssetCategory,
  type LifecycleType,
  type TenureType,
  type OccupancyStatus,
  type PropertyFormData,
  type CreatePropertyFormData,
  type UpdatePropertyFormData,
} from './property';

// Loan schemas
export {
  loanSchema,
  loanWithContextSchema,
  validateLoan,
  validateLTV,
  MORTGAGE_TYPES,
  PAYMENT_TYPES,
  RATE_TYPES,
  type MortgageType,
  type PaymentType,
  type RateType,
  type LoanFormData,
} from './loan';

// Compliance schemas
export {
  complianceItemSchema,
  createComplianceItemSchema,
  updateComplianceItemSchema,
  complianceDocumentSchema,
  validateComplianceItem,
  validateComplianceItemCreate,
  validateComplianceItemUpdate,
  validateComplianceDocument,
  validateExpiryDate,
  COMPLIANCE_TYPES,
  type ComplianceType,
  type ComplianceItemFormData,
  type CreateComplianceItemFormData,
  type UpdateComplianceItemFormData,
  type ComplianceDocumentFormData,
} from './compliance';
