import { DEMO_DATA, Expense, normalize } from './lib';
export const DEMO = import.meta.env.VITE_DEMO === 'true';
const demoErr = () => new Error('Demo mode: backend calls are disabled.');

async function call(path: string, init?: RequestInit) {
  const r = await fetch('/api' + path, init);
  const t = await r.text();
  let j: any = {};
  try { j = t ? JSON.parse(t) : {}; } catch { /* non-JSON body */ }
  if (!r.ok) throw new Error(j.error || j.message || `Request failed (${r.status})`);
  return j;
}
export async function listExpenses(userId: string): Promise<Expense[]> {
  if (DEMO) return DEMO_DATA;
  const j = await call('/expenses?userId=' + encodeURIComponent(userId));
  return Array.isArray(j.items) ? j.items.map(normalize) : [];
}
export type UploadMeta = { currency: string; paymentAccountId: string; paymentType: string };
export async function uploadReceipt(userId: string, file: File, meta: UploadMeta) {
  if (DEMO) throw demoErr();
  const j = await call('/upload', { method: 'POST', body: JSON.stringify({ userId, contentType: file.type, ...meta }) });
  // Headers must match the presigned request exactly: Content-Type + every x-amz-meta-* returned.
  const put = await fetch(j.uploadUrl, { method: 'PUT', body: file,
    headers: { 'Content-Type': j.contentType, ...(j.requiredMetadataHeaders || {}) } });
  if (!put.ok) throw new Error(`S3 upload failed (${put.status}). Check bucket CORS allows PUT and x-amz-meta-* headers.`);
  return j.receiptId as string;
}
// Review token is added server-side by the gateway; it never exists in browser code.
export async function approve(e: Expense, paymentType: string) {
  if (DEMO) throw demoErr();
  return call('/review', { method: 'POST', body: JSON.stringify({ userId: e.userId, sk: e.sk, merchant: e.merchant,
    receiptDate: e.receiptDate, total: e.total, category: e.category, currency: e.currency,
    paymentAccountId: e.paymentAccountId, paymentType }) });
}
