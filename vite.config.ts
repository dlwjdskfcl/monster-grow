import { defineConfig, type Plugin } from 'vite';

// GitHub Pages 프로젝트 사이트는 /<저장소이름>/ 아래에서 열림 → base 를 빌드 때 정함
//   운영:   VITE_BASE=/monster-grow/          스테이징: VITE_BASE=/monster-grow/staging/
const base = process.env.VITE_BASE || '/';

/** 404.html: GitHub Pages 에 없는 주소로 들어오면 게임 첫 화면(base + #/explore)으로. base 를 빌드 때 넣음 */
function notFoundPage(): Plugin {
  return {
    name: 'mk-404',
    generateBundle() {
      this.emitFile({
        type: 'asset', fileName: '404.html',
        source: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>몬스터 키우기</title><meta name="viewport" content="width=device-width, initial-scale=1">
<script>/* 게임은 #/ 주소만 씀 → 새로고침해도 이 파일을 거치지 않음. 잘못 들어온 주소만 첫 화면으로 */
var BASE = ${JSON.stringify(base)};
var p = location.pathname, staging = BASE + 'staging/';
location.replace((p.indexOf(staging) === 0 ? staging : BASE) + '#/explore');</script></head>
<body style="background:#0c141c;color:#eef5f2;font-family:sans-serif;padding:24px">페이지를 찾을 수 없어 첫 화면으로 이동해요… <a style="color:#5ee0a0" href="${base}">이동</a></body></html>`
      });
    }
  };
}

export default defineConfig({
  root: 'frontend',
  base,
  envDir: '..',
  plugins: [notFoundPage()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020', sourcemap: false },
  server: { port: 5173 },
  test: { root: '.', include: ['tests/**/*.test.ts'], environment: 'node' }
} as never);
