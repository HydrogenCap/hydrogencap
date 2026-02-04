import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatGBP, formatPercent } from './calculations';
import { type PropertyWithFinancials } from '@/hooks/useProperties';
import { getPropertyMetrics } from './propertyMetrics';

interface PresentationOptions {
  title?: string;
  subtitle?: string;
  showPropertyDetails?: boolean;
  showFinancials?: boolean;
  showCompliance?: boolean;
}

interface PortfolioStats {
  totalValue: number;
  totalMortgage: number;
  totalEquity: number;
  averageLTV: number;
  monthlyCashflow: number;
  propertyCount: number;
  averageYield: number;
}

export async function generateBankPresentation(
  properties: PropertyWithFinancials[],
  stats: PortfolioStats,
  options: PresentationOptions = {}
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  const {
    title = 'Portfolio Overview',
    subtitle = 'Confidential Bank Presentation',
    showPropertyDetails = true,
    showFinancials = true,
  } = options;

  // Colors
  const primaryColor: [number, number, number] = [20, 184, 166]; // Teal
  const darkColor: [number, number, number] = [30, 41, 59]; // Slate 800

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

  // Portfolio Summary Box
  const boxY = 80;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, boxY, pageWidth - 2 * margin, 80, 3, 3, 'F');
  
  doc.setTextColor(...darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin + 10, boxY + 15);
  
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
    
    currentY += 10;
    
    const financialMetrics = [
      { label: 'Total Portfolio Value', value: formatGBP(stats.totalValue) },
      { label: 'Total Mortgage Debt', value: formatGBP(stats.totalMortgage) },
      { label: 'Total Equity Position', value: formatGBP(stats.totalEquity) },
      { label: 'Portfolio LTV', value: formatPercent(stats.averageLTV) },
      { label: 'Monthly Net Cashflow', value: formatGBP(stats.monthlyCashflow) },
      { label: 'Annual Net Cashflow', value: formatGBP(stats.monthlyCashflow * 12) },
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

    // Footer disclaimer
    currentY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('This document is confidential and intended for the recipient only.', margin, currentY);
    doc.text('All figures are indicative and subject to verification.', margin, currentY + 5);
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
