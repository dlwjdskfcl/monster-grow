// shared/ (게임 규칙) 를 GAS 에서 쓸 수 있는 파일 하나로 묶음 → backend/GameCore.gs
// 클라이언트와 서버가 '같은 코드'로 계산하도록 하기 위함. shared 를 고치면 이 명령을 다시 실행하고 GAS 에 붙여넣기(또는 clasp push)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const r = await build({
  entryPoints: ['shared/index.ts'], bundle: true, format: 'iife', globalName: 'GameCore',
  target: 'es2019', platform: 'neutral', write: false, legalComments: 'none', charset: 'utf8'
});
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const head = `/* GameCore.gs — 자동 생성 파일 (직접 고치지 마세요). 원본: shared/*.ts, 생성: npm run build:gas\n * 버전 ${pkg.version} */\n`;
const body = r.outputFiles[0].text.replace(/^"use strict";\n/, '');
writeFileSync('backend/GameCore.gs', head + body);
console.log('backend/GameCore.gs', r.outputFiles[0].text.length, 'bytes');
