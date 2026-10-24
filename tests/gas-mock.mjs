// Google Apps Script 가짜 환경 (Node) — backend/*.gs 를 실제 코드 그대로 불러와 테스트·로컬 서버에 씀
// 실제 GAS 와 다른 점: 할당량·실행 시간 제한·동시 실행·셀 자동 변환은 흉내 내지 않음 (docs/12_테스트.md)
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const toBuf = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map((b) => b & 255)));

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sheet.rows[this.r - 1 + i] || []; out.push(Array.from({ length: this.nc }, (_, j) => (row[this.c - 1 + j] ?? ''))); } return out; }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) {
    if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) throw new Error('범위 크기와 값 크기가 다름');
    v.forEach((row, i) => { const R = (this.sheet.rows[this.r - 1 + i] ||= []); row.forEach((x, j) => { R[this.c - 1 + j] = x; }); });
    this.sheet.writes++; return this;
  }
  setValue(x) { return this.setValues([[x]]); }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) { const R = this.sheet.rows[this.r - 1 + i]; if (R) for (let j = 0; j < this.nc; j++) R[this.c - 1 + j] = ''; } return this; }
  getRow() { return this.r; }
  createTextFinder(text) {
    const self = this; let whole = false;
    return {
      matchEntireCell(b) { whole = b; return this; },
      findNext() {
        const vals = self.getValues();
        for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals[i].length; j++) {
          const v = String(vals[i][j]);
          if (whole ? v === text : v.includes(text)) return new Range(self.sheet, self.r + i, self.c + j, 1, 1);
        }
        return null;
      }
    };
  }
}

class Sheet {
  constructor(name, ss) { this.name = name; this.ss = ss; this.rows = []; this.writes = 0; }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getLastRow() { let n = this.rows.length; while (n > 0 && (!this.rows[n - 1] || this.rows[n - 1].every((x) => x === '' || x === undefined))) n--; return n; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return new Range(this, 1, 1, Math.max(1, this.getLastRow()), 1);   // 'A:C' 같은 열 범위 (서식 전용)
    return new Range(this, a, b, c || 1, d || 1);
  }
  appendRow(row) { this.rows[this.getLastRow()] = row.slice(); this.writes++; return this; }
  setFrozenRows() { return this; }
  copyTo(ss) { const s = ss.insertSheet(this.name + ' 사본'); s.rows = JSON.parse(JSON.stringify(this.rows)); return s; }
}

class Spreadsheet {
  constructor(name) { this.name = name; this.sheets = [new Sheet('Sheet1', this)]; this.id = randomUUID(); }
  getName() { return this.name; }
  getId() { return this.id; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n, this); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

export function createGas({ name = '몬스터키우기_test', clock = () => Date.now() } = {}) {
  const active = new Spreadsheet(name);
  const created = [];
  const cache = new Map();
  const props = new Map();
  const lock = { busy: false, failNext: 0 };
  const logs = [];
  const fmt2 = (n) => String(n).padStart(2, '0');
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push('WARN ' + a.join(' ')), error: (...a) => logs.push('ERR ' + a.join(' ')) },
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock()); } static now() { return clock(); } },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => active,
      create: (n) => { const s = new Spreadsheet(n); created.push(s); return s; }
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const v = cache.get(k); if (!v) return null; if (v.exp < clock()) { cache.delete(k); return null; } return v.val; },
        put: (k, val, ttl = 600) => { if (String(val).length > 100000) throw new Error('캐시 값 100KB 초과'); cache.set(k, { val: String(val), exp: clock() + ttl * 1000 }); },
        remove: (k) => cache.delete(k),
        removeAll: (ks) => ks.forEach((k) => cache.delete(k))
      })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => { props.set(k, String(v)); } }) },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (lock.failNext > 0) { lock.failNext--; return false; } if (lock.busy) return false; lock.busy = true; return true; },
        waitLock: () => { lock.busy = true; },
        releaseLock: () => { lock.busy = false; }
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      getUuid: () => randomUUID(),
      computeDigest: (alg, text) => toSigned(createHash('sha256').update(toBuf(text)).digest()),
      computeHmacSha256Signature: (text, key) => toSigned(createHmac('sha256', toBuf(key)).update(toBuf(text)).digest()),
      base64EncodeWebSafe: (x) => toBuf(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: (s) => toSigned(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: (bytes) => ({ getDataAsString: () => toBuf(bytes).toString('utf8') }),
      formatDate: (d, _tz, f) => {
        const k = new Date(d.getTime() + 9 * 3600e3);   // Asia/Seoul 고정
        const Y = k.getUTCFullYear(), M = fmt2(k.getUTCMonth() + 1), D = fmt2(k.getUTCDate()), H = fmt2(k.getUTCHours()), m = fmt2(k.getUTCMinutes());
        return f.replace('yyyy', Y).replace('MM', M).replace('dd', D).replace('HH', H).replace('mm', m);
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; }, getContent() { return this.text; } })
    },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased() { return this; }, everyHours() { return this; }, atHour() { return this; }, everyDays() { return this; }, inTimezone() { return this; }, create() {} }) }
  };
  vm.createContext(ctx);
  const dir = new URL('../backend/', import.meta.url).pathname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.gs')).sort((a, b) => (a === 'GameCore.gs' ? -1 : b === 'GameCore.gs' ? 1 : a.localeCompare(b)));
  for (const f of files) vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
  const post = (obj) => JSON.parse(ctx.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).getContent());
  return { ctx, active, created, cache, props, lock, logs, post, get: () => JSON.parse(ctx.doGet({}).getContent()) };
}
