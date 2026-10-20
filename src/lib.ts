export type Expense = {
  userId: string; sk: string; receiptId: string; merchant: string; receiptDate: string;
  total: number | null; subtotal: number | null; tax: number | null; currency: string; category: string;
  confidence: number | null; needsReview: boolean; reviewReasons: string[]; paymentAccountId: string;
  paymentType: string; syncStatus: string; qboId: string; syncError: string; createdAt: string; s3Key: string;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v); return Number.isFinite(n) ? n : null; // API returns Decimals as strings
};
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export function normalize(raw: unknown): Expense {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const sk = str(r.sk);
  return {
    userId: str(r.userId), sk, receiptId: str(r.receiptId) || sk.split('#')[1] || '',
    merchant: str(r.merchant), receiptDate: str(r.receiptDate) || sk.split('#')[0] || '',
    total: num(r.total), subtotal: num(r.subtotal), tax: num(r.tax), currency: str(r.currency),
    category: str(r.category), confidence: num(r.confidence), needsReview: r.needsReview === true,
    reviewReasons: Array.isArray(r.reviewReasons) ? r.reviewReasons.map(str) : [],
    paymentAccountId: str(r.paymentAccountId), paymentType: str(r.paymentType),
    syncStatus: str(r.syncStatus) || 'UNKNOWN', qboId: str(r.qboId), syncError: str(r.syncError),
    createdAt: str(r.createdAt), s3Key: str(r.s3Key),
  };
}
export const money = (n: number | null, c: string) =>
  n === null ? '—' : /^[A-Z]{3}$/.test(c)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
    : `${n.toFixed(2)} ${c || ''}`.trim();

// Mirrors the checks in the deployed review-receipt Lambda (the Lambda stays the authority).
export const APPROVABLE = ['Office Supplies', 'Meals & Entertainment', 'Travel & Transport', 'Utilities'];
export function blockers(e: Expense): string[] {
  const b: string[] = [];
  if (e.syncStatus !== 'NEEDS_REVIEW') b.push('Status must be NEEDS_REVIEW');
  if ((e.confidence ?? 0) < 0.75) b.push('OCR confidence is below 75%');
  if (e.currency !== 'USD') b.push('Currency must be USD');
  if (e.paymentAccountId !== '35') b.push('Payment account must be Checking (35)');
  if (!APPROVABLE.includes(e.category)) b.push('Category has no QuickBooks mapping');
  if (!e.merchant || e.merchant === 'UNKNOWN') b.push('Merchant is missing');
  if (!(e.total !== null && e.total > 0)) b.push('Total is missing or not positive');
  return b;
}
export function toCsv(rows: Expense[]): string {
  const cell = (v: string) => (/^[=+\-@]/.test(v) ? "'" + v : v); // neutralise spreadsheet formulas
  const q = (v: string) => `"${cell(v).replace(/"/g, '""')}"`;
  const head = ['Merchant', 'Date', 'Amount', 'Currency', 'Category', 'Payment', 'ReceiptId', 'Status', 'QBO ID'];
  const lines = rows.map(e => [e.merchant, e.receiptDate, e.total === null ? '' : String(e.total), e.currency,
    e.category, e.paymentType, e.receiptId, e.syncStatus, e.qboId].map(q).join(','));
  return [head.map(q).join(','), ...lines].join('\n');
}

export type SortField = 'merchant' | 'receiptDate' | 'total' | 'category' | 'confidence' | 'syncStatus';
export type SortDirection = 'asc' | 'desc';

export function sortExpenses(items: Expense[], field: SortField, dir: SortDirection): Expense[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === 'total') {
      const aVal = a.total ?? -1;
      const bVal = b.total ?? -1;
      cmp = aVal - bVal;
    } else if (field === 'confidence') {
      const aVal = a.confidence ?? -1;
      const bVal = b.confidence ?? -1;
      cmp = aVal - bVal;
    } else {
      const aVal = (a[field] ?? '').toString().toLowerCase();
      const bVal = (b[field] ?? '').toString().toLowerCase();
      cmp = aVal.localeCompare(bVal);
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export const DEMO_DATA: Expense[] = [
  normalize({ userId: 'demo', sk: '2023-05-02#bcebf5dc34ee480d806394db10346e5', merchant: 'Coffee-Shop', total: '55.00',
    currency: 'USD', category: 'Meals & Entertainment', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.8912',
    syncStatus: 'SYNCED', qboId: '145', needsReview: false }),
  normalize({ userId: 'demo', sk: '2023-05-03#demo0002', merchant: 'Demo Stationers', total: '18.40', currency: 'USD',
    category: 'Office Supplies', paymentAccountId: '35', confidence: '0.82', syncStatus: 'NEEDS_REVIEW', needsReview: true,
    reviewReasons: ['Receipt details not verified'] }),
  normalize({ userId: 'demo', sk: '2023-05-05#demo0003', merchant: 'AWS Cloud Services', total: '342.50', subtotal: '315.00', tax: '27.50',
    currency: 'USD', category: 'Utilities', paymentType: 'Check', paymentAccountId: '35', confidence: '0.96',
    syncStatus: 'SYNCED', qboId: '148', needsReview: false }),
  normalize({ userId: 'demo', sk: '2023-05-08#demo0004', merchant: 'Delta Air Lines', total: '645.00', subtotal: '610.00', tax: '35.00',
    currency: 'USD', category: 'Travel & Transport', paymentType: 'Check', paymentAccountId: '35', confidence: '0.91',
    syncStatus: 'NEEDS_REVIEW', needsReview: true, reviewReasons: ['High amount policy flag'] }),
  normalize({ userId: 'demo', sk: '2023-05-10#demo0005', merchant: 'OfficeMax Supplies', total: '89.20', subtotal: '82.00', tax: '7.20',
    currency: 'USD', category: 'Office Supplies', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.78',
    syncStatus: 'NEEDS_REVIEW', needsReview: true, reviewReasons: ['Receipt details not verified'] }),
  normalize({ userId: 'demo', sk: '2023-05-12#demo0006', merchant: 'Uber Business Ride', total: '42.15', subtotal: '40.00', tax: '2.15',
    currency: 'USD', category: 'Travel & Transport', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.88',
    syncStatus: 'PENDING', needsReview: false }),
  normalize({ userId: 'demo', sk: '2023-05-14#demo0007', merchant: 'Acme Hardware & Tools', total: '124.80', subtotal: '115.00', tax: '9.80',
    currency: 'USD', category: 'Utilities', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.62',
    syncStatus: 'NEEDS_REVIEW', needsReview: true, reviewReasons: ['OCR confidence is below 75%'] }),
  normalize({ userId: 'demo', sk: '2023-05-15#demo0008', merchant: 'Bistro Downtown', total: '112.40', subtotal: '100.00', tax: '12.40',
    currency: 'USD', category: 'Meals & Entertainment', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.85',
    syncStatus: 'FAILED', syncError: 'QuickBooks Sandbox API error: Invalid AccountRef (35) or vendor inactive', needsReview: false }),
  normalize({ userId: 'demo', sk: '2023-05-16#demo0009', merchant: 'WeWork Hot Desk', total: '180.00', subtotal: '180.00', tax: '0.00',
    currency: 'USD', category: 'Utilities', paymentType: 'Check', paymentAccountId: '35', confidence: '0.94',
    syncStatus: 'SYNCED', qboId: '152', needsReview: false }),
  normalize({ userId: 'demo', sk: '2023-05-18#demo0010', merchant: 'FedEx Express Courier', total: '38.50', subtotal: '35.00', tax: '3.50',
    currency: 'USD', category: 'Office Supplies', paymentType: 'Cash', paymentAccountId: '35', confidence: '0.83',
    syncStatus: 'SYNCING', needsReview: false }),
];
