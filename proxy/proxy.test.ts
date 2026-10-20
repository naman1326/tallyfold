import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handler } from './handler.js';

describe('Production API Proxy Handler', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.API_BASE = 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod';
    process.env.API_KEY = 'test-secret-api-key';
    process.env.REVIEW_TOKEN = 'test-secret-review-token';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('handles OPTIONS preflight requests with 204 and CORS headers', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      path: '/api/expenses'
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Headers']).toContain('x-api-key');
    expect(res.headers['Access-Control-Allow-Headers']).toContain('x-review-token');
  });

  it('forwards GET /api/expenses?userId=demo-user stripping /api and preserving /prod', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers || {}) as Record<string, string>;
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const event = {
      httpMethod: 'GET',
      path: '/api/expenses',
      queryStringParameters: { userId: 'demo-user' }
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    // Preserves /prod and strips /api exactly once
    expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/expenses?userId=demo-user');
    // Injects x-api-key server-side
    expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
    // Does not inject x-review-token on expenses
    expect(calledHeaders['x-review-token']).toBeUndefined();
  });

  it('forwards POST /api/upload with x-api-key', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};
    let calledBody = '';

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers || {}) as Record<string, string>;
      calledBody = init?.body as string;
      return new Response(JSON.stringify({ uploadUrl: 'https://s3.amazonaws.com/bucket/key', receiptId: 'rec-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const payload = JSON.stringify({ userId: 'demo', contentType: 'image/jpeg', currency: 'USD' });
    const event = {
      httpMethod: 'POST',
      rawPath: '/api/upload',
      body: payload
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/upload');
    expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
    expect(JSON.parse(calledBody)).toEqual(JSON.parse(payload));
  });

  it('forwards POST /api/review with x-api-key AND x-review-token in headers and body', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};
    let calledBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers || {}) as Record<string, string>;
      calledBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ message: 'Approved' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const clientPayload = {
      userId: 'demo',
      sk: '2023-05-02#abc',
      merchant: 'Coffee Shop',
      receiptDate: '2023-05-02',
      total: 55,
      category: 'Meals & Entertainment',
      currency: 'USD',
      paymentAccountId: '35',
      paymentType: 'Cash'
    };

    const event = {
      httpMethod: 'POST',
      rawPath: '/api/review',
      body: JSON.stringify(clientPayload)
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/review');
    // Checks both server-side token injections
    expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
    expect(calledHeaders['x-review-token']).toBe('test-secret-review-token');
    // Ensure body also receives reviewToken for dual contract compatibility
    expect(calledBody.reviewToken).toBe('test-secret-review-token');
    expect(calledBody.merchant).toBe('Coffee Shop');
  });

  it('returns 502 with structured error when upstream fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));

    const event = {
      httpMethod: 'GET',
      path: '/api/expenses'
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Proxy Error');
    expect(body.message).toContain('Connection timed out');
  });
});
