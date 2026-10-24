/**
 * 밸런스 시뮬레이션 — '욕심쟁이' 플레이어가 가장 싼 강화부터 사며 진행할 때 시간별 진행도
 * 실행: npm run sim   (결과 표는 docs/04_게임시스템_명세.md 에 붙여 둠)
 */
import * as B from '../shared/bignum';
import { applyCommand, GameError } from '../shared/commands';
import { CREATURES, DEFAULT_CONFIG, RESEARCH, ResearchKey } from '../shared/data';
import * as F from '../shared/formulas';
import { newState, PlayerState } from '../shared/state';

const cfg = DEFAULT_CONFIG;
// 튜닝 실험: TUNE='{"shardBase":0.5}' npm run sim
declare const process: { env: Record<string, string | undefined> };
if (process.env.TUNE) Object.assign(F.L, JSON.parse(process.env.TUNE));
let s: PlayerState = newState(0);
let now = 0;
let seed = 1;
const run = (action: string, payload: Record<string, unknown> = {}) => {
  try { const r = applyCommand(s, { action, payload }, { now, cfg, seed: seed++ }); s = r.state; return r.result; }
  catch (e) { if (e instanceof GameError) return null; throw e; }
};

function spendAll() {
  for (let guard = 0; guard < 400; guard++) {
    // 후보: [비용(log10), 명령]
    const opts: [number, string, Record<string, unknown>][] = [];
    for (const id of s.team) {
      const c = s.creatures[id];
      opts.push([B.log10(F.levelCost(c.level)) - B.log10(B.max(s.cur.energy, B.bn(1e-9))), 'upgrade', { kind: 'level', id }]);
      if (c.skill + 1 <= F.skillMax(c.level)) opts.push([B.log10(F.skillCost(c.skill)) - B.log10(B.max(s.cur.shards, B.bn(1e-9))) + 0.3, 'upgrade', { kind: 'skill', id }]);
      if (c.level >= F.resonanceNeedLevel(c.resonance)) opts.push([B.log10(F.resonanceCost(c.resonance)) - B.log10(B.max(s.cur.materials, B.bn(1e-9))), 'upgrade', { kind: 'resonance', id }]);
      if (c.resonance >= 1 && !c.trait) opts.push([-9, 'upgrade', { kind: 'trait', id, trait: CREATURES.find((d) => d.id === id)!.role === 'guard' ? 'surv' : 'atk' }]);
    }
    for (const k of ['gather', 'harmony', 'instinct', 'offline', 'sense'] as ResearchKey[]) {
      if (s.research[k] < RESEARCH[k].max) opts.push([B.log10(F.researchCost(k, s.research[k])) - B.log10(B.max(s.cur.shards, B.bn(1e-9))) + 0.2, 'upgrade', { kind: 'research', key: k }]);
    }
    for (const d of CREATURES) {
      if (s.discovered[d.id] && !s.creatures[d.id] && B.gte(s.cur.shards, B.bn(d.contract.shards)) && B.gte(s.cur.materials, B.bn(d.contract.materials))) opts.push([-8, 'upgrade', { kind: 'contract', id: d.id }]);
    }
    opts.sort((a, b) => a[0] - b[0]);
    const pick = opts.find((o) => o[0] <= 0);
    if (!pick) return;
    if (!run(pick[1], pick[2])) return;
    if (pick[2].kind === 'contract') bestTeam();
  }
}

function bestTeam() {
  const ids = Object.keys(s.creatures);
  const power = (id: string) => { const st = F.creatureStats(s, id); return st.lAtk + 0.5 * st.lHp; };
  ids.sort((a, b) => power(b) - power(a));
  const byRole: Record<string, string> = {};
  for (const id of ids) { const r = CREATURES.find((d) => d.id === id)!.role; if (!byRole[r]) byRole[r] = id; }
  const team = Object.values(byRole);
  for (const id of ids) if (team.length < 5 && !team.includes(id)) team.push(id);
  const guards = team.filter((id) => CREATURES.find((d) => d.id === id)!.role === 'guard');
  const ordered = [...guards, ...team.filter((id) => !guards.includes(id))];
  run('setTeam', { team: ordered });
}

const marks = [600, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 3 * 86400, 7 * 86400];
const rows: string[] = [];
let lastProgress = 0, lastMax = 0;
const STEP = 120;
for (let t = 0; t <= 7 * 86400; t += STEP) {
  now = t * 1000;
  run('claimOffline');
  spendAll();
  if (s.depth >= F.gateDepth(s.gates) && t % 600 === 0) { const r = run('challengeBoss'); if (r && (r.data.battle as { win: boolean }).win) bestTeam(); }
  if (s.maxDepth > lastMax) { lastMax = s.maxDepth; lastProgress = t; }
  // 재구성: 2시간 넘게 막혔고 씨앗이 지금의 1.5배 이상이면
  if (s.maxDepth >= cfg.rebuildMinDepth && t - lastProgress > 7200 && B.toNumber(F.rebuildSeeds(s)) >= Math.max(2, 0.5 * B.toNumber(s.cur.seeds))) {
    run('rebuildEcology', { confirm: true }); lastMax = 0; lastProgress = t; bestTeam();
  }
  if (marks.includes(t)) {
    const lv = s.team.map((id) => s.creatures[id].level).join('/');
    rows.push(`| ${t < 3600 ? t / 60 + '분' : t < 86400 ? t / 3600 + '시간' : t / 86400 + '일'} | ${s.depth} | ${s.bestDepth} | ${s.gates} | ${Object.keys(s.creatures).length} | ${lv} | ${B.fmt(s.cur.shards)} | ${B.fmt(F.rates(s, cfg).shards)}/초 | ${s.rebuilds} | ${B.fmt(s.cur.seeds)} | ${s.stats.bossWins}/${s.stats.bossTries} |`);
  }
}
console.log('| 경과 | 깊이 | 통산 최고 | 관문 | 공명체 | 편대 레벨 | 생명 파편 | 생산 | 재구성 | 씨앗 | 보스 승/도전 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
