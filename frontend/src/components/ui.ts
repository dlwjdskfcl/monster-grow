/** 작은 화면 도우미: 이스케이프, 토스트, 아래에서 올라오는 시트, 확인 창 */

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function $(sel: string, root: ParentNode = document): HTMLElement { return root.querySelector(sel) as HTMLElement; }

let toastTimer = 0;
export function toast(msg: string, kind: 'ok' | 'err' | 'info' = 'info') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.className = 'toast on ' + kind;
  t.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('on'), 2600);
}

const openSheets = new Set<() => void>();
/** 화면(주소)이 바뀌면 열린 시트를 닫음 */
export function closeAllSheets() { [...openSheets].forEach((c) => c()); }

export function sheet(html: string, opts: { onClose?: () => void; wide?: boolean } = {}): { el: HTMLElement; close: () => void } {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true"><button class="sheet-x" aria-label="닫기">✕</button>${html}</div>`;
  document.body.appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('on'));
  const close = () => { openSheets.delete(close); bg.classList.remove('on'); setTimeout(() => bg.remove(), 200); opts.onClose?.(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  openSheets.add(close);
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  (bg.querySelector('.sheet-x') as HTMLElement).onclick = close;
  return { el: bg.querySelector('.sheet') as HTMLElement, close };
}

export function confirmBox(title: string, body: string, yes = '확인'): Promise<boolean> {
  return new Promise((res) => {
    let done = false;
    const s = sheet(`<h3>${esc(title)}</h3><p class="muted">${body}</p><div class="row end"><button class="btn ghost" data-no>취소</button><button class="btn primary" data-yes>${esc(yes)}</button></div>`, { onClose: () => { if (!done) res(false); } });
    (s.el.querySelector('[data-yes]') as HTMLElement).onclick = () => { done = true; res(true); s.close(); };
    (s.el.querySelector('[data-no]') as HTMLElement).onclick = () => { done = true; res(false); s.close(); };
  });
}

export function duration(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : m ? `${m}분` : `${Math.floor(sec)}초`;
}

export const reducedMotion = () => document.documentElement.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
