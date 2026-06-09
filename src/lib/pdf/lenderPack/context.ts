import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { BRAND_PRIMARY } from '../colors';
import { getComplianceStatus } from '../status';
import type { PropertyReportData } from '../types';

// ════════════════════════════════════════════════════════════════════════════
// Shared types for the lender-grade Mortgage Broker Pack
// ════════════════════════════════════════════════════════════════════════════

export interface CompanyData {
  id: string;
  legal_name: string;
  company_number: string | null;
  company_type: string;
  ch_registered_address: string | null;
  ch_incorporation_date: string | null;
  shareholders?: {
    name: string;
    percent: number;
    party_type: string;
  }[];
  directors?: string[];
}

export interface PortfolioSummary {
  totalProperties: number;
  totalBedrooms: number;
  totalValue: number;
  totalMortgageBalance: number;
  averageLTV: number | null;
  hmoExperienceYears: number;
  hasArrears: boolean;
}

export interface MortgageBrokerPackData {
  property: PropertyReportData;
  company: CompanyData | null;
  portfolioSummary: PortfolioSummary;
  loanPurpose: 'refinance' | 'capital_raise' | 'rate_switch' | 'purchase' | '';
  targetLoanAmount: number | null;
  targetLTV: number | null;
  brokerNotes: string;
  preparedFor: string;
}

export interface PackValidation {
  canGenerate: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate if the mortgage broker pack can be generated.
 */
export function validateMortgageBrokerPack(data: MortgageBrokerPackData): PackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.loanPurpose) {
    errors.push('Loan purpose is required');
  }
  if (!data.company) {
    errors.push('Borrowing entity must be linked to the property');
  }

  if (data.property.lifecycle_type === 'core_rental') {
    const hasIncome = data.property.income?.some(i => i.annual_rent_gbp > 0);
    if (!hasIncome) {
      errors.push('Rental income is missing for this property');
    }
  }

  const hasEpc = data.property.complianceItems.some(i =>
    i.compliance_type === 'epc' && getComplianceStatus(i) === 'valid'
  );
  const hasEicr = data.property.complianceItems.some(i =>
    i.compliance_type === 'eicr' && getComplianceStatus(i) === 'valid'
  );
  const hasGas = data.property.complianceItems.some(i =>
    i.compliance_type === 'gas_safety' && getComplianceStatus(i) === 'valid'
  );

  if (!hasEpc) warnings.push('EPC certificate is missing or expired');
  if (!hasEicr) warnings.push('EICR certificate is missing or expired');
  if (!hasGas && data.property.passport?.local_authority_text) {
    warnings.push('Gas safety certificate is missing or expired');
  }
  if (!data.property.insurancePolicy) {
    warnings.push('Buildings insurance details not recorded');
  }

  const expiredItems = data.property.complianceItems.filter(
    i => getComplianceStatus(i) === 'expired'
  );
  if (expiredItems.length > 0) {
    warnings.push(`${expiredItems.length} compliance certificate(s) have expired`);
  }

  return {
    canGenerate: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Shared draw context passed to every section builder.
 * Owns the mutable cursor (`currentY`) and the jsPDF instance.
 */
export class LenderPackContext {
  public doc: jsPDF;
  public data: MortgageBrokerPackData;
  public pageWidth: number;
  public pageHeight: number;
  public margin = 20;
  public currentY = 20;

  constructor(data: MortgageBrokerPackData) {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.data = data;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  // ── shared primitives ─────────────────────────────────────────────────────
  addPageHeader(title: string) {
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 22, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Tenure IQ', this.margin, 10);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(title, this.margin, 17);

    this.doc.text(format(new Date(), 'dd MMM yyyy'), this.pageWidth - this.margin, 10, { align: 'right' });

    this.currentY = 32;
    this.doc.setTextColor(0, 0, 0);
  }

  addSectionTitle(title: string) {
    this.checkNewPage(15);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');
  }

  checkNewPage(spaceNeeded: number) {
    if (this.currentY + spaceNeeded > this.pageHeight - 25) {
      this.doc.addPage();
      this.currentY = 25;
    }
  }

  formatGBP(value: number | null | undefined, _compact = false): string {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  calculateLTV(): string {
    const loan = this.data.property.loans?.[0];
    const balance = loan?.current_mortgage_balance_gbp;
    const value = this.data.property.current_value_gbp;

    if (balance && value && value > 0) {
      const ltv = (balance / value) * 100;
      return `${ltv.toFixed(1)}%`;
    }
    return '—';
  }

  hasValidCert(type: string): boolean {
    return this.data.property.complianceItems.some(
      i => i.compliance_type === type && getComplianceStatus(i) === 'valid'
    );
  }

  getAssetTypeLabel(): string {
    const type = this.data.property.property_type || 'Residential Property';
    const hmo = this.data.property.is_hmo_licensed ? ' – HMO' : '';
    return `${type}${hmo}`;
  }

  formatCompanyType(type: string): string {
    const types: Record<string, string> = {
      'SPV': 'Special Purpose Vehicle (SPV)',
      'HOLDCO': 'Holding Company',
      'OPCO': 'Operating Company',
      'OTHER': 'Limited Company',
    };
    return types[type] || type;
  }

  addFooters() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);

      this.doc.setTextColor(107, 114, 128);
      this.doc.setFontSize(8);
      this.doc.text('Tenure IQ | Confidential', this.margin, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 8, { align: 'right' });
    }
  }
}
