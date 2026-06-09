/**
 * Backwards-compatible barrel for the Tenure IQ PDF report generators.
 *
 * The implementation now lives in `src/lib/pdf/` with shared primitives
 * (colors, base class, status helpers) and one file per report class.
 * External callers continue to import from this module unchanged.
 */
export type { Color } from '@/types/pdf';
export type {
  ReportFilters,
  ComplianceItemData,
  PropertyReportData,
} from './pdf/types';
export { getComplianceStatus, getStatusColor } from './pdf/status';
export { ReportPdfBase } from './pdf/ReportPdfBase';
export { PortfolioComplianceReport } from './pdf/PortfolioComplianceReport';
export { PropertyCompliancePack } from './pdf/PropertyCompliancePack';
export { MortgageBrokerPack } from './pdf/MortgageBrokerPack';
export { InsuranceBrokerPack } from './pdf/InsuranceBrokerPack';
