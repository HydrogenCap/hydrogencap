import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ReportPdfBase } from './ReportPdfBase';
import { BRAND_SUCCESS, BRAND_WARNING, BRAND_DANGER } from './colors';
import { getComplianceStatus } from './status';
import type { PropertyReportData } from './types';

export class InsuranceBrokerPack extends ReportPdfBase {
  private property: PropertyReportData;

  constructor(property: PropertyReportData) {
    super();
    this.property = property;
  }

  generate() {
    this.addHeader('Insurance Broker Pack');
    this.addRiskBuildingSummary();
    this.addComplianceDocsIndex();
    this.addPolicyDetails();
    return this;
  }

  private addRiskBuildingSummary() {
    this.addSectionTitle('Risk & Building Summary');

    this.addKeyValue('Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Property Type', this.property.property_type);
    this.addKeyValue('Construction Period', this.property.passport?.construction_date_band || '—');
    this.addKeyValue('Bedrooms', this.property.beds?.toString());
    this.addKeyValue('Tenure', this.property.tenure);

    this.currentY += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Occupancy & Risk:', this.margin, this.currentY);
    this.currentY += 5;
    this.doc.setFont('helvetica', 'normal');

    this.addKeyValue('HMO Status', this.property.is_hmo_licensed ? 'Licensed HMO' : 'Standard Residential');
    this.addKeyValue('Occupancy Type', this.property.lifecycle_type === 'core_rental' ? 'Tenanted' : 'Development (Vacant)');

    const hasFireAlarm = this.property.complianceItems.some(i => i.compliance_type === 'fire_alarm');
    const hasEmergencyLighting = this.property.complianceItems.some(i => i.compliance_type === 'emergency_lighting');

    this.addKeyValue('Fire Alarm System', hasFireAlarm ? 'Installed & Certified' : 'Not recorded');
    this.addKeyValue('Emergency Lighting', hasEmergencyLighting ? 'Installed & Certified' : 'Not recorded');

    this.currentY += 10;
  }

  private addComplianceDocsIndex() {
    this.addSectionTitle('Compliance Documents (Insurance Relevant)');

    const relevantTypes = ['fire_alarm', 'emergency_lighting', 'gas_safety', 'eicr', 'legionella'];
    const relevantItems = this.property.complianceItems.filter(i =>
      relevantTypes.includes(i.compliance_type)
    );

    if (relevantItems.length === 0) {
      this.addParagraph('No insurance-relevant compliance documents recorded.');
      return;
    }

    const tableData = relevantItems.map(item => {
      const status = getComplianceStatus(item);
      return [
        item.compliance_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        item.expiry_date ? format(new Date(item.expiry_date), 'dd/MM/yyyy') : 'N/A',
        item.documents?.[0]?.original_file_name || '—',
      ];
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Certificate', 'Status', 'Expiry', 'Document']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const value = (data.cell.raw as string).toLowerCase();
          if (value.includes('expired')) data.cell.styles.textColor = BRAND_DANGER;
          if (value.includes('expiring')) data.cell.styles.textColor = BRAND_WARNING;
          if (value.includes('valid')) data.cell.styles.textColor = BRAND_SUCCESS;
        }
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  private addPolicyDetails() {
    this.checkNewPage(40);
    this.addSectionTitle('Current Policy Details');

    const policy = this.property.insurancePolicy;

    if (policy) {
      this.addKeyValue('Insurer', policy.insurer_name);
      this.addKeyValue('Policy Number', policy.policy_number);
      this.addKeyValue('Renewal Date', policy.renewal_date ? format(new Date(policy.renewal_date), 'dd/MM/yyyy') : '—');
      this.addKeyValue('Annual Premium', policy.premium_gbp ? `£${policy.premium_gbp.toLocaleString()}` : '—');
    } else {
      this.addParagraph('No current insurance policy details recorded in system.');
    }
  }
}
