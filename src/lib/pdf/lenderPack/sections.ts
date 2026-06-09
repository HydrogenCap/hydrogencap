import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { BRAND_PRIMARY, BRAND_SECONDARY, BRAND_SUCCESS, BRAND_WARNING, BRAND_DANGER } from '../colors';
import { getComplianceStatus } from '../status';
import type { LenderPackContext } from './context';

// ── Cover page ────────────────────────────────────────────────────────────
export function buildCoverPage(ctx: LenderPackContext) {
  ctx.doc.setFillColor(26, 58, 118);
  ctx.doc.rect(0, 0, ctx.pageWidth, 100, 'F');

  const logoX = ctx.margin;
  const logoY = 20;
  const logoSize = 18;
  ctx.doc.setFillColor(255, 255, 255);
  ctx.doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
  ctx.doc.setTextColor(26, 58, 118);
  ctx.doc.setFontSize(12);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('T', logoX + logoSize / 2, logoY + logoSize / 2 + 2, { align: 'center' });

  ctx.doc.setTextColor(255, 255, 255);
  ctx.doc.setFontSize(11);
  ctx.doc.text('TENURE IQ', logoX + logoSize + 8, logoY + logoSize / 2 + 2);

  ctx.doc.setFontSize(28);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text('Mortgage Broker Pack', ctx.margin, 55);

  ctx.doc.setFontSize(14);
  ctx.doc.setFont('helvetica', 'normal');
  const address = ctx.data.property.address_line;
  const truncatedAddress = address.length > 50 ? address.substring(0, 47) + '...' : address;
  ctx.doc.text(truncatedAddress, ctx.margin, 70);

  const assetType = ctx.getAssetTypeLabel();
  ctx.doc.setFontSize(12);
  ctx.doc.text(assetType, ctx.margin, 85);

  ctx.currentY = 120;
  ctx.doc.setTextColor(0, 0, 0);

  addCoverDetailRow(ctx, 'Property Address', `${address}${ctx.data.property.postcode ? ', ' + ctx.data.property.postcode : ''}`);
  addCoverDetailRow(ctx, 'Asset Type', assetType);
  addCoverDetailRow(ctx, 'Borrowing Entity', ctx.data.company?.legal_name || '—');
  addCoverDetailRow(ctx, 'Prepared For', ctx.data.preparedFor || 'Mortgage Broker / Lender');
  addCoverDetailRow(ctx, 'Date Generated', format(new Date(), 'dd MMMM yyyy'));

  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(107, 114, 128);
  ctx.doc.text('CONFIDENTIAL — For Addressee Only', ctx.margin, ctx.pageHeight - 20);
  ctx.doc.text('Tenure IQ', ctx.pageWidth - ctx.margin, ctx.pageHeight - 20, { align: 'right' });
}

function addCoverDetailRow(ctx: LenderPackContext, label: string, value: string) {
  ctx.doc.setFontSize(10);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setTextColor(107, 114, 128);
  ctx.doc.text(label, ctx.margin, ctx.currentY);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(0, 0, 0);
  ctx.doc.text(value || '—', ctx.margin, ctx.currentY + 6);
  ctx.currentY += 18;
}

// ── Executive deal summary ────────────────────────────────────────────────
export function buildExecutiveSummary(ctx: LenderPackContext) {
  ctx.addPageHeader('Executive Deal Summary');
  ctx.addSectionTitle('Deal Overview');

  const loan = ctx.data.property.loans?.[0];
  const currentValue = ctx.data.property.current_value_gbp;
  const currentBalance = loan?.current_mortgage_balance_gbp;
  const targetLoan = ctx.data.targetLoanAmount || currentBalance;
  const netCapitalReleased = (targetLoan && currentBalance) ? targetLoan - currentBalance : null;

  const loanPurposeLabel = {
    refinance: 'Refinance',
    capital_raise: 'Capital Raise',
    rate_switch: 'Rate Switch',
    purchase: 'Purchase',
    '': '—'
  }[ctx.data.loanPurpose];

  const dealData = [
    ['Loan Purpose', loanPurposeLabel],
    ['Target Loan Amount', ctx.formatGBP(targetLoan)],
    ['Target LTV', ctx.data.targetLTV ? `${ctx.data.targetLTV}%` : ctx.calculateLTV()],
    ['Estimated Property Value', ctx.formatGBP(currentValue)],
    ['Existing Mortgage Balance', ctx.formatGBP(currentBalance)],
    ['Net Capital Released', netCapitalReleased && netCapitalReleased > 0 ? ctx.formatGBP(netCapitalReleased) : 'N/A'],
  ];

  autoTable(ctx.doc, {
    startY: ctx.currentY,
    body: dealData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: BRAND_SECONDARY },
      1: { cellWidth: 80 },
    },
  });
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 15;

  ctx.addSectionTitle('Key Strengths');
  const strengths = generateKeyStrengths(ctx);
  strengths.forEach(strength => {
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(34, 197, 94);
    ctx.doc.text('✓', ctx.margin, ctx.currentY);
    ctx.doc.setTextColor(0, 0, 0);
    ctx.doc.text(strength, ctx.margin + 8, ctx.currentY);
    ctx.currentY += 6;
  });
}

function generateKeyStrengths(ctx: LenderPackContext): string[] {
  const strengths: string[] = [];
  const prop = ctx.data.property;
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

  if (ctx.data.portfolioSummary.totalProperties > 1) {
    strengths.push(`Experienced landlord with ${ctx.data.portfolioSummary.totalProperties}-property portfolio`);
  }

  strengths.push('Long-term hold strategy with professional management');
  return strengths.slice(0, 5);
}

// ── Property summary ──────────────────────────────────────────────────────
export function buildPropertySummary(ctx: LenderPackContext) {
  ctx.addPageHeader('Property Summary');

  const prop = ctx.data.property;
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

  autoTable(ctx.doc, {
    startY: ctx.currentY,
    body: propertyData,
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
      1: { cellWidth: 100 },
    },
  });
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 15;
}

// ── Valuation & finance snapshot ──────────────────────────────────────────
export function buildValuationFinanceSnapshot(ctx: LenderPackContext) {
  ctx.checkNewPage(80);
  ctx.addSectionTitle('Valuation & Finance Snapshot');

  const prop = ctx.data.property;
  const loan = prop.loans?.[0];

  const financeData = [
    ['Purchase Price', ctx.formatGBP(prop.purchase_price_gbp)],
    ['Purchase Date', prop.original_purchase_date ? format(new Date(prop.original_purchase_date), 'dd/MM/yyyy') : '—'],
    ['Current Estimated Value', ctx.formatGBP(prop.current_value_gbp)],
    ['Valuation Source', 'Owner Estimate'],
    ['Valuation Date', format(new Date(), 'dd/MM/yyyy')],
  ];

  autoTable(ctx.doc, {
    startY: ctx.currentY,
    body: financeData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
      1: { cellWidth: 80 },
    },
  });
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;

  if (loan) {
    ctx.doc.setFontSize(11);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setTextColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
    ctx.doc.text('Current Mortgage', ctx.margin, ctx.currentY);
    ctx.currentY += 6;
    ctx.doc.setTextColor(0, 0, 0);

    const mortgageData = [
      ['Current Lender', loan.lender || '—'],
      ['Current Mortgage Balance', ctx.formatGBP(loan.current_mortgage_balance_gbp)],
      ['Interest Rate', loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—'],
      ['Repayment Type', loan.capital_or_interest === 'interest' ? 'Interest Only' : 'Capital & Interest'],
      ['Fixed Rate Expiry', loan.fixed_rate_expires ? format(new Date(loan.fixed_rate_expires), 'dd/MM/yyyy') : '—'],
      ['Current LTV', ctx.calculateLTV()],
    ];

    autoTable(ctx.doc, {
      startY: ctx.currentY,
      body: mortgageData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
  } else {
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
    ctx.doc.text('Property is currently unencumbered / cash purchase.', ctx.margin, ctx.currentY);
    ctx.currentY += 10;
  }
}

// ── Rental income & affordability ─────────────────────────────────────────
export function buildRentalIncomeAffordability(ctx: LenderPackContext) {
  ctx.addPageHeader('Rental Income & Affordability');

  const prop = ctx.data.property;
  const currentYear = new Date().getFullYear();
  const income = prop.income?.find(i => i.year === currentYear);

  ctx.addSectionTitle('Rental Strategy');
  const strategy = prop.is_hmo_licensed ? 'HMO – Per Room Let' : 'Single Let (AST)';
  ctx.doc.setFontSize(10);
  ctx.doc.text(strategy, ctx.margin, ctx.currentY);
  ctx.currentY += 10;

  ctx.addSectionTitle('Rental Schedule');

  if (income && income.annual_rent_gbp > 0) {
    const annualRent = income.annual_rent_gbp;
    const monthlyRent = annualRent / 12;
    const beds = prop.beds || 1;
    const rentPerRoom = monthlyRent / beds;

    if (prop.is_hmo_licensed && beds > 1) {
      const roomData: string[][] = [];
      for (let i = 1; i <= beds; i++) {
        roomData.push([`Room ${i}`, ctx.formatGBP(rentPerRoom, true)]);
      }
      roomData.push(['', '']);
      roomData.push(['Total Monthly Rent', ctx.formatGBP(monthlyRent, true)]);
      roomData.push(['Total Annual Rent', ctx.formatGBP(annualRent, true)]);

      autoTable(ctx.doc, {
        startY: ctx.currentY,
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
        ['Monthly Rent', ctx.formatGBP(monthlyRent, true)],
        ['Annual Rent', ctx.formatGBP(annualRent, true)],
      ];

      autoTable(ctx.doc, {
        startY: ctx.currentY,
        body: rentData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55 },
          1: { cellWidth: 60, halign: 'right' },
        },
      });
    }

    ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;

    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(BRAND_SECONDARY[0], BRAND_SECONDARY[1], BRAND_SECONDARY[2]);
    ctx.doc.text('Bills: ' + (prop.is_hmo_licensed ? 'Included in room rents' : 'Tenant responsibility'), ctx.margin, ctx.currentY);
    ctx.currentY += 5;
    ctx.doc.text('Rental income supported by ASTs / licences and bank statements.', ctx.margin, ctx.currentY);
    ctx.currentY += 10;
  } else {
    ctx.doc.setFontSize(10);
    ctx.doc.text('No rental income recorded for current year.', ctx.margin, ctx.currentY);
    ctx.currentY += 10;
  }
}

// ── HMO compliance & licensing ────────────────────────────────────────────
export function buildHmoComplianceLicensing(ctx: LenderPackContext) {
  ctx.checkNewPage(60);
  ctx.addSectionTitle('HMO Compliance & Licensing');

  const prop = ctx.data.property;
  const hmoItem = prop.complianceItems.find(i =>
    i.compliance_type.toLowerCase().includes('hmo') || i.compliance_type.toLowerCase().includes('licence')
  );

  const hmoData = [
    ['HMO Licence Status', prop.is_hmo_licensed ? 'Active' : (hmoItem ? 'Recorded' : 'Exempt / Not Required')],
    ['Licence Number', hmoItem?.documents?.[0]?.original_file_name?.match(/\d+/)?.[0] || '—'],
    ['Expiry Date', hmoItem?.expiry_date ? format(new Date(hmoItem.expiry_date), 'dd/MM/yyyy') : '—'],
    ['Permitted Occupancy', prop.beds ? `Up to ${prop.beds} persons` : '—'],
    ['Fire Safety Compliance', ctx.hasValidCert('fire_alarm') ? 'Confirmed' : 'Pending verification'],
    ['Local Authority', prop.passport?.local_authority_text || prop.area_name || '—'],
  ];

  autoTable(ctx.doc, {
    startY: ctx.currentY,
    body: hmoData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
      1: { cellWidth: 80 },
    },
  });
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
}

// ── Borrower / entity profile ─────────────────────────────────────────────
export function buildBorrowerEntityProfile(ctx: LenderPackContext) {
  ctx.addPageHeader('Borrower / Entity Profile');

  const company = ctx.data.company;

  if (company) {
    const entityData = [
      ['Borrowing Entity Name', company.legal_name],
      ['Company Number', company.company_number || '—'],
      ['Entity Type', ctx.formatCompanyType(company.company_type)],
      ['Registered Address', company.ch_registered_address || '—'],
      ['Incorporation Date', company.ch_incorporation_date ? format(new Date(company.ch_incorporation_date), 'dd/MM/yyyy') : '—'],
      ['Confirmation', 'Property-owning SPV / Non-trading'],
    ];

    autoTable(ctx.doc, {
      startY: ctx.currentY,
      body: entityData,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 100 },
      },
    });
    ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;

    if (company.shareholders && company.shareholders.length > 0) {
      ctx.addSectionTitle('Shareholders');

      const shareholderData = company.shareholders.map(sh => [
        sh.name,
        sh.party_type === 'COMPANY' ? 'Company' : 'Individual',
        `${sh.percent.toFixed(1)}%`
      ]);

      autoTable(ctx.doc, {
        startY: ctx.currentY,
        head: [['Shareholder', 'Type', 'Holding']],
        body: shareholderData,
        theme: 'striped',
        headStyles: { fillColor: BRAND_PRIMARY, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
      });
      ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
    }

    if (company.directors && company.directors.length > 0) {
      ctx.addSectionTitle('Directors');
      company.directors.forEach(dir => {
        ctx.doc.setFontSize(10);
        ctx.doc.text(`• ${dir}`, ctx.margin + 5, ctx.currentY);
        ctx.currentY += 5;
      });
      ctx.currentY += 5;
    }
  } else {
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(BRAND_DANGER[0], BRAND_DANGER[1], BRAND_DANGER[2]);
    ctx.doc.text('No borrowing entity linked to this property.', ctx.margin, ctx.currentY);
    ctx.currentY += 10;
  }
}

// ── Borrower track record ─────────────────────────────────────────────────
export function buildBorrowerTrackRecord(ctx: LenderPackContext) {
  ctx.checkNewPage(60);
  ctx.addSectionTitle('Borrower Track Record (Portfolio Summary)');

  const summary = ctx.data.portfolioSummary;

  const trackData = [
    ['Total Properties Owned', summary.totalProperties.toString()],
    ['Total Bedrooms', summary.totalBedrooms.toString()],
    ['Total Portfolio Value', ctx.formatGBP(summary.totalValue)],
    ['Average Portfolio LTV', summary.averageLTV ? `${summary.averageLTV.toFixed(1)}%` : '—'],
    ['HMO Experience', `${summary.hmoExperienceYears}+ years`],
    ['Mortgage Arrears / Defaults', summary.hasArrears ? 'Yes – see notes' : 'None'],
  ];

  autoTable(ctx.doc, {
    startY: ctx.currentY,
    body: trackData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: BRAND_SECONDARY },
      1: { cellWidth: 80 },
    },
  });
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
}

// ── Insurance summary ─────────────────────────────────────────────────────
export function buildInsuranceSummary(ctx: LenderPackContext) {
  ctx.addPageHeader('Insurance Summary');

  const policy = ctx.data.property.insurancePolicy;

  if (policy) {
    const insuranceData = [
      ['Buildings Insurance', ctx.data.property.is_hmo_licensed ? 'HMO-specific cover' : 'Standard landlord cover'],
      ['Insurer Name', policy.insurer_name || '—'],
      ['Policy Number', policy.policy_number || '—'],
      ['Sum Insured', '—'],
      ['Policy Expiry Date', policy.renewal_date ? format(new Date(policy.renewal_date), 'dd/MM/yyyy') : '—'],
      ['Annual Premium', policy.premium_gbp ? ctx.formatGBP(policy.premium_gbp) : '—'],
      ['Public Liability', 'Standard cover included'],
    ];

    autoTable(ctx.doc, {
      startY: ctx.currentY,
      body: insuranceData,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: BRAND_SECONDARY },
        1: { cellWidth: 100 },
      },
    });
  } else {
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(BRAND_WARNING[0], BRAND_WARNING[1], BRAND_WARNING[2]);
    ctx.doc.text('No insurance policy details currently recorded in system.', ctx.margin, ctx.currentY);
  }
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 15;
}

// ── Exit strategy & risk note ─────────────────────────────────────────────
export function buildExitStrategyRiskNote(ctx: LenderPackContext) {
  ctx.checkNewPage(50);
  ctx.addSectionTitle('Exit Strategy & Risk Note');

  const area = ctx.data.property.passport?.local_authority_text || ctx.data.property.area_name || 'the local area';

  const exitText = [
    `Exit Strategy: Long-term hold with periodic refinance for capital release.`,
    `Secondary Exit: Open market sale. Comparable sales data supports current valuation.`,
    `Vacancy Risk: Mitigated by strong local rental demand in ${area}.`,
    '',
    `${area} benefits from a diverse tenant base, with demand supported by employment, ` +
    `transport links, and local amenities. The property's configuration and condition ` +
    `position it well for sustained occupancy.`,
  ];

  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0, 0, 0);
  exitText.forEach(line => {
    if (line) {
      const lines = ctx.doc.splitTextToSize(line, ctx.pageWidth - (ctx.margin * 2));
      ctx.doc.text(lines, ctx.margin, ctx.currentY);
      ctx.currentY += lines.length * 5;
    } else {
      ctx.currentY += 3;
    }
  });
  ctx.currentY += 10;
}

// ── Document checklist ────────────────────────────────────────────────────
export function buildDocumentChecklist(ctx: LenderPackContext) {
  ctx.addPageHeader('Document Checklist');

  const prop = ctx.data.property;

  const checklistItems = [
    { doc: 'EPC Certificate', type: 'epc', required: true },
    { doc: 'EICR (Electrical Safety)', type: 'eicr', required: true },
    { doc: 'Gas Safety Certificate', type: 'gas_safety', required: true },
    { doc: 'HMO Licence', type: 'hmo_licence', required: prop.is_hmo_licensed },
    { doc: 'ASTs / Rental Agreements', type: null, required: true },
    { doc: 'Buildings Insurance Schedule', type: null, isInsurance: true },
    { doc: 'Title Register', type: null, required: true },
    { doc: 'Company Accounts / SPV Confirmation', type: null, required: !!ctx.data.company },
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

  autoTable(ctx.doc, {
    startY: ctx.currentY,
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
  ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
}

// ── Broker notes ──────────────────────────────────────────────────────────
export function buildBrokerNotes(ctx: LenderPackContext) {
  ctx.checkNewPage(40);
  ctx.addSectionTitle('Additional Notes');

  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(0, 0, 0);
  const lines = ctx.doc.splitTextToSize(ctx.data.brokerNotes, ctx.pageWidth - (ctx.margin * 2));
  ctx.doc.text(lines, ctx.margin, ctx.currentY);
  ctx.currentY += lines.length * 5 + 10;
}
