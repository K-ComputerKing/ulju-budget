# Gemini 개발 인수인계 — 울주온살림 v73

## 개발 목표
윈도우 CMD에서 빌드·실행하고 GitHub `K-ComputerKing/ulju-budget`의 `main`을 CloudType(Node.js)에 배포. 이미 로컬에서 작동하는 기존 울주온살림 기능과 디자인을 유지하고, 버그 최소화.

## 인수인계 우선순위
- **이번 첨부 원본은 v73(`ulju_onsalim_v73_budget_selection_spacing.html`)이며 이전 v65보다 새 버전입니다.** 업그레이드 과정에서 v65로 덮어쓰지 마세요.
- 현재 제공 ZIP은 CSS 1개, 자바스크립트 4개, 원본 JSON 10개를 HTML에서 분리합니다.
- 프레임워크 없이 Node.js HTTP 서버 방식입니다. `package.json`의 `npm ci`, `npm run build`, `npm start` 사용.
- 데이터는 초기화 시 `assets/bootstrap.js`에서 JSON 10개를 fetch로 가져와 `type=application/json` 빈 스크립트 자리표시자에 주입합니다. 그 다음 기존 JS 4개를 순서대로 실행합니다. 초기 데이터 주입과 기존 JS의 전역 스코프 의존성을 유지해야 합니다.
- 변경된 파일의 의존관계를 실제로 점검하고 `npm run build` + HTTP 로딩/브라우저 콘솔 검사로 검증해 주세요.

## 현재 코드 구조
- `index.html`: DOM 및 JSON 자리표시자
- `public/assets/styles.css`: 전체 CSS
- `public/assets/data/*.json`: 예산 데이터, 집행 자료, 과거연도, 문서 벡터 등 10개 데이터 파일
- `public/assets/scripts/01-app.js`: 주요 UI 애플리케이션
- `public/assets/scripts/02-jszip-3.10.1.js`: ZIP 기능 라이브러리
- `public/assets/scripts/03-execution-imports.js`: 집행자료 가져오기 관련
- `public/assets/scripts/04-search-bridge.js`: 검색 UI 연결
- `public/assets/bootstrap.js`: 데이터 로더 및 JS 순차 실행
- `src/build.js`: 정적 파일을 `dist/`로 복사
- `src/server.js`: `process.env.PORT` 기반 Node HTTP 서버, `/healthz`

## CloudType 설정
Node.js 20 / repo `K-ComputerKing/ulju-budget` / branch main / Install `npm ci` / Build `npm run build` / Start `npm start` / default port 3000, PORT 변수 우선 / root subdir.

## 원본 코드 관련 사실
- 원본은 v73 단일 HTML. HTML 안에 예산/지출 관련 데이터가 포함되어 있었음.
- 처음 v65를 CloudType에 배포하려다 실패했으나 정확한 빌드 오류 로그는 제공되지 않았음.
- `localStorage` 기반 저장은 브라우저별로 독립적이며 실시간 공동 편집 DB가 아님.
- `/healthz` 200 응답만으로 실제 브라우저 모든 기능 검증이 완료됐다고 단정하지 말 것.

## 보안 경고 (최우선)
원본에는 외부 공개 주의 문구와 내부 집행 적요 데이터가 존재합니다. 분리한 JSON 파일도 브라우저에서 다운로드 가능한 공개 정적 리소스입니다. **실제 자료 공개가 승인되기 전에는 공개 GitHub/CloudType에 게시하지 마세요.** 사용자에게 공개용 익명화 데이터 대체, 권한 검토, 내부전용 접근 제어 방식을 안내하세요. 데이터를 단순히 서버의 `public`에서 숨기는 것이 아니라 인증된 서버 엔드포인트로 관리해야 비공개가 됩니다.

## 다음 AI가 할 일
1. ZIP 압축 해제 후 `npm ci && npm run build && npm start`로 실행.
2. `http://localhost:3000`와 `/healthz`, `/assets/data/budget-data.json` 응답 확인.
3. 브라우저 콘솔 에러와 예산표/선택/검색/불러오기 기능 검증.
4. CloudType 빌드 로그가 있다면 실제 원인부터 진단.
5. **내부 자료 공개 승인 확인 전 배포 금지.** 승인 시 공개용 샘플 데이터가 필요한지 검토하고 변경 범위를 명확히 제시.
6. 배포 뒤 GitHub `main` 및 CloudType 설정 확인.
