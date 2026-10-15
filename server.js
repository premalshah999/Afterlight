import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './src/api.js';
import { authentication } from './src/auth.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.env.AFTERLIGHT_DATA ?? path.join(root, '.afterlight/state.json'));
const store = {
  async get() { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
  async set(state) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(`${file}.tmp`, JSON.stringify(state), { mode: 0o600 }); await rename(`${file}.tmp`, file); },
};
let queue = Promise.resolve();
const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", 'Cache-Control': 'no-cache' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`);
    if (url.pathname === '/healthz' || url.pathname === '/version') { res.writeHead(200, { ...security, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(url.pathname === '/version' ? { revision: process.env.ATLAS_REVISION ?? 'development' } : { status: 'ok', service: 'afterlight' })); }
    if (url.pathname.startsWith('/api/')) {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 25000) { res.writeHead(413); return res.end(); } }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(raw ? { body: raw } : {}) });
      const operation = async () => { const auth = await authentication(request, process.env); return auth.response ?? api(request, store); };
      const result = queue.then(operation); queue = result.catch(() => {});
      const response = await result; res.writeHead(response.status, { ...security, ...Object.fromEntries(response.headers) }); return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
    const asset = assets[url.pathname];
    if (!asset) { res.writeHead(404, security); return res.end('Not found'); }
    res.writeHead(200, { ...security, 'Content-Type': `${asset[1]}; charset=utf-8` });
    res.end(req.method === 'HEAD' ? '' : await readFile(path.join(root, 'public', asset[0])));
  } catch { res.writeHead(500); res.end('Server error'); }
});
server.listen(Number(process.env.PORT ?? 4321), '127.0.0.1', () => console.log(`Afterlight → http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
