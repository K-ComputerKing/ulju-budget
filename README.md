# 울주온살림 CloudType 배포용 (Node.js)

이 프로젝트는 첨부한 단일 HTML의 기능을 변경하지 않고, CloudType에서 **Node.js** 앱으로 배포할 수 있도록 구성했습니다. **Vite/React를 사용하지 않습니다.** 기존 HTML을 그대로 제공하기 때문에 복잡한 의존성 설치가 없습니다.

## 폴더 구조

```text
ulju-cloudtype-deploy/
├── index.html           # 기존 울주온살림 HTML 원본
├── package.json         # npm 명령 정의
├── package-lock.json
├── .nvmrc               # Node.js 20 권장
├── .gitignore
├── public/              # 추가 이미지/파일이 있을 때 사용
├── src/
│   ├── build.js         # dist/ 정적 사이트 생성
│   └── server.js        # CloudType HTTP 서버
└── README.md
```

## 로컬 실행 (Windows CMD)

```cmd
npm ci
npm run build
npm start
```

브라우저에서 `http://localhost:3000` 접속. 종료는 CMD에서 `Ctrl+C`.

## CloudType 배포 설정

- GitHub 저장소: 본인 저장소, 브랜치 `main`
- 템플릿/프리셋: **Node.js** (`HTML` 또는 `React/Vite`가 아님)
- Node.js 버전: **20**
- Install Command: `npm ci`
- Build Command: `npm run build`
- Start Command: `npm start`
- Port: `3000`
- Subdirectory: 공란 (패키지 파일을 저장소 최상위에 올린 경우)
- Health check: `/healthz` (선택)

이 서버는 `PORT` 환경변수가 있으면 그 포트로 실행하고, 기본 포트는 3000입니다. 서비스는 `0.0.0.0`에 바인딩합니다.

## GitHub 업로드

저장소 루트에 이 ZIP의 파일을 복사한 후 CMD에서 다음 명령어를 실행합니다.

```cmd
git add .
git commit -m "Add CloudType deployable Node website"
git push origin main
```

`node_modules/`, `dist/`, `.env.local` 등 비밀 파일은 업로드하지 마세요.

## 중요: 실제 내부 예산/지출 정보의 공개 위험

원본 HTML에는 **내부 집행 내역과 지출 적요를 외부에 공개하지 말라는 문구**가 들어 있습니다. ZIP은 기능 보존을 위해 원본 HTML을 그대로 포함합니다. 데이터를 공개할 권한이 명확하지 않다면 **공개 저장소/공개 도메인에 이 패키지를 그대로 게시하지 마세요.** 먼저 내부 지출 적요와 개인정보를 제거·비식별화하고, 배포 대상 권한을 검토해야 합니다. 저장소를 비공개로 해도 공개 웹사이트에 실린 데이터는 노출될 수 있습니다.

브라우저의 `localStorage` 기반 설정은 컴퓨터나 브라우저 간에 자동 공유되지 않습니다. 다중 사용자 공유 저장 기능은 별도의 백엔드/DB가 필요합니다.
