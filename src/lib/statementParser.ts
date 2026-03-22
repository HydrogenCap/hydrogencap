/**
 * Bank statement CSV parser with auto-detection for UK banks.
 * Replaces the manual column mapping flow with automatic format detection.
 */

import { parseCSV, type ParsedCSVRow } from './csvParser';

export interface ParsedTransaction {
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;         // Positive = credit, negative = debit
  balance: number | null;
  reference: string | null;
  type: string | null;    // 'FPS', 'STO', 'DD', etc.
}

export interface StatementParseResult {
  transactions: ParsedTransaction[];
  detectedFormat: string;
  warnings: string[];
}

// ─── Format Detection ─────────────────────────────────────────────────

interface FormatSpec {
  name: string;
  detect: (headers: string[]) => boolean;
  parse: (row: ParsedCSVRow) => ParsedTransaction | null;
}

const FORMATS: FormatSpec[] = [
  {
    name: 'barclays',
    detect: (h) => h.some(c => /^Number$/i.test(c)) && h.some(c => /^Date$/i.test(c)) && h.some(c => /^Amount$/i.test(c)),
    parse: (row) => ({
      date: parseUKDate(row['Date']),
      description: row['Memo'] || row['Description'] || '',
      amount: parseAmount(row['Amount']),
      balance: parseAmountOrNull(row['Balance']),
      reference: row['Reference'] || null,
      type: row['Type'] || null,
    }),
  },
  {
    name: 'hsbc',
    detect: (h) => h.some(c => /^Date$/i.test(c)) && h.some(c => /^Description$/i.test(c))
      && (h.some(c => /^Credit$/i.test(c)) || h.some(c => /^Amount$/i.test(c))),
    parse: (row) => {
      const credit = parseAmountOrNull(row['Credit']);
      const debit = parseAmountOrNull(row['Debit']);
      const amount = credit !== null ? credit : debit !== null ? -Math.abs(debit) : parseAmount(row['Amount']);
      return {
        date: parseUKDate(row['Date']),
        description: row['Description'] || '',
        amount,
        balance: parseAmountOrNull(row['Balance']),
        reference: row['Reference'] || null,
        type: row['Type'] || null,
      };
    },
  },
  {
    name: 'natwest',
    detect: (h) => h.some(c => /^Date$/i.test(c)) && h.some(c => /^Value$/i.test(c))
      && h.some(c => /^Balance$/i.test(c)),
    parse: (row) => ({
      date: parseUKDate(row['Date']),
      description: row['Description'] || '',
      amount: parseAmount(row['Value']),
      balance: parseAmountOrNull(row['Balance']),
      reference: null,
      type: row['Type'] || null,
    }),
  },
  {
    name: 'monzo',
    detect: (h) => h.some(c => /^Transaction ID$/i.test(c)) || (h.some(c => /^Date$/i.test(c)) && h.some(c => /^Name$/i.test(c)) && h.some(c => /^Amount$/i.test(c))),
    parse: (row) => ({
      date: parseISODate(row['Date'] || row['Created']),
      description: row['Name'] || row['Description'] || '',
      amount: parseAmount(row['Amount']),
      balance: parseAmountOrNull(row['Balance']),
      reference: row['Reference'] || row['Notes'] || null,
      type: row['Category'] || null,
    }),
  },
  {
    name: 'lloyds',
    detect: (h) => h.some(c => /^Transaction Date$/i.test(c)) && h.some(c => /^Credit Amount$/i.test(c)),
    parse: (row) => {
      const credit = parseAmountOrNull(row['Credit Amount']);
      const debit = parseAmountOrNull(row['Debit Amount']);
      return {
        date: parseUKDate(row['Transaction Date']),
        description: row['Transaction Description'] || '',
        amount: credit !== null ? credit : debit !== null ? -Math.abs(debit) : 0,
        balance: parseAmountOrNull(row['Balance']),
        reference: null,
        type: row['Transaction Type'] || null,
      };
    },
  },
];

// ─── Generic fallback ────────────────────────────────────────────────

function genericParse(row: ParsedCSVRow, headers: string[]): ParsedTransaction | null {
  const dateCol = headers.find(h => /date/i.test(h));
  const amountCol = headers.find(h => /^amount$|^value$/i.test(h));
  const creditCol = headers.find(h => /credit|money\s*in|paid\s*in/i.test(h));
  const debitCol = headers.find(h => /debit|money\s*out|paid\s*out/i.test(h));
  const descCol = headers.find(h => /desc|memo|narrative|detail|name|payee/i.test(h));
  const balCol = headers.find(h => /balance/i.test(h));
  const refCol = headers.find(h => /ref|reference/i.test(h));

  if (!dateCol) return null;

  let amount = 0;
  if (amountCol) {
    amount = parseAmount(row[amountCol]);
  } else if (creditCol || debitCol) {
    const credit = creditCol ? parseAmountOrNull(row[creditCol]) : null;
    const debit = debitCol ? parseAmountOrNull(row[debitCol]) : null;
    amount = (credit ?? 0) - Math.abs(debit ?? 0);
  }

  const rawDate = row[dateCol];
  const date = parseFlexibleDate(rawDate);

  return {
    date,
    description: descCol ? row[descCol] || '' : '',
    amount,
    balance: balCol ? parseAmountOrNull(row[balCol]) : null,
    reference: refCol ? row[refCol] || null : null,
    type: null,
  };
}

// ─── Main Parser ─────────────────────────────────────────────────────

export function parseStatement(csvText: string): StatementParseResult {
  const parsed = parseCSV(csvText);
  const warnings: string[] = [];

  if (parsed.rows.length === 0) {
    return { transactions: [], detectedFormat: 'unknown', warnings: ['No data rows found'] };
  }

  const format = FORMATS.find(f => f.detect(parsed.headers));
  const formatName = format?.name || 'generic';

  const transactions: ParsedTransaction[] = [];
  const seenHashes = new Set<string>();

  for (let i = 0; i < parsed.rows.length; i++) {
    try {
      const txn = format
        ? format.parse(parsed.rows[i])
        : genericParse(parsed.rows[i], parsed.headers);

      if (!txn || !txn.date || txn.amount === 0) continue;

      // Dedup within this file
      const hash = `${txn.date}|${txn.amount}|${txn.description}`;
      if (seenHashes.has(hash)) {
        warnings.push(`Row ${i + 2}: Possible duplicate skipped (${txn.date}, ${txn.amount})`);
        continue;
      }
      seenHashes.add(hash);

      transactions.push(txn);
    } catch (e) {
      warnings.push(`Row ${i + 2}: Parse error — ${(e as Error).message}`);
    }
  }

  return { transactions, detectedFormat: formatName, warnings };
}

// ─── Date Parsers ────────────────────────────────────────────────────

function parseUKDate(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return parseFlexibleDate(raw);
}

function parseISODate(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return parseFlexibleDate(raw);
}

function parseFlexibleDate(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const uk = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

// ─── Amount Parsers ──────────────────────────────────────────────────

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[£$€,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseAmountOrNull(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/[£$€,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Hash for dedup ──────────────────────────────────────────────────

export async function computeTransactionHash(date: string, amount: number, description: string): Promise<string> {
  const text = `${date}|${amount.toFixed(2)}|${description.trim().toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
