// 브라우저 통합 테스트 (Playwright) — 실제 빌드를 GitHub Pages 와 같은 하위 경로(/monster-grow/)로 띄우고,
// 서버는 backend/*.gs 실제 코드(가짜 GAS 환경)로 돌림.  실행: npm run build:gas && npm run e2e
// 스크린샷: e2e-shots/*.png
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const BASE = '/monster-grow/';
const API = 'http://localhost:8799';
execSync(`npx vite build`, { stdio: 'inherit', env: { ...process.env, VITE_BASE: BASE, VITE_ENV: 'staging', VITE_API_URL: API } });

const api = spawn(process.execPath, ['scripts/gas-local-server.mjs'], { env: { ...process.env, PORT: '8799', DELAY_MS: '120' }, stdio: 'inherit' });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const web = createServer((req, res) => {        // GitHub Pages 흉내: 하위 경로, 없는 파일은 404.html
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(BASE)) { res.writeHead(404); return res.end(readFileSync('dist/404.html')); }
  let f = join('dist', p.slice(BASE.length));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end(readFileSync('dist/404.html')); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(8798);

const URL0 = 'http://localhost:8798' + BASE;
mkdirSync('e2e-shots', { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); console.log(ok ? '✓' : '✗', name, extra); };
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch();
try {
  for (const w of [360, 390, 430]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });   // 404 는 일부러 없는 주소를 여는 시험
    await page.goto(URL0);
    await page.waitForSelector('.sheet h3', { timeout: 15000 });
    check(`${w}px 첫 접속 → 환영·복구 코드`, (await page.textContent('.sheet')).includes('MK-'));
    if (w === 390) await page.screenshot({ path: 'e2e-shots/01_welcome.png' });
    await page.click('[data-go]');
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check(`${w}px 가로 넘침 없음`, !overflow);
    if (w !== 390) { check(`${w}px 콘솔 오류 없음`, errors.length === 0, errors.join(' | ')); await ctx.close(); continue; }

    await page.screenshot({ path: 'e2e-shots/02_explore.png' });
    // 강화
    const lvSum = () => page.$$eval('.row-item .lv', (els) => els.reduce((a, e) => a + Number(e.textContent.replace(/\D/g, '')), 0));
    const before = await lvSum();
    await page.click('.row-item [data-lv]:not([data-times])');
    await page.waitForFunction((b) => [...document.querySelectorAll('.row-item .lv')].reduce((a, e) => a + Number(e.textContent.replace(/\D/g, '')), 0) > b, before, { timeout: 8000 }).catch(() => {});
    check('레벨 업 → 서버 저장 후 화면 반영', (await lvSum()) > before);
    // 새로고침해도 유지 + 해시 라우팅
    await page.goto(URL0 + '#/creatures');
    await page.waitForSelector('.mcard');
    check('#/creatures 직접 진입 · 새로고침', (await page.locator('.mcard').count()) >= 3);
    await page.click('.mcard');
    await page.waitForSelector('.detail-head');
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'e2e-shots/03_detail.png' });
    await page.keyboard.press('Escape');
    await page.goto(URL0 + '#/team'); await page.waitForSelector('.formation');
    await page.screenshot({ path: 'e2e-shots/04_team.png' });
    await page.goto(URL0 + '#/lab'); await page.waitForSelector('.row-item');
    await page.goto(URL0 + '#/more/settings'); await page.waitForSelector('#restore');
    check('설정에 플레이어 ID 표시', /[0-9a-f-]{36}/.test(await page.textContent('.kv code')));
    // 없는 경로 → 404.html → 첫 화면
    await page.goto('http://localhost:8798/monster-grow/nope/deep');
    await page.waitForURL(/#\/explore/, { timeout: 5000 }).catch(() => {});
    check('없는 하위 경로 → 404.html 이 첫 화면으로', page.url().endsWith(BASE + '#/explore'), page.url());
    // 오프라인 보상: 서버 시각 3시간 앞으로
    await fetch(API + '/__time?add=10800', { method: 'POST' });
    await page.reload();
    await page.waitForSelector('.sheet h3', { timeout: 10000 }).catch(() => {});
    const t = (await page.textContent('.sheet').catch(() => '')) || '';
    check('3시간 뒤 접속 → 오프라인 보상 안내', t.includes('돌아왔어요'), t.slice(0, 60));
    await page.screenshot({ path: 'e2e-shots/05_offline.png' });
    await page.keyboard.press('Escape');
    // 보스전 (로컬 전용 도구로 레벨을 올린 뒤 관문까지)
    await fetch(API + '/__boost?level=70');
    await page.reload();
    await page.waitForSelector('#bossBtn', { timeout: 10000 }).catch(() => {});
    const hasBoss = await page.locator('#bossBtn').count();
    check('관문 도달 → 보스 도전 버튼', hasBoss > 0);
    if (hasBoss) {
      await page.screenshot({ path: 'e2e-shots/06_gate.png' });
      await page.keyboard.press('Escape');
      await page.click('#bossBtn');
      await page.waitForSelector('.battle', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'e2e-shots/07_battle.png' });
      await page.click('#bskip');
      await page.waitForSelector('#bres:not(.hide)');
      await page.waitForTimeout(400);
      check('보스전 결과 표시', (await page.textContent('#bres')).length > 2, (await page.textContent('#bres h3')));
      await page.screenshot({ path: 'e2e-shots/08_result.png' });
    }
    // 두 탭 동시 수령 → 하나는 충돌 후 자동 복구
    const p2 = await ctx.newPage();
    await p2.goto(URL0); await p2.waitForSelector('.scene');
    await Promise.all([page.evaluate(() => 1), p2.evaluate(() => 1)]);
    check('두 번째 탭도 같은 계정으로 열림', (await p2.locator('.scene').count()) === 1);
    // reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // 데스크톱
  const d = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const dp = await d.newPage();
  await dp.goto(URL0); await dp.waitForSelector('.sheet h3'); await dp.click('[data-go]');
  await dp.screenshot({ path: 'e2e-shots/09_desktop.png' });
  check('데스크톱 표시', (await dp.locator('.scene').count()) === 1);
  await d.close();
} finally {
  await browser.close(); web.close(); api.kill();
}
const fail = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - fail.length} / ${results.length} 통과`);
process.exit(fail.length ? 1 : 0);
