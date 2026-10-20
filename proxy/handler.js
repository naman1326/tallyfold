/**
 * Tallyfold Production API Proxy (AWS Lambda Handler)
 *
 * Designed for AWS Amplify Hosting deployments:
 * 1. Sits between the client browser (or Amplify 200 Rewrite) and the backend API Gateway.
 * 2. Strips the '/api' prefix exactly once while preserving the '/prod' stage path.
 * 3. Injects 'x-api-key' server-side from the API_KEY environment variable.
 * 4. Injects 'x-review-token' header server-side from REVIEW_TOKEN on /review requests.
 * 5. Handles CORS preflight (OPTIONS) with 204 No Content.
 * 6. Never exposes API_KEY or REVIEW_TOKEN to the client browser.
 */

const DEFAULT_API_BASE = 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-review-token, x-amz-meta-*',
  'Access-Control-Max-Age': '86400'
};

export async function handler(event) {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

  // 1. Handle CORS Preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  const apiBase = (process.env.API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
  const apiKey = process.env.API_KEY || '';
  const reviewToken = process.env.REVIEW_TOKEN || '';

  try {
    // 2. Extract path (compatible with Lambda Function URLs, HTTP API v2, and REST API v1)
    const rawPath = event.rawPath || event.path || '/';

    // Strip leading '/api' prefix exactly once
    let subPath = rawPath.replace(/^\/?api(?=\/|$)/, '');
    if (!subPath || !subPath.startsWith('/')) {
      subPath = '/' + subPath;
    }

    // 3. Extract query parameters
    let queryString = '';
    if (event.rawQueryString) {
      queryString = '?' + event.rawQueryString;
    } else if (event.queryStringParameters) {
      const qs = new URLSearchParams(event.queryStringParameters).toString();
      if (qs) queryString = '?' + qs;
    }

    // Construct target URL: preserves '/prod' from API_BASE and appends subPath + query
    const targetUrl = `${apiBase}${subPath}${queryString}`;

    // 4. Build server-side headers
    const headers = {
      'content-type': 'application/json'
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // 5. Handle request body & review token adaptation
    let body = event.body;
    if (event.isBase64Encoded && body) {
      body = Buffer.from(body, 'base64').toString('utf8');
    }

    const isReview = (subPath === '/review' || subPath.startsWith('/review?')) && method === 'POST';
    if (isReview && reviewToken) {
      // Send both the x-review-token header and ensure body has reviewToken
      headers['x-review-token'] = reviewToken;

      if (body) {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.reviewToken) {
            parsed.reviewToken = reviewToken;
          }
          body = JSON.stringify(parsed);
        } catch {
          // Keep raw body if not JSON
        }
      }
    }

    // 6. Forward request to upstream API Gateway
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
        ...CORS_HEADERS,
        'content-type': responseContentType
      },
      body: responseText
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        ...CORS_HEADERS,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Proxy Error',
        message: err.message || 'Failed to communicate with backend API Gateway.'
      })
    };
  }
}
