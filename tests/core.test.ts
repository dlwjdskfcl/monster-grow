// 게임 핵심 단위 테스트 — 실행: npm test
import { describe, expect, it } from 'vitest';
import * as B from '../shared/bignum';
import { simulateBoss } from '../shared/battle';
import { applyCommand, GameError, settle } from '../shared/commands';
import { CREATURES, DEFAULT_CONFIG } from '../shared/data';
import * as F from '../shared/formulas';
import { processRequest, validateShape, versionLess } from '../shared/protocol';
import { deserialize, newState, PlayerState, serialize } from '../shared/state';

const cfg = DEFAULT_CONFIG;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const req = (n: number, action: string, payload: Record<string, unknown> = {}, rev = 0) =>
  ({ requestId: uuid(n), action, payload, expectedRevision: rev, clientVersion: '0.1.0', schemaVersion: 1 }) as never;
const err = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as GameError).reason || (e as Error).message; } return 'NO_ERROR'; };

describe('큰 수', () => {
  it('직렬화·역직렬화가 같은 값', () => {
    for (const v of [0, 1, 9.99, 12345.678, 1e15, 2 ** 60, 123456789012345678]) {
      const a = B.bn(v);
      expect(B.parse(B.str(a))).toEqual(a);
    }
    const big = B.powN(1.1, 5000);
    expect(B.parse(B.str(big))).toEqual(big);
    expect(big.e).toBe(206);
  });
  it('안전 정수 범위를 넘는 값도 비교·덧셈이 맞음', () => {
    const a = B.parse('9.007199254740e15'), b = B.add(a, B.bn(1e5));   // 유효숫자 12자리 (상대 오차 1e-12)
    expect(B.gt(b, a)).toBe(true);
    expect(B.gt(B.powN(10, 400), B.powN(10, 399))).toBe(true);
  });
  it('NaN·Infinity·잘못된 문자열은 거부', () => {
    expect(() => B.bn(NaN)).toThrow();
    expect(() => B.bn(Infinity)).toThrow();
    expect(() => B.parse('1e')).toThrow();
    expect(() => B.parse('abc')).toThrow();
    expect(() => B.parse('1'.repeat(50))).toThrow();
  });
  it('뺄셈 음수 판정', () => {
    expect(B.isNeg(B.sub(B.bn(3), B.bn(5)))).toBe(true);
    expect(B.cmp(B.bn(5), B.bn(5))).toBe(0);
  });
  it('표시 형식', () => {
    expect(B.fmt(B.bn(1234))).toBe('1,234');
    expect(B.fmt(B.bn(12345))).toBe('1.2만');
    expect(B.fmt(B.bn(3.2e8))).toBe('3.2억');
    expect(B.fmt(B.powN(10, 45))).toBe('1.00e45');
  });
});

describe('성장·비용', () => {
  it('비용은 단계마다 증가 (역전 없음)', () => {
    for (let i = 1; i < 500; i++) expect(B.gt(F.levelCost(i + 1), F.levelCost(i))).toBe(true);
    for (let i = 0; i < 200; i++) expect(B.gt(F.skillCost(i + 1), F.skillCost(i))).toBe(true);
  });
  it('레벨 2000 이어도 숫자가 넘치지 않음', () => {
    const s = newState(0);
    s.creatures.c01.level = 2000;
    const st = F.creatureStats(s, 'c01');
    expect(isFinite(st.lAtk) && isFinite(st.lHp)).toBe(true);
    expect(B.str(F.levelCost(2000))).toMatch(/e1\d\d$/);
  });
  it('강화는 비용만큼 정확히 줄어듦 (재화 보존)', () => {
    const s = newState(0);
    s.cur.energy = B.bn(1000);
    const cost = F.levelCost(1);
    const { state } = applyCommand(s, { action: 'upgrade', payload: { kind: 'level', id: 'c01' } }, { now: 0, cfg, seed: 1 });
    expect(B.str(state.cur.energy)).toBe(B.str(B.sub(B.bn(1000), cost)));
    expect(state.creatures.c01.level).toBe(2);
  });
  it('재화가 모자라면 실패하고 음수가 되지 않음', () => {
    const s = newState(0);
    s.cur.energy = B.bn(1);
    expect(err(() => applyCommand(s, { action: 'upgrade', payload: { kind: 'level', id: 'c01' } }, { now: 0, cfg, seed: 1 }))).toBe('NOT_ENOUGH_RESOURCES');
  });
  it('여러 번 강화(times)는 살 수 있는 만큼만', () => {
    const s = newState(0);
    s.cur.energy = B.add(B.add(F.levelCost(1), F.levelCost(2)), B.bn(1));
    const { state, result } = applyCommand(s, { action: 'upgrade', payload: { kind: 'level', id: 'c01', times: 50 } }, { now: 0, cfg, seed: 1 });
    expect(result.data.done).toBe(2);
    expect(B.isNeg(state.cur.energy)).toBe(false);
  });
  it('위조된 값·없는 대상은 거부', () => {
    const s = newState(0);
    const run = (payload: unknown) => err(() => applyCommand(s, { action: 'upgrade', payload }, { now: 0, cfg, seed: 1 }));
    expect(run({ kind: 'level', id: 'c99' })).toBe('UNKNOWN_CREATURE');
    expect(run({ kind: 'level', id: 'c05' })).toBe('NOT_CONTRACTED');
    expect(run({ kind: 'level', id: 'c01', times: 1e9 })).toBe('BAD_TIMES');
    expect(run({ kind: 'level', id: 'c01', times: -1 })).toBe('BAD_TIMES');
    expect(run({ kind: 'gold', amount: 1e99 })).toBe('UNKNOWN_UPGRADE');
    expect(run([1, 2])).toBe('PAYLOAD_NOT_OBJECT');
    expect(run({ kind: 'contract', id: 'c09' })).toBe('NOT_DISCOVERED');
  });
});

describe('정산(오프라인 보상)', () => {
  it('서버 시각 기준, 한도까지만', () => {
    const s = newState(0);
    const cap = F.offlineCapSeconds(s, cfg);
    const r = F.rates(s, cfg);
    const rep = settle(s, (cap + 5000) * 1000, cfg);
    expect(rep.recognized).toBe(cap);
    expect(rep.capped).toBe(true);
    expect(rep.gained.shards).toBe(B.str(B.mulN(r.shards, cap)));
  });
  it('시계를 되돌려도(음수 경과) 보상 0, 마지막 정산 시각은 뒤로 가지 않음', () => {
    const s = newState(100000);
    const rep = settle(s, 50000, cfg);
    expect(rep.recognized).toBe(0);
    expect(s.lastSettledAt).toBe(100000);
  });
  it('두 번 연속 정산해도 한 번 정산과 보상이 같음 (중복 지급 없음)', () => {
    // 깊이가 안 바뀌는 조건(관문에 서 있음)에서 비교 — 깊이가 오르면 생산량이 달라지는 게 정상
    const at = () => { const s = newState(0); for (const id of s.team) s.creatures[id].level = 80; s.depth = 20; s.maxDepth = 20; return s; };
    const a = at(), b = at();
    settle(a, 3600e3, cfg);
    settle(b, 1800e3, cfg); settle(b, 3600e3, cfg);
    expect(B.toNumber(a.cur.shards)).toBeCloseTo(B.toNumber(b.cur.shards), 3);
  });
  it('정산 중에는 새 지역(관문 너머)으로 가지 않음', () => {
    const s = newState(0);
    for (const id of s.team) s.creatures[id].level = 400;
    settle(s, 3600e3, cfg);
    expect(s.depth).toBe(F.gateDepth(0));
    expect(s.gates).toBe(0);
  });
  it('100년 미접속도 한도 안에서 정상', () => {
    const s = newState(0);
    const rep = settle(s, 100 * 365 * 86400e3, cfg);
    expect(rep.recognized).toBe(F.offlineCapSeconds(newState(0), cfg));
  });
});

describe('보스전', () => {
  const strong = () => { const s = newState(0); for (const id of s.team) s.creatures[id].level = 60; s.depth = 20; return s; };
  it('같은 seed → 같은 결과 (결정적)', () => {
    const s = strong();
    expect(simulateBoss(s, 42)).toEqual(simulateBoss(s, 42));
  });
  it('강한 편대는 이기고 약한 편대는 짐', () => {
    expect(simulateBoss(strong(), 1).win).toBe(true);
    const w = newState(0); w.depth = 20;
    expect(simulateBoss(w, 1).win).toBe(false);
  });
  it('관문에 도달하지 않으면 도전 불가', () => {
    expect(err(() => applyCommand(newState(0), { action: 'challengeBoss' }, { now: 0, cfg, seed: 1 }))).toBe('GATE_NOT_REACHED');
  });
  it('이기면 관문 +1, 보상, 다음 지역 발견', () => {
    const { state, result } = applyCommand(strong(), { action: 'challengeBoss' }, { now: 0, cfg, seed: 1 });
    expect(state.gates).toBe(1);
    expect((result.data.reward as { first: boolean }).first).toBe(true);
    expect("c05" in state.discovered).toBe(true);
  });
  it('능력치가 아주 커도(레벨 3000) 계산 가능', () => {
    const s = newState(0); for (const id of s.team) s.creatures[id].level = 3000; s.gates = 40; s.depth = F.gateDepth(40);
    const r = simulateBoss(s, 3);
    expect(r.log.every((e) => isFinite(e[4]))).toBe(true);
  });
});

describe('생태 재구성', () => {
  it('조건 미달이면 거부, 달성하면 씨앗 지급 + 진행 초기화 + 영구 요소 유지', () => {
    const s = newState(0);
    expect(err(() => applyCommand(s, { action: 'rebuildEcology', payload: { confirm: true } }, { now: 0, cfg, seed: 1 }))).toBe('REBUILD_LOCKED');
    s.maxDepth = 60; s.bestDepth = 60; s.gates = 2; s.depth = 60; s.research.gather = 3; s.creatures.c01.resonance = 2; s.creatures.c01.level = 90;
    expect(err(() => applyCommand(s, { action: 'rebuildEcology', payload: {} }, { now: 0, cfg, seed: 1 }))).toBe('CONFIRM_REQUIRED');
    const { state } = applyCommand(s, { action: 'rebuildEcology', payload: { confirm: true } }, { now: 0, cfg, seed: 1 });
    expect(B.toNumber(state.cur.seeds)).toBeGreaterThan(0);
    expect(state.gates).toBe(0);
    expect(state.creatures.c01.level).toBe(1);
    expect(state.creatures.c01.resonance).toBe(2);
    expect(state.research.gather).toBe(3);
    expect(state.rebuilds).toBe(1);
  });
});

describe('요청 처리 (중복·revision)', () => {
  it('같은 requestId 는 한 번만 적용', () => {
    let s: PlayerState = newState(0); s.cur.energy = B.bn(1e6);
    const ctx = { now: 0, cfg, seed: 1 };
    const a = processRequest(s, req(1, 'upgrade', { kind: 'level', id: 'c01' }, 0), ctx);
    s = a.state;
    const b = processRequest(s, req(1, 'upgrade', { kind: 'level', id: 'c01' }, 1), ctx);
    expect(b.code).toBe('DUPLICATE_REQUEST');
    expect(b.state.creatures.c01.level).toBe(2);
    expect(s.revision).toBe(1);
  });
  it('revision 이 다르면 VERSION_CONFLICT', () => {
    const s = newState(0);
    expect(() => processRequest(s, req(2, 'claimOffline', {}, 5), { now: 0, cfg, seed: 1 })).toThrowError(GameError);
  });
  it('sync 는 저장하지 않음 (revision 그대로)', () => {
    const s = newState(0);
    const r = processRequest(s, req(3, 'sync', {}, 99), { now: 3600e3, cfg, seed: 1 });
    expect(r.changed).toBe(false);
    expect(r.state.revision).toBe(0);
    expect(B.gt(r.state.cur.shards, s.cur.shards)).toBe(true);
  });
  it('요청 모양 검사', () => {
    expect(() => validateShape(null)).toThrow();
    expect(() => validateShape({ requestId: 'x', action: 'sync', clientVersion: '0.1.0', schemaVersion: 1 })).toThrow();
    expect(() => validateShape({ requestId: uuid(1), action: 'hack', clientVersion: '0.1.0', schemaVersion: 1 })).toThrow();
    expect(validateShape({ requestId: uuid(1), action: 'sync', clientVersion: '0.1.0', schemaVersion: 1 }).action).toBe('sync');
    expect(versionLess('0.1.0', '0.2.0')).toBe(true);
    expect(versionLess('1.0.0', '0.9.9')).toBe(false);
  });
});

describe('상태 직렬화·마이그레이션', () => {
  it('직렬화 후 같은 상태', () => {
    const s = newState(123);
    s.cur.shards = B.powN(1.1, 3000);
    const t = deserialize(serialize(s));
    expect(B.str(t.cur.shards)).toBe(B.str(s.cur.shards));
    expect(t.creatures).toEqual(s.creatures);
  });
  it('미래 스키마는 거부', () => {
    const s = JSON.parse(serialize(newState(0))); s.schemaVersion = 99;
    expect(() => deserialize(JSON.stringify(s))).toThrow('SCHEMA_TOO_NEW');
  });
  it('공명체 12종 모두 데이터가 맞음', () => {
    expect(CREATURES.length).toBe(12);
    expect(new Set(CREATURES.map((c) => c.name)).size).toBe(12);
    for (const r of ['guard', 'striker', 'tuner', 'shifter']) expect(CREATURES.filter((c) => c.role === r).length).toBe(3);
  });
});
