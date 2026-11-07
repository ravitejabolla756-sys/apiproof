import http from 'node:http';
import path from 'node:path';

// Keep the production build and request handling path while retaining the
// explicit test runtime contract required by the hermetic SQLite fixture.
// `next start` overwrites NODE_ENV with production, which correctly rejects
// SQLite but cannot serve this browser-test fixture.
Reflect.set(process.env, 'NODE_ENV', 'test');

const next = (await import('next')).default;
const hostname = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');
const app = next({
  dev: false,
  dir: path.resolve(process.cwd(), 'apps/web'),
  hostname,
  port,
});
// Next initializes a non-development app as production during construction.
// Restore the explicit test contract before instrumentation and route modules
// are evaluated so the hermetic SQLite adapter remains available.
Reflect.set(process.env, 'NODE_ENV', 'test');
const handle = app.getRequestHandler();

await app.prepare();

const server = http.createServer((request, response) => {
  void handle(request, response);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.listen(port, hostname, () => {
  console.log(`Playwright server listening on http://${hostname}:${port}`);
});
