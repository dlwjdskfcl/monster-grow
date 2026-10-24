/**
 * 명령 처리 (순수 함수) — 서버(GAS)에서 실행해 정본 상태를 바꿈. 클라이언트는 '의도'만 보냄.
 *  applyCommand(상태, 명령, {now: 서버 시각, cfg, seed}) → { state, result }  (실패하면 GameError)
 * 모든 명령은 먼저 settle()로 지난 구간 보상을 '이전 편성·이전 깊이' 기준으로 정산한 뒤 처리.
 */
import * as B from './bignum';
import { simulateBoss } from './battle';
import { CREATURE_BY_ID, CREATURES, GameConfig, REGIONS, RESEARCH, ResearchKey, Trait, TRAITS } from './data';
import * as F from './formulas';
import { PlayerState, clone, newCreature, newState } from './state';

export type Action = 'sync' | 'claimOffline' | 'upgrade' | 'setTeam' | 'challengeBoss' | 'rebuildEcology' | 'setAlias';
export const ACTIONS: Action[] = ['sync', 'claimOffline', 'upgrade', 'setTeam', 'challengeBoss', 'rebuildEcology', 'setAlias'];

export type ErrorCode = 'AUTH_REQUIRED' | 'INVALID_REQUEST' | 'VERSION_CONFLICT' | 'DUPLICATE_REQUEST' | 'RATE_LIMITED' | 'MAINTENANCE' | 'SERVER_ERROR';

export class GameError extends Error {
  code: ErrorCode; reason: string;
  constructor(code: ErrorCode, reason: string) { super(reason); this.code = code; this.reason = reason; }
}
const bad = (reason: string) => new GameError('INVALID_REQUEST', reason);

export interface Ctx { now: number; cfg: GameConfig; seed: number }

export interface SettleReport {
  elapsed: number; recognized: number; capped: boolean;
  gained: { shards: string; energy: string; materials: string };
  depthFrom: number; depthTo: number;
}

/** 지난 구간 정산: 서버 시각 기준, 한도 있음. 음수 경과(시계 되돌림)는 0초로 봄 */
export function settle(s: PlayerState, now: number, cfg: GameConfig): SettleReport {
  const elapsed = Math.max(0, Math.floor((now - s.lastSettledAt) / 1000));
  const cap = F.offlineCapSeconds(s, cfg);
  const recognized = Math.min(elapsed, cap);
  const effSec = recognized;
  const r = F.rates(s, cfg);                       // 구간 시작 시점의 편성·깊이로 고정
  const g = { shards: B.mulN(r.shards, effSec), energy: B.mulN(r.energy, effSec), materials: B.mulN(r.materials, effSec) };
  s.cur.shards = B.add(s.cur.shards, g.shards);
  s.cur.energy = B.add(s.cur.energy, g.energy);
  s.cur.materials = B.add(s.cur.materials, g.materials);
  s.lastSettledAt = Math.max(s.lastSettledAt, now);
  const from = s.depth;
  advanceDepth(s);
  return { elapsed, recognized, capped: elapsed > cap, gained: { shards: B.str(g.shards), energy: B.str(g.energy), materials: B.str(g.materials) }, depthFrom: from, depthTo: s.depth };
}

/** 편대가 이길 수 있는 깊이까지 전진 (다음 관문에서 멈춤 — 새 지역은 보스를 깨야 열림) */
export function advanceDepth(s: PlayerState) {
  const d = Math.max(s.depth, F.reachableDepth(s));
  s.depth = Math.min(d, F.gateDepth(s.gates));
  s.maxDepth = Math.max(s.maxDepth, s.depth);
  if (s.depth > s.bestDepth) s.bestDepth = s.depth;
  REGIONS.forEach((reg, i) => {
    if (!F.regionUnlocked(s, i)) return;
    for (const c of CREATURES) if (c.region === reg.id && !(c.id in s.discovered)) s.discovered[c.id] = s.lastSettledAt;
  });
}

function spend(s: PlayerState, k: 'shards' | 'energy' | 'materials' | 'seeds', amt: B.BN) {
  if (!B.gte(s.cur[k], amt)) throw bad('NOT_ENOUGH_' + k.toUpperCase());
  s.cur[k] = B.sub(s.cur[k], amt);
  if (B.isNeg(s.cur[k])) s.cur[k] = B.ZERO;   // 반올림 오차 보호 (gte 확인 후라 실제 음수는 없음)
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const intIn = (x: unknown, a: number, b: number) => typeof x === 'number' && Number.isInteger(x) && x >= a && x <= b;

function ownCreature(s: PlayerState, id: unknown) {
  if (typeof id !== 'string' || !CREATURE_BY_ID[id]) throw bad('UNKNOWN_CREATURE');
  const c = s.creatures[id];
  if (!c) throw bad('NOT_CONTRACTED');
  return c;
}

export interface CommandResult { action: Action; settle: SettleReport; data: Record<string, unknown> }

export function applyCommand(s0: PlayerState, cmd: { action: string; payload?: unknown }, ctx: Ctx): { state: PlayerState; result: CommandResult } {
  if (!ACTIONS.includes(cmd.action as Action)) throw bad('UNKNOWN_ACTION');
  const action = cmd.action as Action;
  const p = cmd.payload === undefined ? {} : cmd.payload;
  if (!isObj(p)) throw bad('PAYLOAD_NOT_OBJECT');
  const s = clone(s0);
  const rep = settle(s, ctx.now, ctx.cfg);
  const data: Record<string, unknown> = {};

  switch (action) {
    case 'sync': break;
    case 'claimOffline': s.stats.offlineClaims += rep.recognized >= 600 ? 1 : 0; break;

    case 'upgrade': {
      const kind = p.kind;
      const times = p.times === undefined ? 1 : p.times;
      if (!intIn(times, 1, 100)) throw bad('BAD_TIMES');
      let done = 0;
      if (kind === 'level') {
        const c = ownCreature(s, p.id);
        for (; done < (times as number); done++) {
          const cost = F.levelCost(c.level);
          if (!B.gte(s.cur.energy, cost)) break;
          spend(s, 'energy', cost); c.level += 1;
        }
      } else if (kind === 'skill') {
        const c = ownCreature(s, p.id);
        for (; done < (times as number); done++) {
          if (c.skill + 1 > F.skillMax(c.level)) { if (!done) throw bad('SKILL_NEEDS_LEVEL'); break; }
          const cost = F.skillCost(c.skill);
          if (!B.gte(s.cur.shards, cost)) break;
          spend(s, 'shards', cost); c.skill += 1;
        }
      } else if (kind === 'resonance') {
        const c = ownCreature(s, p.id);
        if (c.level < F.resonanceNeedLevel(c.resonance)) throw bad('RESONANCE_NEEDS_LEVEL');
        spend(s, 'materials', F.resonanceCost(c.resonance)); c.resonance += 1; done = 1;
      } else if (kind === 'trait') {
        const c = ownCreature(s, p.id);
        if (typeof p.trait !== 'string' || !(p.trait in TRAITS)) throw bad('UNKNOWN_TRAIT');
        if (c.resonance < 1) throw bad('TRAIT_NEEDS_RESONANCE');
        if (c.trait === p.trait) throw bad('SAME_TRAIT');
        if (c.trait) spend(s, 'materials', B.bn(F.TRAIT_CHANGE_COST));
        c.trait = p.trait as Trait; done = 1;
      } else if (kind === 'research') {
        if (typeof p.key !== 'string' || !(p.key in RESEARCH)) throw bad('UNKNOWN_RESEARCH');
        const k = p.key as ResearchKey;
        for (; done < (times as number); done++) {
          if (s.research[k] >= RESEARCH[k].max) { if (!done) throw bad('RESEARCH_MAX'); break; }
          const cost = F.researchCost(k, s.research[k]);
          if (!B.gte(s.cur.shards, cost)) break;
          spend(s, 'shards', cost); s.research[k] += 1;
        }
      } else if (kind === 'contract') {
        if (typeof p.id !== 'string' || !CREATURE_BY_ID[p.id]) throw bad('UNKNOWN_CREATURE');
        const d = CREATURE_BY_ID[p.id];
        if (s.creatures[d.id]) throw bad('ALREADY_CONTRACTED');
        if (!(d.id in s.discovered)) throw bad('NOT_DISCOVERED');
        spend(s, 'shards', B.bn(d.contract.shards));
        spend(s, 'materials', B.bn(d.contract.materials));
        s.creatures[d.id] = newCreature(ctx.now, s.depth); done = 1;
      } else throw bad('UNKNOWN_UPGRADE');
      if (!done) throw bad('NOT_ENOUGH_RESOURCES');
      data.done = done;
      break;
    }

    case 'setTeam': {
      const t = p.team;
      if (!Array.isArray(t) || t.length < 1 || t.length > ctx.cfg.maxTeam) throw bad('BAD_TEAM_SIZE');
      if (new Set(t).size !== t.length) throw bad('DUPLICATE_MEMBER');
      t.forEach((id) => ownCreature(s, id));
      s.team = t.slice() as string[];
      advanceDepth(s);
      break;
    }

    case 'challengeBoss': {
      if (s.team.length < ctx.cfg.minTeamForBoss) throw bad('TEAM_TOO_SMALL');
      if (s.depth < F.gateDepth(s.gates)) throw bad('GATE_NOT_REACHED');
      const res = simulateBoss(s, ctx.seed);
      const bossId = res.boss.id + (res.boss.tier ? '#' + res.boss.tier : '');
      s.stats.bossTries += 1;
      for (const id of s.team) s.creatures[id].battles += 1;
      if (res.win) {
        const first = !s.firstClears.includes(bossId);
        const rw = F.bossReward(s.gates, first);
        s.cur.shards = B.add(s.cur.shards, rw.shards);
        s.cur.materials = B.add(s.cur.materials, rw.materials);
        if (first) s.firstClears.push(bossId);
        s.gates += 1; s.stats.bossWins += 1;
        advanceDepth(s);
        data.reward = { shards: B.str(rw.shards), materials: B.str(rw.materials), first };
      }
      data.battle = res;
      break;
    }

    case 'rebuildEcology': {
      if (p.confirm !== true) throw bad('CONFIRM_REQUIRED');
      if (s.maxDepth < ctx.cfg.rebuildMinDepth) throw bad('REBUILD_LOCKED');
      const seeds = F.rebuildSeeds(s);
      const keep = s;
      const fresh = newState(ctx.now);
      // 유지: 계약·공명 단계·특성·별칭·도감·연구·보스 최초 기록·통산 기록 / 초기화: 깊이·관문·재화·레벨·스킬
      for (const id of Object.keys(keep.creatures)) {
        const c = keep.creatures[id];
        fresh.creatures[id] = { ...c, level: 1, skill: 0 };
      }
      fresh.createdAt = keep.createdAt; fresh.revision = keep.revision; fresh.recent = keep.recent;
      fresh.discovered = keep.discovered; fresh.research = keep.research; fresh.firstClears = keep.firstClears;
      fresh.team = keep.team.filter((id) => fresh.creatures[id]);
      fresh.bestDepth = keep.bestDepth; fresh.stats = keep.stats;
      fresh.rebuilds = keep.rebuilds + 1;
      fresh.cur.seeds = B.add(keep.cur.seeds, seeds);
      fresh.seedsEarned = B.add(keep.seedsEarned, seeds);
      Object.assign(s, fresh);
      data.seeds = B.str(seeds);
      break;
    }

    case 'setAlias': {
      const c = ownCreature(s, p.id);
      if (typeof p.alias !== 'string' || p.alias.length > 12) throw bad('BAD_ALIAS');
      c.alias = p.alias.replace(/[\u0000-\u001f<>"'`=+@]/g, '').trim();
      break;
    }
  }
  s.stats.commands += 1;
  return { state: s, result: { action, settle: rep, data } };
}
