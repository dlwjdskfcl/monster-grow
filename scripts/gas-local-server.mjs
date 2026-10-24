// 로컬 개발 서버: backend/*.gs '실제 코드'를 가짜 GAS 환경에서 돌려 http://localhost:8787 로 제공
//   npm run build:gas && npm run dev:server   (다른 창)  npm run dev → http://localhost:5173
//   시간 건너뛰기(오프라인 보상 확인): curl -X POST "http://localhost:8787/__time?add=3600"
import { createServer } from 'node:http';
import { createGas } from '../tests/gas-mock.mjs';

let offset = 0;
const g = createGas({ name: '몬스터키우기_local', clock: () => Date.now() + offset });
g.ctx.setup('local');
const port = Number(process.env.PORT || 8787);
const delay = Number(process.env.DELAY_MS || 300);   // 실제 GAS 처럼 약간 느리게

createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (url.pathname === '/__time') { offset += Number(url.searchParams.get('add') || 0) * 1000; res.writeHead(200, cors); return res.end(JSON.stringify({ offset })); }
  // 로컬 전용 테스트 도구 (backend 에는 없음): 편대 레벨 올리기 → 보스전 화면 확인용
  if (url.pathname === '/__boost') {
    const sh = g.active.getSheetByName('PlayerState');
    for (let r = 2; r <= sh.getLastRow(); r++) {
      const st = g.ctx.GameCore.deserialize(String(sh.rows[r - 1][1]));
      for (const id of st.team) st.creatures[id].level = Number(url.searchParams.get('level') || 60);
      const t = g.ctx.GameCore.serialize(st);
      sh.rows[r - 1][1] = t; sh.rows[r - 1][2] = g.ctx.sha_(t).slice(0, 16);
    }
    res.writeHead(200, cors); return res.end('{"ok":true}');
  }
  if (req.method === 'GET') { res.writeHead(200, cors); return res.end(JSON.stringify(g.get())); }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => setTimeout(() => {
    const out = g.post(body);
    res.writeHead(200, cors); res.end(JSON.stringify(out));
  }, delay));
}).listen(port, () => console.log(`가짜 GAS 서버: http://localhost:${port}  (시간 건너뛰기: POST /__time?add=초)`));
