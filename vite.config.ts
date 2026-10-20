import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// DEV-ONLY gateway: keeps API_KEY and REVIEW_TOKEN on the server side of the dev process.
// Production needs an equivalent (CloudFront + Lambda/BFF with real user auth). See README.
function gateway(env: Record<string, string>): Plugin {
  return {
    name: 'gateway',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          let body: string | undefined = chunks.length ? Buffer.concat(chunks).toString() : undefined;
          const path = req.url || '/';
          if (req.method === 'POST' && path.startsWith('/review') && body)
            body = JSON.stringify({ ...JSON.parse(body), reviewToken: env.REVIEW_TOKEN || '' });
          const r = await fetch((env.API_BASE || '') + path, {
            method: req.method, body,
            headers: { 'content-type': 'application/json', 'x-api-key': env.API_KEY || '' },
          });
          res.statusCode = r.status;
          res.setHeader('content-type', 'application/json');
          res.end(await r.text());
        } catch (e) {
          res.statusCode = 502;
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
