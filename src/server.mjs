import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectDir, 'dist');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
const versionFile = join(outputDir, 'version.json');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 값이 올바르지 않습니다.');
if (!existsSync(join(outputDir, 'index.html')) || !existsSync(versionFile)) {
  throw new Error('dist/가 준비되지 않았습니다. 먼저 npm run build를 실행하세요.');
}
const version = JSON.parse(readFileSync(versionFile, 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-ULJU-Version', version.version);
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!['GET','HEAD'].includes(request.method || '')) {
    response.writeHead(405, {'Allow':'GET, HEAD'}); return response.end('Method Not Allowed');
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); return response.end('Bad Request'); }
  if (pathname === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end(request.method === 'HEAD' ? undefined : 'ok');
  }
  if (pathname === '/version') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end(request.method === 'HEAD' ? undefined : `${version.version} ${version.originalHtmlSha256.slice(0,12)}`);
  }
  const target = resolve(outputDir, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(outputDir + sep) || (pathname !== '/' && !['/index.html','/version.json'].includes(pathname))) {
    response.writeHead(404); return response.end('Not Found');
  }
  let stat;
  try { stat = statSync(target); } catch { /* 파일이 없으면 404 */ }
  if (!stat?.isFile()) { response.writeHead(404); return response.end('Not Found'); }
  response.writeHead(200, {'Content-Type':types[extname(target)] || 'application/octet-stream','Content-Length':stat.size});
  if (request.method === 'HEAD') return response.end();
  return createReadStream(target).pipe(response);
});
server.listen(port, host, () => console.log(`울주온살림 ${version.version}: http://${host}:${port} /version.json`));
