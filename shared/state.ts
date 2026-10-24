/**
 * 플레이어 상태 — 서버(GAS)가 정본, 클라이언트는 받은 상태를 보여주기만 함
 * 직렬화(JSON)할 때 큰 수는 문자열("1.5e3"), 나머지는 일반 숫자
 */
import { BN, ZERO, bn, str } from './bignum';
import { CREATURES, ResearchKey, Trait } from './data';

export const SCHEMA_VERSION = 1;

export interface CreatureState {
  level: number;
  skill: number;
  resonance: number;
  trait: Trait | null;
  alias: string;
  contractedAt: number;
  firstRegionDepth: number;   // 최초 발견 깊이
  battles: number;            // 상호작용 기록 (보스전 참여 수)
}

export interface Currencies { shards: BN; energy: BN; materials: BN; seeds: BN }

export interface PlayerState {
  schemaVersion: number;
  createdAt: number;
  lastSettledAt: number;      // 서버 시각(ms). 보상은 이 시각부터 계산
  revision: number;
  cur: Currencies;
  depth: number;              // 지금 탐사 깊이
  maxDepth: number;           // 이번 순환(재구성 전)의 최고 깊이
  bestDepth: number;          // 통산 최고 깊이
  gates: number;              // 이번 순환에서 깬 관문 수 (관문 = 깊이 20·40·60 …의 보스)
  firstClears: string[];      // 처음 깬 보스 id (발견 보너스 1회)
  creatures: Record<string, CreatureState>;
  discovered: Record<string, number>;   // 도감: 발견한 공명체 id → 시각
  team: string[];
  research: Record<ResearchKey, number>;
  rebuilds: number;
  seedsEarned: BN;
  stats: { bossTries: number; bossWins: number; offlineClaims: number; commands: number };
  recent: { id: string; a: string; r: number }[];   // 최근 처리한 requestId (중복 방지, 최대 40)
}

export function newCreature(now: number, depth: number): CreatureState {
  return { level: 1, skill: 0, resonance: 0, trait: null, alias: '', contractedAt: now, firstRegionDepth: depth, battles: 0 };
}

export function newState(now: number): PlayerState {
  const creatures: Record<string, CreatureState> = {};
  const discovered: Record<string, number> = {};
  const team: string[] = [];
  for (const c of CREATURES) {
    if (c.starter) { creatures[c.id] = newCreature(now, 1); team.push(c.id); }
    if (c.region === 'mycel') discovered[c.id] = now;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now, lastSettledAt: now, revision: 0,
    cur: { shards: bn(50), energy: bn(100), materials: ZERO, seeds: ZERO },
    depth: 1, maxDepth: 1, bestDepth: 1, gates: 0, firstClears: [],
    creatures, discovered, team,
    research: { gather: 0, offline: 0, harmony: 0, instinct: 0, sense: 0 },
    rebuilds: 0, seedsEarned: ZERO,
    stats: { bossTries: 0, bossWins: 0, offlineClaims: 0, commands: 0 },
    recent: []
  };
}

/* ---------- 직렬화 ---------- */
type Json = Record<string, unknown>;

export function serialize(s: PlayerState): string {
  return JSON.stringify(s, (_k, v) => (v && typeof v === 'object' && typeof v.m === 'number' && typeof v.e === 'number' && Object.keys(v).length === 2 ? str(v) : v));
}

const BN_PATHS = ['shards', 'energy', 'materials', 'seeds'];

export function deserialize(text: string): PlayerState {
  const o = JSON.parse(text) as Json;
  return migrate(o);
}

/** 예전 스키마 → 지금 스키마. 새 버전을 만들면 여기에 단계를 추가 (docs/13_백업_복구_마이그레이션.md) */
export function migrate(o: Json): PlayerState {
  const v = Number(o.schemaVersion || 0);
  if (v > SCHEMA_VERSION) throw new Error('SCHEMA_TOO_NEW');
  // v0 → v1: (예시) recent 가 없던 상태
  if (!Array.isArray(o.recent)) o.recent = [];
  const cur = (o.cur || {}) as Json;
  const out = o as unknown as PlayerState;
  out.cur = {} as Currencies;
  for (const k of BN_PATHS) (out.cur as unknown as Record<string, BN>)[k] = bn((cur[k] as string) ?? '0');
  out.seedsEarned = bn((o.seedsEarned as string) ?? '0');
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

export function clone(s: PlayerState): PlayerState { return deserialize(serialize(s)); }
