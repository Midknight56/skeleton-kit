// A small static server for the browser tests. It serves dist/ and nothing else.
// A path that ends in / or names a folder gets that folder's index.html.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const dist = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let path = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (path !== dist && !path.startsWith(dist + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    path = join(path, 'index.html');
  }
  if (!existsSync(path)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(readFileSync(path));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`serving dist/ on http://127.0.0.1:${port}\n`);
});
