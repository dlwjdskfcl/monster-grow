/**
 * 브라우저 저장 — 서버 정본의 '캐시'와 '보내지 못한 명령' 임시 보관용 (인증·치트 방지 수단이 아님)
 *  - localStorage : 설정, 세션 토큰, 마지막 서버 상태(작은 캐시)
 *  - IndexedDB    : 보내지 못한 명령 큐 (안 되면 localStorage 로 대신)
 * 모든 접근은 try/catch (사생활 보호 모드·저장 차단에서도 게임은 뜸)
 */
import { KEY_PREFIX } from '../config/env';

export const local = {
  get<T>(k: string, def: T): T {
    try { const v = localStorage.getItem(KEY_PREFIX + k); return v === null ? def : (JSON.parse(v) as T); } catch { return def; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(KEY_PREFIX + k, JSON.stringify(v)); } catch { /* 저장 불가 */ } },
  del(k: string) { try { localStorage.removeItem(KEY_PREFIX + k); } catch { /* */ } }
};

export interface QueuedCommand { requestId: string; action: string; payload: Record<string, unknown>; createdAt: number; tries: number }

const DB = KEY_PREFIX + 'db';
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'requestId' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

export const queue = {
  async all(): Promise<QueuedCommand[]> {
    const d = await db();
    if (!d) return local.get<QueuedCommand[]>('queue', []);
    return new Promise((res) => {
      const t = d.transaction('queue', 'readonly').objectStore('queue').getAll();
      t.onsuccess = () => res((t.result as QueuedCommand[]).sort((a, b) => a.createdAt - b.createdAt));
      t.onerror = () => res([]);
    });
  },
  async put(c: QueuedCommand) {
    const d = await db();
    if (!d) { const q = local.get<QueuedCommand[]>('queue', []).filter((x) => x.requestId !== c.requestId); q.push(c); local.set('queue', q); return; }
    await new Promise<void>((res) => { const t = d.transaction('queue', 'readwrite'); t.objectStore('queue').put(c); t.oncomplete = () => res(); t.onerror = () => res(); });
  },
  async del(id: string) {
    const d = await db();
    if (!d) { local.set('queue', local.get<QueuedCommand[]>('queue', []).filter((x) => x.requestId !== id)); return; }
    await new Promise<void>((res) => { const t = d.transaction('queue', 'readwrite'); t.objectStore('queue').delete(id); t.oncomplete = () => res(); t.onerror = () => res(); });
  },
  async clear() { for (const c of await queue.all()) await queue.del(c.requestId); }
};
