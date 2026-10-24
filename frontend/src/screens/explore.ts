/** 탐사 화면: 지역 장면 · 깊이 · 관문 보스 · 추천 강화 */
import * as BN from '../../../shared/bignum';
import { CREATURE_BY_ID, REGIONS, ROLE_NAME } from '../../../shared/data';
import * as F from '../../../shared/formulas';
import type { PlayerState } from '../../../shared/state';
import { creatureSvg, foeSvg, regionBg } from '../components/art';
import { esc, toast } from '../components/ui';
import { session } from '../game/session';
import { playBattle } from './battle';

export function renderExplore(root: HTMLElement) {
  const v = session.view()!;
  const reg = F.regionOf(v.depth);
  const tier = F.tierOf(v.depth);
  const gate = F.gateDepth(v.gates);
  const bandStart = F.bandOf(v.depth) * F.L.bandSize + 1;
  const pct = Math.min(100, ((v.depth - bandStart + 1) / F.L.bandSize) * 100);
  const atGate = v.depth >= gate;
  const boss = F.bossAt(v.gates);
  const tp = F.teamPower(v), ep = F.enemyPower(v.depth + 1);
  const team = v.team.filter((id) => v.creatures[id]);

  root.innerHTML = `
  <section class="scene" style="--c1:${reg.bg[0]};--c2:${reg.bg[1]}">
    ${regionBg(reg.id, reg.bg[0], reg.bg[1])}
    <div class="scene-top">
      <div><span class="chip glass">${esc(reg.name)}${tier ? ' · 변이 ' + tier : ''}</span><h1>깊이 ${v.depth}</h1></div>
      <div class="gate"><small>다음 관문</small><b>${gate}</b></div>
    </div>
    <div class="stage">
      <div class="lane">${team.map((id, i) => `<div class="mon m${i}" style="--d:${i * 0.18}s">${creatureSvg(CREATURE_BY_ID[id].look, 58)}</div>`).join('')}</div>
      <div class="foe" id="foe">${atGate ? '' : foeSvg(v.depth, reg.bg[1], 64)}</div>
      <div class="floats" id="floats"></div>
    </div>
    <div class="depthbar"><i style="width:${pct}%"></i><span>${reg.name} ${v.depth - bandStart + 1} / ${F.L.bandSize}</span></div>
  </section>

  ${atGate ? `
  <section class="card boss-cta">
    <div class="boss-mini">${bossBadge(boss.id)}</div>
    <div class="grow">
      <small class="eyebrow">관문 보스${boss.tier ? ' · 변이 ' + boss.tier : ''}</small>
      <h2>${esc(boss.name)}</h2>
      <p class="muted">${esc(boss.desc)}. 이기면 새 지역이 열려요.</p>
    </div>
    <button class="btn primary big" id="bossBtn" ${team.length < session.cfg.minTeamForBoss ? 'disabled' : ''}>도전</button>
  </section>` : `
  <section class="card info-row">
    <div><small class="eyebrow">편대 전투력</small><b>${powerText(tp)}</b></div>
    <div><small class="eyebrow">다음 깊이 적</small><b>${powerText(ep)}</b></div>
    <p class="muted full">${tp >= ep ? '편대가 계속 전진하고 있어요.' : '적이 더 강해요 — 공명체를 강화하면 더 깊이 들어가요.'} 관문(깊이 ${gate})에서 보스가 기다려요.</p>
  </section>`}

  <h3 class="sec">추천 강화</h3>
  <div class="list" id="recs">${recs(v)}</div>

  ${v.maxDepth >= session.cfg.rebuildMinDepth ? `<a class="card link-card" href="#/more/rebuild"><b>🌱 생태 재구성 가능</b><span class="muted">지금 하면 씨앗 ${BN.fmt(F.rebuildSeeds(v))}개 · 영구 성장</span></a>` : ''}
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((b) => b.onclick = () => act(b, () => session.send('upgrade', { kind: 'level', id: b.dataset.lv!, times: Number(b.dataset.times || 1) })));
  const bb = root.querySelector<HTMLButtonElement>('#bossBtn');
  if (bb) bb.onclick = async () => {
    bb.disabled = true;
    try { const r = await session.boss(); playBattle(r.battle, r.reward); }
    catch (e) { toast((e as Error).message, 'err'); bb.disabled = false; }
  };
}

function bossBadge(id: string) {
  const c = { b_rotking: '#b99be0', b_sandmaw: '#ffd48a', b_galecore: '#9fc4ff' }[id] || '#ccc';
  return `<div class="boss-dot" style="--bc:${c}"></div>`;
}

function powerText(l: number) { return isFinite(l) ? BN.fmt(BN.powN(10, l)) : '-'; }

function recs(v: PlayerState): string {
  const rows = v.team.filter((id) => v.creatures[id]).map((id) => {
    const c = v.creatures[id], d = CREATURE_BY_ID[id];
    const cost = F.levelCost(c.level);
    let n = 0, sum = BN.ZERO, cur = v.cur.energy;
    for (let L = c.level; n < 10; L++) { const k = F.levelCost(L); if (!BN.gte(cur, k)) break; cur = BN.sub(cur, k); sum = BN.add(sum, k); n++; }
    return { id, c, d, cost, n, sum };
  }).sort((a, b) => BN.cmp(a.cost, b.cost));
  if (!rows.length) return '<p class="muted">편대에 공명체를 넣어 주세요.</p>';
  return rows.map((r) => `
    <div class="row-item">
      <div class="av">${creatureSvg(r.d.look, 40, { shadow: false })}</div>
      <div class="grow"><b>${esc(r.c.alias || r.d.name)}</b> <span class="lv">Lv.${r.c.level}</span><br><small class="muted">${ROLE_NAME[r.d.role]} · 다음 레벨 ${BN.fmt(r.cost)} 에너지</small></div>
      <button class="btn sm" data-lv="${r.id}" ${r.n ? '' : 'disabled'}>+1</button>
      <button class="btn sm primary" data-lv="${r.id}" data-times="10" ${r.n > 1 ? '' : 'disabled'}>+${Math.max(r.n, 1)}</button>
    </div>`).join('');
}

export async function act(btn: HTMLButtonElement, fn: () => Promise<unknown>) {
  btn.disabled = true; btn.classList.add('loading');
  try { await fn(); } catch (e) { toast((e as Error).message, 'err'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

let tickN = 0;
export function tickExplore(root: HTMLElement, v: PlayerState) {
  const fl = root.querySelector('#floats');
  if (!fl || document.hidden) return;
  tickN++;
  const r = F.rates(v, session.cfg);
  const foe = root.querySelector('#foe');
  if (foe && tickN % 2 === 0) { foe.classList.remove('hit'); void (foe as HTMLElement).offsetWidth; foe.classList.add('hit'); }
  const el = document.createElement('span');
  el.className = 'float';
  el.style.left = 55 + Math.random() * 25 + '%';
  el.textContent = '+' + BN.fmt(r.shards);
  fl.appendChild(el);
  setTimeout(() => el.remove(), 1400);
  if (REGIONS.length && fl.childElementCount > 6) fl.firstElementChild?.remove();
}
