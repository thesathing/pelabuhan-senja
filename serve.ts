import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./game/', import.meta.url));
const mime: Record<string,string> = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const name = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Pelabuhan Senja at http://localhost:' + (process.env.PORT || 8080)));
