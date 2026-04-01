// Export generation utilities for Accounting Export module (Phase 2.7)

import { format, parse } from 'date-fns';
import type { FinancialSnapshot } from '@/lib/financialSnapshotTypes';
import type {
  AccountingMapping,
  AccountingSystem,
  TransactionLine,
  HydrogencapCategory,
  TaxYearSummary,
  EXPENSE_CATEGORIES,
} from '@/lib/accountingTypes';
import { CATEGORY_LABELS } from '@/lib/accountingTypes';

// ── Transaction line generation ──

interface PropertyInfo {
  id: string;
  address: string;
}

interface EntityInfo {
  id: string;
  name: string;
  entity_type: string;
}

const EXPENSE_FIELDS: { field: keyof FinancialSnapshot; category: HydrogencapCategory; label: string }[] = [
  { field: 'management_fees', category: 'management_fees', label: 'Management fees' },
  { field: 'maintenance_costs', category: 'maintenance_costs', label: 'Repairs & maintenance' },
  { field: 'insurance_costs', category: 'insurance_costs', label: 'Insurance' },
  { field: 'mortgage_payments', category: 'mortgage_payments', label: 'Mortgage interest' },
  { field: 'utilities', category: 'utilities', label: 'Utilities' },
  { field: 'council_tax', category: 'council_tax', label: 'Council tax' },
  { field: 'licensing_costs', category: 'licensing_costs', label: 'Licensing' },
  { field: 'professional_fees', category: 'professional_fees', label: 'Professional fees' },
  { field: 'other_costs', category: 'other_costs', label: 'Other expenses' },
];

function formatMonthLabel(snapshotMonth: string): string {
  try {
    const d = parse(snapshotMonth, 'yyyy-MM-dd', new Date());
    return format(d, 'MMMM yyyy');
  } catch (err) {
    console.error('Failed to format month label:', err);
    return snapshotMonth;
  }
}

function formatRef(snapshotMonth: string): string {
  return snapshotMonth.replace(/-/g, '').slice(0, 6);
}

function formatDateForSystem(dateStr: string, system: AccountingSystem): string {
  try {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (system === 'xero') return format(d, 'dd/MM/yyyy');
    if (system === 'quickbooks') return format(d, 'MM/dd/yyyy');
    return format(d, 'yyyy-MM-dd');
  } catch (err) {
    console.error('Failed to format date for accounting system:', err);
    return dateStr;
  }
}

export function generateTransactionLines(
  snapshot: FinancialSnapshot,
  property: PropertyInfo,
  entity: EntityInfo,
  mappings: AccountingMapping[],
  system: AccountingSystem,
): TransactionLine[] {
  const lines: TransactionLine[] = [];
  const monthLabel = formatMonthLabel(snapshot.snapshot_month);
  const propRef = property.address;

  const getMapping = (cat: HydrogencapCategory) =>
    mappings.find(m => m.hydrogencap_category === cat && m.accounting_system === system);

  // Income lines
  if ((snapshot.gross_rent_received ?? 0) > 0) {
    const m = getMapping('gross_rent_received');
    lines.push({
      date: snapshot.snapshot_month,
      amount: snapshot.gross_rent_received,
      category: 'gross_rent_received',
      accountCode: m?.account_code,
      accountName: m?.account_name,
      taxRateCode: m?.tax_rate_code ?? undefined,
      description: `Rental income - ${propRef} - ${monthLabel}`,
      reference: `RNT-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0, 4)}`,
      entityName: entity.name,
      propertyAddress: propRef,
    });
  }

  if ((snapshot.other_income ?? 0) > 0) {
    const m = getMapping('other_income');
    lines.push({
      date: snapshot.snapshot_month,
      amount: snapshot.other_income,
      category: 'other_income',
      accountCode: m?.account_code,
      accountName: m?.account_name,
      taxRateCode: m?.tax_rate_code ?? undefined,
      description: `Other income - ${propRef} - ${monthLabel}`,
      reference: `OTH-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0, 4)}`,
      entityName: entity.name,
      propertyAddress: propRef,
    });
  }

  // Expense lines
  for (const ef of EXPENSE_FIELDS) {
    const value = (snapshot[ef.field] as number) ?? 0;
    if (value > 0) {
      const m = getMapping(ef.category);
      lines.push({
        date: snapshot.snapshot_month,
        amount: system === 'xero' ? -value : value,
        category: ef.category,
        accountCode: m?.account_code,
        accountName: m?.account_name,
        taxRateCode: m?.tax_rate_code ?? undefined,
        description: `${ef.label} - ${propRef} - ${monthLabel}`,
        reference: `EXP-${formatRef(snapshot.snapshot_month)}-${property.id.slice(0, 4)}`,
        isExpense: true,
        entityName: entity.name,
        propertyAddress: propRef,
      });
    }
  }

  return lines;
}

// ── CSV formatters ──

export function transactionsToXeroCsv(lines: TransactionLine[]): string {
  const header = '*Date,*Amount,*AccountCode,Description,Reference,TaxType';
  const rows = lines.map(l => {
    const date = formatDateForSystem(l.date, 'xero');
    return `${date},${l.amount.toFixed(2)},${l.accountCode ?? ''},${escCsv(l.description)},${escCsv(l.reference)},${l.taxRateCode ?? 'NONE'}`;
  });
  return [header, ...rows].join('\n');
}

export function transactionsToQuickbooksCsv(lines: TransactionLine[]): string {
  const header = 'Date,Description,Amount,Account,Name,Class';
  const rows = lines.map(l => {
    const date = formatDateForSystem(l.date, 'quickbooks');
    const amount = l.isExpense ? -Math.abs(l.amount) : Math.abs(l.amount);
    return `${date},${escCsv(l.description)},${amount.toFixed(2)},${escCsv(l.accountName ?? '')},${escCsv(l.entityName ?? '')},${''}`;
  });
  return [header, ...rows].join('\n');
}

export function transactionsToGenericCsv(lines: TransactionLine[]): string {
  const header = 'Date,Entity,Property,Category,Description,Income,Expense,Net,Reference,VAT';
  const rows = lines.map(l => {
    const date = formatDateForSystem(l.date, 'generic');
    const income = l.isExpense ? '' : Math.abs(l.amount).toFixed(2);
    const expense = l.isExpense ? Math.abs(l.amount).toFixed(2) : '';
    const net = (l.isExpense ? -Math.abs(l.amount) : Math.abs(l.amount)).toFixed(2);
    return `${date},${escCsv(l.entityName ?? '')},${escCsv(l.propertyAddress ?? '')},${escCsv(CATEGORY_LABELS[l.category] ?? l.category)},${escCsv(l.description)},${income},${expense},${net},${escCsv(l.reference)},${l.taxRateCode ?? 'N/A'}`;
  });
  return [header, ...rows].join('\n');
}

export function transactionsToQif(lines: TransactionLine[]): string {
  const qifLines = ['!Type:Bank'];
  for (const l of lines) {
    const date = formatDateForSystem(l.date, 'xero'); // DD/MM/YYYY
    const amount = l.isExpense ? -Math.abs(l.amount) : Math.abs(l.amount);
    qifLines.push(`D${date}`);
    qifLines.push(`T${amount.toFixed(2)}`);
    qifLines.push(`P${l.description}`);
    qifLines.push(`N${l.reference}`);
    qifLines.push('^');
  }
  return qifLines.join('\n');
}

// ── Tax summary formatters ──

export function taxSummaryToSA105(summary: TaxYearSummary, entityName: string): string {
  const n = (v: number | null) => `£${(v ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalIncome = (summary.total_rental_income ?? 0) + (summary.total_other_income ?? 0);
  const rentRatesInsurance = (summary.total_insurance ?? 0) + (summary.total_council_tax ?? 0);
  const repairs = summary.total_repairs_maintenance ?? 0;
  const finCosts = summary.total_mortgage_interest ?? 0;
  const legalMgmt = (summary.total_management_fees ?? 0) + (summary.total_professional_fees ?? 0);
  const services = summary.total_utilities ?? 0;
  const other = (summary.total_licensing ?? 0) + (summary.total_other_expenses ?? 0);
  const profit = summary.net_rental_profit ?? 0;

  return [
    `HMRC Self-Assessment Property Income (SA105)`,
    `Entity: ${entityName}`,
    `Tax Year: ${summary.tax_year} (${summary.tax_year_start} - ${summary.tax_year_end})`,
    ``,
    `Box 20: Total rents and other income from property: ${n(totalIncome)}`,
    `Box 21: Tax taken off any income in box 20: £0.00`,
    `Box 24: Rent, rates, insurance, ground rents: ${n(rentRatesInsurance)}`,
    `Box 25: Property repairs, maintenance and renewals: ${n(repairs)}`,
    `Box 26: Loan interest and other financial costs: ${n(finCosts)}`,
    `Box 27: Legal, management and other professional fees: ${n(legalMgmt)}`,
    `Box 28: Cost of services provided, including wages: ${n(services)}`,
    `Box 29: Other allowable property expenses: ${n(other)}`,
    `Box 30: Private use adjustment: £0.00`,
    `Box 37: Taxable profit or loss: ${n(profit)}`,
    `Box 38: Unused losses brought forward: £0.00`,
    `Box 39: Tax adjustments: £0.00`,
    `Box 40: Adjusted profit for tax purposes: ${n(profit)}`,
    `Box 44: Residential finance costs (Section 24): ${n(finCosts)}`,
    ``,
    `Basic Rate Tax Reduction (20% of finance costs): ${n(summary.basic_rate_tax_reduction)}`,
  ].join('\n');
}

// ── Helpers ──

function escCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function formatCsvForSystem(
  lines: TransactionLine[],
  system: AccountingSystem,
): string {
  switch (system) {
    case 'xero':
      return transactionsToXeroCsv(lines);
    case 'quickbooks':
      return transactionsToQuickbooksCsv(lines);
    default:
      return transactionsToGenericCsv(lines);
  }
}

export function downloadFile(content: string, fileName: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function computeExportTotals(lines: TransactionLine[]) {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const l of lines) {
    if (l.isExpense) {
      totalExpenses += Math.abs(l.amount);
    } else {
      totalIncome += Math.abs(l.amount);
    }
  }
  return { totalIncome, totalExpenses, net: totalIncome - totalExpenses, rowCount: lines.length };
}
