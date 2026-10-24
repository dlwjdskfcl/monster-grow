/** 몬스터 키우기 — 시작 */
import './styles/main.css';
import { startApp } from './app/app';
import { esc, sheet } from './components/ui';
import { session } from './game/session';
import { local } from './storage/store';

if (local.get('calm', false)) document.documentElement.classList.add('calm');
startApp(document.getElementById('app')!);

let welcomed = false;
session.on(() => {
  if (welcomed || !session.newRecoveryCode) return;
  welcomed = true;
  const code = session.newRecoveryCode;
  session.newRecoveryCode = '';
  sheet(`<h3>탐사단에 온 걸 환영해요</h3>
    <p>부유 대륙의 생태 핵이 무너졌어요. 공명체 셋과 함께 균사림부터 되살려 주세요. 편대는 자동으로 탐사하고, 접속하지 않아도 정산 한도 안에서 자원을 모아요.</p>
    <div class="card warn small"><b>복구 코드 — 꼭 적어 두세요</b><p>이 기기의 게스트 계정이에요. 아래 코드가 없으면 기록을 되찾을 수 없어요. (설정에서 다시 볼 수 있어요)</p>
      <div class="kv"><span>ID</span><code>${esc(session.playerId)}</code></div><div class="kv"><span>코드</span><code>${esc(code)}</code></div></div>
    <div class="row end"><button class="btn primary" data-go>탐사 시작</button></div>`).el.querySelector<HTMLElement>('[data-go]')!.onclick = () => document.querySelector<HTMLElement>('.sheet-x')?.click();
});

session.boot();
