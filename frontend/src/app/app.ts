/**
 * 앱 뼈대: 위 재화 바 · 가운데 화면 · 아래 탭. 라우팅은 hash (#/explore …) → GitHub Pages 하위 경로에서 새로고침해도 404 없음
 */
import * as BN from '../../../shared/bignum';
import * as F from '../../../shared/formulas';
import { ENV } from '../config/env';
import { closeAllSheets, esc, sheet, duration } from '../components/ui';
import { session } from '../game/session';
import { renderExplore, tickExplore } from '../screens/explore';
import { renderCreatures } from '../screens/creatures';
import { renderTeam } from '../screens/team';
import { renderLab } from '../screens/lab';
import { renderMore } from '../screens/more';

export type Screen = (root: HTMLElement) => void;
const ROUTES: Record<string, { title: string; icon: string; render: Screen; tab?: boolean }> = {
  explore: { title: '탐사', icon: 'compass', render: renderExplore, tab: true },
  creatures: { title: '공명체', icon: 'paw', render: renderCreatures, tab: true },
  team: { title: '편대', icon: 'team', render: renderTeam, tab: true },
  lab: { title: '연구', icon: 'flask', render: renderLab, tab: true },
  more: { title: '더보기', icon: 'dots', render: renderMore, tab: true }
};

const ICONS: Record<string, string> = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
  paw: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5-2 3-4 3-4 0-4-3z"/>',
  team: '<rect x="3.5" y="5" width="7" height="6" rx="1.5"/><rect x="13.5" y="5" width="7" height="6" rx="1.5"/><rect x="8.5" y="14" width="7" height="6" rx="1.5"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
export const icon = (n: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

let current = '';
let main: HTMLElement;

export function route(): string {
  const r = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'explore');
  return r in ROUTES || r.startsWith('more') ? r : 'explore';
}

export function startApp(root: HTMLElement) {
  root.innerHTML = `
    <header class="topbar">
      <div class="res" id="res"></div>
      <div class="net" id="net"></div>
    </header>
    <div class="banner hide" id="banner"></div>
    <main id="main" tabindex="-1"></main>
    <nav class="tabbar" id="tabbar">${Object.entries(ROUTES).filter(([, v]) => v.tab).map(([k, v]) => `<a href="#/${k}" data-r="${k}">${icon(v.icon)}<span>${v.title}</span></a>`).join('')}</nav>
    ${ENV !== 'prod' ? `<div class="envtag">${esc(ENV.toUpperCase())}</div>` : ''}`;
  main = document.getElementById('main')!;
  window.addEventListener('hashchange', () => { closeAllSheets(); draw(true); });
  session.on(() => draw(false));
  setInterval(tick, 1000);
  draw(true);
}

function draw(navigated: boolean) {
  const r = route();
  const key = r.split('/')[0];
  if (navigated) window.scrollTo(0, 0);
  current = r;
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', (a as HTMLElement).dataset.r === (key in ROUTES ? key : 'more')));
  drawTop();
  drawBanner();
  const R = ROUTES[key] || ROUTES.more;
  document.title = '몬스터 키우기 · ' + R.title;
  if (!session.view()) { main.innerHTML = loadingHtml(); return; }
  R.render(main);
  maybeOfflineReport();
}

function loadingHtml() {
  if (session.maintenance) return `<div class="center-msg"><div class="big">🛠️</div><h2>점검 중</h2><p class="muted">${esc(session.maintenance)}</p></div>`;
  if (session.lastError) return `<div class="center-msg"><h2>연결할 수 없어요</h2><p class="muted">${esc(session.lastError)}</p><button class="btn primary" onclick="location.reload()">다시 시도</button></div>`;
  return `<div class="center-msg"><div class="spinner"></div><p class="muted">탐사 기지에 연결하는 중… (첫 연결은 최대 30초)</p></div>`;
}

function drawTop() {
  const v = session.view();
  const res = document.getElementById('res')!;
  if (!v) { res.innerHTML = '<b class="logo">몬스터 키우기</b>'; return; }
  const rt = F.rates(v, session.cfg);
  res.innerHTML = `
    <div class="cur" title="생명 파편 — 스킬·연구·계약"><i class="dot shard"></i><b data-live="shards">${BN.fmt(v.cur.shards)}</b><small>+${BN.fmt(rt.shards)}/s</small></div>
    <div class="cur" title="공명 에너지 — 레벨 업"><i class="dot energy"></i><b data-live="energy">${BN.fmt(v.cur.energy)}</b><small>+${BN.fmt(rt.energy)}/s</small></div>
    <div class="cur" title="복원 재료 — 공명 단계·계약"><i class="dot mat"></i><b data-live="materials">${BN.fmt(BN.floor(v.cur.materials))}</b></div>
    ${BN.isZero(v.cur.seeds) ? '' : `<div class="cur" title="생태 씨앗 — 영구 성장"><i class="dot seed"></i><b>${BN.fmt(v.cur.seeds)}</b></div>`}`;
  const net = document.getElementById('net')!;
  net.className = 'net' + (session.busy ? ' busy' : '') + (!session.online ? ' off' : '');
  net.title = !session.online ? '오프라인' : session.busy ? '저장 중' : '저장됨';
}

function drawBanner() {
  const b = document.getElementById('banner')!;
  const msg = session.lastError || (session.newRecoveryCode ? '' : '');
  b.classList.toggle('hide', !msg);
  b.textContent = msg;
}

function tick() {
  const v = session.view();
  if (!v) return;
  for (const k of ['shards', 'energy', 'materials'] as const) {
    const el = document.querySelector(`[data-live="${k}"]`);
    if (el) el.textContent = BN.fmt(k === 'materials' ? BN.floor(v.cur[k]) : v.cur[k]);
  }
  if (current === 'explore') tickExplore(main, v);
}

let shownReport = false;
function maybeOfflineReport() {
  const r = session.offlineReport;
  if (!r || shownReport) return;
  shownReport = true;
  session.offlineReport = null;
  sheet(`<h3>탐사단이 돌아왔어요</h3>
    <p class="muted">${duration(r.seconds)} 동안 자동 탐사${r.capped ? ' (정산 한도까지만 쌓였어요 — 연구소의 야영 기술로 늘릴 수 있어요)' : ''}</p>
    <ul class="gain">
      <li><i class="dot shard"></i>생명 파편 <b>+${BN.fmt(BN.parse(r.shards))}</b></li>
      <li><i class="dot energy"></i>공명 에너지 <b>+${BN.fmt(BN.parse(r.energy))}</b></li>
      <li><i class="dot mat"></i>복원 재료 <b>+${BN.fmt(BN.floor(BN.parse(r.materials)))}</b></li>
      ${r.depthTo > r.depthFrom ? `<li>탐사 깊이 <b>${r.depthFrom} → ${r.depthTo}</b></li>` : ''}
    </ul>
    <p class="hint">보상은 서버 시각으로 계산돼요. 받은 보상은 다음 행동 때 함께 저장돼요.</p>
    <div class="row end"><button class="btn primary" data-ok>좋아요</button></div>`).el.querySelector<HTMLElement>('[data-ok]')!.onclick = () => document.querySelector<HTMLElement>('.sheet-x')?.click();
  session.send('claimOffline').catch(() => undefined);
}
