// PELABUHAN SENJA — tiny static server for local play-testing.
//
// Serves game/ on http://localhost:8080 (or --port <n>). Node 22 standard
// library only, no dependencies. It never serves a path outside game/, and
// it sends the content types a browser game needs. Development convenience
// only — not a server for the open internet.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function pickPort(argv: string[]): number {
  const at = argv.indexOf('--port');
  const wanted = at === -1 ? 8080 : Number(argv[at + 1]);
  return Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const port = pickPort(process.argv.slice(2));

createServer((req, res) => {
  const raw = req.url ?? '/';
  let path: string;
  try {
    path = decodeURIComponent(new URL(raw, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(gameRoot, normalize(path)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let size: number;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`PELABUHAN SENJA — game/ is on http://localhost:${port}`);
});
