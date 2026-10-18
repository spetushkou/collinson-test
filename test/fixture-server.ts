import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

export type Endpoint = 'geocoding' | 'forecast' | 'marine';

export interface FixtureServer {
  baseUrl: string;
  calls: string[];
  fail: Set<Endpoint>;
  close(): Promise<void>;
}

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'test/fixtures', `${name}.json`), 'utf8');

// Stands in for all three Open-Meteo hosts, answering from the captured fixtures. Weather
// calls are routed by the latitude the service sends, which is the geocoder's own answer.
function route(url: URL): { endpoint: Endpoint; body: string } | null {
  const q = url.searchParams;
  if (url.pathname === '/v1/search') {
    const name = (q.get('name') ?? '').toLowerCase();
    const country = q.get('countryCode');
    const file =
      name === 'paris'
        ? country === 'US'
          ? 'geocode-paris-us'
          : 'geocode-paris'
        : name === 'lisbon'
          ? 'geocode-lisbon'
          : 'geocode-unknown';
    return { endpoint: 'geocoding', body: fixture(file) };
  }
  const city = (q.get('latitude') ?? '').startsWith('48.85')
    ? 'paris'
    : (q.get('latitude') ?? '').startsWith('38.72')
      ? 'lisbon'
      : null;
  if (url.pathname === '/v1/forecast' && city) {
    return { endpoint: 'forecast', body: fixture(`forecast-${city}`) };
  }
  if (url.pathname === '/v1/marine' && city) {
    return { endpoint: 'marine', body: fixture(`marine-${city}`) };
  }
  return null;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const calls: string[] = [];
  const fail = new Set<Endpoint>();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fixture');
    calls.push(url.pathname);
    const hit = route(url);
    if (!hit) {
      res.writeHead(404).end();
      return;
    }
    if (fail.has(hit.endpoint)) {
      res.writeHead(503).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(hit.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    fail,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
