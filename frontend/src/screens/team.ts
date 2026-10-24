/** 편대: 앞줄 2 · 뒷줄 3. 공명체를 눌러 넣고, 칸을 눌러 빼고, 저장 */
import * as BN from '../../../shared/bignum';
import { CREATURE_BY_ID, CREATURES, ROLE_NAME } from '../../../shared/data';
import * as F from '../../../shared/formulas';
import { clone } from '../../../shared/state';
import { creatureSvg } from '../components/art';
import { esc, toast } from '../components/ui';
import { session } from '../game/session';
import { act } from './explore';

let draft: string[] | null = null;

export function renderTeam(root: HTMLElement) {
  const v = session.view()!;
  if (!draft || draft.some((id) => !v.creatures[id])) draft = v.team.slice();
  const max = session.cfg.maxTeam;
  const changed = draft.join() !== v.team.join();
  const sim = clone(v); sim.team = draft.slice();
  const roles = new Set(draft.map((id) => CREATURE_BY_ID[id].role));
  const slot = (i: number) => {
    const id = draft![i];
    if (!id) return `<button class="slot empty" data-slot="${i}"><span>${i < 2 ? '앞줄' : '뒷줄'}</span></button>`;
    const d = CREATURE_BY_ID[id], c = v.creatures[id];
    return `<button class="slot role-${d.role}" data-slot="${i}" aria-label="${esc(d.name)} 빼기">${creatureSvg(d.look, 52, { shadow: false })}<b>${esc(c.alias || d.name)}</b><small>${ROLE_NAME[d.role]} Lv.${c.level}</small></button>`;
  };
  root.innerHTML = `
    <h2 class="page">편대 <small class="muted">${draft.length} / ${max}</small></h2>
    <div class="formation">
      <div class="rowlabel">앞줄 — 보스가 먼저 노려요</div>
      <div class="slots two">${slot(0)}${slot(1)}</div>
      <div class="rowlabel">뒷줄</div>
      <div class="slots three">${[2, 3, 4].slice(0, Math.max(0, max - 2)).map(slot).join('')}</div>
    </div>
    <div class="card info-row">
      <div><small class="eyebrow">편대 전투력</small><b>${draft.length ? BN.fmt(BN.powN(10, F.teamPower(sim))) : '-'}</b></div>
      <div><small class="eyebrow">역할</small><b>${roles.size} / 4</b></div>
      <p class="muted full">역할이 다양할수록 전투력 +6%씩. 보스전은 ${session.cfg.minTeamForBoss}마리 이상. 전위는 앞줄, 변환은 균열로 방어를 깨고, 조율은 편대를 강화해요.</p>
    </div>
    <div class="row">
      <button class="btn ghost" id="auto">자동 편성</button>
      <span class="grow"></span>
      <button class="btn ghost" id="reset" ${changed ? '' : 'disabled'}>되돌리기</button>
      <button class="btn primary" id="save" ${changed && draft.length ? '' : 'disabled'}>저장</button>
    </div>
    <h3 class="sec">공명체 <small class="muted">눌러서 넣기</small></h3>
    <div class="grid small">${CREATURES.filter((d) => v.creatures[d.id]).map((d) => {
      const c = v.creatures[d.id], inT = draft!.includes(d.id);
      return `<button class="mcard role-${d.role}${inT ? ' picked' : ''}" data-pick="${d.id}" ${inT ? 'disabled' : ''}><div class="art">${creatureSvg(d.look, 48)}</div><b>${esc(c.alias || d.name)}</b><small>${ROLE_NAME[d.role]} Lv.${c.level}</small></button>`;
    }).join('')}</div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.slot); if (draft![i]) { draft!.splice(i, 1); renderTeam(root); } });
  root.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.onclick = () => {
    if (draft!.length >= max) { toast(`편대는 ${max}마리까지`, 'err'); return; }
    draft!.push(b.dataset.pick!); renderTeam(root);
  });
  (root.querySelector('#auto') as HTMLButtonElement).onclick = () => { draft = autoTeam(); renderTeam(root); };
  (root.querySelector('#reset') as HTMLButtonElement).onclick = () => { draft = v.team.slice(); renderTeam(root); };
  const save = root.querySelector('#save') as HTMLButtonElement;
  save.onclick = () => act(save, async () => { await session.send('setTeam', { team: draft }); draft = null; toast('편대를 저장했어요', 'ok'); });
}

/** 역할마다 가장 강한 공명체 1마리씩 → 남은 칸은 강한 순. 전위는 앞줄 */
function autoTeam(): string[] {
  const v = session.view()!;
  const ids = Object.keys(v.creatures);
  const pw = (id: string) => { const s = F.creatureStats(v, id); return s.lAtk + 0.5 * s.lHp; };
  ids.sort((a, b) => pw(b) - pw(a));
  const pick: string[] = [];
  for (const r of ['guard', 'shifter', 'tuner', 'striker']) { const id = ids.find((x) => CREATURE_BY_ID[x].role === r && !pick.includes(x)); if (id) pick.push(id); }
  for (const id of ids) if (pick.length < session.cfg.maxTeam && !pick.includes(id)) pick.push(id);
  const guards = pick.filter((id) => CREATURE_BY_ID[id].role === 'guard');
  return [...guards, ...pick.filter((id) => !guards.includes(id))].slice(0, session.cfg.maxTeam);
}
