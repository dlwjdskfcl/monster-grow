/** 연구소: 원정단 전체에 적용되는 영구 효과 (생태 재구성 뒤에도 유지) */
import * as BN from '../../../shared/bignum';
import { RESEARCH, ResearchKey } from '../../../shared/data';
import * as F from '../../../shared/formulas';
import { esc } from '../components/ui';
import { session } from '../game/session';
import { act } from './explore';

const ICON: Record<ResearchKey, string> = { gather: '🧺', offline: '⛺', harmony: '🎵', instinct: '🛡️', sense: '🔍' };

export function renderLab(root: HTMLElement) {
  const v = session.view()!;
  root.innerHTML = `
    <h2 class="page">연구소</h2>
    <p class="muted">생명 파편으로 연구해요. 연구 효과는 생태 재구성 뒤에도 남아요.</p>
    <div class="list">${(Object.keys(RESEARCH) as ResearchKey[]).map((k) => {
      const r = RESEARCH[k], lv = v.research[k], maxed = lv >= r.max;
      const cost = F.researchCost(k, lv);
      return `<div class="row-item">
        <div class="av emoji">${ICON[k]}</div>
        <div class="grow"><b>${esc(r.name)}</b> <span class="lv">${lv}${r.max < 1e6 ? ' / ' + r.max : ''}</span><br><small class="muted">${esc(r.desc)}</small><br>
          <small>${maxed ? '최대 단계' : BN.fmt(cost) + ' 파편'}</small></div>
        <button class="btn sm primary" data-r="${k}" ${maxed || !BN.gte(v.cur.shards, cost) ? 'disabled' : ''}>연구</button>
      </div>`;
    }).join('')}</div>
    <div class="card"><b>지금 효과</b>
      <ul class="plain small">
        <li>탐사 생산량 ×${(1 + 0.15 * v.research.gather).toFixed(2)}</li>
        <li>정산 한도 ${Math.round(F.offlineCapSeconds(v, session.cfg) / 360) / 10}시간</li>
        <li>편대 공격 ×${(1 + 0.12 * v.research.harmony).toFixed(2)} · 체력 ×${(1 + 0.12 * v.research.instinct).toFixed(2)}</li>
        <li>복원 재료 ×${(1 + 0.2 * v.research.sense).toFixed(1)}</li>
      </ul></div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-r]').forEach((b) => b.onclick = () => act(b, () => session.send('upgrade', { kind: 'research', key: b.dataset.r! })));
}
