// Dependency-free local development server: npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import handler from './api/generate.js';

const root = resolve('.');
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/generate') {
    let payload = '';
    try {
      for await (const chunk of req) {
        payload += chunk;
        if (payload.length > 400000) { res.writeHead(413); res.end('Request too large'); return; }
      }
      req.body = JSON.parse(payload || '{}');
      res.status = code => ({ json: data => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); } });
      await handler(req, res);
    } catch (error) {
      if (!res.headersSent) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Invalid request.' } })); }
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
  let name;
  try { name = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad request'); return; }
  const target = resolve(root, `.${name === '/' ? '/index.html' : name}`);
  if (target !== root && !target.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (target.includes(`${sep}.env`) || target.includes(`${sep}node_modules${sep}`) || target.includes(`${sep}tests${sep}`) || target.includes(`${sep}lib${sep}`) || target.endsWith('server.mjs')) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    if (!(await stat(target)).isFile()) throw new Error('Not found');
    const contents = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else res.end(contents);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, () => console.log(`Arno is running at http://localhost:${port}`));
