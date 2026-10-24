/**
 * 성장·탐사·보상 공식 (순수 함수). 능력치는 지수적으로 커지므로 log10 값으로 다룸 (넘침 없음)
 *   lAtk = log10(공격력), lHp = log10(체력). 방어력은 작은 일반 숫자.
 */
import * as B from './bignum';
import { BN } from './bignum';
import { BOSSES, CREATURE_BY_ID, GameConfig, REGIONS, RESEARCH, ResearchKey, Role } from './data';
import { PlayerState } from './state';

/** 밸런스 상수 (scripts/balance-sim.ts 로 맞춤). 운영 중 큰 조정은 새 configVersion 과 함께 */
export const L = {
  enemyBase: 2.2,               // log10(첫 적 전투력)
  enemyGrowth: 0.0792,          // 깊이 1당 적 전투력 ×1.2
  shardBase: 0.5,
  rewardGrowth: 1.105,
  energyPerShard: 2,
  matPerSec: 0.0006,
  bandSize: 20,
  levelBase: 10, levelGrowth: 1.17,
  skillBase: 40, skillGrowth: 1.7,
  levelLin: 0.1, levelDoubleEvery: 25,
  seedEach: 0.1, seedPow: 1.4
};

/* ---------- 지역·관문 ---------- */
export function bandOf(depth: number): number { return Math.floor((Math.max(1, depth) - 1) / L.bandSize); }
export function regionOf(depth: number) { return REGIONS[bandOf(depth) % REGIONS.length]; }
/** 변이 단계: 60 이후 한 바퀴마다 +1 */
export function tierOf(depth: number): number { return Math.floor(bandOf(depth) / REGIONS.length); }
/** 이번 순환에서 갈 수 있는 최대 깊이 = 다음 관문 깊이 (그 깊이에서 보스 도전) */
export function gateDepth(gates: number): number { return (gates + 1) * L.bandSize; }
export function bossAt(gates: number) {
  const b = BOSSES[gates % BOSSES.length];
  return { ...b, tier: Math.floor(gates / BOSSES.length), depth: gateDepth(gates) };
}
/** 지역 해금 = 통산 최고 깊이가 그 지역에 들어간 적이 있음 (계약·도감 발견 조건) */
export function regionUnlocked(s: PlayerState, regionIndex: number): boolean {
  return s.bestDepth > regionIndex * L.bandSize;
}

/* ---------- 배율 ---------- */
export function seedMult(s: PlayerState): number { return 1 + L.seedEach * Math.min(B.toNumber(s.cur.seeds), 1e12); }
export function contractedCount(s: PlayerState): number { return Object.keys(s.creatures).length; }
function traitCount(s: PlayerState, t: string): number {
  return s.team.filter((id) => s.creatures[id] && s.creatures[id].trait === t).length;
}

/* ---------- 공명체 능력치 ---------- */
export interface Stats { lAtk: number; lHp: number; def: number; spd: number; role: Role; region: string }

export function levelLog(level: number): number {
  return Math.log10(1 + L.levelLin * (level - 1)) + Math.floor(level / L.levelDoubleEvery) * Math.log10(2);
}

export function creatureStats(s: PlayerState, id: string): Stats {
  const d = CREATURE_BY_ID[id];
  const c = s.creatures[id];
  if (!d || !c) throw new Error('NO_CREATURE');
  const res = c.resonance * Math.log10(1.5);
  const sm = Math.log10(seedMult(s));
  const lv = levelLog(c.level);
  let lAtk = Math.log10(d.atk) + lv + res + sm + Math.log10(1 + 0.12 * s.research.harmony);
  let lHp = Math.log10(d.hp) + lv + res + sm + Math.log10(1 + 0.12 * s.research.instinct);
  let def = d.def * (1 + 0.03 * (c.level - 1)) * Math.pow(1.2, c.resonance);
  if (c.trait === 'atk') lAtk += Math.log10(1.25);
  if (c.trait === 'surv') { lHp += Math.log10(1.25); def *= 1.25; }
  return { lAtk, lHp, def, spd: d.spd, role: d.role, region: d.region };
}

/** 로그 합: log10(Σ10^x) */
export function logSum(xs: number[]): number {
  if (!xs.length) return -Infinity;
  const m = Math.max(...xs);
  return m + Math.log10(xs.reduce((a, x) => a + Math.pow(10, x - m), 0));
}

/** 편대 전투력 (log10). 공명체 하나 = 공격력 × √체력, 역할이 다양하면 +6%씩 */
export function teamPower(s: PlayerState): number {
  const ids = s.team.filter((id) => s.creatures[id]);
  if (!ids.length) return -Infinity;
  const ps = ids.map((id) => { const st = creatureStats(s, id); return st.lAtk + 0.5 * st.lHp; });
  const roles = new Set(ids.map((id) => CREATURE_BY_ID[id].role)).size;
  return logSum(ps) + Math.log10(1 + 0.06 * (roles - 1));
}

/** 깊이 d 의 적 전투력 (log10) */
export function enemyPower(d: number): number { return L.enemyBase + (d - 1) * L.enemyGrowth; }

/** 편대가 막힘없이 탐사할 수 있는 깊이 (관문에서 멈춤) */
export function reachableDepth(s: PlayerState): number {
  const p = teamPower(s);
  if (!isFinite(p)) return s.depth;
  const d = Math.floor((p - L.enemyBase) / L.enemyGrowth) + 1;
  return Math.max(1, Math.min(d, gateDepth(s.gates)));
}

/* ---------- 생산량 (초당) ---------- */
export interface Rates { shards: BN; energy: BN; materials: BN }

export function rates(s: PlayerState, cfg: GameConfig): Rates {
  const mult = cfg.prodMult * (1 + 0.15 * s.research.gather) * (1 + 0.08 * traitCount(s, 'auto')) * seedMult(s) * (1 + 0.03 * contractedCount(s));
  const shards = B.mulN(B.powN(L.rewardGrowth, s.depth - 1), L.shardBase * mult);
  return {
    shards,
    energy: B.mulN(shards, L.energyPerShard),
    materials: B.bn(L.matPerSec * (1 + bandOf(s.depth)) * (1 + 0.2 * s.research.sense) * cfg.prodMult)
  };
}

/** 정산 한도 (초). 접속 중이어도 저장 없이 이 시간이 지나면 더 쌓이지 않음 → 클라이언트가 주기적으로 자동 저장 */
export function offlineCapSeconds(s: PlayerState, cfg: GameConfig): number {
  const h = cfg.offlineCapHours + Math.min(s.research.offline, RESEARCH.offline.max) + 1 * traitCount(s, 'off');
  return Math.round(h * 3600);
}

/* ---------- 비용 ---------- */
export function levelCost(level: number): BN { return B.mulN(B.powN(L.levelGrowth, level - 1), L.levelBase); }
export function skillCost(skill: number): BN { return B.mulN(B.powN(L.skillGrowth, skill), L.skillBase); }
export function skillMax(level: number): number { return Math.floor(level / 5) + 1; }
export function resonanceCost(r: number): BN { return B.bn(Math.ceil(3 * Math.pow(2.2, r))); }
export function resonanceNeedLevel(r: number): number { return 15 * (r + 1); }
export function researchCost(k: ResearchKey, lv: number): BN { return B.mulN(B.powN(RESEARCH[k].growth, lv), RESEARCH[k].base); }
export const TRAIT_CHANGE_COST = 5;

/* ---------- 보스 ---------- */
export const BOSS_K = { atk: Math.log10(1.6), hp: Math.log10(20), def: 30, spd: 5 };
export function bossStats(gates: number) {
  const b = bossAt(gates);
  const e = enemyPower(b.depth) + (gates === 0 ? 0 : Math.log10(1.5));   // 첫 보스는 조금 쉽게 (입문)
  // 전투력(공격 × √체력) ∝ E 가 되도록 공격·체력을 E^(2/3) 에 맞춤
  return { ...b, lAtk: (2 / 3) * e + BOSS_K.atk, lHp: (2 / 3) * e + BOSS_K.hp, def: BOSS_K.def + 12 * b.tier, spd: BOSS_K.spd };
}
export function bossReward(gates: number, first: boolean) {
  const b = bossAt(gates);
  const shards = B.mulN(B.powN(L.rewardGrowth, b.depth - 1), L.shardBase * 600);
  return { shards, materials: B.bn((first ? 12 : 4) * (1 + b.tier) * (1 + (gates % 3))) };
}

/* ---------- 생태 재구성 ---------- */
export function rebuildSeeds(s: PlayerState): BN {
  const x = (s.maxDepth - 20) / 10;
  if (x <= 0) return B.ZERO;
  return B.bn(Math.floor(Math.pow(x, L.seedPow) * (1 + 0.05 * contractedCount(s))));
}
