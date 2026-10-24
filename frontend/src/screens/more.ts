/** 더보기: 도감 · 생태 재구성 · 공지 · 설정(계정 복구·움직임 줄이기·정보) */
import * as BN from '../../../shared/bignum';
import { CREATURES, REGIONS, ROLE_NAME } from '../../../shared/data';
import * as F from '../../../shared/formulas';
import { APP_VERSION, ENV } from '../config/env';
import { creatureSvg } from '../components/art';
import { confirmBox, esc, toast } from '../components/ui';
import { session } from '../game/session';
import { local } from '../storage/store';
import { act } from './explore';

export function renderMore(root: HTMLElement) {
  const sub = location.hash.split('/')[2] || '';
  if (sub === 'codex') return codex(root);
  if (sub === 'rebuild') return rebuild(root);
  if (sub === 'settings') return settings(root);
  if (sub === 'notice') return notice(root);
  const v = session.view()!;
  root.innerHTML = `
    <h2 class="page">더보기</h2>
    <div class="menu">
      <a href="#/more/codex"><b>📖 생태 도감</b><span class="muted">${Object.keys(v.discovered).length} / ${CREATURES.length} 발견</span></a>
      <a href="#/more/rebuild"><b>🌱 생태 재구성</b><span class="muted">${v.maxDepth >= session.cfg.rebuildMinDepth ? '가능' : '깊이 ' + session.cfg.rebuildMinDepth + '부터'}</span></a>
      <a href="#/more/notice"><b>📢 공지</b><span class="muted">${session.announcements.length}</span></a>
      <a href="#/more/settings"><b>⚙️ 설정 · 계정</b><span class="muted">복구 코드</span></a>
    </div>
    <div class="card small">
      <b>기록</b>
      <ul class="plain">
        <li>통산 최고 깊이 ${v.bestDepth} · 재구성 ${v.rebuilds}회</li>
        <li>보스 ${v.stats.bossWins}승 / ${v.stats.bossTries}회 도전</li>
        <li>받은 생태 씨앗 ${BN.fmt(v.seedsEarned)}</li>
      </ul>
    </div>`;
}

function back(title: string) { return `<a class="back" href="#/more">‹ 더보기</a><h2 class="page">${title}</h2>`; }

function codex(root: HTMLElement) {
  const v = session.view()!;
  root.innerHTML = back('생태 도감') + REGIONS.map((r, i) => `
    <h3 class="sec">${esc(r.name)} <small class="muted">${F.regionUnlocked(v, i) ? esc(r.desc) : '아직 가 보지 못한 곳'}</small></h3>
    <div class="grid small">${CREATURES.filter((c) => c.region === r.id).map((c) => {
      const seen = c.id in v.discovered, own = !!v.creatures[c.id];
      return `<div class="mcard codex${own ? '' : ' off'}"><div class="art">${creatureSvg(c.look, 52, { dim: !seen })}</div><b>${seen ? esc(c.name) : '???'}</b><small>${seen ? ROLE_NAME[c.role] + (own ? ' · 계약' : ' · 발견') : '미발견'}</small></div>`;
    }).join('')}</div>`).join('') + '<p class="hint">계약한 공명체마다 생산량 +3% (발견 보너스).</p>';
}

function rebuild(root: HTMLElement) {
  const v = session.view()!;
  const ok = v.maxDepth >= session.cfg.rebuildMinDepth;
  const seeds = F.rebuildSeeds(v);
  root.innerHTML = back('생태 재구성') + `
    <div class="card">
      <p>무너진 생태계를 처음부터 다시 엮어요. 진행 일부를 내려놓는 대신 <b>생태 씨앗</b>을 얻고, 씨앗 1개마다 모든 능력치와 생산량이 영구히 +${Math.round(F.L.seedEach * 100)}% 올라요.</p>
      <div class="two-col small">
        <div><b>초기화</b><ul class="plain"><li>탐사 깊이 · 관문</li><li>생명 파편 · 에너지 · 복원 재료</li><li>공명체 레벨 · 스킬</li></ul></div>
        <div><b>유지</b><ul class="plain"><li>계약한 공명체 · 공명 단계 · 특성 · 별칭</li><li>연구 · 도감 · 씨앗</li><li>통산 기록</li></ul></div>
      </div>
      <p>이번 순환 최고 깊이 <b>${v.maxDepth}</b> → 받을 씨앗 <b class="big">${BN.fmt(seeds)}</b> <small class="muted">(지금 ${BN.fmt(v.cur.seeds)})</small></p>
      <button class="btn primary big" id="rb" ${ok && !BN.isZero(seeds) ? '' : 'disabled'}>${ok ? '재구성하기' : '깊이 ' + session.cfg.rebuildMinDepth + '에 도달하면 열려요'}</button>
    </div>`;
  const b = root.querySelector<HTMLButtonElement>('#rb')!;
  b.onclick = async () => {
    if (!(await confirmBox('생태 재구성', `씨앗 ${BN.fmt(seeds)}개를 받고 깊이 1부터 다시 시작해요. 되돌릴 수 없어요.`, '재구성'))) return;
    act(b, async () => { const r = await session.send('rebuildEcology', { confirm: true }); toast(`생태 씨앗 +${BN.fmt(BN.parse(String(r.seeds)))}`, 'ok'); location.hash = '#/explore'; });
  };
}

function notice(root: HTMLElement) {
  root.innerHTML = back('공지') + (session.announcements.length ? session.announcements.map((a) => `<div class="card"><b>${esc(a.title)}</b><p class="pre">${esc(a.body)}</p></div>`).join('') : '<p class="muted">공지가 없어요.</p>');
}

function settings(root: HTMLElement) {
  const code = local.get('recovery', '');
  const calm = local.get('calm', false);
  root.innerHTML = back('설정 · 계정') + `
    <div class="card">
      <b>계정 (게스트)</b>
      <p class="muted small">이 기기에 저장된 게스트 계정이에요. <b>복구 코드를 잃어버리면 기록을 되찾을 수 없어요.</b> 캡처하거나 메모해 두세요.</p>
      <div class="kv"><span>플레이어 ID</span><code>${esc(session.playerId || '-')}</code></div>
      <div class="kv"><span>복구 코드</span><code id="rc">${code ? '●●●●●●●●●●' : '(이 기기에 없음)'}</code>${code ? '<button class="btn sm" id="show">보기</button>' : ''}</div>
      <button class="btn sm" id="copy" ${code ? '' : 'disabled'}>ID와 코드 복사</button>
    </div>
    <div class="card">
      <b>다른 기기의 기록 불러오기</b>
      <p class="muted small">지금 기기의 기록 대신 불러온 기록을 써요.</p>
      <input class="input" id="rpid" placeholder="플레이어 ID" autocomplete="off">
      <input class="input" id="rcode" placeholder="복구 코드 (MK-…)" autocomplete="off">
      <button class="btn primary" id="restore">불러오기</button>
    </div>
    <div class="card">
      <label class="switch"><input type="checkbox" id="calm" ${calm ? 'checked' : ''}> 움직임 줄이기</label>
      <p class="muted small">버전 ${APP_VERSION} · ${ENV} · 서버 시각 기준 저장 · 자동 저장 10분마다</p>
      <button class="btn sm ghost" id="sync">지금 저장된 상태 다시 받기</button>
    </div>`;
  const show = root.querySelector<HTMLButtonElement>('#show');
  if (show) show.onclick = () => { root.querySelector('#rc')!.textContent = code; show.remove(); };
  root.querySelector<HTMLButtonElement>('#copy')!.onclick = async () => {
    try { await navigator.clipboard.writeText(`몬스터 키우기 복구 정보\nID: ${session.playerId}\n코드: ${code}`); toast('복사했어요', 'ok'); } catch { toast('복사하지 못했어요 — 직접 적어 두세요', 'err'); }
  };
  const rb = root.querySelector<HTMLButtonElement>('#restore')!;
  rb.onclick = async () => {
    const pid = (root.querySelector('#rpid') as HTMLInputElement).value, c = (root.querySelector('#rcode') as HTMLInputElement).value;
    if (!pid || !c) { toast('ID와 복구 코드를 넣어 주세요', 'err'); return; }
    if (!(await confirmBox('기록 불러오기', '이 기기의 지금 기록 대신 불러온 기록을 써요. 지금 기록의 복구 코드를 적어 두지 않았다면 되찾을 수 없어요.', '불러오기'))) return;
    act(rb, async () => { await session.restore(pid, c); toast('불러왔어요', 'ok'); location.hash = '#/explore'; });
  };
  root.querySelector<HTMLInputElement>('#calm')!.onchange = (e) => { const on = (e.target as HTMLInputElement).checked; local.set('calm', on); document.documentElement.classList.toggle('calm', on); };
  const sy = root.querySelector<HTMLButtonElement>('#sync')!;
  sy.onclick = () => act(sy, () => session.syncNow());
}
