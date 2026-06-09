import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ReportPdfBase } from './ReportPdfBase';
import { BRAND_SUCCESS, BRAND_DANGER } from './colors';
import { getComplianceStatus } from './status';
import type { PropertyReportData } from './types';

export class MortgageBrokerPack extends ReportPdfBase {
  private property: PropertyReportData;
  private brokerNotes: string;

  constructor(property: PropertyReportData, brokerNotes = '') {
    super();
    this.property = property;
    this.brokerNotes = brokerNotes;
  }

  generate() {
    this.addHeader('Mortgage Broker Pack');
    this.addPropertySummary();
    this.addValuationFinance();
    this.addIncomeSnapshot();
    this.addDocumentChecklist();
    if (this.brokerNotes) this.addBrokerNotes();
    return this;
  }

  private addPropertySummary() {
    this.addSectionTitle('Property Summary');

    this.addKeyValue('Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Property Type', this.property.property_type);
    this.addKeyValue('Bedrooms', this.property.beds?.toString());
    this.addKeyValue('Bathrooms', this.property.bathrooms?.toString());
    this.addKeyValue('Local Authority', this.property.passport?.local_authority_text || this.property.area_name);
    this.addKeyValue('Construction Period', this.property.passport?.construction_date_band);
    this.addKeyValue('Council Tax Band', this.property.passport?.council_tax_band);
    this.addKeyValue('EPC Rating', this.property.epc_rating);
    this.addKeyValue('Tenure', this.property.tenure);

    this.currentY += 10;
  }

  private addValuationFinance() {
    this.addSectionTitle('Valuation & Finance Snapshot');

    const formatGBP = (val: number | null) => val ? `£${val.toLocaleString()}` : '—';

    this.addKeyValue('Current Value', formatGBP(this.property.current_value_gbp));
    this.addKeyValue('Purchase Price', formatGBP(this.property.purchase_price_gbp));
    this.addKeyValue('Purchase Date', this.property.original_purchase_date ? format(new Date(this.property.original_purchase_date), 'dd/MM/yyyy') : '—');

    const loan = this.property.loans?.[0];
    if (loan) {
      this.currentY += 5;
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Current Mortgage:', this.margin, this.currentY);
      this.currentY += 5;
      this.doc.setFont('helvetica', 'normal');

      this.addKeyValue('Lender', loan.lender);
      this.addKeyValue('Balance', formatGBP(loan.current_mortgage_balance_gbp));
      this.addKeyValue('Interest Rate', loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—');
      this.addKeyValue('Repayment Type', loan.capital_or_interest === 'interest' ? 'Interest Only' : 'Repayment');
      this.addKeyValue('Fixed Rate Expires', loan.fixed_rate_expires ? format(new Date(loan.fixed_rate_expires), 'dd/MM/yyyy') : '—');

      if (loan.current_mortgage_balance_gbp && this.property.current_value_gbp) {
        const ltv = (loan.current_mortgage_balance_gbp / this.property.current_value_gbp) * 100;
        this.addKeyValue('Current LTV', `${ltv.toFixed(1)}%`);
      }
    } else {
      this.addKeyValue('Mortgage Status', 'Unencumbered / Cash Purchase');
    }

    this.currentY += 10;
  }

  private addIncomeSnapshot() {
    if (this.property.lifecycle_type !== 'core_rental') return;

    this.addSectionTitle('Income Snapshot');

    const currentYear = new Date().getFullYear();
    const income = this.property.income?.find(i => i.year === currentYear);

    if (income) {
      this.addKeyValue('Annual Rent', `£${income.annual_rent_gbp.toLocaleString()}`);
      this.addKeyValue('Monthly Rent', `£${Math.round(income.annual_rent_gbp / 12).toLocaleString()}`);
      this.addKeyValue('Rental Strategy', this.property.is_hmo_licensed ? 'HMO - Per Room' : 'Single Let AST');
    } else {
      this.addParagraph('No rental income data recorded for current year.');
    }

    this.currentY += 10;
  }

  private addDocumentChecklist() {
    this.checkNewPage(60);
    this.addSectionTitle('Document Checklist for Broker');

    const hasEpc = this.property.complianceItems.some(i => i.compliance_type === 'epc' && getComplianceStatus(i) === 'valid');
    const hasEicr = this.property.complianceItems.some(i => i.compliance_type === 'eicr' && getComplianceStatus(i) === 'valid');
    const hasGas = this.property.complianceItems.some(i => i.compliance_type === 'gas_safety' && getComplianceStatus(i) === 'valid');

    const checklist = [
      ['EPC Certificate', hasEpc ? 'Present' : 'Missing'],
      ['EICR', hasEicr ? 'Present' : 'Missing'],
      ['Gas Safety Certificate', hasGas ? 'Present' : 'Missing'],
      ['Proof of Ownership (Title)', '—'],
      ['ID Documents', '—'],
      ['AST/Lease Agreement', '—'],
      ['Buildings Insurance Schedule', this.property.insurancePolicy ? 'Present' : 'Missing'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Document', 'Status']],
      body: checklist,
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'Present') data.cell.styles.textColor = BRAND_SUCCESS;
          if (value === 'Missing') data.cell.styles.textColor = BRAND_DANGER;
        }
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  private addBrokerNotes() {
    this.checkNewPage(40);
    this.addSectionTitle('Additional Notes');
    this.addParagraph(this.brokerNotes);
  }
}
