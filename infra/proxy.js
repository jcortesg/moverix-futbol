'use strict';

const http = require('http');
const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth();

const BACKENDS = {
  'api-ftb.moverix.co':   process.env.API_URL   || 'https://moverix-api-production-emmug3ztxq-uc.a.run.app',
  'admin-ftb.moverix.co': process.env.ADMIN_URL  || 'https://moverix-admin-production-emmug3ztxq-uc.a.run.app',
  'futbol.moverix.co':    process.env.ADMIN_URL  || 'https://moverix-admin-production-emmug3ztxq-uc.a.run.app',
};

// Keep-alive agent for Cloud Run connections
const agent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 60000 });

// Token cache per audience (refresh 5 min before expiry)
const tokenCache = new Map();

async function getIdToken(audience) {
  const cached = tokenCache.get(audience);
  if (cached && cached.expires > Date.now() + 5 * 60_000) {
    return cached.token;
  }
  const client = await auth.getIdTokenClient(audience);
  const headers = await client.getRequestHeaders(audience);
  const token = headers['Authorization'];
  tokenCache.set(audience, { token, expires: Date.now() + 55 * 60_000 });
  console.log(`[token] refreshed for ${audience}`);
  return token;
}

function proxyRequest(req, res, target, authToken, retries = 1) {
  const url = new URL(target);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: req.url,
    method: req.method,
    agent,
    headers: {
      ...req.headers,
      host: url.hostname,
      'X-Serverless-Authorization': authToken,
      'X-Forwarded-Host': req.headers.host,
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': req.socket.remoteAddress,
    },
  };

  // Remove hop-by-hop headers
  delete options.headers['connection'];
  delete options.headers['upgrade'];

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if ((err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') && retries > 0) {
      console.log(`[proxy] ${err.code} for ${req.url}, retrying...`);
      setTimeout(() => proxyRequest(req, res, target, authToken, retries - 1), 500);
      return;
    }
    console.error(`[proxy error] ${err.code || err.message} for ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Bad Gateway');
  });

  // Pipe request body
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === '/__health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  const host = (req.headers.host || '').split(':')[0];
  const target = BACKENDS[host] || BACKENDS['api-ftb.moverix.co'];

  try {
    const authToken = await getIdToken(target);
    proxyRequest(req, res, target, authToken);
  } catch (err) {
    console.error('[token error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Bad Gateway');
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`Cloud Run Proxy listening on :${PORT}`)
);
