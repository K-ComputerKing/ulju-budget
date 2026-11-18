import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(projectDir, relative));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const manifest = JSON.parse(read('split-manifest.json').toString('utf8'));
let html = read('index.html').toString('utf8');

for (const item of manifest.parts) {
  if (!/^[\w./-]+$/.test(item.file) || item.file.includes('..') || !item.file.startsWith('src/')) {
    throw new Error(`잘못된 파일 경로: ${item.file}`);
  }
  const content = read(item.file);
  if (hash(content) !== item.sha256 || content.byteLength !== item.bytes) {
    throw new Error(`분리 파일이 변경되었습니다: ${item.file}. 해시 검증을 다시 진행하세요.`);
  }
  if (item.kind === 'data') JSON.parse(content.toString('utf8'));
  const parts = html.split(item.marker);
  if (parts.length !== 2) throw new Error(`HTML 자리표시자 오류: ${item.marker}`);
  html = parts[0] + content.toString('utf8') + parts[1];
}

const finalHtml = Buffer.from(html, 'utf8');
const finalHash = hash(finalHtml);
if (finalHash !== manifest.original_html_sha256 || finalHtml.byteLength !== manifest.original_html_bytes) {
  throw new Error(`v73 원본 복원 실패. 기대 SHA256=${manifest.original_html_sha256}, 실제=${finalHash}`);
}

const outputDir = join(projectDir, 'dist');
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'index.html'), finalHtml);

let gitCommit = null;
try {
  gitCommit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim() || null;
} catch { /* Git 메타데이터가 없는 ZIP 배포도 허용 */ }

const version = {
  app: 'ulju-onsalim',
  version: manifest.version,
  originalHtmlSha256: finalHash,
  generatedAt: new Date().toISOString(),
  gitCommit,
  notes: 'v73 HTML 원본을 분리 소스에서 바이트 단위로 동일하게 복원한 결과',
};
writeFileSync(join(outputDir, 'version.json'), JSON.stringify(version, null, 2) + '\n');
console.log(`완료: 울주온살림 ${manifest.version}, dist/index.html ${(finalHtml.byteLength / 1024 / 1024).toFixed(2)} MiB`);
console.log(`SHA-256: ${finalHash}`);
console.log('배포 확인 주소: https://<CloudType-도메인>/version.json');
