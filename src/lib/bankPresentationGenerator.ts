import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatGBP, formatPercent } from './calculations';
import { type PropertyWithFinancials } from '@/hooks/useProperties';
import { getPropertyMetrics } from './propertyMetrics';

export interface EnhancedPresentationOptions {
  title?: string;
  subtitle?: string;
  companyName?: string;
  preparedFor?: string;
  showPropertyDetails?: boolean;
  showFinancials?: boolean;
  showPhotos?: boolean;
  includeExecutiveSummary?: boolean;
  propertyPhotos?: Map<string, string>; // propertyId -> base64 or URL
  complianceSummary?: {
    totalItems: number;
    compliant: number;
    expiringSoon: number;
    expired: number;
  };
}

export interface PortfolioStats {
  totalValue: number;
  totalMortgage: number;
  totalEquity: number;
  averageLTV: number;
  monthlyCashflow: number;
  propertyCount: number;
  averageYield: number;
}

// Colors
const primaryColor: [number, number, number] = [20, 184, 166]; // Teal
const darkColor: [number, number, number] = [30, 41, 59]; // Slate 800
const successColor: [number, number, number] = [34, 197, 94]; // Green
const warningColor: [number, number, number] = [234, 179, 8]; // Yellow
const dangerColor: [number, number, number] = [239, 68, 68]; // Red

function addExecutiveSummaryPage(
  doc: jsPDF, 
  stats: PortfolioStats, 
  options: EnhancedPresentationOptions
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin, 20);

  let yPos = 45;

  // Portfolio narrative
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const overview = [
    `This portfolio comprises ${stats.propertyCount} properties with a combined value of ${formatGBP(stats.totalValue)}.`,
    `Net monthly cashflow is ${formatGBP(stats.monthlyCashflow)} after all costs and debt service.`,
    `Current debt: ${formatGBP(stats.totalMortgage)} (Portfolio LTV: ${formatPercent(stats.averageLTV)}).`,
    `Total equity position: ${formatGBP(stats.totalEquity)}.`,
  ];
  
  overview.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 8;
  });

  // Key Strengths
  yPos += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Strengths', margin, yPos);
  yPos += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const strengths = [
    stats.averageLTV <= 75 && '✓ Conservative leverage below 75% LTV',
    stats.monthlyCashflow > 0 && '✓ Positive monthly cashflow',
    stats.averageYield >= 5 && `✓ Strong yield at ${formatPercent(stats.averageYield)}`,
    stats.propertyCount >= 3 && '✓ Diversified property portfolio',
  ].filter(Boolean);

  if (strengths.length === 0) {
    strengths.push('✓ Active portfolio under management');
  }

  doc.setTextColor(34, 87, 74); // Dark green
  strengths.forEach(s => {
    doc.text(s as string, margin, yPos);
    yPos += 7;
  });

  // Compliance Summary (if provided)
  if (options.complianceSummary) {
    yPos += 15;
    doc.setTextColor(...darkColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compliance Status', margin, yPos);
    yPos += 12;

    const { totalItems, compliant, expiringSoon, expired } = options.complianceSummary;
    const complianceRate = totalItems > 0 ? Math.round((compliant / totalItems) * 100) : 0;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Compliance bar
    const barWidth = 120;
    const barHeight = 8;
    
    // Background
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(margin, yPos, barWidth, barHeight, 2, 2, 'F');
    
    // Progress
    if (compliant > 0) {
      const greenWidth = (compliant / totalItems) * barWidth;
      doc.setFillColor(...successColor);
      doc.roundedRect(margin, yPos, greenWidth, barHeight, 2, 2, 'F');
    }

    doc.setTextColor(...darkColor);
    doc.text(`${complianceRate}% Compliant`, margin + barWidth + 10, yPos + 6);
    
    yPos += 15;

    // Status breakdown
    const complianceItems = [
      { label: 'Valid certificates', count: compliant, color: successColor },
      { label: 'Expiring soon (60 days)', count: expiringSoon, color: warningColor },
      { label: 'Expired/Missing', count: expired, color: dangerColor },
    ];

    complianceItems.forEach(item => {
      doc.setFillColor(...item.color);
      doc.circle(margin + 3, yPos - 2, 3, 'F');
      doc.setTextColor(...darkColor);
      doc.text(`${item.label}: ${item.count}`, margin + 12, yPos);
      yPos += 8;
    });
  }

  // Prepared for section
  if (options.preparedFor) {
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(`Prepared for: ${options.preparedFor}`, margin, yPos);
  }
}

function addPhotosPage(
  doc: jsPDF, 
  properties: PropertyWithFinancials[], 
  photos: Map<string, string>
) {
  if (photos.size === 0) return;
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  doc.addPage();
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Gallery', margin, 20);

  let yPos = 45;
  const photoWidth = 80;
  const photoHeight = 55;
  let col = 0;
  let propertiesWithPhotos = 0;

  for (const property of properties) {
    if (propertiesWithPhotos >= 8) break; // Max 8 photos per page
    
    const photoUrl = photos.get(property.id);
    if (!photoUrl) continue;
    
    const xPos = margin + col * 90;
    
    // Try to add image - if it fails, draw placeholder
    try {
      // For base64 images
      if (photoUrl.startsWith('data:')) {
        doc.addImage(photoUrl, 'JPEG', xPos, yPos, photoWidth, photoHeight);
      } else {
        // For URLs, we'll draw a placeholder since jsPDF can't fetch URLs directly
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(xPos, yPos, photoWidth, photoHeight, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Photo available', xPos + photoWidth / 2 - 15, yPos + photoHeight / 2);
      }
    } catch {
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(xPos, yPos, photoWidth, photoHeight, 3, 3, 'F');
    }
    
    // Property label
    doc.setFontSize(8);
    doc.setTextColor(...darkColor);
    const label = property.address_line.length > 35 
      ? property.address_line.substring(0, 32) + '...' 
      : property.address_line;
    doc.text(label, xPos, yPos + photoHeight + 5);
    
    if (property.postcode) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(property.postcode, xPos, yPos + photoHeight + 10);
    }
    
    col++;
    propertiesWithPhotos++;
    
    if (col >= 2) {
      col = 0;
      yPos += photoHeight + 25;
      
      // Check if we need a new page
      if (yPos + photoHeight > pageHeight - 30) {
        break;
      }
    }
  }
}

export async function generateBankPresentation(
  properties: PropertyWithFinancials[],
  stats: PortfolioStats,
  options: EnhancedPresentationOptions = {}
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  const {
    title = 'Portfolio Overview',
    subtitle = 'Confidential Bank Presentation',
    preparedFor,
    showPropertyDetails = true,
    showFinancials = true,
    showPhotos = false,
    includeExecutiveSummary = true,
    propertyPhotos = new Map(),
    complianceSummary,
  } = options;

  // ==========================================
  // COVER PAGE
  // ==========================================
  
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 35);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, margin, 48);

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy')}`, pageWidth - margin - 50, 48);

  // Prepared for (on cover)
  if (preparedFor) {
    doc.setFontSize(12);
    doc.text(`Prepared for: ${preparedFor}`, margin, 55);
  }

  // Portfolio Summary Box
  const boxY = 80;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, boxY, pageWidth - 2 * margin, 80, 3, 3, 'F');
  
  doc.setTextColor(...darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Portfolio Snapshot', margin + 10, boxY + 15);
  
  // Stats grid
  const statY = boxY + 30;
  const colWidth = (pageWidth - 2 * margin - 20) / 3;
  
  const summaryStats = [
    { label: 'Portfolio Value', value: formatGBP(stats.totalValue) },
    { label: 'Total Equity', value: formatGBP(stats.totalEquity) },
    { label: 'Average LTV', value: formatPercent(stats.averageLTV) },
    { label: 'Properties', value: stats.propertyCount.toString() },
    { label: 'Monthly Cashflow', value: formatGBP(stats.monthlyCashflow) },
    { label: 'Average Yield', value: formatPercent(stats.averageYield) },
  ];

  summaryStats.forEach((stat, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + 10 + col * colWidth;
    const y = statY + row * 25;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label, x, y);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text(stat.value, x, y + 8);
  });

  // Table of Contents
  let tocY = boxY + 100;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Contents', margin, tocY);
  tocY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let pageNum = 2;
  
  const tocItems: string[] = [];
  if (includeExecutiveSummary) tocItems.push('Executive Summary');
  if (showPhotos && propertyPhotos.size > 0) tocItems.push('Property Gallery');
  if (showPropertyDetails) tocItems.push('Property Portfolio');
  if (showFinancials) tocItems.push('Financial Analysis');

  tocItems.forEach((item) => {
    doc.text(`${item}`, margin + 5, tocY);
    doc.text(`${pageNum}`, pageWidth - margin - 10, tocY);
    tocY += 7;
    pageNum++;
  });

  // ==========================================
  // EXECUTIVE SUMMARY PAGE (if enabled)
  // ==========================================
  if (includeExecutiveSummary) {
    addExecutiveSummaryPage(doc, stats, { ...options, complianceSummary });
  }

  // ==========================================
  // PROPERTY PHOTOS PAGE (if enabled)
  // ==========================================
  if (showPhotos && propertyPhotos.size > 0) {
    addPhotosPage(doc, properties, propertyPhotos);
  }

  // ==========================================
  // PROPERTY TABLE PAGE
  // ==========================================
  
  if (showPropertyDetails && properties.length > 0) {
    doc.addPage();
    
    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Property Portfolio', margin, 17);

    // Table
    const tableData = properties.map(property => {
      const metrics = getPropertyMetrics(property);
      return [
        property.address_line,
        property.postcode || '—',
        property.beds?.toString() || '—',
        formatGBP(metrics.currentValue),
        formatGBP(metrics.mortgageBalance),
        formatPercent(metrics.ltv),
        formatGBP(metrics.equity),
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Address', 'Postcode', 'Beds', 'Value', 'Mortgage', 'LTV', 'Equity']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    // Portfolio totals row
    const totalRow = [
      'PORTFOLIO TOTAL',
      '',
      properties.reduce((sum, p) => sum + (p.beds || 0), 0).toString(),
      formatGBP(stats.totalValue),
      formatGBP(stats.totalMortgage),
      formatPercent(stats.averageLTV),
      formatGBP(stats.totalEquity),
    ];

    const finalY = (doc as any).lastAutoTable?.finalY || 35;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin - 2, finalY + 2, pageWidth - 2 * margin + 4, 12, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    
    let xOffset = margin;
    totalRow.forEach((val, idx) => {
      const widths = [50, 25, 15, 25, 25, 20, 25];
      doc.text(val, xOffset + 2, finalY + 9);
      xOffset += widths[idx] || 20;
    });
  }

  // ==========================================
  // FINANCIAL SUMMARY PAGE
  // ==========================================
  
  if (showFinancials) {
    doc.addPage();
    
    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Analysis', margin, 17);

    let currentY = 40;

    // Key Metrics
    doc.setTextColor(...darkColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Financial Metrics', margin, currentY);
    
    currentY += 12;
    
    const financialMetrics = [
      { label: 'Total Portfolio Value', value: formatGBP(stats.totalValue) },
      { label: 'Total Mortgage Debt', value: formatGBP(stats.totalMortgage) },
      { label: 'Total Equity Position', value: formatGBP(stats.totalEquity) },
      { label: 'Portfolio LTV', value: formatPercent(stats.averageLTV) },
      { label: 'Monthly Net Cashflow', value: formatGBP(stats.monthlyCashflow) },
      { label: 'Annual Net Cashflow', value: formatGBP(stats.monthlyCashflow * 12) },
      { label: 'Gross Rental Yield', value: formatPercent(stats.averageYield) },
    ];

    financialMetrics.forEach((metric, idx) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(metric.label, margin, currentY + idx * 12);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text(metric.value, margin + 80, currentY + idx * 12);
    });

    // Debt service coverage
    currentY += financialMetrics.length * 12 + 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Debt Service Analysis', margin, currentY);
    
    currentY += 12;
    
    const annualRent = stats.monthlyCashflow * 12 + stats.totalMortgage * 0.05; // Approximate gross
    const dscr = stats.totalMortgage > 0 
      ? (annualRent / (stats.totalMortgage * 0.05)).toFixed(2) 
      : 'N/A';

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Estimated DSCR', margin, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text(dscr === 'N/A' ? dscr : `${dscr}x`, margin + 80, currentY);

    // Footer disclaimer
    currentY = pageHeight - 35;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('This document is confidential and intended for the recipient only.', margin, currentY);
    doc.text('All figures are indicative and subject to verification.', margin, currentY + 5);
    doc.text(`Report generated by HydrogenCap on ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin, currentY + 10);
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
  }

  // Generate blob
  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
