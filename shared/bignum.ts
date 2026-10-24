/**
 * 큰 수 (가수 × 10^지수) — 클라이언트와 GAS가 같은 코드를 씀 (scripts/build-gas.mjs 가 GAS용으로 묶음)
 *
 * 규칙
 *  - 값은 { m, e } : 0 이거나 1 ≤ |m| < 10, e 는 정수
 *  - 가수는 항상 유효숫자 12자리로 반올림 (round12) → 클라이언트·서버가 같은 결과
 *  - 직렬화: "0" 또는 "<가수>e<지수>" 문자열 (예: "1.5e3"). JSON 상태 안에 문자열로 저장 → 시트 자동 숫자 변환 없음
 *  - NaN · Infinity · 잘못된 문자열은 예외 (조용히 0 으로 바꾸지 않음)
 */
export interface BN { m: number; e: number }

export const ZERO: BN = Object.freeze({ m: 0, e: 0 }) as BN;
const SIG = 12;

function round12(x: number): number {
  return Number(x.toPrecision(SIG));
}

function norm(m: number, e: number): BN {
  if (!isFinite(m) || !isFinite(e)) throw new Error('BN_NOT_FINITE');
  if (m === 0) return { m: 0, e: 0 };
  const s = Math.floor(Math.log10(Math.abs(m)));
  m = m / Math.pow(10, s);
  e = e + s;
  m = round12(m);
  if (Math.abs(m) >= 10) { m = round12(m / 10); e += 1; }
  if (Math.abs(m) < 1) { m = round12(m * 10); e -= 1; }
  return { m, e };
}

export function bn(v: number | string | BN): BN {
  if (typeof v === 'number') {
    if (!isFinite(v)) throw new Error('BN_NOT_FINITE');
    return norm(v, 0);
  }
  if (typeof v === 'string') return parse(v);
  if (v && typeof v.m === 'number' && typeof v.e === 'number') return norm(v.m, v.e);
  throw new Error('BN_BAD_VALUE');
}

export function parse(s: string): BN {
  if (typeof s !== 'string' || s.length > 40) throw new Error('BN_BAD_STRING');
  if (s === '0') return { m: 0, e: 0 };
  const mt = /^(-?\d+(?:\.\d+)?)(?:e(-?\d+))?$/.exec(s);
  if (!mt) throw new Error('BN_BAD_STRING');
  return norm(Number(mt[1]), mt[2] ? Number(mt[2]) : 0);
}

export function str(a: BN): string {
  if (a.m === 0) return '0';
  return String(a.m) + 'e' + String(a.e);
}

export function toNumber(a: BN): number {
  if (a.e > 308) return a.m > 0 ? Infinity : -Infinity;
  if (a.e < -308) return 0;
  return a.m * Math.pow(10, a.e);
}

export function isZero(a: BN): boolean { return a.m === 0; }
export function isNeg(a: BN): boolean { return a.m < 0; }

export function add(a: BN, b: BN): BN {
  if (a.m === 0) return b;
  if (b.m === 0) return a;
  const d = a.e - b.e;
  if (d > SIG + 2) return a;
  if (d < -(SIG + 2)) return b;
  if (d >= 0) return norm(a.m + b.m / Math.pow(10, d), a.e);
  return norm(b.m + a.m / Math.pow(10, -d), b.e);
}

export function neg(a: BN): BN { return a.m === 0 ? a : { m: -a.m, e: a.e }; }
export function sub(a: BN, b: BN): BN { return add(a, neg(b)); }

export function mul(a: BN, b: BN): BN {
  if (a.m === 0 || b.m === 0) return { m: 0, e: 0 };
  return norm(a.m * b.m, a.e + b.e);
}

export function mulN(a: BN, n: number): BN { return mul(a, bn(n)); }

export function div(a: BN, b: BN): BN {
  if (b.m === 0) throw new Error('BN_DIV_ZERO');
  if (a.m === 0) return { m: 0, e: 0 };
  return norm(a.m / b.m, a.e - b.e);
}

/** base^exp (base > 0) — 비용·성장 곡선용. log10 으로 계산해 지수가 커도 넘치지 않음 */
export function powN(base: number, exp: number): BN {
  if (!(base > 0) || !isFinite(exp)) throw new Error('BN_BAD_POW');
  const l = exp * Math.log10(base);
  const e = Math.floor(l);
  return norm(Math.pow(10, l - e), e);
}

export function cmp(a: BN, b: BN): number {
  const d = sub(a, b);
  return d.m === 0 ? 0 : d.m > 0 ? 1 : -1;
}
export function gte(a: BN, b: BN): boolean { return cmp(a, b) >= 0; }
export function gt(a: BN, b: BN): boolean { return cmp(a, b) > 0; }
export function max(a: BN, b: BN): BN { return cmp(a, b) >= 0 ? a : b; }
export function min(a: BN, b: BN): BN { return cmp(a, b) <= 0 ? a : b; }

/** 소수점 아래 버림 (작은 수만 의미 있음) */
export function floor(a: BN): BN {
  if (a.e >= SIG || a.m === 0) return a;
  if (a.e < 0) return a.m < 0 ? bn(-1) : { m: 0, e: 0 };
  return bn(Math.floor(toNumber(a)));
}

/** log10 (a > 0) */
export function log10(a: BN): number {
  if (a.m <= 0) throw new Error('BN_BAD_LOG');
  return Math.log10(a.m) + a.e;
}

const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간'];

/** 화면 표시: 1만 미만은 정수(소수 1자리), 그 위는 한국식 단위, 10^40 이상은 지수 표기 */
export function fmt(a: BN): string {
  if (a.m === 0) return '0';
  if (a.m < 0) return '-' + fmt(neg(a));
  if (a.e < 4) {
    const n = toNumber(a);
    return n < 10 ? String(Math.floor(n * 10) / 10) : Math.floor(n).toLocaleString('ko-KR');
  }
  const g = Math.floor(a.e / 4);
  if (g < UNITS.length) {
    const v = a.m * Math.pow(10, a.e - g * 4);
    const t = v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10;
    return t + UNITS[g];
  }
  return (Math.floor(a.m * 100) / 100).toFixed(2) + 'e' + a.e;
}
