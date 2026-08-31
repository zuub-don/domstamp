import http from 'node:http';
import { scenarioNames, renderScenario } from './scenarios.mjs';

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '0.0.0.0';
const originName = process.env.ORIGIN_NAME ?? 'local';
const peerOrigin = process.env.PEER_ORIGIN ?? `http://127.0.0.1:${port}`;

const send = (response, status, body, contentType = 'text/plain; charset=utf-8', headers = {}) => {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    ...headers
  });
  response.end(body);
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (url.pathname === '/healthz') {
    return send(response, 200, JSON.stringify({ ok: true, originName }), 'application/json');
  }

  if (url.pathname === '/manifest.json') {
    return send(
      response,
      200,
      JSON.stringify({ version: 1, originName, scenarios: scenarioNames }),
      'application/json'
    );
  }

  if (url.pathname === '/api/data') {
    const seed = Number(url.searchParams.get('seed') ?? 1);
    const delay = Math.min(Number(url.searchParams.get('delay') ?? 0), 5_000);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return send(
      response,
      200,
      JSON.stringify({ id: seed * 17, label: `record-${seed}`, originName }),
      'application/json'
    );
  }

  if (url.pathname === '/api/chaos') {
    const seed = Number(url.searchParams.get('seed') ?? 1);
    const fault = url.searchParams.get('fault') ?? 'ok';
    if (fault === 'delay') await new Promise((resolve) => setTimeout(resolve, 75));
    if (fault === 'disconnect') {
      response.destroy();
      return;
    }
    if (fault === 'truncate') {
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': '1000',
        'cache-control': 'no-store'
      });
      response.end(`{"seed":${seed}`);
      return;
    }
    if (fault === 'status') {
      return send(response, 503, JSON.stringify({ ok: false, seed }), 'application/json');
    }
    return send(response, 200, JSON.stringify({ ok: true, seed, originName }), 'application/json');
  }

  if (url.pathname === '/frame/nested') {
    const seed = Number(url.searchParams.get('seed') ?? 1);
    const depth = Math.max(0, Math.min(Number(url.searchParams.get('depth') ?? 0), 8));
    const child = depth > 0
      ? `<iframe title="frame-depth-${depth - 1}" src="/frame/nested?seed=${seed + 1}&amp;depth=${depth - 1}"></iframe>`
      : '';
    return send(
      response,
      200,
      `<!doctype html><html><body data-origin="${originName}" data-depth="${depth}"><h2>Frame ${originName}</h2><label>Frame input <input id="frame-input" value="frame-${seed}"></label>${child}</body></html>`,
      'text/html; charset=utf-8',
      { 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'" }
    );
  }

  const match = url.pathname.match(/^\/scenario\/([a-z0-9-]+)$/);
  if (match) {
    const name = match[1];
    if (!name || !scenarioNames.includes(name)) return send(response, 404, 'unknown scenario');
    const seed = Number(url.searchParams.get('seed') ?? 1);
    return send(
      response,
      200,
      renderScenario(name, { seed, originName, peerOrigin }),
      'text/html; charset=utf-8'
    );
  }

  return send(response, 404, 'not found');
});

server.listen(port, host, () => {
  console.log(`domstamp gym ${originName} listening on http://${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
