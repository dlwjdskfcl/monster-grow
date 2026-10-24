// 비밀 값 검사 — 빌드 결과(dist)와 backend 에 비밀처럼 보이는 문자열이 있으면 실패
// GitHub Pages 에 올라가는 것은 '공개'로 취급. API 주소(GAS exec URL)는 공개 값이라 허용
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '개인 키'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API 키'],
  [/ya29\.[0-9A-Za-z_-]{20,}/, 'Google OAuth 토큰'],
  [/gh[pousr]_[0-9A-Za-z]{30,}/, 'GitHub 토큰'],
  [/(SESSION_SECRET|RECOVERY_PEPPER|SEED_SECRET|ADMIN_KEY)\s*[:=]\s*['"][^'"]{8,}/, '서버 비밀 값 대입'],
  [/1[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/, '구글 문서 ID로 보이는 값']
];
const ALLOW = [/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/];
const bad = [];
function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(js|mjs|css|html|gs|json|txt|map)$/.test(f)) continue;
    let t = readFileSync(p, 'utf8');
    for (const a of ALLOW) t = t.replace(new RegExp(a, 'g'), '');
    for (const [re, name] of RULES) if (re.test(t)) bad.push(`${p}: ${name}`);
  }
}
for (const d of process.argv.slice(2)) { try { walk(d); } catch { /* 폴더 없음 */ } }
if (bad.length) { console.error('비밀 값으로 보이는 문자열:\n' + bad.join('\n')); process.exit(1); }
console.log('비밀 값 검사 통과:', process.argv.slice(2).join(', '));
