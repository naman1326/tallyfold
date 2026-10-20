import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handler, resetSecretsCache, setSSMClient } from './handler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROD_ORIGIN = 'https://main.d7hymcw027vmv.amplifyapp.com';

describe('Tallyfold Production API Proxy Handler', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.API_BASE = 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod';
    process.env.API_KEY = 'test-secret-api-key';
    process.env.REVIEW_TOKEN = 'test-secret-review-token';
    process.env.ALLOWED_ORIGIN = PROD_ORIGIN;
    delete process.env.PROXY_SECRET;
    resetSecretsCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    resetSecretsCache();
    vi.restoreAllMocks();
  });

  describe('Route & Method Whitelist', () => {
    it('returns 404 for non-whitelisted paths', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/admin',
        headers: { origin: PROD_ORIGIN }
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
        headers: { origin: PROD_ORIGIN }
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
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('POST, OPTIONS');
    });

    it('returns 405 for GET on /api/review (only POST allowed)', async () => {
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/review',
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('POST, OPTIONS');
    });
  });

  describe('SSM Parameter Store Resolution & Caching', () => {
    it('retrieves API key and review token from SSM Parameter Store when env vars are not set', async () => {
      delete process.env.API_KEY;
      delete process.env.REVIEW_TOKEN;

      const mockSend = vi.fn().mockImplementation(async (command: { input: { Name: string } }) => {
        if (command.input.Name === '/expense/proxy/api_key') {
          return { Parameter: { Value: 'ssm-fetched-api-key' } };
        }
        if (command.input.Name === '/expense/proxy/review_token') {
          return { Parameter: { Value: 'ssm-fetched-review-token' } };
        }
        throw new Error('Parameter not found');
      });

      setSSMClient({ send: mockSend } as unknown as import('@aws-sdk/client-ssm').SSMClient);

      let calledHeaders: Record<string, string> = {};
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        calledHeaders = (init?.headers || {}) as Record<string, string>;
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      });

      const event = {
        httpMethod: 'POST',
        rawPath: '/api/review',
        headers: { origin: PROD_ORIGIN },
        body: JSON.stringify({ userId: 'alice' })
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(200);
      expect(calledHeaders['x-api-key']).toBe('ssm-fetched-api-key');
      expect(calledHeaders['x-review-token']).toBe('ssm-fetched-review-token');
      expect(mockSend).toHaveBeenCalledTimes(2);

      // Verify in-memory caching on second invocation
      await handler(event);
      expect(mockSend).toHaveBeenCalledTimes(2); // No extra SSM calls due to caching
    });

    it('fails safely with generic 500 when SSM parameter fetch throws', async () => {
      delete process.env.API_KEY;
      delete process.env.REVIEW_TOKEN;

      const mockSend = vi.fn().mockRejectedValue(new Error('AccessDeniedException: User not authorized'));
      setSSMClient({ send: mockSend } as unknown as import('@aws-sdk/client-ssm').SSMClient);

      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toBe('Server-side API key configuration missing.');
      // Never leak internal AWS exception or parameter names
      expect(res.body).not.toContain('AccessDeniedException');
      expect(res.body).not.toContain('/expense/proxy');
    });
  });

  describe('Configuration Validation', () => {
    it('returns 500 safely if API_BASE is missing or invalid', async () => {
      process.env.API_BASE = '';
      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toContain('API_BASE');
    });

    it('returns 500 safely if API key cannot be resolved', async () => {
      delete process.env.API_KEY;
      setSSMClient({ send: vi.fn().mockResolvedValue({}) } as unknown as import('@aws-sdk/client-ssm').SSMClient);

      const event = {
        httpMethod: 'GET',
        rawPath: '/api/expenses',
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Configuration Error');
      expect(body.message).toContain('API key');
    });

    it('returns 500 safely on /review if review token cannot be resolved', async () => {
      delete process.env.REVIEW_TOKEN;
      setSSMClient({
        send: vi.fn().mockImplementation(async (cmd: { input: { Name: string } }) => {
          if (cmd.input.Name === '/expense/proxy/api_key') {
            return { Parameter: { Value: 'valid-api-key' } };
          }
          return {}; // Missing review token
        })
      } as unknown as import('@aws-sdk/client-ssm').SSMClient);

      const event = {
        httpMethod: 'POST',
        rawPath: '/api/review',
        headers: { origin: PROD_ORIGIN },
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
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe(PROD_ORIGIN);
      expect(res.headers['Vary']).toBe('Origin');
    });

    it('sets preflight CORS headers including allowed methods and headers on OPTIONS', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        rawPath: '/api/expenses',
        headers: { origin: PROD_ORIGIN }
      };

      const res = await handler(event);
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe(PROD_ORIGIN);
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
        headers: { origin: PROD_ORIGIN }
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
          origin: PROD_ORIGIN,
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
        headers: { origin: PROD_ORIGIN }
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
        headers: { origin: PROD_ORIGIN },
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
        headers: { origin: PROD_ORIGIN },
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
        headers: { origin: PROD_ORIGIN }
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

    it('defaults AllowedOrigin to production Amplify origin', () => {
      const templatePath = path.resolve(__dirname, 'template.yaml');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      expect(templateContent).toContain("Default: 'https://main.d7hymcw027vmv.amplifyapp.com'");
    });

    it('does not define ApiKey or ReviewToken as CloudFormation parameters', () => {
      const templatePath = path.resolve(__dirname, 'template.yaml');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      // Ensure raw secrets are not defined as template parameters
      expect(templateContent).not.toMatch(/^\s*ApiKey:\s*$/m);
      expect(templateContent).not.toMatch(/^\s*ReviewToken:\s*$/m);

      // Ensures non-secret parameter names are used instead
      expect(templateContent).toContain('ApiKeyParameterName:');
      expect(templateContent).toContain("Default: '/expense/proxy/api_key'");
      expect(templateContent).toContain('ReviewTokenParameterName:');
      expect(templateContent).toContain("Default: '/expense/proxy/review_token'");
    });

    it('restricts SSM permissions to ssm:GetParameter on the two specific parameter ARNs in eu-north-1', () => {
      const templatePath = path.resolve(__dirname, 'template.yaml');
      const templateContent = fs.readFileSync(templatePath, 'utf8');

      expect(templateContent).toContain('Action:\n                - ssm:GetParameter');
      expect(templateContent).toContain("!Sub 'arn:aws:ssm:eu-north-1:${AWS::AccountId}:parameter/expense/proxy/api_key'");
      expect(templateContent).toContain("!Sub 'arn:aws:ssm:eu-north-1:${AWS::AccountId}:parameter/expense/proxy/review_token'");

      // Verify no broad wildcard SSM permissions
      expect(templateContent).not.toContain('ssm:*');
      expect(templateContent).not.toContain('parameter/*');
    });
  });

  describe('Lambda Packaging & Dependencies (proxy/package.json)', () => {
    it('defines a dedicated package.json in proxy/ with @aws-sdk/client-ssm dependency', () => {
      const pkgPath = path.resolve(__dirname, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.type).toBe('module');
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies['@aws-sdk/client-ssm']).toBeDefined();
    });

    it('has a matching package-lock.json in proxy/ for reproducible sam build', () => {
      const lockPath = path.resolve(__dirname, 'package-lock.json');
      expect(fs.existsSync(lockPath)).toBe(true);
    });
  });
});
