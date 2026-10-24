/**
 * API 계약 (클라이언트 ↔ GAS) + 서버 쪽 명령 처리 순서 중 '게임 규칙' 부분
 * GAS 의 CommandService.gs 가 인증·잠금·저장을 맡고, 그 안에서 processRequest() 를 부름
 */
import { applyCommand, Action, ACTIONS, Ctx, ErrorCode, GameError } from './commands';
import { PlayerState, SCHEMA_VERSION, clone } from './state';

export const CLIENT_VERSION = '0.1.0';

export interface ApiRequest {
  requestId: string;
  action: Action | 'register' | 'restore' | 'hello';
  expectedRevision?: number;
  clientVersion: string;
  schemaVersion: number;
  payload?: Record<string, unknown>;
  token?: string;
}

export interface ApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  code: 'OK' | ErrorCode;
  requestId: string;
  serverTime: number;
  revision: number;
  data: T | null;
  error: { reason: string } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 요청 모양 검사 (인증 전, 값 크기·타입만) */
export function validateShape(x: unknown): ApiRequest {
  const bad = (r: string) => new GameError('INVALID_REQUEST', r);
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw bad('NOT_OBJECT');
  const o = x as Record<string, unknown>;
  if (typeof o.requestId !== 'string' || !UUID.test(o.requestId)) throw bad('BAD_REQUEST_ID');
  if (typeof o.action !== 'string' || !(ACTIONS as string[]).concat(['register', 'restore', 'hello']).includes(o.action)) throw bad('UNKNOWN_ACTION');
  if (typeof o.clientVersion !== 'string' || o.clientVersion.length > 20) throw bad('BAD_CLIENT_VERSION');
  if (o.schemaVersion !== SCHEMA_VERSION) throw bad('SCHEMA_MISMATCH');
  if (o.expectedRevision !== undefined && !(Number.isInteger(o.expectedRevision) && (o.expectedRevision as number) >= 0)) throw bad('BAD_REVISION');
  if (o.payload !== undefined && (!o.payload || typeof o.payload !== 'object' || Array.isArray(o.payload))) throw bad('BAD_PAYLOAD');
  if (o.token !== undefined && (typeof o.token !== 'string' || o.token.length > 400)) throw bad('BAD_TOKEN');
  return o as unknown as ApiRequest;
}

export function versionLess(a: string, b: string): boolean {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0); }
  return false;
}

export interface Processed { state: PlayerState; changed: boolean; code: 'OK' | 'DUPLICATE_REQUEST'; data: Record<string, unknown> }

/**
 * 게임 명령 처리: 중복 확인 → revision 확인 → 규칙 적용 → revision+1 → 최근 요청 기록
 * (호출하는 쪽이 잠금 안에서 '방금 읽은 최신 상태'를 넘겨야 함)
 */
export function processRequest(state: PlayerState, req: ApiRequest, ctx: Ctx): Processed {
  const seen = state.recent.find((r) => r.id === req.requestId);
  if (seen) return { state, changed: false, code: 'DUPLICATE_REQUEST', data: { duplicateOf: seen.r } };
  const action = req.action as Action;
  if (action === 'sync') {
    // 읽기 전용: 정산한 '보기'만 돌려주고 저장하지 않음 (revision 그대로) — 저장은 claimOffline·다른 명령이 함
    const { state: view, result } = applyCommand(state, { action, payload: {} }, ctx);
    view.revision = state.revision; view.recent = state.recent; view.stats = state.stats;
    return { state: view, changed: false, code: 'OK', data: result as unknown as Record<string, unknown> };
  }
  if (req.expectedRevision !== state.revision) throw new GameError('VERSION_CONFLICT', 'REVISION_MISMATCH');
  const { state: next, result } = applyCommand(state, { action, payload: req.payload }, ctx);
  next.revision = state.revision + 1;
  next.recent = [{ id: req.requestId, a: action, r: next.revision }, ...state.recent].slice(0, 40);
  return { state: next, changed: true, code: 'OK', data: result as unknown as Record<string, unknown> };
}

export { clone };
