import { describe, it, expect } from 'vitest';
import { parseStatement, computeTransactionHash } from './statementParser';

describe('parseStatement — format detection', () => {
  it('returns unknown + warning for empty input', () => {
    const result = parseStatement('');
    expect(result.detectedFormat).toBe('unknown');
    expect(result.transactions).toEqual([]);
    expect(result.warnings).toContain('No data rows found');
  });

  it('detects the Barclays format via Number + Date + Amount headers', () => {
    const csv = `Number,Date,Memo,Amount,Balance
123,15/06/2025,Coffee,-3.50,100.00`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('barclays');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toBe('2025-06-15');
    expect(result.transactions[0].description).toBe('Coffee');
    expect(result.transactions[0].amount).toBe(-3.5);
    expect(result.transactions[0].balance).toBe(100);
  });

  it('detects the Lloyds format via Transaction Date + Credit Amount headers', () => {
    const csv = `Transaction Date,Transaction Description,Credit Amount,Debit Amount,Balance,Transaction Type
15/06/2025,Rent income,1200.00,,5000.00,CR
16/06/2025,Electric bill,,45.50,4954.50,DD`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('lloyds');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(1200);
    // Debit amount is stored as negative
    expect(result.transactions[1].amount).toBe(-45.5);
    expect(result.transactions[1].type).toBe('DD');
  });

  it('detects HSBC via separate Credit + Debit columns', () => {
    const csv = `Date,Description,Credit,Debit,Balance
15/06/2025,Salary,2500.00,,5000.00
16/06/2025,Rent,,1200.00,3800.00`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('hsbc');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(2500);
    expect(result.transactions[1].amount).toBe(-1200);
  });

  it('detects NatWest via Date + Value + Balance headers', () => {
    const csv = `Date,Description,Value,Balance,Type
15/06/2025,ATM withdrawal,-20.00,480.00,ATM
16/06/2025,Salary,1500.00,1980.00,CR`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('natwest');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(-20);
    expect(result.transactions[1].amount).toBe(1500);
  });

  it('detects Monzo via Transaction ID header', () => {
    const csv = `Transaction ID,Date,Name,Amount,Balance,Reference,Category
tx1,2025-06-15,Tesco,-25.50,100.00,grocery,Food
tx2,2025-06-16,Starbucks,-4.50,95.50,,Eating out`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('monzo');
    expect(result.transactions).toHaveLength(2);
    // ISO date format pre-normalised
    expect(result.transactions[0].date).toBe('2025-06-15');
    expect(result.transactions[0].type).toBe('Food'); // category mapped to type
    expect(result.transactions[0].reference).toBe('grocery');
  });

  it('falls through to the generic parser when no preset matches', () => {
    // "Narrative" avoids the HSBC preset ("Description") while still matching
    // the generic descCol regex (which includes /narrative/).
    const csv = `Date,Narrative,Amount
15/06/2025,Coffee,-3.50`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('generic');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(-3.5);
  });
});

describe('parseStatement — generic fallback', () => {
  it('handles "Money In" / "Money Out" columns', () => {
    const csv = `Date,Description,Money In,Money Out,Balance
15/06/2025,Salary,2500.00,,5000.00
16/06/2025,Rent,,1200.00,3800.00`;
    const result = parseStatement(csv);
    expect(result.detectedFormat).toBe('generic');
    expect(result.transactions[0].amount).toBe(2500);
    expect(result.transactions[1].amount).toBe(-1200);
  });

  it('returns no transactions when the csv lacks a date column', () => {
    const csv = `Description,Amount
Coffee,-3.50`;
    const result = parseStatement(csv);
    expect(result.transactions).toEqual([]);
  });
});

describe('parseStatement — dedup + filters', () => {
  it('skips duplicate rows (same date + amount + description)', () => {
    const csv = `Date,Description,Value,Balance
15/06/2025,Coffee,-3.50,100.00
15/06/2025,Coffee,-3.50,96.50
16/06/2025,Coffee,-3.50,93.00`;
    const result = parseStatement(csv);
    expect(result.transactions).toHaveLength(2); // second is a dup, third has a different date
    expect(result.warnings.some((w) => w.includes('Possible duplicate'))).toBe(true);
  });

  it('skips rows with amount=0', () => {
    const csv = `Date,Description,Value,Balance
15/06/2025,No-op,0.00,100.00
16/06/2025,Coffee,-3.50,96.50`;
    const result = parseStatement(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Coffee');
  });

  it('skips rows with unparseable date', () => {
    const csv = `Date,Description,Value,Balance
not-a-date,Bad row,-10,100
15/06/2025,Good row,-5,95`;
    const result = parseStatement(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Good row');
  });
});

describe('parseStatement — amount parsing', () => {
  it('strips currency symbols and commas', () => {
    // Both amount and balance need quoting when they contain a comma.
    const csv = `Date,Description,Value,Balance
15/06/2025,Rent,"£1,200.00","£5,000.00"`;
    const result = parseStatement(csv);
    expect(result.transactions[0].amount).toBe(1200);
    expect(result.transactions[0].balance).toBe(5000);
  });

  it('treats an empty balance cell as null', () => {
    const csv = `Date,Description,Value,Balance
15/06/2025,Coffee,-3.50,`;
    const result = parseStatement(csv);
    expect(result.transactions[0].balance).toBeNull();
  });

  it('treats non-numeric balance as null', () => {
    const csv = `Date,Description,Value,Balance
15/06/2025,Coffee,-3.50,N/A`;
    const result = parseStatement(csv);
    expect(result.transactions[0].balance).toBeNull();
  });
});

describe('parseStatement — date parsing', () => {
  it('parses DD/MM/YYYY (UK format)', () => {
    const csv = `Date,Description,Value
15/06/2025,x,-1`;
    const result = parseStatement(csv);
    expect(result.transactions[0].date).toBe('2025-06-15');
  });

  it('parses DD-MM-YYYY', () => {
    const csv = `Date,Description,Value
15-06-2025,x,-1`;
    const result = parseStatement(csv);
    expect(result.transactions[0].date).toBe('2025-06-15');
  });

  it('pads single-digit day/month', () => {
    const csv = `Date,Description,Value
5/6/2025,x,-1`;
    const result = parseStatement(csv);
    expect(result.transactions[0].date).toBe('2025-06-05');
  });

  it('accepts YYYY-MM-DD (ISO)', () => {
    const csv = `Date,Description,Value
2025-06-15,x,-1`;
    const result = parseStatement(csv);
    expect(result.transactions[0].date).toBe('2025-06-15');
  });
});

describe('computeTransactionHash', () => {
  it('returns a deterministic SHA-256 hex string', async () => {
    const h1 = await computeTransactionHash('2025-06-15', 100, 'Coffee');
    const h2 = await computeTransactionHash('2025-06-15', 100, 'Coffee');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is case-insensitive on description and trims whitespace', async () => {
    const h1 = await computeTransactionHash('2025-06-15', 100, 'Coffee');
    const h2 = await computeTransactionHash('2025-06-15', 100, '  COFFEE  ');
    expect(h1).toBe(h2);
  });

  it('normalises amount to 2 decimal places', async () => {
    const h1 = await computeTransactionHash('2025-06-15', 100, 'Coffee');
    const h2 = await computeTransactionHash('2025-06-15', 100.0, 'Coffee');
    const h3 = await computeTransactionHash('2025-06-15', 100.00, 'Coffee');
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('produces different hashes for different inputs', async () => {
    const h1 = await computeTransactionHash('2025-06-15', 100, 'Coffee');
    const h2 = await computeTransactionHash('2025-06-16', 100, 'Coffee'); // different date
    const h3 = await computeTransactionHash('2025-06-15', 200, 'Coffee'); // different amount
    const h4 = await computeTransactionHash('2025-06-15', 100, 'Tea'); // different desc
    expect(new Set([h1, h2, h3, h4]).size).toBe(4);
  });
});
