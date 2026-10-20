/**
 * Standalone Node.js Proxy Server
 * Can be run locally with: node proxy/server.js
 * or containerized on ECS, App Runner, or EC2.
 */

import http from 'http';
import { handler } from './handler.js';

const PORT = process.env.PORT || 3001;

export const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  const event = {
    rawPath: url.pathname,
    rawQueryString: url.search ? url.search.substring(1) : '',
    httpMethod: req.method,
    headers: req.headers,
    body
  };

  const result = await handler(event);

  res.statusCode = result.statusCode;
  if (result.headers) {
    for (const [key, val] of Object.entries(result.headers)) {
      res.setHeader(key, val);
    }
  }
  res.end(result.body);
});

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  server.listen(PORT, () => {
    console.log(`Tallyfold API proxy listening on http://localhost:${PORT}`);
  });
}

export default server;
