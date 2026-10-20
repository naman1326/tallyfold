import { DEMO_DATA, Expense, normalize } from './lib';

export const DEMO = import.meta.env.VITE_DEMO === 'true';

// Base URL for API requests. Defaults to relative '/api' which works seamlessly
// with the local Vite dev proxy and AWS Amplify 200 Rewrite rules.
// Can be overridden via VITE_API_BASE if targeting a dedicated proxy Function URL directly.
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

const demoErr = () => new Error('Demo mode: backend calls are disabled.');

export async function call(path: string, init?: RequestInit) {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE}${cleanPath}`;

  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)) || 'Network error';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
      throw new Error(
        `Unable to reach backend API at ${url}. Check your network connection, CORS configuration, or ensure the server-side API proxy is deployed and reachable.`
      );
    }
    throw new Error(`Network request failed: ${msg}`);
  }

  const t = await r.text();
  let j: any = {};
  try { j = t ? JSON.parse(t) : {}; } catch { /* non-JSON response body */ }

  if (!r.ok) {
    const serverMsg = j.error || j.message || '';
    if (r.status === 404) {
      throw new Error(
        serverMsg
          ? `404 Not Found: ${serverMsg}`
          : `API endpoint not found (404) at ${url}. Verify that the Amplify /api rewrite rule or server-side proxy is active and forwarding requests to the correct backend stage (/prod).`
      );
    }
    if (r.status === 403) {
      throw new Error(
        serverMsg
          ? `403 Forbidden: ${serverMsg}`
          : `Access forbidden (403). The API Gateway rejected the request. Ensure the server-side proxy is injecting a valid x-api-key header.`
      );
    }
    if (r.status === 502 || r.status === 504) {
      throw new Error(
        serverMsg
          ? `Gateway error (${r.status}): ${serverMsg}`
          : `Gateway error (${r.status}). The proxy or API Gateway could not communicate with the upstream Lambda function.`
      );
    }
    throw new Error(serverMsg || `Request failed with HTTP status ${r.status}`);
  }

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
  const j = await call('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, contentType: file.type, ...meta })
  });

  // Direct browser-to-S3 upload:
  // Headers must match the presigned request exactly: Content-Type + every x-amz-meta-* returned.
  const put = await fetch(j.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': j.contentType, ...(j.requiredMetadataHeaders || {}) }
  });

  if (!put.ok) {
    throw new Error(`S3 upload failed (${put.status}). Check bucket CORS allows PUT and x-amz-meta-* headers.`);
  }

  return j.receiptId as string;
}

// Review token and API key are injected server-side by the proxy;
// they never exist in browser code or client JavaScript.
export async function approve(
  e: Expense,
  paymentType: string,
  category: string
) {
  if (DEMO) throw demoErr();
  return call('/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: e.userId,
      sk: e.sk,
      merchant: e.merchant,
      receiptDate: e.receiptDate,
      total: e.total,
      category,
      currency: e.currency,
      paymentAccountId: e.paymentAccountId,
      paymentType
    })
  });
}
