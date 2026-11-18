import { existsSync, mkdirSync, readdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceHtml = path.join(projectDir, 'index.html');
const publicDir = path.join(projectDir, 'public');
const outputDir = path.join(projectDir, 'dist');

if (!existsSync(sourceHtml)) {
  console.error('빌드 실패: 루트 폴더에 index.html 파일이 없습니다.');
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(sourceHtml, path.join(outputDir, 'index.html'));

if (existsSync(publicDir)) {
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'index.html') {
      console.error('빌드 실패: public/index.html은 루트 index.html과 중복됩니다.');
      process.exit(1);
    }
    cpSync(path.join(publicDir, entry.name), path.join(outputDir, entry.name), { recursive: true });
  }
}
console.log('빌드 성공: dist/index.html 및 public 정적 파일 준비 완료');
