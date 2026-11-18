# Gemini 인수인계 — 울주온살림 v73 안정형 분리·배포

## 원칙
- 최신 소스 기준: `ulju_onsalim_v73_budget_selection_spacing.html` (v65가 아님)
- 정확한 사용자 PC 경로: `C:\Users\UIju\ulju-budget` (`ulji-budget` 표기는 오기)
- GitHub: `https://github.com/K-ComputerKing/ulju-budget`
- 배포: CloudType Node.js (Node 20 이상), main 브랜치
- 목적: 원본 v73의 화면·기능·데이터를 유지한 채 재배포 업데이트 문제 해결

## 현재 구현
이 ZIP에서는 HTML/CSS/4개 JavaScript/10개 JSON 데이터가 파일로 분리되어 있습니다. `index.html`은 **소스 템플릿**이고, `src/build.mjs`가 원본 파일의 각 부분을 원위치에 끼워 넣어 **정확히 원본과 같은** `dist/index.html`을 만듭니다. 브라우저에서 JSON을 순차/병렬 fetch 하지 않으며 런타임 스크립트 동기화 문제가 없습니다.

- `npm ci`
- `npm run build`
- `npm run verify`
- `npm start`
- `http://localhost:3000/`
- `http://localhost:3000/version.json`

원본 SHA-256이 `0b3d1a3b65c414b85f13e7a8be0251f5bb61f37db84da82c1a115261966bb996`이며 `npm run verify`가 동일성 검증을 합니다. `/healthz`와 `/version.json`을 서버가 제공합니다. CloudType 빌드 명령이 반드시 실행되어야 하며 소스 템플릿을 직접 서빙하면 실패합니다.

## 수정 시 주의
1. 원본과 동일한 빌드를 유지하려면 `src/styles`, `src/scripts`, `src/data`, `index.html`을 직접 수정한 뒤 **매니페스트 파일 해시 및 예상 최종 HTML 해시도 변경하여 검증**해야 합니다. 현재 빌드 도구는 v73 원본과 동일함을 보장하므로 임의 수정은 의도적으로 검증 실패합니다. 향후 개발을 위해 빌더를 변경할 때에는 원본 보존 모드와 개발 모드를 명확히 구분하세요.
2. 기능 재작성이나 데이터 삭제를 임의로 하지 말고, 프로젝트 내용과 사용자가 요청한 수정 범위를 먼저 비교하세요.
3. CloudType 자동 배포가 안 된다면 로컬 `git log -1`, 원격 `main` SHA, CloudType 배포 대상 커밋 및 `/version.json` 값을 비교하세요.
4. 소스 파일을 `C:\Users\UIju\ulju-budget`의 최상위에 덮어쓰세요. 하위 `ulju-v73-reliable-deploy` 폴더에만 두면 기존 프로젝트가 업데이트되지 않습니다.
5. 이전 분리 패키지의 `public/assets/`가 GitHub에 남았는지도 확인하세요.

## 보안
원본 HTML에는 공개 부적절할 수 있는 내부 지출 적요 및 실제 예산 정보가 포함되어 있습니다. 이 배포 빌드는 이를 그대로 재구성하므로 *공개용 안전 버전이 아닙니다*. 소스와 JSON을 외부 AI 서비스에 업로드하는 행위 자체도 조직의 정보 처리 규정을 확인해야 합니다. 승인 없이 GitHub 공개 저장소/공개 CloudType으로 배포하지 마세요. 실제 사용자들의 브라우저 localStorage 저장은 자동 공유가 아닙니다.

## 요청할 작업 순서
- ZIP의 소스와 매니페스트 확인
- `npm run build`와 `npm run verify` 실행
- 정상 화면·예산 선택·화면 간격·검색·예산 및 집행관리 기능 브라우저 테스트
- 로컬 경로 확인 및 원격 `main` 커밋과 CloudType 배포 대상 커밋 비교
- CloudType 배포 후 `/version.json`에서 `v73` 확인
- 실패하면 빌드 로그와 실행 로그를 받아 수정본 ZIP 생성
