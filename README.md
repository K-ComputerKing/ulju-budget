# 울주온살림 v73 — 안정형 분리 소스 / CloudType 배포

## 무엇이 달라졌나요?

원본: `ulju_onsalim_v73_budget_selection_spacing.html` (5,989,310 bytes)

기존 분리본은 브라우저에서 JSON을 10번 `fetch`하여 나중에 실행했습니다. 이 패키지는 **HTML/CSS/JavaScript/JSON을 분리하여 관리하되 `npm run build` 시 원본 v73 HTML을 정확하게 복원**합니다. 런타임에는 별도의 CSS·JS·JSON 네트워크 요청이 필요 없습니다. 로컬에서 작동하던 원본 HTML과 **SHA-256이 바이트 단위로 동일**함을 자동으로 검증합니다.

- 원본 HTML SHA-256: `0b3d1a3b65c414b85f13e7a8be0251f5bb61f37db84da82c1a115261966bb996`
- `npm run build`: `dist/index.html` 및 `dist/version.json` 생성
- `npm run verify`: v73 원본과 빌드 결과 일치 / JSON 10개 검사
- `npm start`: 클라우드가 지정한 `PORT` 또는 3000에서 정적 웹서버 시작
- `/healthz`: 서비스 상태 확인, `/version.json`: 배포 버전·빌드 시각·커밋 정보 확인
- HTML 응답에 `Cache-Control: no-store` 적용 (브라우저가 이전 HTML을 재사용하는 문제 완화)

## 파일 구조

```text
ulju-v73-reliable-deploy/
├── index.html                  # 원본 화면 마크업, 분리 파일의 자리표시자
├── package.json
├── package-lock.json
├── .nvmrc                      # Node.js 20
├── .gitignore
├── split-manifest.json         # 분리 파일 SHA-256 및 원본 일치 기준
├── README.md
├── GEMINI_HANDOFF_V73.md
└── src/
    ├── build.mjs              # 배포 전 CSS/JS/JSON을 정확히 원본에 삽입
    ├── verify.mjs             # 데이터 및 출력 파일 검증
    ├── server.mjs             # Node.js HTTP 웹서버
    ├── styles/app.css
    ├── scripts/
    │   ├── 01-app-core.js
    │   ├── 02-jszip-3.10.1.js
    │   ├── 03-imports.js
    │   └── 04-search-link.js
    └── data/                  # 원본 예산/집행/과거연도 JSON 10개
```

**중요:** 루트의 `index.html`은 빌드용 *소스 템플릿*이므로 더블클릭해서 열면 안 됩니다. 실제 접속 파일은 `dist/index.html`입니다. CloudType은 반드시 `npm run build`를 실행해야 합니다.

## Windows CMD — 올바른 로컬 폴더

**정확한 경로는 `C:\Users\UIju\ulju-budget`입니다. `ulji-budget`이 아닙니다.**

1. 기존 `C:\Users\UIju\ulju-budget` 폴더를 먼저 백업합니다.
2. ZIP 압축을 풀고 **그 안의 파일/폴더 전체를** `C:\Users\UIju\ulju-budget`에 복사하여 `index.html`과 `package.json`을 덮어씁니다. 폴더를 통째로 넣어 `ulju-budget\ulju-v73-reliable-deploy\index.html`이 되는 상황을 피하세요.
3. `.git` 폴더는 삭제하거나 덮어쓰지 않습니다.

```cmd
cd /d C:\Users\UIju\ulju-budget
dir package.json
dir src\build.mjs
npm ci
npm run build
npm run verify
npm start
```

브라우저에서 `http://localhost:3000` 및 `http://localhost:3000/version.json`을 확인합니다. 버전 파일의 `version`이 `v73`이어야 합니다. 서버 종료는 CMD에서 `Ctrl+C`입니다.

## GitHub에 최신 소스 반영

**먼저 내부 예산·집행 자료를 외부에 공개해도 되는지 조직 승인을 확인하세요.** 이 ZIP은 원본 데이터를 그대로 보존한 *내부 작업본*이며 공개용 비식별 버전이 아닙니다.

승인을 받았다면 해당 폴더에서:

```cmd
cd /d C:\Users\UIju\ulju-budget
git remote -v
git status
git add -A
git commit -m "Deploy ulju-onsalim v73 reliable build"
git push origin main
git log -1 --oneline
git ls-remote origin refs/heads/main
```

- `git status`에서 변경 파일이 전혀 없으면 **압축을 잘못 푼 경우**일 수 있습니다. 로컬 `index.html`, `src/build.mjs`, `package.json`의 위치를 확인하세요.
- `nothing to commit`은 이미 커밋되었거나 파일 복사가 안 되었을 때 나타날 수 있습니다. `git log -1`과 `git status`를 함께 확인하세요.
- `git push`가 성공한 뒤 GitHub 웹사이트에서 최신 커밋 메시지가 보이는지 확인하세요.
- 이전 분리본의 `public/assets/`가 GitHub에 남아 있다면, 이전 데이터가 그대로 저장소에 공개될 수 있습니다. 백업 및 영향 확인 후 정리하고, Git 기록에 들어간 민감정보도 별도 처리해야 합니다.

## CloudType 설정

| 항목 | 값 |
|---|---|
| 저장소 | `K-ComputerKing/ulju-budget` |
| 브랜치 | `main` |
| 배포 유형 | Node.js (Static HTML이 아님) |
| Node.js 버전 | 20 이상 |
| 프로젝트/서브디렉터리 | 저장소 루트 |
| 설치 | `npm ci` |
| 빌드 | `npm run build` |
| 시작 | `npm start` |
| 포트 | `3000` 또는 CloudType 지정 `PORT` |
| 헬스체크 | `/healthz` |

CloudType 프로젝트의 GitHub 연결 저장소와 브랜치가 정확히 `K-ComputerKing/ulju-budget` / `main`인지 확인합니다. 자동 배포가 해제되어 있다면 **최신 커밋으로 수동 재배포**합니다. 

배포 후 새 도메인에서 다음 두 주소를 열어 확인합니다.

```text
https://<CloudType-도메인>/version.json
https://<CloudType-도메인>/healthz
```

`version.json`의 `version: "v73"`과 `originalHtmlSha256`가 위 원본 SHA와 일치해야 이번 코드가 배포된 것입니다. 이전 파일이 표시되면 CloudType에서 어떤 커밋을 배포했는지 먼저 확인합니다. 오류가 지속되면 CloudType **빌드 로그 끝 20~30줄**과 `git log -1 --oneline` 출력을 함께 살핍니다.

## 배포·보안 유의사항

이 프로젝트의 `src/data/*.json`에는 원본 내부 예산·지출 적요가 포함되어 있을 수 있습니다. 데이터를 `src`로 분리했어도 **빌드 시 HTML 안에 다시 합쳐지므로 공개 사이트 접속자는 데이터를 볼 수 있습니다.** GitHub 저장소 비공개 설정만으로 공개 CloudType 페이지의 정보를 보호할 수 없습니다. 조직 승인을 받기 전에는 공개 배포하지 마세요. 공개용으로 운영하려면 별도의 데이터 비식별화나 인증·서버측 접근제어가 필요합니다.

브라우저 `localStorage`에 저장하는 사용자 입력은 기존처럼 해당 브라우저에만 저장됩니다. 다른 컴퓨터와 자동 동기화되는 공유 데이터베이스 기능은 아닙니다.

## 검증 수준

테스트 완료: `npm ci`, `npm run build`, `npm run verify`, JavaScript 문법, 서버의 `/`, `/healthz`, `/version.json` HTTP 응답. 원본 `index.html`과 최종 빌드의 바이트 단위 일치 확인. 단, 테스트 환경의 브라우저 네트워크 제한으로 **클릭·입력 등 실제 브라우저 상호작용 검증은 수행하지 못했습니다.**
