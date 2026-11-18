import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT 환경변수가 유효한 숫자가 아닙니다.');
  process.exit(1);
}
if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/index.html이 없습니다. 먼저 npm run build 를 실행하세요.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : 'ok');
    return;
  }

  const requestedFile = urlPath === '/' ? '/index.html' : urlPath;
  const target = path.resolve(distDir, '.' + requestedFile);
  if (!target.startsWith(distDir + path.sep) || path.basename(target).startsWith('.')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let stat;
  try { stat = statSync(target); } catch { /* not found */ }
  if (!stat?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(target).pipe(res);
});
server.listen(port, host, () => console.log(`울주온살림 웹서버 실행: http://${host}:${port}`));
