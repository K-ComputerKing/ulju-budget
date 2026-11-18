/* 울주온살림 v73 자료 로더 — 원본 응용코드는 변경하지 않습니다. */
(async function startUljuOnsalm() {
  'use strict';
  const dataFiles = [
  {
    "id": "execution-data",
    "url": "/assets/data/execution-data.json"
  },
  {
    "id": "group-data",
    "url": "/assets/data/group-data.json"
  },
  {
    "id": "child-data",
    "url": "/assets/data/child-data.json"
  },
  {
    "id": "historical-data",
    "url": "/assets/data/historical-data.json"
  },
  {
    "id": "budget-data",
    "url": "/assets/data/budget-data.json"
  },
  {
    "id": "page-data",
    "url": "/assets/data/page-data.json"
  },
  {
    "id": "vector-data",
    "url": "/assets/data/vector-data.json"
  },
  {
    "id": "funding-data",
    "url": "/assets/data/funding-data.json"
  },
  {
    "id": "phase-data",
    "url": "/assets/data/phase-data.json"
  },
  {
    "id": "fiscal-band-data",
    "url": "/assets/data/fiscal-band-data.json"
  }
];
  const appScripts = [
  "/assets/scripts/01-app.js",
  "/assets/scripts/02-jszip-3.10.1.js",
  "/assets/scripts/03-execution-imports.js",
  "/assets/scripts/04-search-bridge.js"
];
  const showError = (message) => {
    console.error('[울주온살림] 초기화 실패:', message);
    const warning = document.createElement('div');
    warning.setAttribute('role', 'alert');
    warning.style.cssText = 'position:fixed;z-index:999999;left:12px;right:12px;top:12px;padding:16px;border-radius:8px;color:#7f1d1d;background:#fee2e2;border:1px solid #ef4444;font:14px/1.6 sans-serif;';
    warning.textContent = '초기화 실패: ' + message + ' (개발자 도구 Console/Network에서 확인해 주세요.)';
    document.body.appendChild(warning);
  };
  try {
    const loaded = await Promise.all(dataFiles.map(async ({ id, url }) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`데이터 파일 누락: ${url} (HTTP ${response.status})`);
      const text = await response.text();
      JSON.parse(text); // JSON 파일 손상 시 초기 단계에서 명확한 오류 표시
      return { id, text };
    }));
    for (const { id, text } of loaded) {
      const slot = document.getElementById(id);
      if (!slot) throw new Error(`데이터 자리표시자 누락: ${id}`);
      slot.textContent = text;
    }
    for (const url of appScripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`스크립트 로드 실패: ${url}`));
        document.body.appendChild(script);
      });
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
})();
