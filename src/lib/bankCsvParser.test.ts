import { describe, it, expect } from 'vitest';
import {
  parseCSVContent,
  detectBankFormat,
  autoDetectMapping,
  parseDate,
  transformRows,
  BANK_PRESETS,
  type CSVColumnMapping,
} from './bankCsvParser';

describe('parseCSVContent', () => {
  it('returns empty for fewer than 2 non-blank lines', () => {
    expect(parseCSVContent('')).toEqual({ headers: [], rows: [] });
    expect(parseCSVContent('Header only')).toEqual({ headers: [], rows: [] });
  });

  it('strips blank lines and parses headers + rows', () => {
    const csv = 'Date,Amount\n\n2025-01-01,100\n2025-01-02,200\n';
    const out = parseCSVContent(csv);
    expect(out.headers).toEqual(['Date', 'Amount']);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toEqual({ Date: '2025-01-01', Amount: '100' });
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'Name,Amount\n"Smith, John",100\n';
    const out = parseCSVContent(csv);
    expect(out.rows[0]).toEqual({ Name: 'Smith, John', Amount: '100' });
  });

  it('handles escaped quotes ("" inside a quoted field)', () => {
    const csv = 'Name,Amount\n"She said ""hi""",50\n';
    const out = parseCSVContent(csv);
    expect(out.rows[0]).toEqual({ Name: 'She said "hi"', Amount: '50' });
  });

  it('pads missing trailing fields to empty string', () => {
    const csv = 'A,B,C\nx,y\n';
    const out = parseCSVContent(csv);
    expect(out.rows[0]).toEqual({ A: 'x', B: 'y', C: '' });
  });

  it('tolerates CRLF line endings', () => {
    const csv = 'A,B\r\n1,2\r\n';
    const out = parseCSVContent(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toEqual({ A: '1', B: '2' });
  });
});

describe('detectBankFormat', () => {
  it('detects Lloyds from its distinctive headers', () => {
    const preset = detectBankFormat(['Transaction Date', 'Transaction Description', 'Credit Amount', 'Debit Amount', 'Balance']);
    expect(preset?.name).toBe('Lloyds / Halifax');
  });

  it('detects Starling from its GBP-suffixed headers', () => {
    const preset = detectBankFormat(['Date', 'Counter Party', 'Reference', 'Amount (GBP)', 'Balance (GBP)']);
    expect(preset?.name).toBe('Starling');
  });

  it('is case-insensitive for header comparison', () => {
    const preset = detectBankFormat(['date', 'MEMO', 'number', 'amount']);
    expect(preset?.name).toBe('Barclays');
  });

  it('returns null when no preset matches', () => {
    expect(detectBankFormat(['foo', 'bar', 'baz'])).toBeNull();
  });

  it('requires at least 60% of expected columns to match', () => {
    // Barclays expects 4 columns: Date, Memo, Number, Amount. 60% = 3 matches.
    // Only 2 matches → no detection.
    expect(detectBankFormat(['Date', 'Memo', 'foo', 'bar'])).toBeNull();
  });
});

describe('autoDetectMapping', () => {
  it('detects Lloyds-style credit/debit columns separately', () => {
    const mapping = autoDetectMapping(['Transaction Date', 'Transaction Description', 'Credit Amount', 'Debit Amount', 'Balance']);
    expect(mapping.date).toBe('Transaction Date');
    expect(mapping.description).toBe('Transaction Description');
    expect(mapping.credit).toBe('Credit Amount');
    expect(mapping.debit).toBe('Debit Amount');
    expect(mapping.balance).toBe('Balance');
  });

  it('excludes credit/debit/local columns from the generic amount detection', () => {
    // "Local amount" should not be selected as the amount column
    const mapping = autoDetectMapping(['Date', 'Description', 'Amount', 'Local Amount', 'Credit Amount']);
    expect(mapping.amount).toBe('Amount');
    expect(mapping.credit).toBe('Credit Amount');
  });

  it('maps description to "Counter Party" when no description column exists', () => {
    const mapping = autoDetectMapping(['Date', 'Counter Party', 'Amount']);
    expect(mapping.description).toBe('Counter Party');
  });

  it('leaves fields null when no header matches', () => {
    const mapping = autoDetectMapping(['foo', 'bar']);
    expect(mapping).toEqual({
      date: null,
      description: null,
      reference: null,
      amount: null,
      credit: null,
      debit: null,
      balance: null,
    });
  });
});

describe('parseDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseDate('15/06/2025', 'DD/MM/YYYY')).toBe('2025-06-15');
  });

  it('accepts . and - as separators for DD/MM/YYYY', () => {
    expect(parseDate('15-06-2025', 'DD/MM/YYYY')).toBe('2025-06-15');
    expect(parseDate('15.06.2025', 'DD/MM/YYYY')).toBe('2025-06-15');
  });

  it('parses MM/DD/YYYY', () => {
    expect(parseDate('06/15/2025', 'MM/DD/YYYY')).toBe('2025-06-15');
  });

  it('parses YYYY-MM-DD as the default', () => {
    expect(parseDate('2025-06-15', 'ISO')).toBe('2025-06-15');
  });

  it('pads single-digit day/month', () => {
    expect(parseDate('5/6/2025', 'DD/MM/YYYY')).toBe('2025-06-05');
  });

  it('promotes 2-digit year to 2000s', () => {
    expect(parseDate('15/06/25', 'DD/MM/YYYY')).toBe('2025-06-15');
  });

  it('returns null for empty / incomplete / garbage input', () => {
    expect(parseDate('', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('   ', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('15/06', 'DD/MM/YYYY')).toBeNull();
    expect(parseDate('foo/bar/baz', 'DD/MM/YYYY')).toBeNull();
  });
});

describe('transformRows', () => {
  const mapping: CSVColumnMapping = {
    date: 'Date',
    description: 'Description',
    reference: 'Ref',
    amount: 'Amount',
    credit: null,
    debit: null,
    balance: 'Balance',
  };

  it('classifies positive single-column amounts as credits', () => {
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'Rent', Ref: 'R1', Amount: '1200.00', Balance: '2000.00' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(tx).toMatchObject({
      transaction_date: '2025-05-01',
      transaction_type: 'credit',
      amount: 1200,
      balance_after: 2000,
    });
  });

  it('classifies negative single-column amounts as debits and stores absolute value', () => {
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'Fee', Ref: '', Amount: '-50.00', Balance: '' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(tx.transaction_type).toBe('debit');
    expect(tx.amount).toBe(50);
    expect(tx.balance_after).toBeNull();
  });

  it('strips £, commas, and whitespace from amount and balance', () => {
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'x', Ref: '', Amount: '£1,234.56', Balance: '£ 10,000.00 ' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(tx.amount).toBeCloseTo(1234.56, 2);
    expect(tx.balance_after).toBeCloseTo(10000, 2);
  });

  it('prefers credit over debit when both columns have values', () => {
    const cd: CSVColumnMapping = { ...mapping, amount: null, credit: 'Credit', debit: 'Debit' };
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'x', Ref: '', Credit: '100', Debit: '0', Balance: '' }],
      cd,
      'DD/MM/YYYY',
    );
    expect(tx.transaction_type).toBe('credit');
    expect(tx.amount).toBe(100);
  });

  it('uses debit when credit is zero', () => {
    const cd: CSVColumnMapping = { ...mapping, amount: null, credit: 'Credit', debit: 'Debit' };
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'x', Ref: '', Credit: '0', Debit: '40', Balance: '' }],
      cd,
      'DD/MM/YYYY',
    );
    expect(tx.transaction_type).toBe('debit');
    expect(tx.amount).toBe(40);
  });

  it('drops rows with unparseable date', () => {
    const out = transformRows(
      [{ Date: 'not-a-date', Description: 'x', Ref: '', Amount: '100', Balance: '' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(out).toEqual([]);
  });

  it('drops rows where amount is zero', () => {
    const out = transformRows(
      [{ Date: '01/05/2025', Description: 'x', Ref: '', Amount: '0', Balance: '' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(out).toEqual([]);
  });

  it('drops rows when neither amount nor credit/debit columns are mapped', () => {
    const none: CSVColumnMapping = { ...mapping, amount: null };
    const out = transformRows(
      [{ Date: '01/05/2025', Description: 'x', Ref: '', Amount: '100', Balance: '' }],
      none,
      'DD/MM/YYYY',
    );
    expect(out).toEqual([]);
  });

  it('preserves the raw row for audit purposes', () => {
    const [tx] = transformRows(
      [{ Date: '01/05/2025', Description: 'Rent', Ref: 'R1', Amount: '100', Balance: '' }],
      mapping,
      'DD/MM/YYYY',
    );
    expect(tx.raw_row).toEqual({ Date: '01/05/2025', Description: 'Rent', Ref: 'R1', Amount: '100', Balance: '' });
  });
});

describe('BANK_PRESETS', () => {
  it('exports a non-empty list with stable names', () => {
    const names = BANK_PRESETS.map((p) => p.name);
    expect(names).toContain('Barclays');
    expect(names).toContain('Lloyds / Halifax');
    expect(names).toContain('NatWest / RBS');
    expect(names).toContain('Monzo');
    expect(names).toContain('Starling');
  });
});
