/** 보스전 재생 — 서버가 확정한 기록(log)을 보여주기만 함 (승패·보상은 이미 서버에서 결정됨) */
import * as BN from '../../../shared/bignum';
import type { BattleResult } from '../../../shared/battle';
import { CREATURE_BY_ID } from '../../../shared/data';
import { bossSvg, creatureSvg } from '../components/art';
import { esc, reducedMotion, sheet } from '../components/ui';

const KIND: Record<string, string> = { atk: '', skill: '스킬', crack: '균열', shield: '방벽', buff: '공명', hit: '' };

export function playBattle(b: BattleResult, reward?: { shards: string; materials: string; first: boolean }) {
  SCALE = b.scale;
  const s = sheet(`
    <div class="battle">
      <div class="b-boss"><div class="art">${bossSvg(b.boss.id, 120)}</div><b>${esc(b.boss.name)}${b.boss.tier ? ' · 변이 ' + b.boss.tier : ''}</b><div class="hp"><i id="bhp" style="width:100%"></i></div></div>
      <div class="b-log" id="blog" aria-live="polite"></div>
      <div class="b-team">${b.team.map((t, i) => `<div class="bt" id="bt${i}"><div class="art">${creatureSvg(CREATURE_BY_ID[t.id].look, 48, { shadow: false })}</div><div class="hp"><i style="width:100%"></i></div></div>`).join('')}</div>
      <div class="b-result hide" id="bres"></div>
      <div class="row end"><button class="btn ghost" id="bskip">건너뛰기</button></div>
    </div>`, { wide: true });
  const el = s.el;
  let bossHp = b.boss.max;
  const hp = b.team.map((t) => t.max);
  const logEl = el.querySelector('#blog')!;
  let i = 0, timer = 0;
  const step = () => {
    const e = b.log[i++];
    if (!e) return finish();
    const [round, who, kind, tgt, amt] = e;
    if (tgt === -1) { bossHp = Math.max(0, bossHp - amt); (el.querySelector('#bhp') as HTMLElement).style.width = (bossHp / b.boss.max) * 100 + '%'; el.querySelector('.b-boss')!.classList.remove('shake'); void (el.querySelector('.b-boss') as HTMLElement).offsetWidth; el.querySelector('.b-boss')!.classList.add('shake'); }
    if (who === -1 && tgt >= 0 && tgt < 9) { hp[tgt] = Math.max(0, hp[tgt] - amt); const bt = el.querySelector(`#bt${tgt}`) as HTMLElement; (bt.querySelector('.hp i') as HTMLElement).style.width = (hp[tgt] / b.team[tgt].max) * 100 + '%'; bt.classList.toggle('down', hp[tgt] <= 0); }
    const name = who === -1 ? b.boss.name : CREATURE_BY_ID[b.team[who].id].name;
    const line = document.createElement('div');
    line.innerHTML = `<small>R${round}</small> ${esc(name)} ${KIND[kind] ? `<em>${KIND[kind]}</em>` : ''} ${kind === 'shield' ? '방벽 ' + fmtN(amt) : kind === 'buff' ? '공격 +' + amt + '%' : fmtN(amt) + ' 피해'}`;
    logEl.prepend(line);
    if (logEl.childElementCount > 5) logEl.lastElementChild?.remove();
    timer = window.setTimeout(step, reducedMotion() ? 0 : Math.max(60, 4200 / b.log.length));
  };
  const finish = () => {
    window.clearTimeout(timer);
    const r = el.querySelector('#bres') as HTMLElement;
    r.classList.remove('hide');
    r.innerHTML = b.win
      ? `<h3>승리! (${b.rounds}라운드)</h3>${reward ? `<p>생명 파편 <b>+${BN.fmt(BN.parse(reward.shards))}</b> · 복원 재료 <b>+${BN.fmt(BN.parse(reward.materials))}</b>${reward.first ? ' <span class="chip">첫 승리</span>' : ''}</p>` : ''}<p class="muted">새 지역으로 가는 길이 열렸어요.</p>`
      : `<h3>후퇴…</h3><p class="muted">${b.rounds >= 30 ? '30라운드 안에 쓰러뜨리지 못했어요.' : '편대가 모두 쓰러졌어요.'} 레벨·스킬·공명 단계를 올리거나 역할을 섞어 보세요 (전위 앞줄, 변환으로 균열, 조율로 강화).</p>`;
    const sk = el.querySelector('#bskip') as HTMLButtonElement;
    sk.textContent = '닫기'; sk.onclick = s.close;
  };
  (el.querySelector('#bskip') as HTMLElement).onclick = () => { while (i < b.log.length) { const e = b.log[i++]; if (e[3] === -1) bossHp -= e[4]; } (el.querySelector('#bhp') as HTMLElement).style.width = Math.max(0, bossHp / b.boss.max) * 100 + '%'; b.team.forEach((t, k) => { const bt = el.querySelector(`#bt${k}`) as HTMLElement; (bt.querySelector('.hp i') as HTMLElement).style.width = (t.hp / t.max) * 100 + '%'; bt.classList.toggle('down', t.hp <= 0); }); finish(); };
  step();
}

let SCALE = 0;
/** 전투 기록 숫자는 10^scale 로 나눠져 있음 → 원래 크기로 표시 */
function fmtN(x: number) { return BN.fmt(BN.mul(BN.bn(Math.max(0, x)), BN.powN(10, SCALE))); }
