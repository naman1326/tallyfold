import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { call, listExpenses } from './api';

describe('src/api client error handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('produces descriptive error message on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(call('/expenses')).rejects.toThrow('404 Not Found: Resource not found');
  });

  it('produces descriptive actionable error on 404 with empty response body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    await expect(call('/expenses')).rejects.toThrow(/API endpoint not found \(404\) at \/api\/expenses/);
  });

  it('produces descriptive actionable error on 403 Forbidden', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(call('/expenses')).rejects.toThrow('403 Forbidden: Forbidden');
  });

  it('identifies CORS / network failure from Failed to fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(call('/expenses')).rejects.toThrow(/Unable to reach backend API.*CORS configuration/);
  });
});
