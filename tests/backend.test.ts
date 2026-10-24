// 서버(GAS) 테스트 — backend/*.gs 실제 코드를 가짜 GAS 환경(tests/gas-mock.mjs)에서 실행
import { beforeEach, describe, expect, it } from 'vitest';
import { createGas } from './gas-mock.mjs';

let now = Date.UTC(2026, 9, 24, 3, 0, 0);
let g: ReturnType<typeof createGas>;
let n = 0;
const rid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const base = (action: string, extra: Record<string, unknown> = {}) => ({ requestId: rid(), action, clientVersion: '0.1.0', schemaVersion: 1, ...extra });

function setupWorld() {
  now = Date.UTC(2026, 9, 24, 3, 0, 0);
  g = createGas({ clock: () => now });
  g.ctx.setup('dev');
}
function register() {
  const r = g.post(base('register'));
  expect(r.ok).toBe(true);
  return r.data as { playerId: string; token: string; recoveryCode: string; state: { revision: number; cur: Record<string, string> } };
}

describe('GAS API', () => {
  beforeEach(setupWorld);

  it('doGet 상태 확인', () => {
    expect(g.get()).toMatchObject({ ok: true, service: 'monster-grow', env: 'dev' });
  });

  it('가입 → 동기화 → 강화 → 저장 확인', () => {
    const p = register();
    expect(p.recoveryCode).toMatch(/^MK-/);
    now += 3600e3;
    const s = g.post(base('sync', { token: p.token }));
    expect(s.ok).toBe(true);
    expect(s.revision).toBe(0);
    const u = g.post(base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c02', times: 5 } }));
    expect(u.ok).toBe(true);
    expect(u.revision).toBe(1);
    expect(u.data.state.creatures.c02.level).toBeGreaterThan(1);
    // 시트에 저장됐는지: 다시 sync 하면 같은 레벨
    const s2 = g.post(base('sync', { token: p.token }));
    expect(s2.data.state.creatures.c02.level).toBe(u.data.state.creatures.c02.level);
    expect(g.active.getSheetByName('CommandJournal').getLastRow()).toBe(3);   // 제목 + register + upgrade
  });

  it('잘못된 JSON · 너무 큰 요청 · 이상한 모양', () => {
    expect(g.post('{oops').code).toBe('INVALID_REQUEST');
    expect(g.post('x'.repeat(20000)).error.reason).toBe('BODY_TOO_LARGE');
    expect(g.post({ requestId: 'nope', action: 'sync' }).code).toBe('INVALID_REQUEST');
    expect(g.post(base('sync', { schemaVersion: 2 })).error.reason).toBe('SCHEMA_MISMATCH');
  });

  it('토큰 없음 · 위조 · 만료', () => {
    const p = register();
    expect(g.post(base('sync')).code).toBe('AUTH_REQUIRED');
    const forged = p.token.slice(0, -3) + 'abc';
    expect(g.post(base('sync', { token: forged })).code).toBe('AUTH_REQUIRED');
    now += 31 * 86400e3;
    expect(g.post(base('sync', { token: p.token })).code).toBe('AUTH_REQUIRED');
  });

  it('남의 playerId 로 접근 불가 (토큰의 playerId 만 사용)', () => {
    const a = register(), b = register();
    const r = g.post(base('upgrade', { token: a.token, expectedRevision: 0, playerId: b.playerId, payload: { kind: 'level', id: 'c01' } }));
    expect(r.ok).toBe(true);
    const sb = g.post(base('sync', { token: b.token }));
    expect(sb.data.state.creatures.c01.level).toBe(1);
  });

  it('같은 requestId 재전송 → 한 번만 적용 (DUPLICATE_REQUEST)', () => {
    const p = register();
    const req = base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c01' } });
    const a = g.post(req), b = g.post(req);
    expect(a.code).toBe('OK');
    expect(b.code).toBe('DUPLICATE_REQUEST');
    expect(b.data.state.creatures.c01.level).toBe(2);
    expect(b.revision).toBe(1);
  });

  it('revision 충돌 → VERSION_CONFLICT', () => {
    const p = register();
    g.post(base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c01' } }));
    const r = g.post(base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c01' } }));
    expect(r.code).toBe('VERSION_CONFLICT');
  });

  it('두 탭에서 동시에 보상 수령 → 하나만 저장, 다른 하나는 충돌', () => {
    const p = register();
    now += 7200e3;
    const r1 = g.post(base('claimOffline', { token: p.token, expectedRevision: 0 }));
    const r2 = g.post(base('claimOffline', { token: p.token, expectedRevision: 0 }));
    expect(r1.ok).toBe(true);
    expect(r2.code).toBe('VERSION_CONFLICT');
  });

  it('위조된 보상량·재화는 무시 (서버가 계산)', () => {
    const p = register();
    const r = g.post(base('claimOffline', { token: p.token, expectedRevision: 0, payload: { shards: '9e99', amount: 1e300 } }));
    expect(r.ok).toBe(true);
    expect(Number(String(r.data.state.cur.shards).split('e')[1] || 0)).toBeLessThan(5);
    const bad = g.post(base('upgrade', { token: p.token, expectedRevision: 1, payload: { kind: 'level', id: 'c01', times: 100000 } }));
    expect(bad.code).toBe('INVALID_REQUEST');
  });

  it('잠금 실패 → SERVER_ERROR(BUSY), 상태 변화 없음', () => {
    const p = register();
    g.lock.failNext = 1;
    const r = g.post(base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c01' } }));
    expect(r.code).toBe('SERVER_ERROR');
    expect(r.error.reason).toBe('BUSY');
    expect(g.post(base('sync', { token: p.token })).data.state.creatures.c01.level).toBe(1);
  });

  it('점검 모드 · 읽기 전용 모드', () => {
    const p = register();
    g.ctx.maintenanceOn();
    expect(g.post(base('sync', { token: p.token })).code).toBe('MAINTENANCE');
    expect(g.post(base('hello')).data.maintenance).toBe(true);
    g.ctx.maintenanceOff();
    g.ctx.setReadOnly(true);
    expect(g.post(base('sync', { token: p.token })).ok).toBe(true);
    expect(g.post(base('claimOffline', { token: p.token, expectedRevision: 0 })).error.reason).toBe('READ_ONLY');
  });

  it('최소 클라이언트 버전', () => {
    g.ctx.setConfig_('minClientVersion', '0.2.0');
    const p = g.post(base('register'));
    expect(p.error.reason).toBe('CLIENT_TOO_OLD');
  });

  it('복구 코드로 다른 기기에서 이어 하기 · 틀린 코드 반복은 잠김', () => {
    const p = register();
    const ok = g.post(base('restore', { payload: { playerId: p.playerId, code: p.recoveryCode } }));
    expect(ok.ok).toBe(true);
    expect(ok.data.playerId).toBe(p.playerId);
    for (let i = 0; i < 4; i++) expect(g.post(base('restore', { payload: { playerId: p.playerId, code: 'MK-00000-00000-00000-00000' } })).code).toBe('AUTH_REQUIRED');
    expect(g.post(base('restore', { payload: { playerId: p.playerId, code: p.recoveryCode } })).code).toBe('RATE_LIMITED');
  });

  it('요청 빈도 제한', () => {
    const p = register();
    let last;
    for (let i = 0; i < 61; i++) last = g.post(base('sync', { token: p.token }));
    expect(last.code).toBe('RATE_LIMITED');
  });

  it('운영 API: 키 없으면 거부 + 감사 기록, 키 맞으면 처리', () => {
    expect(g.post({ admin: { op: 'status', key: 'wrong' } }).code).toBe('AUTH_REQUIRED');
    g.ctx.setAdminKey('this-is-a-long-admin-key-for-tests');
    const r = g.post({ admin: { op: 'announce', key: 'this-is-a-long-admin-key-for-tests', args: { title: '오픈', body: '환영해요' } } });
    expect(r.ok).toBe(true);
    expect(g.post(base('hello')).data.announcements[0].title).toBe('오픈');
    expect(g.active.getSheetByName('AdminAudit').getLastRow()).toBe(3);
  });

  it('백업 · 운영 사본 · 기록 보충 · 마이그레이션', () => {
    const p = register();
    g.post(base('upgrade', { token: p.token, expectedRevision: 0, payload: { kind: 'level', id: 'c01' } }));
    g.ctx.backupSnapshot();
    expect(g.created[0].getSheetByName('PlayerState').getLastRow()).toBe(2);
    g.ctx.refreshMirrors();
    expect(g.active.getSheetByName('Inventory').getLastRow()).toBe(5);
    // 기록 한 줄을 잃어버린 상황
    const j = g.active.getSheetByName('CommandJournal');
    j.rows.splice(2, 1);
    expect(g.ctx.reconcile()).toBe(1);
    expect(g.ctx.runMigrations().migrated).toBe(1);
  });

  it('가입 응답 유실 후 같은 requestId 로 재시도 → 계정 하나만', () => {
    const req = base('register');
    const a = g.post(req), b = g.post(req);
    expect(b.code).toBe('DUPLICATE_REQUEST');
    expect(b.data.playerId).toBe(a.data.playerId);
    expect(g.active.getSheetByName('Players').getLastRow()).toBe(2);
  });

  it('응답에 비밀 값·시트 원본이 없음', () => {
    const p = register();
    const r = g.post(base('sync', { token: p.token }));
    const t = JSON.stringify(r);
    for (const k of ['SESSION_SECRET', 'RECOVERY_PEPPER', 'SEED_SECRET']) expect(t).not.toContain(g.props.get(k));
    expect(t).not.toContain('recoveryHash');
  });

  it('잠만보 시트에서는 setup 거부', () => {
    const w = createGas({ name: '잠만보_구글시트' });
    expect(() => w.ctx.setup('dev')).toThrow();
  });
});
