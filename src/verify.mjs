import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'split-manifest.json'), 'utf8'));
const dist = readFileSync(join(root, 'dist/index.html'));
const actual = createHash('sha256').update(dist).digest('hex');
if (actual !== manifest.original_html_sha256 || dist.byteLength !== manifest.original_html_bytes) {
  throw new Error(`검증 실패: 원본 v73 SHA256와 다름. ${actual}`);
}
if (dist.toString('utf8').includes('__ULJU_DATA_') || dist.toString('utf8').includes('__ULJU_SCRIPT_')) {
  throw new Error('검증 실패: 자리표시자가 남아 있습니다.');
}
const jsons = manifest.parts.filter((entry) => entry.kind === 'data');
for (const entry of jsons) JSON.parse(readFileSync(join(root, entry.file), 'utf8'));
const version = JSON.parse(readFileSync(join(root, 'dist/version.json'), 'utf8'));
if (version.originalHtmlSha256 !== actual || version.version !== manifest.version) throw new Error('검증 실패: 버전 파일이 일치하지 않습니다.');
console.log(`PASS: 원본 ${manifest.version} HTML과 바이트 단위 일치 (${dist.byteLength.toLocaleString('en-US')} bytes)`);
console.log(`PASS: JSON 데이터 ${jsons.length}개 유효`);
console.log(`PASS: 공개 버전 확인 파일 dist/version.json`);
