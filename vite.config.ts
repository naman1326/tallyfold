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

          if (normalizedPath.startsWith('/receipt-url') || normalizedPath.startsWith('/receipt-image')) {
            const urlObj = new URL(rawUrl, 'http://localhost');
            const s3Key = (urlObj.searchParams.get('key') || urlObj.searchParams.get('s3Key') || '').trim();
            if (!s3Key || !/^uploads\/[a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+\.(jpg|jpeg|png)$/i.test(s3Key)) {
              res.statusCode = 400;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'Bad Request', message: 'Valid s3Key parameter is required.' }));
              return;
            }

            try {
              const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
              const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
              const s3 = new S3Client({ region: env.AWS_REGION || 'eu-north-1' });
              const cmd = new GetObjectCommand({
                Bucket: env.RECEIPTS_BUCKET || 'receipts-510821108145-us-east-1',
                Key: s3Key,
              });
              const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });

              if (normalizedPath.startsWith('/receipt-image')) {
                res.statusCode = 307;
                res.setHeader('Location', presignedUrl);
                res.setHeader('Cache-Control', 'private, max-age=800');
                res.end('Redirecting to presigned image URL');
                return;
              }

              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.setHeader('Cache-Control', 'private, max-age=800');
              res.end(JSON.stringify({ url: presignedUrl, key: s3Key, expiresIn: 900 }));
              return;
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'S3 Error', message: (err as Error).message }));
              return;
            }
          }

          const isReview = (req.method || '').toUpperCase() === 'POST' && (normalizedPath === '/review' || normalizedPath.startsWith('/review?'));

          const targetBase = (env.API_BASE || 'https://vec4q0sqc9.execute-api.eu-north-1.amazonaws.com/prod').replace(/\/+$/, '');
          const targetUrl = `${targetBase}${normalizedPath}`;

          const headers: Record<string, string> = {
            'content-type': 'application/json',
            'x-api-key': env.API_KEY || '',
          };

          if (isReview && env.REVIEW_TOKEN) {
            headers['x-review-token'] = env.REVIEW_TOKEN;
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
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', '.aws-sam/**'],
  },
}));
