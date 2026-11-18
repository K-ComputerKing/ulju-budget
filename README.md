# 울주온살림 v73 — CloudType 배포형 분리 프로젝트

원본 파일: `ulju_onsalim_v73_budget_selection_spacing.html`  
원본 기능을 최대한 유지하면서 CSS, JavaScript, **10개 JSON 데이터**를 실제 별도 파일로 분리했습니다. 프레임워크가 없는 Node.js 정적 서버 방식이므로 Vite/React를 설치할 필요가 없습니다.

## 폴더 구조

```text
ulju-v73-cloudtype-split/
├── index.html                  # UI HTML 구조, JSON 데이터 자리표시자
├── package.json
├── package-lock.json
├── .nvmrc
├── .gitignore
├── split-manifest.json         # 원본/분리된 데이터 파일 SHA-256 및 목록
├── public/
│   └── assets/
│       ├── styles.css          # HTML에서 CSS 분리
│       ├── bootstrap.js        # 10개 JSON 로드 후 앱 스크립트 순서대로 시작
│       ├── data/               # 예산/집행/과거연도/페이지/벡터 등 JSON 10개
│       └── scripts/
│           ├── 01-app.js
│           ├── 02-jszip-3.10.1.js
│           ├── 03-execution-imports.js
│           └── 04-search-bridge.js
└── src/
    ├── build.js               # dist/ 생성
    └── server.js              # HTTP 서버 (PORT 환경변수 지원)
```

## Windows CMD 로컬 테스트

압축을 풀고 해당 폴더에서 CMD 실행:

```cmd
npm ci
npm run build
npm start
```

브라우저 `http://localhost:3000`에서 확인하세요. 종료는 `Ctrl+C`입니다.  
**주의:** JSON을 `fetch()`로 불러오므로 파일을 더블클릭한 `file:///` 방식으로는 작동하지 않습니다. HTTP 서버로 실행해야 합니다.

## CloudType

- 종류/프리셋: **Node.js** (React/Vite 아님)
- Node 버전: **20** 이상
- 브랜치: `main`
- 저장소: `K-ComputerKing/ulju-budget`
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm start`
- Port: `3000` (CloudType이 `PORT`를 지정하면 그 값이 우선)
- 서브 디렉터리: 저장소 루트에 파일을 놓으면 비움
- Health check: `/healthz`

## 기존 GitHub 프로젝트 갱신

기존 프로젝트는 우선 백업하고 **이 프로젝트의 `index.html`, `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `src/`, `public/`, `split-manifest.json` 파일/폴더로 교체**하세요. 기존 v65 `index.html`을 그대로 두지 말고 새 v73의 `index.html`을 사용하세요. `dist/`는 업로드하지 않아도 됩니다.

```cmd
cd C:\Users\UIju\ulji-budget
npm ci
npm run build
npm start
```

테스트 후 Ctrl+C로 종료하고:

```cmd
git add .
git commit -m "Deploy ulju onsalim v73 split project"
git push origin main
```

## 데이터 보안 — 공개 전에 필수 확인

**원본에 내부 예산·집행·지출 적요 데이터가 포함되어 있습니다.** ZIP 내부 `public/assets/data/`에는 이 데이터가 **원본과 동일하게** 포함되어 있습니다. `index.html`만 비워 보이게 분리했더라도 **공개 사이트에서는 JSON URL로 모든 데이터를 다운로드할 수 있습니다.** 데이터를 공개해도 되는 권한이 확인되기 전에는 GitHub 공개 저장소나 공개 CloudType 서비스에 배포하지 마세요. `.gitignore`나 GitHub 비공개 설정만으로 브라우저에 전송되는 데이터가 보호되지는 않습니다. 공개용 데모는 별도로 안전하게 비식별화해야 합니다.

브라우저 `localStorage` 사용 부분은 유지했습니다. 다른 브라우저/기기 간 예산 데이터 자동 동기화는 제공하지 않습니다. 이를 원하면 인증·DB 등이 추가로 필요합니다.

## Gemini 인수인계

`GEMINI_HANDOFF_V73.md`를 Gemini에 제공하고, 본 ZIP의 자료 및 HTML의 내부정보 취급 승인 여부를 전달하세요.
