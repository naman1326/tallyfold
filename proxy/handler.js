/**
 * Tallyfold Production API Proxy (AWS Lambda Handler)
 *
 * Sits between AWS Amplify Hosting and the existing AWS API Gateway REST API.
 * - Enforces strict path and method whitelisting:
 *     - GET  /api/expenses (with query params)
 *     - POST /api/upload
 *     - POST /api/review
 *   Returns 404 for unknown paths, and 405 for unsupported HTTP methods.
 * - Restricts CORS to the configured Amplify website origin (ALLOWED_ORIGIN).
 *   (Note: CORS provides browser-level domain restrictions for abuse prevention;
 *    it does not authenticate users.)
 * - Reads API key and review token dynamically at runtime from AWS Systems Manager
 *   (SSM) Parameter Store SecureString parameters:
 *     - /expense/proxy/api_key
 *     - /expense/proxy/review_token
 * - Caches retrieved secrets in-memory across warm Lambda invocations.
 * - Injects 'x-api-key' server-side from retrieved SSM parameter.
 * - Injects 'x-review-token' header server-side for POST /review without modifying client body.
 * - Strips '/api' prefix exactly once while preserving the '/prod' stage path and query params.
 * - Never logs or exposes secrets, tokens, sensitive payloads, or presigned URLs.
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const DEFAULT_API_BASE = 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod';
const DEFAULT_ALLOWED_ORIGIN = 'https://main.d7hymcw027vmv.amplifyapp.com';
const DEFAULT_API_KEY_PARAM = '/expense/proxy/api_key';
const DEFAULT_REVIEW_TOKEN_PARAM = '/expense/proxy/review_token';

// In-memory cache for parameters to optimize warm invocations
let cachedApiKey = null;
let cachedReviewToken = null;

let ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'eu-north-1' });

export function setSSMClient(client) {
  ssmClient = client;
}

export function resetSecretsCache() {
  cachedApiKey = null;
  cachedReviewToken = null;
}

async function fetchSSMParameter(paramName) {
  if (!paramName) return '';
  const command = new GetParameterCommand({
    Name: paramName,
    WithDecryption: true,
  });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value || '';
}

export async function getApiKey() {
  if (cachedApiKey) return cachedApiKey;
  if (process.env.API_KEY) {
    cachedApiKey = process.env.API_KEY.trim();
    return cachedApiKey;
  }
  const paramName = (process.env.API_KEY_PARAM_NAME || process.env.SSM_API_KEY_PARAM || DEFAULT_API_KEY_PARAM).trim();
  try {
    const val = await fetchSSMParameter(paramName);
    if (val) {
      cachedApiKey = val.trim();
      return cachedApiKey;
    }
  } catch {
    // Fail safely: Never log secret values, parameter names, or internal AWS errors
  }
  return '';
}

export async function getReviewToken() {
  if (cachedReviewToken) return cachedReviewToken;
  if (process.env.REVIEW_TOKEN) {
    cachedReviewToken = process.env.REVIEW_TOKEN.trim();
    return cachedReviewToken;
  }
  const paramName = (process.env.REVIEW_TOKEN_PARAM_NAME || process.env.SSM_REVIEW_TOKEN_PARAM || DEFAULT_REVIEW_TOKEN_PARAM).trim();
  try {
    const val = await fetchSSMParameter(paramName);
    if (val) {
      cachedReviewToken = val.trim();
      return cachedReviewToken;
    }
  } catch {
    // Fail safely: Never log secret values, parameter names, or internal AWS errors
  }
  return '';
}

// Strict whitelist of permitted endpoints and their allowed HTTP methods
export const ALLOWED_ROUTES = {
  '/expenses': ['GET'],
  '/upload': ['POST'],
  '/review': ['POST']
};

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key] || '';
    }
  }
  return '';
}

export function resolveCors(event, allowedOriginEnv) {
  const originHeader = getHeader(event?.headers, 'origin');
  const allowedList = (allowedOriginEnv !== undefined ? allowedOriginEnv : DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  let isAllowed = false;
  let activeOrigin = '';

  if (allowedList.length === 0) {
    // If no origin restriction is configured, allow without setting Allow-Origin wildcard
    isAllowed = true;
    activeOrigin = '';
  } else if (!originHeader) {
    // Direct or server-to-server rewrite where browser Origin is not populated
    isAllowed = true;
    activeOrigin = allowedList[0];
  } else if (allowedList.includes(originHeader)) {
    isAllowed = true;
    activeOrigin = originHeader;
  } else {
    isAllowed = false;
    activeOrigin = '';
  }

  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-review-token, x-proxy-secret, x-amz-meta-*',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  if (activeOrigin) {
    corsHeaders['Access-Control-Allow-Origin'] = activeOrigin;
  }

  return { corsHeaders, isAllowed };
}

export async function handler(event) {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN !== undefined ? process.env.ALLOWED_ORIGIN : DEFAULT_ALLOWED_ORIGIN;
  const { corsHeaders, isAllowed } = resolveCors(event, allowedOriginEnv);

  // 1. Handle CORS Preflight (OPTIONS)
  if (method === 'OPTIONS') {
    if (!isAllowed) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden', message: 'CORS origin not allowed.' })
      };
    }
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // 2. Enforce CORS origin policy for standard requests
  if (!isAllowed) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: 'Request origin not allowed by CORS policy.' })
    };
  }

  // 3. Optional Proxy Secret Verification (Access Control for Function URL)
  // Disabled by default because AWS Amplify Hosting rewrites cannot inject custom request headers
  const requiredProxySecret = process.env.PROXY_SECRET || '';
  if (requiredProxySecret) {
    const incomingSecret = getHeader(event.headers, 'x-proxy-secret');
    if (!incomingSecret || incomingSecret !== requiredProxySecret) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid proxy access token.' })
      };
    }
  }

  // 4. Extract and normalize path
  const rawPath = event.rawPath || event.path || '/';
  let subPath = rawPath.replace(/^\/?api(?=\/|$)/, '');
  if (!subPath || !subPath.startsWith('/')) {
  	subPath = '/' + subPath;
  }

  // Normalize trailing slashes for API route matching.
  if (subPath.length > 1) {
  	subPath = subPath.replace(/\/+$/, '');
  }

  // 5. Whitelist Validation (Strict endpoint & method checking)
  if (!(subPath in ALLOWED_ROUTES)) {
    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Not Found', message: `Route ${subPath} is not supported by the API proxy.` })
    };
  }

  const allowedMethods = ALLOWED_ROUTES[subPath];
  if (!allowedMethods.includes(method)) {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        'Allow': `${allowedMethods.join(', ')}, OPTIONS`
      },
      body: JSON.stringify({
        error: 'Method Not Allowed',
        message: `HTTP ${method} is not allowed for ${subPath}. Allowed: ${allowedMethods.join(', ')}`
      })
    };
  }

  // 6. Validate Required Server-Side Environment Variables & Secrets
  const rawApiBase = process.env.API_BASE !== undefined ? process.env.API_BASE : DEFAULT_API_BASE;
  const apiBase = (rawApiBase || '').trim().replace(/\/+$/, '');

  if (!apiBase || (!apiBase.startsWith('http://') && !apiBase.startsWith('https://'))) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Configuration Error', message: 'Invalid or missing API_BASE environment variable.' })
    };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Configuration Error', message: 'Server-side API key configuration missing.' })
    };
  }

  // 7. Verify review token availability if route is /review
  const isReview = subPath === '/review';
  let reviewToken = '';
  if (isReview) {
    reviewToken = await getReviewToken();
    if (!reviewToken) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Configuration Error', message: 'Server-side review token configuration missing.' })
      };
    }
  }

  // 8. Build target URL (preserves /prod stage and query parameters)
  let queryString = '';
  if (event.rawQueryString) {
    queryString = '?' + event.rawQueryString;
  } else if (event.queryStringParameters) {
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    if (qs) queryString = '?' + qs;
  }

  const targetUrl = `${apiBase}${subPath}${queryString}`;

  // 9. Build server-side headers
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey
  };

  // Add x-review-token header ONLY for /review (header-only, do not modify body)
  if (isReview && reviewToken) {
    headers['x-review-token'] = reviewToken;
  }

  // 10. Extract body (leave payload intact without appending secrets)
  let body = event.body;
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf8');
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined
    });

    const responseText = await upstream.text();
    const responseContentType = upstream.headers.get('content-type') || 'application/json';

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders,
        'content-type': responseContentType
      },
      body: responseText
    };
  } catch {
    // Sanitize error logging / output — never expose internal details
    return {
      statusCode: 502,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Bad Gateway',
        message: 'Failed to communicate with backend API Gateway.'
      })
    };
  }
}
