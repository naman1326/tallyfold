import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// DEV-ONLY gateway: keeps API_KEY and REVIEW_TOKEN on the server side of the dev process.
// In production on AWS Amplify, the serverless proxy in /proxy handles this upstream forwarding.
function gateway(env: Record<string, string>): Plugin {
  return {
    name: 'gateway',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          let body: string | undefined = chunks.length ? Buffer.concat(chunks).toString() : undefined;

          // Connect middleware strips the mount path '/api', so req.url starts at '/expenses', '/upload', etc.
          // Safely strip any redundant leading '/api' prefix exactly once
          const rawUrl = req.url || '/';
          const subPath = rawUrl.replace(/^\/?api(?=\/|$)/, '') || '/';
          const normalizedPath = subPath.startsWith('/') ? subPath : '/' + subPath;

          const isReview = (req.method || '').toUpperCase() === 'POST' && (normalizedPath === '/review' || normalizedPath.startsWith('/review?'));

          const targetBase = (env.API_BASE || 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod').replace(/\/+$/, '');
          const targetUrl = `${targetBase}${normalizedPath}`;

          const headers: Record<string, string> = {
            'content-type': 'application/json',
            'x-api-key': env.API_KEY || '',
          };

          if (isReview) {
            if (env.REVIEW_TOKEN) {
              headers['x-review-token'] = env.REVIEW_TOKEN;
            }
            if (body) {
              try {
                const parsed = JSON.parse(body);
                if (env.REVIEW_TOKEN && !parsed.reviewToken) {
                  parsed.reviewToken = env.REVIEW_TOKEN;
                }
                body = JSON.stringify(parsed);
              } catch {
                // Keep original body if not JSON
              }
            }
          }

          const r = await fetch(targetUrl, {
            method: req.method,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
            headers,
          });

          res.statusCode = r.status;
          res.setHeader('content-type', r.headers.get('content-type') || 'application/json');
          res.end(await r.text());
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Gateway error: ' + (e as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), gateway(loadEnv(mode, process.cwd(), ''))],
  test: { environment: 'node' },
}));
