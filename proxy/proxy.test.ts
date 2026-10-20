import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handler } from './handler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tallyfold Production API Proxy Handler', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.API_BASE = 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod';
    process.env.API_KEY = 'test-secret-api-key';
    process.env.REVIEW_TOKEN = 'test-secret-review-token';
    process.env.ALLOWED_ORIGIN = 'https://main.d123456789.amplifyapp.com';
    delete process.env.PROXY_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('Route & Method Whitelist', () => {
    it('returns 404 for non-whitelisted paths', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/admin',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('/admin is not supported');
    });

    it('returns 405 Method Not Allowed when method does not match route', async () => {
      // POST to /expenses is not allowed (only GET is allowed)
      const event = {
        httpMethod: 'POST',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('GET, OPTIONS');
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Method Not Allowed');
    });

    it('returns 405 for GET on /api/upload (only POST allowed)', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/upload',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('POST, OPTIONS');
    });

    it('returns 405 for GET on /api/review (only POST allowed)', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/review',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('POST, OPTIONS');
    });
  });

  describe('Environment Variable Validation', () => {
    it('returns 500 safely if API_BASE is missing or invalid', async () => {
      process.env.API_BASE = '';
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toContain('API_BASE');
    });

    it('returns 500 safely if API_KEY is missing', async () => {
      process.env.API_KEY = '';
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toContain('API key');
    });

    it('returns 500 safely on /review if REVIEW_TOKEN is missing', async () => {
      process.env.REVIEW_TOKEN = '';
      const event = {
        httpMethod: 'POST',
        rawPath: '/api/review',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' },
        body: JSON.stringify({ userId: 'demo' })
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toContain('review token');
    });
  });

  describe('Strict CORS Origin Control', () => {
    it('sets Access-Control-Allow-Origin to matched configured origin', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('https://main.d123456789.amplifyapp.com');
      expect(res.headers['Vary']).toBe('Origin');
    });

    it('sets preflight CORS headers including allowed methods and headers on OPTIONS', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('https://main.d123456789.amplifyapp.com');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(res.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(res.headers['Access-Control-Allow-Headers']).toContain('x-api-key');
      expect(res.headers['Access-Control-Allow-Headers']).toContain('x-review-token');
      expect(res.headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('rejects OPTIONS preflight from unauthorized origin with 403', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        rawPath: '/api/expenses',
        headers: { origin: 'https://malicious-site.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(403);
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('rejects standard request from unauthorized origin with 403', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: 'https://malicious-site.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(403);
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  describe('Optional Proxy Secret Access Control', () => {
    beforeEach(() => {
      process.env.PROXY_SECRET = 'super-secret-proxy-token';
    });

    it('rejects request with 401 when x-proxy-secret header is missing', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('accepts request when valid x-proxy-secret header is provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: {
          origin: 'https://main.d123456789.amplifyapp.com',
          'x-proxy-secret': 'super-secret-proxy-token'
        }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Upstream Request Forwarding & Token Injection', () => {
    it('forwards GET /api/expenses?userId=alice with x-api-key and preserves query params and /prod', async () => {
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
        queryStringParameters: { userId: 'alice' },
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/expenses?userId=alice');
      expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
      expect(calledHeaders['x-review-token']).toBeUndefined();
    });

    it('forwards POST /api/upload with x-api-key and payload intact', async () => {
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
        headers: { origin: 'https://main.d123456789.amplifyapp.com' },
        body: payload
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/upload');
      expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
      expect(calledBody).toBe(payload);
    });

    it('forwards POST /api/review with x-review-token in HEADER ONLY without adding it to body', async () => {
      let calledUrl = '';
      let calledHeaders: Record<string, string> = {};
      let calledBodyRaw = '';

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        calledUrl = url;
        calledHeaders = (init?.headers || {}) as Record<string, string>;
        calledBodyRaw = init?.body as string;
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

      const rawInputBody = JSON.stringify(clientPayload);
      const event = {
        httpMethod: 'POST',
        rawPath: '/api/review',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' },
        body: rawInputBody
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(calledUrl).toBe('https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod/review');
      // Injects x-api-key
      expect(calledHeaders['x-api-key']).toBe('test-secret-api-key');
      // Injects x-review-token in header
      expect(calledHeaders['x-review-token']).toBe('test-secret-review-token');
      // Body payload is unmodified: does NOT contain reviewToken in body
      const parsedForwardedBody = JSON.parse(calledBodyRaw);
      expect(parsedForwardedBody.reviewToken).toBeUndefined();
      expect(calledBodyRaw).toBe(rawInputBody);
    });

    it('returns 502 with sanitized message when upstream call fails without leaking sensitive info', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));

      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: 'https://main.d123456789.amplifyapp.com' }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(502);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Bad Gateway');
      expect(body.message).toBe('Failed to communicate with backend API Gateway.');
      // Ensure secrets are not in error output
      expect(res.body).not.toContain('test-secret-api-key');
      expect(res.body).not.toContain('test-secret-review-token');
    });
  });

  describe('SAM Template Configuration (proxy/template.yaml)', () => {
    it('specifies nodejs24.x runtime and valid AllowMethods without OPTIONS', () => {
      const templatePath = path.resolve(__dirname, 'template.yaml');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      expect(templateContent).toContain('Runtime: nodejs24.x');
      expect(templateContent).not.toContain('Runtime: nodejs20.x');

      // SAM / CloudFormation rejects OPTIONS in FunctionUrlConfig.Cors.AllowMethods
      expect(templateContent).not.toMatch(/AllowMethods:[\s\S]*?-\s*OPTIONS/);
      expect(templateContent).toMatch(/AllowMethods:\s*\n\s*-\s*GET\s*\n\s*-\s*POST/);
    });
  });
});
