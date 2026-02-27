/**
 * Bank CSV parser with UK bank presets.
 */

export interface BankFormatPreset {
  name: string;
  columns: {
    date: string;
    description: string;
    reference?: string;
    amount?: string;
    credit?: string;
    debit?: string;
    balance?: string;
  };
  dateFormat: string;
}

export const BANK_PRESETS: BankFormatPreset[] = [
  {
    name: 'Barclays',
    columns: { date: 'Date', description: 'Memo', reference: 'Number', amount: 'Amount', balance: undefined as unknown as string },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Lloyds / Halifax',
    columns: { date: 'Transaction Date', description: 'Transaction Description', credit: 'Credit Amount', debit: 'Debit Amount', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'NatWest / RBS',
    columns: { date: 'Date', description: 'Description', amount: 'Value', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Monzo',
    columns: { date: 'Date', description: 'Name', reference: 'Description', amount: 'Amount', balance: undefined as unknown as string },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Starling',
    columns: { date: 'Date', description: 'Counter Party', reference: 'Reference', amount: 'Amount (GBP)', balance: 'Balance (GBP)' },
    dateFormat: 'DD/MM/YYYY',
  },
];

export interface CSVColumnMapping {
  date: string | null;
  description: string | null;
  reference: string | null;
  amount: string | null;
  credit: string | null;
  debit: string | null;
  balance: string | null;
}

export interface ParsedTransaction {
  transaction_date: string;
  description: string;
  reference: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  balance_after: number | null;
  is_duplicate: boolean;
  raw_row: Record<string, string>;
}

export function parseCSVContent(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  });

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function detectBankFormat(headers: string[]): BankFormatPreset | null {
  const normalised = headers.map(h => h.toLowerCase().trim());

  for (const preset of BANK_PRESETS) {
    const cols = Object.values(preset.columns).filter(Boolean) as string[];
    const matchCount = cols.filter(col => normalised.includes(col.toLowerCase())).length;
    if (matchCount >= Math.ceil(cols.length * 0.6)) {
      return preset;
    }
  }
  return null;
}

export function autoDetectMapping(headers: string[]): CSVColumnMapping {
  const mapping: CSVColumnMapping = {
    date: null,
    description: null,
    reference: null,
    amount: null,
    credit: null,
    debit: null,
    balance: null,
  };

  const lower = headers.map(h => h.toLowerCase().trim());

  // Date
  const dateIdx = lower.findIndex(h => h.includes('date'));
  if (dateIdx >= 0) mapping.date = headers[dateIdx];

  // Description
  const descIdx = lower.findIndex(h =>
    h.includes('description') || h.includes('memo') || h.includes('name') || h.includes('counter party')
  );
  if (descIdx >= 0) mapping.description = headers[descIdx];

  // Reference
  const refIdx = lower.findIndex(h => h.includes('reference') || h.includes('number'));
  if (refIdx >= 0) mapping.reference = headers[refIdx];

  // Amount (single column)
  const amtIdx = lower.findIndex(h =>
    (h.includes('amount') || h === 'value') && !h.includes('credit') && !h.includes('debit') && !h.includes('local')
  );
  if (amtIdx >= 0) mapping.amount = headers[amtIdx];

  // Credit/Debit (separate columns)
  const creditIdx = lower.findIndex(h => h.includes('credit') || h.includes('money in'));
  if (creditIdx >= 0) mapping.credit = headers[creditIdx];

  const debitIdx = lower.findIndex(h => h.includes('debit') || h.includes('money out'));
  if (debitIdx >= 0) mapping.debit = headers[debitIdx];

  // Balance
  const balIdx = lower.findIndex(h => h.includes('balance'));
  if (balIdx >= 0) mapping.balance = headers[balIdx];

  return mapping;
}

export function parseDate(dateStr: string, format: string): string | null {
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  let day: number, month: number, year: number;

  if (format === 'DD/MM/YYYY') {
    const parts = cleaned.split(/[/\-.]/);
    if (parts.length < 3) return null;
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else if (format === 'MM/DD/YYYY') {
    const parts = cleaned.split(/[/\-.]/);
    if (parts.length < 3) return null;
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    // YYYY-MM-DD
    const parts = cleaned.split(/[/\-.]/);
    if (parts.length < 3) return null;
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  }

  if (year < 100) year += 2000;
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function transformRows(
  rows: Record<string, string>[],
  mapping: CSVColumnMapping,
  dateFormat: string
): ParsedTransaction[] {
  return rows
    .map(row => {
      const dateRaw = mapping.date ? row[mapping.date] : '';
      const transactionDate = parseDate(dateRaw, dateFormat);
      if (!transactionDate) return null;

      const description = mapping.description ? row[mapping.description] || '' : '';
      const reference = mapping.reference ? row[mapping.reference] || '' : '';

      let amount: number;
      let transactionType: 'credit' | 'debit';

      if (mapping.amount) {
        const rawAmt = parseFloat((row[mapping.amount] || '0').replace(/[£,\s]/g, ''));
        amount = Math.abs(rawAmt);
        transactionType = rawAmt >= 0 ? 'credit' : 'debit';
      } else if (mapping.credit || mapping.debit) {
        const credit = parseFloat((row[mapping.credit || ''] || '0').replace(/[£,\s]/g, '')) || 0;
        const debit = parseFloat((row[mapping.debit || ''] || '0').replace(/[£,\s]/g, '')) || 0;
        if (credit > 0) {
          amount = credit;
          transactionType = 'credit';
        } else {
          amount = Math.abs(debit);
          transactionType = 'debit';
        }
      } else {
        return null;
      }

      if (amount === 0) return null;

      const balanceRaw = mapping.balance ? row[mapping.balance] : '';
      const balanceAfter = balanceRaw ? parseFloat(balanceRaw.replace(/[£,\s]/g, '')) : null;

      return {
        transaction_date: transactionDate,
        description,
        reference,
        amount,
        transaction_type: transactionType,
        balance_after: isNaN(balanceAfter as number) ? null : balanceAfter,
        is_duplicate: false,
        raw_row: row,
      } as ParsedTransaction;
    })
    .filter(Boolean) as ParsedTransaction[];
}
