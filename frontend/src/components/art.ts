/**
 * 공명체·보스·배경 그림 — 이 프로젝트에서 만든 절차적 SVG (외부 이미지·폰트·아이콘 없음)
 * 몸 모양(6종) × 색 × 눈 × 무늬 × 머리 장식 조합. 자산 목록: docs/14_자산_권리검토.md
 */
import type { Look } from '../../../shared/data';

const uid = (() => { let n = 0; return () => 'g' + (++n).toString(36); })();

function bodyPath(b: Look['body']): string {
  switch (b) {
    case 'blob': return 'M60 22c22 0 36 18 36 40 0 22-14 36-36 36S24 84 24 62c0-22 14-40 36-40z';
    case 'shell': return 'M18 80c0-30 18-50 42-50s42 20 42 50c0 8-6 12-14 12H32c-8 0-14-4-14-12z';
    case 'crystal': return 'M60 14l28 30-10 46H42L32 44z';
    case 'jelly': return 'M24 62c0-24 16-40 36-40s36 16 36 40c0 6-4 8-8 8H32c-4 0-8-2-8-8z';
    case 'wisp': return 'M60 18c18 0 32 16 32 34 0 20-14 34-32 40-6 2-10 8-12 14-2-10-4-16-10-20-8-6-10-20-10-34 0-18 14-34 32-34z';
    case 'serpent': return 'M30 92c-10-4-10-18 2-22l30-8c10-3 10-14 0-17l-12-3c-8-2-6-14 4-14h16c18 0 26 22 12 32l-22 14c-6 4-2 12 6 10l18-4c10-2 14 10 4 14z';
  }
}

function eyes(n: 1 | 2 | 3, body: Look['body']): string {
  const y = body === 'shell' ? 58 : body === 'serpent' ? 34 : body === 'crystal' ? 50 : 54;
  const cx = body === 'serpent' ? 66 : 60;
  const xs = n === 1 ? [cx] : n === 2 ? [cx - 11, cx + 11] : [cx - 14, cx, cx + 14];
  return xs.map((x, i) => {
    const r = n === 1 ? 8 : n === 3 && i === 1 ? 5 : 6;
    const yy = n === 3 && i === 1 ? y - 9 : y;
    return `<ellipse cx="${x}" cy="${yy}" rx="${r}" ry="${r * 1.15}" fill="#fff"/><ellipse cx="${x + 1}" cy="${yy + 1}" rx="${r * 0.55}" ry="${r * 0.65}" fill="#1b1d2b"/><circle cx="${x + 2.5}" cy="${yy - 2}" r="${r * 0.22}" fill="#fff"/>`;
  }).join('');
}

function marks(m: Look['mark'], c2: string): string {
  switch (m) {
    case 'spots': return `<g fill="${c2}" opacity=".55"><circle cx="40" cy="70" r="5"/><circle cx="78" cy="74" r="4"/><circle cx="70" cy="40" r="3.5"/></g>`;
    case 'stripes': return `<g stroke="${c2}" stroke-width="4" stroke-linecap="round" opacity=".5" fill="none"><path d="M36 72q24 6 48 0"/><path d="M40 82q20 5 40 0"/></g>`;
    case 'rings': return `<g fill="none" stroke="${c2}" stroke-width="2.5" opacity=".55"><circle cx="60" cy="74" r="10"/><circle cx="60" cy="74" r="4"/></g>`;
    case 'facets': return `<g fill="#fff" opacity=".18"><path d="M60 16l12 28H48z"/><path d="M42 50l8 36h-8z"/></g>`;
    default: return '';
  }
}

function crest(c: Look['crest'], c1: string, c2: string, body: Look['body']): string {
  const top = body === 'shell' ? 30 : body === 'crystal' ? 14 : body === 'serpent' ? 18 : 22;
  const cx = body === 'serpent' ? 66 : 60;
  switch (c) {
    case 'cap': return `<path d="M${cx - 26} ${top + 10}q26-26 52 0q-26-6-52 0z" fill="${c2}" stroke="${c1}" stroke-width="2"/>`;
    case 'fins': return `<path d="M${cx - 30} ${top + 26}l-10-14 16 4zM${cx + 30} ${top + 26}l10-14-16 4z" fill="${c2}" opacity=".9"/>`;
    case 'spikes': return `<path d="M${cx - 16} ${top + 4}l4-12 4 12zM${cx - 4} ${top}l4-14 4 14zM${cx + 8} ${top + 4}l4-12 4 12z" fill="${c2}"/>`;
    case 'antenna': return `<g stroke="${c1}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${cx - 8} ${top + 2}q-6-14-14-16"/><path d="M${cx + 8} ${top + 2}q6-14 14-16"/></g><circle cx="${cx - 22}" cy="${top - 14}" r="4" fill="${c2}"/><circle cx="${cx + 22}" cy="${top - 14}" r="4" fill="${c2}"/>`;
    case 'halo': return `<ellipse cx="${cx}" cy="${top - 6}" rx="16" ry="5" fill="none" stroke="${c2}" stroke-width="3" opacity=".9"/>`;
    default: return '';
  }
}

function extras(b: Look['body'], c1: string, c2: string): string {
  if (b === 'jelly') return `<g stroke="${c1}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".85"><path d="M36 70q-4 12 2 22"/><path d="M50 70q-2 14 2 24"/><path d="M70 70q2 14-2 24"/><path d="M84 70q4 12-2 22"/></g>`;
  if (b === 'shell') return `<g fill="${c1}"><rect x="30" y="88" width="10" height="8" rx="4"/><rect x="80" y="88" width="10" height="8" rx="4"/></g><path d="M30 60q30-22 60 0" stroke="${c2}" stroke-width="3" fill="none" opacity=".5"/>`;
  if (b === 'wisp') return `<circle cx="38" cy="96" r="3" fill="${c2}" opacity=".7"/><circle cx="30" cy="104" r="2" fill="${c2}" opacity=".5"/>`;
  return '';
}

/** 공명체 그림 (SVG 문자열). size = 화면 크기(px) */
export function creatureSvg(look: Look, size = 96, opts: { shadow?: boolean; dim?: boolean } = {}): string {
  const g = uid();
  const { body, c1, c2 } = look;
  const dim = opts.dim ? ' style="filter:grayscale(1) brightness(.45)"' : '';
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true"${dim}>
<defs><radialGradient id="${g}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${c2}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${shade(c1, -0.35)}"/></radialGradient></defs>
${opts.shadow === false ? '' : '<ellipse cx="60" cy="108" rx="30" ry="6" fill="#000" opacity=".22"/>'}
${extras(body, c1, c2)}
<path d="${bodyPath(body)}" fill="url(#${g})" stroke="${shade(c1, -0.45)}" stroke-width="2.5" stroke-linejoin="round"/>
${marks(look.mark, c2)}${crest(look.crest, shade(c1, -0.3), c2, body)}${eyes(look.eye, body)}
<path d="M${body === 'serpent' ? 60 : 54} ${body === 'shell' ? 70 : body === 'serpent' ? 44 : 68}q6 5 12 0" stroke="#1b1d2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;
}

/** 보스: 큰 몸 + 균열/핵 문양 (오리지널) */
export const BOSS_LOOK: Record<string, Look & { core: string }> = {
  b_rotking: { body: 'blob', c1: '#5b4a6e', c2: '#b99be0', eye: 3, mark: 'spots', crest: 'cap', core: '#c6ff7a' },
  b_sandmaw: { body: 'crystal', c1: '#9a6a32', c2: '#ffd48a', eye: 2, mark: 'facets', crest: 'spikes', core: '#ff8a3d' },
  b_galecore: { body: 'jelly', c1: '#33416e', c2: '#9fc4ff', eye: 1, mark: 'rings', crest: 'antenna', core: '#ffe76a' }
};
export function bossSvg(id: string, size = 150): string {
  const l = BOSS_LOOK[id] || BOSS_LOOK.b_rotking;
  const inner = creatureSvg(l, size, { shadow: false });
  return `<div class="boss-art" style="--core:${l.core}">${inner}<span class="core"></span></div>`;
}

/** 탐사 중 만나는 무명 적 (지역 색의 그림자 형태) */
export function foeSvg(seed: number, tint: string, size = 70): string {
  const bodies: Look['body'][] = ['blob', 'crystal', 'jelly', 'wisp'];
  const look: Look = { body: bodies[seed % 4], c1: shade(tint, -0.2), c2: shade(tint, 0.25), eye: ((seed % 3) + 1) as 1 | 2 | 3, mark: 'none', crest: 'none' };
  return creatureSvg(look, size);
}

/** 지역 배경 (언덕 3겹 + 빛 알갱이) */
export function regionBg(id: string, c1: string, c2: string): string {
  const deco = id === 'mycel'
    ? '<g fill="#d8ff9a" opacity=".55"><circle cx="40" cy="60" r="2"/><circle cx="120" cy="40" r="1.6"/><circle cx="220" cy="70" r="2.2"/><circle cx="300" cy="35" r="1.8"/><circle cx="350" cy="80" r="1.4"/></g>'
    : id === 'glass'
      ? '<g fill="#fff" opacity=".35"><path d="M60 120l12-40 12 40z"/><path d="M270 120l16-56 16 56z"/></g><circle cx="320" cy="40" r="18" fill="#ffe7a8" opacity=".6"/>'
      : '<g stroke="#fff6a0" stroke-width="2" fill="none" opacity=".7"><path d="M300 10l-12 26h10l-14 28"/></g>';
  return `<svg class="bg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c1, -0.2)}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="400" height="200" fill="url(#sky-${id})"/>${deco}
<path d="M0 140q60-40 120-10t140-20 140 10v80H0z" fill="${shade(c1, 0.1)}" opacity=".6"/>
<path d="M0 160q80-30 160 0t160-6 80 6v40H0z" fill="${shade(c1, -0.15)}" opacity=".85"/>
<path d="M0 182q100-18 200 0t200 0v18H0z" fill="${shade(c1, -0.4)}"/>
</svg>`;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
