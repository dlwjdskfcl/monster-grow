/** 공명체: 계약한 공명체 목록 · 상세(레벨·스킬·공명 단계·특성·별칭) · 계약 가능한 공명체 */
import * as BN from '../../../shared/bignum';
import { CREATURE_BY_ID, CREATURES, REGIONS, ROLE_DESC, ROLE_NAME, TRAITS, Trait } from '../../../shared/data';
import * as F from '../../../shared/formulas';
import { creatureSvg } from '../components/art';
import { esc, sheet, toast } from '../components/ui';
import { session } from '../game/session';
import { act } from './explore';

const regionName = (id: string) => REGIONS.find((r) => r.id === id)?.name || id;

export function renderCreatures(root: HTMLElement) {
  const v = session.view()!;
  const owned = CREATURES.filter((d) => v.creatures[d.id]);
  const can = CREATURES.filter((d) => !v.creatures[d.id] && d.id in v.discovered);
  root.innerHTML = `
    <h2 class="page">공명체 <small class="muted">${owned.length} / ${CREATURES.length}</small></h2>
    <div class="grid">${owned.map((d) => {
      const c = v.creatures[d.id];
      const inTeam = v.team.includes(d.id);
      return `<button class="mcard role-${d.role}" data-open="${d.id}">
        ${inTeam ? '<span class="tag">편대</span>' : ''}
        <div class="art">${creatureSvg(d.look, 72)}</div>
        <b>${esc(c.alias || d.name)}</b>
        <small>${ROLE_NAME[d.role]} · Lv.${c.level}${c.resonance ? ' · 공명 ' + c.resonance : ''}</small>
      </button>`;
    }).join('')}</div>
    ${can.length ? `<h3 class="sec">계약할 수 있는 공명체</h3><div class="list">${can.map((d) => `
      <div class="row-item">
        <div class="av">${creatureSvg(d.look, 44, { shadow: false })}</div>
        <div class="grow"><b>${esc(d.name)}</b> <small class="muted">${ROLE_NAME[d.role]} · ${regionName(d.region)}</small><br>
          <small class="muted">서식지 복원: 생명 파편 ${BN.fmt(BN.bn(d.contract.shards))}${d.contract.materials ? ' · 복원 재료 ' + d.contract.materials : ''}</small></div>
        <button class="btn sm primary" data-contract="${d.id}" ${BN.gte(v.cur.shards, BN.bn(d.contract.shards)) && BN.gte(v.cur.materials, BN.bn(d.contract.materials)) ? '' : 'disabled'}>계약</button>
      </div>`).join('')}</div>` : ''}
    <p class="hint">새 지역에 들어가면 그곳의 공명체를 발견해요. 계약한 공명체 수만큼 탐사 생산량 +3%.</p>`;
  root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) => b.onclick = () => openDetail(b.dataset.open!));
  root.querySelectorAll<HTMLButtonElement>('[data-contract]').forEach((b) => b.onclick = () => act(b, async () => {
    await session.send('upgrade', { kind: 'contract', id: b.dataset.contract! });
    toast(CREATURE_BY_ID[b.dataset.contract!].name + '와(과) 공명 계약을 맺었어요', 'ok');
  }));
}

export function openDetail(id: string) {
  const s = sheet('<div id="cd"></div>');
  const draw = () => {
    const v = session.view();
    if (!v || !v.creatures[id] || !document.body.contains(s.el)) return;
    const d = CREATURE_BY_ID[id], c = v.creatures[id], st = F.creatureStats(v, id);
    const lvCost = F.levelCost(c.level), skCost = F.skillCost(c.skill), rsCost = F.resonanceCost(c.resonance);
    const skOk = c.skill + 1 <= F.skillMax(c.level), rsOk = c.level >= F.resonanceNeedLevel(c.resonance);
    s.el.querySelector('#cd')!.innerHTML = `
      <div class="detail-head role-${d.role}">
        <div class="art">${creatureSvg(d.look, 112)}</div>
        <div><small class="eyebrow">${ROLE_NAME[d.role]} · ${regionName(d.region)}</small><h3>${esc(c.alias || d.name)}${c.alias ? ` <small class="muted">${esc(d.name)}</small>` : ''}</h3>
        <p class="muted small">${esc(ROLE_DESC[d.role])}</p></div>
      </div>
      <div class="stats">
        <div><small>공격</small><b>${BN.fmt(BN.powN(10, st.lAtk))}</b></div>
        <div><small>체력</small><b>${BN.fmt(BN.powN(10, st.lHp))}</b></div>
        <div><small>방어</small><b>${Math.round(st.def)}</b></div>
        <div><small>속도</small><b>${st.spd}</b></div>
      </div>
      <div class="skill"><b>${esc(d.skill.name)}</b> <span class="lv">Lv.${c.skill}</span><p class="muted small">${esc(d.skill.desc)} · ${d.skill.cd}턴마다 · 스킬 레벨당 효과 +15%</p></div>
      <div class="ups">
        <div class="up"><div><b>레벨 ${c.level}</b><small>${BN.fmt(lvCost)} 에너지</small></div><button class="btn sm" data-up="level">+1</button><button class="btn sm primary" data-up="level" data-times="10">+10</button></div>
        <div class="up"><div><b>스킬 ${c.skill}</b><small>${skOk ? BN.fmt(skCost) + ' 파편' : '레벨 ' + (c.skill * 5) + ' 필요'}</small></div><button class="btn sm primary" data-up="skill" ${skOk ? '' : 'disabled'}>+1</button></div>
        <div class="up"><div><b>공명 단계 ${c.resonance}</b><small>${rsOk ? BN.fmt(rsCost) + ' 복원 재료 · 능력치 ×1.5' : '레벨 ' + F.resonanceNeedLevel(c.resonance) + ' 필요'}</small></div><button class="btn sm primary" data-up="resonance" ${rsOk ? '' : 'disabled'}>공명</button></div>
      </div>
      <h4>특성 분기 ${c.resonance < 1 ? '<small class="muted">공명 1단계부터</small>' : c.trait ? '<small class="muted">바꾸기: 복원 재료 5</small>' : ''}</h4>
      <div class="traits">${(Object.keys(TRAITS) as Trait[]).map((t) => `<button class="trait${c.trait === t ? ' on' : ''}" data-trait="${t}" ${c.resonance < 1 || c.trait === t ? 'disabled' : ''}><b>${TRAITS[t].name}</b><small>${TRAITS[t].desc}</small></button>`).join('')}</div>
      <details class="lore"><summary>도감 기록</summary>
        <p>${esc(d.lore)}</p><p class="muted small">성격: ${esc(d.nature)} · 서식: ${esc(d.habitat)} · 처음 만난 깊이: ${c.firstRegionDepth} · 보스전 참여 ${c.battles}회</p>
        <label class="alias">별칭 <input class="input" maxlength="12" value="${esc(c.alias)}" placeholder="${esc(d.name)}"><button class="btn sm" data-alias>저장</button></label>
      </details>`;
    s.el.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => b.onclick = () => act(b, () => session.send('upgrade', { kind: b.dataset.up!, id, times: Number(b.dataset.times || 1) })));
    s.el.querySelectorAll<HTMLButtonElement>('[data-trait]').forEach((b) => b.onclick = () => act(b, () => session.send('upgrade', { kind: 'trait', id, trait: b.dataset.trait! })));
    const al = s.el.querySelector<HTMLButtonElement>('[data-alias]')!;
    al.onclick = () => act(al, async () => { await session.send('setAlias', { id, alias: (s.el.querySelector('.alias input') as HTMLInputElement).value }); toast('별칭을 저장했어요', 'ok'); });
  };
  const off = session.on(draw);
  const obs = new MutationObserver(() => { if (!document.body.contains(s.el)) { off(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
  draw();
}
