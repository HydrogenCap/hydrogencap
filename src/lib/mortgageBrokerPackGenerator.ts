// ============================================
// LENDER-GRADE MORTGAGE BROKER PACK PDF GENERATOR
// Professional PDF for BTL/HMO lenders
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getComplianceStatus, type PropertyReportData, type ComplianceItemData } from './reportPdfGenerator';

type Color = [number, number, number];

// Branding colors
const BRAND_PRIMARY: Color = [26, 58, 118];
const BRAND_SECONDARY: Color = [107, 114, 128];
const BRAND_SUCCESS: Color = [34, 197, 94];
const BRAND_WARNING: Color = [234, 179, 8];
const BRAND_DANGER: Color = [239, 68, 68];

// Extended data interfaces for comprehensive broker pack
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

// Validation result
export interface PackValidation {
  canGenerate: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate if the mortgage broker pack can be generated
 */
export function validateMortgageBrokerPack(data: MortgageBrokerPackData): PackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.loanPurpose) {
    errors.push('Loan purpose is required');
  }
  if (!data.company) {
    errors.push('Borrowing entity must be linked to the property');
  }
  
  // Rental income for core rental
  if (data.property.lifecycle_type === 'core_rental') {
    const hasIncome = data.property.income?.some(i => i.annual_rent_gbp > 0);
    if (!hasIncome) {
      errors.push('Rental income is missing for this property');
    }
  }

  // Warnings for missing but optional data
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

  // Check for expired compliance items
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
 * Lender-Grade Mortgage Broker Pack PDF Generator
 */
export class LenderGradeMortgageBrokerPack {
  private doc: jsPDF;
  private data: MortgageBrokerPackData;
  private pageWidth: number;
  private pageHeight: number;
  private margin = 20;
  private currentY = 20;

  constructor(data: MortgageBrokerPackData) {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.data = data;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  generate(): this {
    this.addCoverPage();
    this.doc.addPage();
    this.addExecutiveSummary();
    this.doc.addPage();
    this.addPropertySummary();
    this.addValuationFinanceSnapshot();
    this.doc.addPage();
    this.addRentalIncomeAffordability();
    this.addHmoComplianceLicensing();
    this.doc.addPage();
    this.addBorrowerEntityProfile();
    this.addBorrowerTrackRecord();
    this.doc.addPage();
    this.addInsuranceSummary();
    this.addExitStrategyRiskNote();
    this.doc.addPage();
    this.addDocumentChecklist();
    
    if (this.data.brokerNotes) {
      this.addBrokerNotes();
    }
    
    return this;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  private addCoverPage() {
    // Header block with logo
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 100, 'F');

    // Logo placeholder (white circle with H)
    const logoX = this.margin;
    const logoY = 20;
    const logoSize = 18;
    this.doc.setFillColor(255, 255, 255);
    this.doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    this.doc.setTextColor(26, 58, 118);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('T', logoX + logoSize / 2, logoY + logoSize / 2 + 2, { align: 'center' });

    // Tenure IQ text
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(11);
    this.doc.text('TENURE IQ', logoX + logoSize + 8, logoY + logoSize / 2 + 2);

    // Title
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Mortgage Broker Pack', this.margin, 55);

    // Subtitle with property address
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    const address = this.data.property.address_line;
    const truncatedAddress = address.length > 50 ? address.substring(0, 47) + '...' : address;
    this.doc.text(truncatedAddress, this.margin, 70);

    // Asset type
    const assetType = this.getAssetTypeLabel();
    this.doc.setFontSize(12);
    this.doc.text(assetType, this.margin, 85);

    // Cover details section
    this.currentY = 120;
    this.doc.setTextColor(0, 0, 0);

    // Property details card
    this.addCoverDetailRow('Property Address', `${address}${this.data.property.postcode ? ', ' + this.data.property.postcode : ''}`);
    this.addCoverDetailRow('Asset Type', assetType);
    this.addCoverDetailRow('Borrowing Entity', this.data.company?.legal_name || '—');
    this.addCoverDetailRow('Prepared For', this.data.preparedFor || 'Mortgage Broker / Lender');
    this.addCoverDetailRow('Date Generated', format(new Date(), 'dd MMMM yyyy'));

    // Confidential footer on cover
    this.doc.setFontSize(9);
    this.doc.setTextColor(107, 114, 128);
    this.doc.text('CONFIDENTIAL — For Addressee Only', this.margin, this.pageHeight - 20);
    this.doc.text('Tenure IQ', this.pageWidth - this.margin, this.pageHeight - 20, { align: 'right' });
  }

  private addCoverDetailRow(label: string, value: string) {
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(107, 114, 128);
    this.doc.text(label, this.margin, this.currentY);
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(value || '—', this.margin, this.currentY + 6);
    this.currentY += 18;
  }

  private getAssetTypeLabel(): string {
    const type = this.data.property.property_type || 'Residential Property';
    const hmo = this.data.property.is_hmo_licensed ? ' – HMO' : '';
    return `${type}${hmo}`;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // EXECUTIVE DEAL SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  private addExecutiveSummary() {
    this.addPageHeader('Executive Deal Summary');

    // Deal Overview section
    this.addSectionTitle('Deal Overview');

    const loan = this.data.property.loans?.[0];
    const currentValue = this.data.property.current_value_gbp;
    const currentBalance = loan?.current_mortgage_balance_gbp;
    const targetLoan = this.data.targetLoanAmount || currentBalance;
    const netCapitalReleased = (targetLoan && currentBalance) ? targetLoan - currentBalance : null;

    const loanPurposeLabel = {
      refinance: 'Refinance',
      capital_raise: 'Capital Raise',
      rate_switch: 'Rate Switch',
      purchase: 'Purchase',
      '': '—'
    }[this.data.loanPurpose];

    const dealData = [
      ['Loan Purpose', loanPurposeLabel],
      ['Target Loan Amount', this.formatGBP(targetLoan)],
      ['Target LTV', this.data.targetLTV ? `${this.data.targetLTV}%` : this.calculateLTV()],
      ['Estimated Property Value', this.formatGBP(currentValue)],
      ['Existing Mortgage Balance', this.formatGBP(currentBalance)],
      ['Net Capital Released', netCapitalReleased && netCapitalReleased > 0 ? this.formatGBP(netCapitalReleased) : 'N/A'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: dealData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 15;

    // Key Strengths section
    this.addSectionTitle('Key Strengths');
    
    const strengths = this.generateKeyStrengths();
    strengths.forEach(strength => {
      this.doc.setFontSize(10);
      this.doc.setTextColor(34, 197, 94);
      this.doc.text('✓', this.margin, this.currentY);
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(strength, this.margin + 8, this.currentY);
      this.currentY += 6;
    });
  }

  private generateKeyStrengths(): string[] {
    const strengths: string[] = [];
    const prop = this.data.property;
    const area = prop.passport?.local_authority_text || prop.area_name;
    
    if (area) {
      strengths.push(`${area} location with strong rental demand`);
    }
    
    if (prop.is_hmo_licensed) {
      strengths.push('Proven HMO configuration with licensed operation');
    } else if (prop.beds && prop.beds >= 3) {
      strengths.push(`${prop.beds}-bedroom property with established lettings history`);
    }
    
    const currentYearIncome = prop.income?.find(i => i.year === new Date().getFullYear());
    if (currentYearIncome && currentYearIncome.annual_rent_gbp > 0) {
      strengths.push('Stable and verified rental income');
    }
    
    if (this.data.portfolioSummary.totalProperties > 1) {
      strengths.push(`Experienced landlord with ${this.data.portfolioSummary.totalProperties}-property portfolio`);
    }
    
    strengths.push('Long-term hold strategy with professional management');
    
    return strengths.slice(0, 5);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PROPERTY SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  private addPropertySummary() {
    this.addPageHeader('Property Summary');

    const prop = this.data.property;
    const passport = prop.passport;

    const propertyData = [
      ['Full Address', `${prop.address_line}${prop.postcode ? ', ' + prop.postcode : ''}`],
      ['Local Authority', passport?.local_authority_text || prop.area_name || '—'],
      ['Property Type', prop.property_type || '—'],
      ['Construction Period', passport?.construction_date_band || '—'],
      ['Tenure', prop.tenure || '—'],
      ['Bedrooms', prop.beds?.toString() || '—'],
      ['Bathrooms', prop.bathrooms?.toString() || '—'],
      ['EPC Rating', prop.epc_rating || '—'],
      ['Council Tax Band', prop.is_hmo_licensed ? 'HMO – exempt' : (passport?.council_tax_band || '—')],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: propertyData,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 100 },
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VALUATION & FINANCE SNAPSHOT
  // ══════════════════════════════════════════════════════════════════════════════
  private addValuationFinanceSnapshot() {
    this.checkNewPage(80);
    this.addSectionTitle('Valuation & Finance Snapshot');

    const prop = this.data.property;
    const loan = prop.loans?.[0];

    const financeData = [
      ['Purchase Price', this.formatGBP(prop.purchase_price_gbp)],
      ['Purchase Date', prop.original_purchase_date ? format(new Date(prop.original_purchase_date), 'dd/MM/yyyy') : '—'],
      ['Current Estimated Value', this.formatGBP(prop.current_value_gbp)],
      ['Valuation Source', 'Owner Estimate'],
      ['Valuation Date', format(new Date(), 'dd/MM/yyyy')],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: financeData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 10;

    // Mortgage details
    if (loan) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
      this.doc.text('Current Mortgage', this.margin, this.currentY);
      this.currentY += 6;
      this.doc.setTextColor(0, 0, 0);

      const mortgageData = [
        ['Current Lender', loan.lender || '—'],
        ['Current Mortgage Balance', this.formatGBP(loan.current_mortgage_balance_gbp)],
        ['Interest Rate', loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—'],
        ['Repayment Type', loan.capital_or_interest === 'interest' ? 'Interest Only' : 'Capital & Interest'],
        ['Fixed Rate Expiry', loan.fixed_rate_expires ? format(new Date(loan.fixed_rate_expires), 'dd/MM/yyyy') : '—'],
        ['Current LTV', this.calculateLTV()],
      ];

      autoTable(this.doc, {
        startY: this.currentY,
        body: mortgageData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
          1: { cellWidth: 80 },
        },
      });
      this.currentY = this.doc.lastAutoTable.finalY + 10;
    } else {
      this.doc.setFontSize(10);
      this.doc.setTextColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
      this.doc.text('Property is currently unencumbered / cash purchase.', this.margin, this.currentY);
      this.currentY += 10;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENTAL INCOME & AFFORDABILITY
  // ══════════════════════════════════════════════════════════════════════════════
  private addRentalIncomeAffordability() {
    this.addPageHeader('Rental Income & Affordability');

    const prop = this.data.property;
    const currentYear = new Date().getFullYear();
    const income = prop.income?.find(i => i.year === currentYear);

    // Rental strategy
    this.addSectionTitle('Rental Strategy');
    const strategy = prop.is_hmo_licensed ? 'HMO – Per Room Let' : 'Single Let (AST)';
    this.doc.setFontSize(10);
    this.doc.text(strategy, this.margin, this.currentY);
    this.currentY += 10;

    // Income schedule
    this.addSectionTitle('Rental Schedule');

    if (income && income.annual_rent_gbp > 0) {
      const annualRent = income.annual_rent_gbp;
      const monthlyRent = annualRent / 12;
      const beds = prop.beds || 1;
      const rentPerRoom = monthlyRent / beds;

      // Room breakdown if HMO
      if (prop.is_hmo_licensed && beds > 1) {
        const roomData: string[][] = [];
        for (let i = 1; i <= beds; i++) {
          roomData.push([`Room ${i}`, this.formatGBP(rentPerRoom, true)]);
        }
        roomData.push(['', '']);
        roomData.push(['Total Monthly Rent', this.formatGBP(monthlyRent, true)]);
        roomData.push(['Total Annual Rent', this.formatGBP(annualRent, true)]);

        autoTable(this.doc, {
          startY: this.currentY,
          head: [['Room', 'Monthly Rent']],
          body: roomData,
          theme: 'striped',
          headStyles: { fillColor: BRAND_PRIMARY, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 50, halign: 'right' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index >= beds) {
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
      } else {
        const rentData = [
          ['Monthly Rent', this.formatGBP(monthlyRent, true)],
          ['Annual Rent', this.formatGBP(annualRent, true)],
        ];

        autoTable(this.doc, {
          startY: this.currentY,
          body: rentData,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 55 },
            1: { cellWidth: 60, halign: 'right' },
          },
        });
      }

      this.currentY = this.doc.lastAutoTable.finalY + 10;

      // Bills statement
      this.doc.setFontSize(9);
      this.doc.setTextColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
      this.doc.text('Bills: ' + (prop.is_hmo_licensed ? 'Included in room rents' : 'Tenant responsibility'), this.margin, this.currentY);
      this.currentY += 5;
      this.doc.text('Rental income supported by ASTs / licences and bank statements.', this.margin, this.currentY);
      this.currentY += 10;
    } else {
      this.doc.setFontSize(10);
      this.doc.text('No rental income recorded for current year.', this.margin, this.currentY);
      this.currentY += 10;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // HMO COMPLIANCE & LICENSING
  // ══════════════════════════════════════════════════════════════════════════════
  private addHmoComplianceLicensing() {
    this.checkNewPage(60);
    this.addSectionTitle('HMO Compliance & Licensing');

    const prop = this.data.property;
    const hmoItem = prop.complianceItems.find(i => 
      i.compliance_type.toLowerCase().includes('hmo') || i.compliance_type.toLowerCase().includes('licence')
    );

    const hmoData = [
      ['HMO Licence Status', prop.is_hmo_licensed ? 'Active' : (hmoItem ? 'Recorded' : 'Exempt / Not Required')],
      ['Licence Number', hmoItem?.documents?.[0]?.original_file_name?.match(/\d+/)?.[0] || '—'],
      ['Expiry Date', hmoItem?.expiry_date ? format(new Date(hmoItem.expiry_date), 'dd/MM/yyyy') : '—'],
      ['Permitted Occupancy', prop.beds ? `Up to ${prop.beds} persons` : '—'],
      ['Fire Safety Compliance', this.hasValidCert('fire_alarm') ? 'Confirmed' : 'Pending verification'],
      ['Local Authority', prop.passport?.local_authority_text || prop.area_name || '—'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: hmoData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // BORROWER / ENTITY PROFILE
  // ══════════════════════════════════════════════════════════════════════════════
  private addBorrowerEntityProfile() {
    this.addPageHeader('Borrower / Entity Profile');

    const company = this.data.company;

    if (company) {
      const entityData = [
        ['Borrowing Entity Name', company.legal_name],
        ['Company Number', company.company_number || '—'],
        ['Entity Type', this.formatCompanyType(company.company_type)],
        ['Registered Address', company.ch_registered_address || '—'],
        ['Incorporation Date', company.ch_incorporation_date ? format(new Date(company.ch_incorporation_date), 'dd/MM/yyyy') : '—'],
        ['Confirmation', 'Property-owning SPV / Non-trading'],
      ];

      autoTable(this.doc, {
        startY: this.currentY,
        body: entityData,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
          1: { cellWidth: 100 },
        },
      });
      this.currentY = this.doc.lastAutoTable.finalY + 10;

      // Shareholders
      if (company.shareholders && company.shareholders.length > 0) {
        this.addSectionTitle('Shareholders');
        
        const shareholderData = company.shareholders.map(sh => [
          sh.name,
          sh.party_type === 'COMPANY' ? 'Company' : 'Individual',
          `${sh.percent.toFixed(1)}%`
        ]);

        autoTable(this.doc, {
          startY: this.currentY,
          head: [['Shareholder', 'Type', 'Holding']],
          body: shareholderData,
          theme: 'striped',
          headStyles: { fillColor: BRAND_PRIMARY, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
        });
        this.currentY = this.doc.lastAutoTable.finalY + 10;
      }

      // Directors
      if (company.directors && company.directors.length > 0) {
        this.addSectionTitle('Directors');
        company.directors.forEach(dir => {
          this.doc.setFontSize(10);
          this.doc.text(`• ${dir}`, this.margin + 5, this.currentY);
          this.currentY += 5;
        });
        this.currentY += 5;
      }
    } else {
      this.doc.setFontSize(10);
      this.doc.setTextColor(BRAND_DANGER[0], BRAND_DANGER[1], BRAND_DANGER[2]);
      this.doc.text('No borrowing entity linked to this property.', this.margin, this.currentY);
      this.currentY += 10;
    }
  }

  private formatCompanyType(type: string): string {
    const types: Record<string, string> = {
      'SPV': 'Special Purpose Vehicle (SPV)',
      'HOLDCO': 'Holding Company',
      'OPCO': 'Operating Company',
      'OTHER': 'Limited Company',
    };
    return types[type] || type;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // BORROWER TRACK RECORD
  // ══════════════════════════════════════════════════════════════════════════════
  private addBorrowerTrackRecord() {
    this.checkNewPage(60);
    this.addSectionTitle('Borrower Track Record (Portfolio Summary)');

    const summary = this.data.portfolioSummary;

    const trackData = [
      ['Total Properties Owned', summary.totalProperties.toString()],
      ['Total Bedrooms', summary.totalBedrooms.toString()],
      ['Total Portfolio Value', this.formatGBP(summary.totalValue)],
      ['Average Portfolio LTV', summary.averageLTV ? `${summary.averageLTV.toFixed(1)}%` : '—'],
      ['HMO Experience', `${summary.hmoExperienceYears}+ years`],
      ['Mortgage Arrears / Defaults', summary.hasArrears ? 'Yes – see notes' : 'None'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      body: trackData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // INSURANCE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  private addInsuranceSummary() {
    this.addPageHeader('Insurance Summary');

    const policy = this.data.property.insurancePolicy;

    if (policy) {
      const insuranceData = [
        ['Buildings Insurance', this.data.property.is_hmo_licensed ? 'HMO-specific cover' : 'Standard landlord cover'],
        ['Insurer Name', policy.insurer_name || '—'],
        ['Policy Number', policy.policy_number || '—'],
        ['Sum Insured', '—'],
        ['Policy Expiry Date', policy.renewal_date ? format(new Date(policy.renewal_date), 'dd/MM/yyyy') : '—'],
        ['Annual Premium', policy.premium_gbp ? this.formatGBP(policy.premium_gbp) : '—'],
        ['Public Liability', 'Standard cover included'],
      ];

      autoTable(this.doc, {
        startY: this.currentY,
        body: insuranceData,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
          1: { cellWidth: 100 },
        },
      });
    } else {
      this.doc.setFontSize(10);
      this.doc.setTextColor(BRAND_WARNING[0], BRAND_WARNING[1], BRAND_WARNING[2]);
      this.doc.text('No insurance policy details currently recorded in system.', this.margin, this.currentY);
    }
    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // EXIT STRATEGY & RISK NOTE
  // ══════════════════════════════════════════════════════════════════════════════
  private addExitStrategyRiskNote() {
    this.checkNewPage(50);
    this.addSectionTitle('Exit Strategy & Risk Note');

    const area = this.data.property.passport?.local_authority_text || this.data.property.area_name || 'the local area';

    const exitText = [
      `Exit Strategy: Long-term hold with periodic refinance for capital release.`,
      `Secondary Exit: Open market sale. Comparable sales data supports current valuation.`,
      `Vacancy Risk: Mitigated by strong local rental demand in ${area}.`,
      '',
      `${area} benefits from a diverse tenant base, with demand supported by employment, ` +
      `transport links, and local amenities. The property's configuration and condition ` +
      `position it well for sustained occupancy.`,
    ];

    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    exitText.forEach(line => {
      if (line) {
        const lines = this.doc.splitTextToSize(line, this.pageWidth - (this.margin * 2));
        this.doc.text(lines, this.margin, this.currentY);
        this.currentY += lines.length * 5;
      } else {
        this.currentY += 3;
      }
    });
    this.currentY += 10;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DOCUMENT CHECKLIST
  // ══════════════════════════════════════════════════════════════════════════════
  private addDocumentChecklist() {
    this.addPageHeader('Document Checklist');

    const prop = this.data.property;

    const checklistItems = [
      { doc: 'EPC Certificate', type: 'epc', required: true },
      { doc: 'EICR (Electrical Safety)', type: 'eicr', required: true },
      { doc: 'Gas Safety Certificate', type: 'gas_safety', required: true },
      { doc: 'HMO Licence', type: 'hmo_licence', required: prop.is_hmo_licensed },
      { doc: 'ASTs / Rental Agreements', type: null, required: true },
      { doc: 'Buildings Insurance Schedule', type: null, isInsurance: true },
      { doc: 'Title Register', type: null, required: true },
      { doc: 'Company Accounts / SPV Confirmation', type: null, required: !!this.data.company },
      { doc: 'Bank Statements (rental)', type: null, required: prop.lifecycle_type === 'core_rental' },
    ];

    const checklistData = checklistItems.map(item => {
      let status: string;
      let expiry = '—';

      if (item.type) {
        const compItem = prop.complianceItems.find(c => c.compliance_type === item.type);
        if (compItem) {
          const compStatus = getComplianceStatus(compItem);
          status = compStatus === 'valid' ? 'Uploaded' : 
                   compStatus === 'expired' ? 'Expired' : 
                   compStatus === 'expiring_soon' ? 'Expiring Soon' : 'Missing';
          expiry = compItem.expiry_date ? format(new Date(compItem.expiry_date), 'dd/MM/yyyy') : '—';
        } else {
          status = item.required ? 'Missing' : 'N/A';
        }
      } else if (item.isInsurance) {
        status = prop.insurancePolicy ? 'Uploaded' : 'Missing';
        expiry = prop.insurancePolicy?.renewal_date ? format(new Date(prop.insurancePolicy.renewal_date), 'dd/MM/yyyy') : '—';
      } else {
        status = '—';
      }

      return [item.doc, status, expiry];
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Document', 'Status', 'Expiry Date']],
      body: checklistData,
      theme: 'striped',
      headStyles: { fillColor: BRAND_PRIMARY, fontSize: 9, cellPadding: 4 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'Uploaded') data.cell.styles.textColor = BRAND_SUCCESS;
          else if (value === 'Missing') data.cell.styles.textColor = BRAND_DANGER;
          else if (value === 'Expired') data.cell.styles.textColor = BRAND_DANGER;
          else if (value === 'Expiring Soon') data.cell.styles.textColor = BRAND_WARNING;
        }
      },
    });
    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // BROKER NOTES
  // ══════════════════════════════════════════════════════════════════════════════
  private addBrokerNotes() {
    this.checkNewPage(40);
    this.addSectionTitle('Additional Notes');

    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    const lines = this.doc.splitTextToSize(this.data.brokerNotes, this.pageWidth - (this.margin * 2));
    this.doc.text(lines, this.margin, this.currentY);
    this.currentY += lines.length * 5 + 10;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ══════════════════════════════════════════════════════════════════════════════
  private addPageHeader(title: string) {
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

  private addSectionTitle(title: string) {
    this.checkNewPage(15);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');
  }

  private checkNewPage(spaceNeeded: number) {
    if (this.currentY + spaceNeeded > this.pageHeight - 25) {
      this.doc.addPage();
      this.currentY = 25;
    }
  }

  private formatGBP(value: number | null | undefined, compact = false): string {
    if (value === null || value === undefined) return '—';
    if (compact) {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private calculateLTV(): string {
    const loan = this.data.property.loans?.[0];
    const balance = loan?.current_mortgage_balance_gbp;
    const value = this.data.property.current_value_gbp;
    
    if (balance && value && value > 0) {
      const ltv = (balance / value) * 100;
      return `${ltv.toFixed(1)}%`;
    }
    return '—';
  }

  private hasValidCert(type: string): boolean {
    return this.data.property.complianceItems.some(
      i => i.compliance_type === type && getComplianceStatus(i) === 'valid'
    );
  }

  private addFooters() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      // Footer line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);

      // Footer text
      this.doc.setTextColor(107, 114, 128);
      this.doc.setFontSize(8);
      this.doc.text('Tenure IQ | Confidential', this.margin, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 8, { align: 'right' });
    }
  }

  public getBlob(): Blob {
    this.addFooters();
    return this.doc.output('blob');
  }

  public download(filename: string) {
    this.addFooters();
    this.doc.save(filename);
  }
}
