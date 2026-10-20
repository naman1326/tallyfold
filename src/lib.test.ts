import { describe, expect, it } from 'vitest';
import { blockers, DEMO_DATA, money, normalize, sortExpenses, toCsv } from './lib';

describe('normalize', () => {
  it('parses string decimals and survives garbage', () => {
    expect(normalize({ total: '55.00', confidence: '0.89' }).total).toBe(55);
    const e = normalize(null);
    expect(e.total).toBeNull(); expect(e.reviewReasons).toEqual([]); expect(e.syncStatus).toBe('UNKNOWN');
  });
  it('derives id/date from sk', () => expect(normalize({ sk: '2023-05-02#abc' })).toMatchObject({ receiptId: 'abc', receiptDate: '2023-05-02' }));
});

describe('review rules', () => {
  it('blocks low confidence and wrong status', () => {
    expect(blockers(normalize({ ...DEMO_DATA[0], syncStatus: 'SYNCED' }))).toContain('Status must be NEEDS_REVIEW');
    expect(blockers({ ...DEMO_DATA[1], confidence: 0.5 })).toContain('OCR confidence is below 75%');
  });
  it('allows an eligible receipt', () => expect(blockers(DEMO_DATA[1])).toEqual([]));
  it('never shows SYNCED from a pending record', () => expect(normalize({ syncStatus: 'PENDING' }).syncStatus).not.toBe('SYNCED'));
});

describe('format', () => {
  it('shows missing amounts as a dash, not zero', () => expect(money(null, 'USD')).toBe('—'));
  it('escapes CSV formulas', () => expect(toCsv([normalize({ merchant: '=SUM(A1)' })])).toContain("\"'=SUM(A1)\""));
});

describe('sortExpenses', () => {
  it('sorts expenses by amount ascending and descending', () => {
    const sortedAsc = sortExpenses(DEMO_DATA, 'total', 'asc');
    expect(sortedAsc[0].total).toBeLessThanOrEqual(sortedAsc[1].total ?? Infinity);
    const sortedDesc = sortExpenses(DEMO_DATA, 'total', 'desc');
    expect(sortedDesc[0].total).toBeGreaterThanOrEqual(sortedDesc[1].total ?? -Infinity);
  });
  it('sorts expenses by merchant alphabetically', () => {
    const sorted = sortExpenses(DEMO_DATA, 'merchant', 'asc');
    expect(sorted[0].merchant.localeCompare(sorted[sorted.length - 1].merchant)).toBeLessThanOrEqual(0);
  });
});
