/**
 * GAS 통신
 *  - POST + 본문은 JSON 문자열, Content-Type 은 text/plain → CORS 사전 요청(preflight) 없이 보냄
 *    (GAS 는 302 로 googleusercontent 주소에 결과를 두고, fetch 가 따라가서 본문을 읽음 — 'no-cors' 는 쓰지 않음: 응답을 못 읽음)
 *  - 시간 초과 20초 (GAS 첫 응답이 느린 '콜드 스타트' 대비)
 *  - 다시 시도: 네트워크 오류 · SERVER_ERROR(BUSY 등) · RATE_LIMITED → 지수 백오프 + 지터, 최대 4번
 *    같은 requestId 로 다시 보내므로 서버가 중복 적용하지 않음
 */
import type { ApiRequest, ApiResponse } from '../../../shared/protocol';
import { API_URL, APP_VERSION } from '../config/env';

export function uuid(): string {
  const c = globalThis.crypto as Crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16); c.getRandomValues(b);   // randomUUID 가 없는 오래된 브라우저
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export class NetError extends Error { constructor(msg: string) { super(msg); } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY = new Set(['SERVER_ERROR', 'RATE_LIMITED']);

async function once(req: ApiRequest, timeoutMs: number): Promise<ApiResponse> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow', signal: ac.signal, cache: 'no-store' });
    if (!r.ok) throw new NetError('HTTP_' + r.status);
    const j = (await r.json()) as ApiResponse;
    if (!j || typeof j.ok !== 'boolean' || typeof j.code !== 'string') throw new NetError('BAD_RESPONSE');
    return j;
  } catch (e) {
    if (e instanceof NetError) throw e;
    throw new NetError((e as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
  } finally { clearTimeout(t); }
}

export async function call(req: Omit<ApiRequest, 'clientVersion' | 'schemaVersion'>, opt: { tries?: number; timeoutMs?: number } = {}): Promise<ApiResponse> {
  const full: ApiRequest = { ...req, clientVersion: APP_VERSION, schemaVersion: 1 } as ApiRequest;
  const tries = opt.tries ?? 4;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(Math.min(8000, 500 * 2 ** (i - 1)) * (0.6 + Math.random() * 0.8));
    try {
      const res = await once(full, opt.timeoutMs ?? 20000);
      if (!res.ok && RETRY.has(res.code) && i < tries - 1) { last = res; continue; }
      return res;
    } catch (e) { last = e; }
  }
  if (last && typeof last === 'object' && 'code' in (last as object)) return last as ApiResponse;
  throw last instanceof Error ? last : new NetError('NETWORK');
}
