/**
 * 게임 세션 — 서버 정본 상태를 받아 두고, 화면에는 '예측 보기'를 보여 줌
 *  - 서버 상태(base) + 서버 시각 차이(offset) → 지금 시점으로 정산한 보기(view). 숫자가 실시간으로 오르는 것처럼 보이지만
 *    확정은 서버가 함. 클라이언트 값과 서버 값을 더하지 않음 (서버 응답이 오면 그대로 바꿈)
 *  - 명령은 한 번에 하나씩 (expectedRevision = 마지막으로 받은 revision)
 *  - 네트워크 실패 → 큐(IndexedDB)에 두고 다시 시도. 충돌(VERSION_CONFLICT) → 최신 상태를 받고 그 명령은 버림(이중 적용 방지)
 *  - 자동 저장: 10분마다 claimOffline (정산 한도에 걸리지 않게)
 *  - 다른 탭: BroadcastChannel 로 '바뀌었음'만 알림 → 그 탭이 sync
 */
import * as Core from '../../../shared/index';
import type { BattleResult } from '../../../shared/battle';
import type { ApiResponse } from '../../../shared/protocol';
import type { GameConfig } from '../../../shared/data';
import type { PlayerState } from '../../../shared/state';
import { call, NetError, uuid } from '../api/client';
import { KEY_PREFIX } from '../config/env';
import { local, queue } from '../storage/store';

export type Listener = () => void;
export interface Announcement { id: string; title: string; body: string }
export interface OfflineReport { seconds: number; capped: boolean; shards: string; energy: string; materials: string; depthFrom: number; depthTo: number }

const AUTOSAVE_MS = 10 * 60 * 1000;

class Session {
  base: PlayerState | null = null;
  cfg: GameConfig = Core.DEFAULT_CONFIG;
  offset = 0;                 // 서버 시각 - 내 시각
  token = '';
  playerId = '';
  online = true;
  busy = false;
  maintenance = '';
  announcements: Announcement[] = [];
  lastError = '';
  newRecoveryCode = '';
  offlineReport: OfflineReport | null = null;
  private listeners = new Set<Listener>();
  private chain: Promise<unknown> = Promise.resolve();
  private bc: BroadcastChannel | null = null;
  private saveTimer = 0;

  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }

  serverNow() { return Date.now() + this.offset; }

  /** 화면용 보기: 지금 시점까지 정산한 복사본 (저장하지 않음) */
  view(): PlayerState | null {
    if (!this.base) return null;
    const v = Core.clone(this.base);
    Core.settle(v, this.serverNow(), this.cfg);
    return v;
  }

  private accept(res: ApiResponse) {
    this.offset = res.serverTime - Date.now();
    const d = res.data as { state?: unknown; config?: GameConfig } | null;
    if (d && d.config) this.cfg = { ...Core.DEFAULT_CONFIG, ...d.config };
    if (d && d.state) {
      this.base = Core.deserialize(JSON.stringify(d.state));
      local.set('cache', { state: d.state, at: Date.now(), cfg: this.cfg });
    }
  }

  async boot() {
    this.token = local.get('token', '');
    this.playerId = local.get('pid', '');
    const cached = local.get<{ state: unknown; cfg: GameConfig } | null>('cache', null);
    if (cached && cached.state) {
      try { this.base = Core.deserialize(JSON.stringify(cached.state)); this.cfg = { ...Core.DEFAULT_CONFIG, ...cached.cfg }; } catch { /* 캐시 손상 → 무시 */ }
    }
    this.emit();
    try {
      const h = await call({ requestId: uuid(), action: 'hello' });
      if (h.ok && h.data) {
        const d = h.data as { announcements: Announcement[]; maintenance: boolean; maintenanceMessage: string; config: GameConfig };
        this.announcements = d.announcements || [];
        this.cfg = { ...Core.DEFAULT_CONFIG, ...d.config };
        this.maintenance = d.maintenance ? d.maintenanceMessage || '점검 중이에요' : '';
      }
      if (this.maintenance) { this.emit(); return; }
      if (!this.token) await this.register();
      else await this.syncNow(true);
      await this.flushQueue();
    } catch (e) {
      this.online = false;
      this.lastError = e instanceof NetError ? '서버에 연결할 수 없어요. 잠시 후 다시 시도할게요.' : '불러오지 못했어요.';
    }
    this.startTimers();
    this.emit();
  }

  private async register() {
    const r = await call({ requestId: local.get('regId', '') || this.rememberRegId(), action: 'register' });
    if (!r.ok) throw new Error(r.error?.reason || r.code);
    const d = r.data as { playerId: string; token: string; recoveryCode: string };
    this.token = d.token; this.playerId = d.playerId; this.newRecoveryCode = d.recoveryCode;
    local.set('token', d.token); local.set('pid', d.playerId); local.set('recovery', d.recoveryCode); local.del('regId');
    this.accept(r);
  }
  private rememberRegId() { const id = uuid(); local.set('regId', id); return id; }

  async restore(playerId: string, code: string) {
    const r = await call({ requestId: uuid(), action: 'restore', payload: { playerId: playerId.trim(), code: code.trim() } }, { tries: 1 });
    if (!r.ok) throw new Error(r.code === 'RATE_LIMITED' ? '시도가 너무 많아요. 10분 뒤 다시 해 주세요.' : '계정을 찾지 못했어요. ID와 복구 코드를 확인해 주세요.');
    const d = r.data as { playerId: string; token: string };
    await queue.clear();
    this.token = d.token; this.playerId = d.playerId;
    local.set('token', d.token); local.set('pid', d.playerId); local.set('recovery', code.trim());
    this.accept(r);
    this.emit();
  }

  async syncNow(reportOffline = false) {
    const r = await call({ requestId: uuid(), action: 'sync', token: this.token });
    if (r.code === 'AUTH_REQUIRED') { this.lastError = '로그인이 만료됐어요. 설정에서 복구 코드로 다시 연결해 주세요.'; this.emit(); return; }
    if (r.code === 'MAINTENANCE') { this.maintenance = r.error?.reason === 'READ_ONLY' ? '' : '점검 중이에요'; }
    if (!r.ok) return;
    this.online = true; this.lastError = '';
    this.accept(r);
    if (reportOffline) {
      const s = (r.data as { result?: { settle?: Core.SettleReport } }).result?.settle;
      if (s && s.recognized >= 600) this.offlineReport = { seconds: s.recognized, capped: s.capped, ...s.gained, depthFrom: s.depthFrom, depthTo: s.depthTo };
    }
    this.emit();
  }

  /** 명령 보내기 (차례대로). 성공하면 결과 data, 실패하면 이유 문자열을 던짐 */
  send(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const job = this.chain.then(() => this.sendNow(action, payload));
    this.chain = job.catch(() => undefined);
    return job;
  }

  private async sendNow(action: string, payload: Record<string, unknown>) {
    if (!this.base) throw new Error('아직 불러오는 중이에요');
    const requestId = uuid();
    const item = { requestId, action, payload, createdAt: Date.now(), tries: 0 };
    await queue.put(item);
    this.busy = true; this.emit();
    try {
      return await this.deliver(item);
    } finally { this.busy = false; this.emit(); }
  }

  private async deliver(item: { requestId: string; action: string; payload: Record<string, unknown> }) {
    let r: ApiResponse;
    try {
      r = await call({ requestId: item.requestId, action: item.action as never, expectedRevision: this.base!.revision, payload: item.payload, token: this.token });
    } catch (e) {
      this.online = false; this.lastError = '연결이 끊겼어요. 다시 연결되면 보낼게요.'; this.emit();
      throw new Error('오프라인 — 연결되면 다시 보내요');
    }
    this.online = true; this.lastError = '';
    if (r.ok) {                              // OK 또는 DUPLICATE_REQUEST(이미 처리됨)
      await queue.del(item.requestId);
      this.accept(r);
      this.broadcast();
      return ((r.data as { result?: { data?: Record<string, unknown> } }).result?.data) || {};
    }
    if (r.code === 'VERSION_CONFLICT') {
      await queue.del(item.requestId);
      await this.syncNow();
      throw new Error('다른 탭이나 기기에서 먼저 바뀌어서 최신 상태로 다시 불러왔어요. 한 번 더 눌러 주세요.');
    }
    if (r.code === 'SERVER_ERROR' || r.code === 'RATE_LIMITED') {
      throw new Error('서버가 바빠요. 잠시 후 자동으로 다시 보내요.');   // 큐에 남겨 둠 → flushQueue
    }
    await queue.del(item.requestId);
    if (r.code === 'AUTH_REQUIRED') this.lastError = '로그인이 만료됐어요. 설정에서 복구 코드로 다시 연결해 주세요.';
    if (r.code === 'MAINTENANCE') this.maintenance = '점검 중이에요';
    throw new Error(reasonText(r.error?.reason || r.code));
  }

  /** 보내지 못한 명령 다시 보내기 (오래된 순, 하나라도 충돌하면 나머지는 버림) */
  async flushQueue() {
    const q = await queue.all();
    for (const it of q) {
      if (Date.now() - it.createdAt > 3600e3) { await queue.del(it.requestId); continue; }
      try { await this.chain; await this.deliver(it); } catch { break; }
    }
  }

  private startTimers() {
    window.clearInterval(this.saveTimer);
    this.saveTimer = window.setInterval(() => { if (!document.hidden && this.base && !this.maintenance) this.send('claimOffline').catch(() => undefined); }, AUTOSAVE_MS);
    window.addEventListener('online', () => { this.online = true; this.flushQueue().then(() => this.syncNow()); });
    window.addEventListener('offline', () => { this.online = false; this.emit(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.token) this.syncNow(true).catch(() => undefined); });
    try {
      this.bc = new BroadcastChannel(KEY_PREFIX + 'tabs');
      this.bc.onmessage = (e) => { if (e.data === 'changed') this.syncNow().catch(() => undefined); };
    } catch { /* 지원 안 함 */ }
  }
  private broadcast() { try { this.bc?.postMessage('changed'); } catch { /* */ } }

  async boss(): Promise<{ battle: BattleResult; reward?: { shards: string; materials: string; first: boolean } }> {
    return (await this.send('challengeBoss')) as never;
  }
}

const REASONS: Record<string, string> = {
  NOT_ENOUGH_RESOURCES: '재화가 모자라요', NOT_ENOUGH_ENERGY: '공명 에너지가 모자라요', NOT_ENOUGH_SHARDS: '생명 파편이 모자라요',
  NOT_ENOUGH_MATERIALS: '복원 재료가 모자라요', SKILL_NEEDS_LEVEL: '레벨을 더 올려야 해요', RESONANCE_NEEDS_LEVEL: '레벨을 더 올려야 공명할 수 있어요',
  TRAIT_NEEDS_RESONANCE: '공명 1단계부터 특성을 고를 수 있어요', SAME_TRAIT: '이미 고른 특성이에요', RESEARCH_MAX: '최대 단계예요',
  NOT_DISCOVERED: '아직 발견하지 못했어요', ALREADY_CONTRACTED: '이미 계약했어요', TEAM_TOO_SMALL: '편대가 3마리 이상이어야 해요',
  GATE_NOT_REACHED: '관문까지 더 탐사해야 해요', REBUILD_LOCKED: '깊이 40에 도달하면 재구성할 수 있어요', BAD_TEAM_SIZE: '편대는 1~5마리',
  CLIENT_TOO_OLD: '새 버전이 나왔어요. 새로고침해 주세요', READ_ONLY: '지금은 읽기 전용이에요 (점검 준비)', BAD_ALIAS: '별칭은 12자까지'
};
export function reasonText(r: string) { return REASONS[r] || '처리하지 못했어요 (' + r + ')'; }

export const session = new Session();
