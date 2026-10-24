# 몬스터 키우기 (작업명)

공명체와 함께 무너진 부유 대륙의 생태계를 되살리는 **오리지널 방치형 성장 웹게임**.
GitHub Pages(정적 TypeScript) + Google Apps Script(API) + Google Sheets(저장). **jammanbo / jammanbo-beta 와 완전히 분리된 새 프로젝트.**

```
shared/      게임 규칙 (클라이언트·서버 공용 순수 함수) — 큰 수, 데이터, 공식, 전투, 명령, API 계약
frontend/    게임 화면 (Vite + TypeScript, 프레임워크 없음)
backend/     GAS 코드 (Code·Auth·PlayerRepository·CommandService·Admin·Setup + 자동 생성 GameCore.gs)
tests/       단위·서버 테스트 (vitest) + 가짜 GAS 환경
scripts/     로컬 서버 · GameCore 묶기 · 브라우저 테스트 · 밸런스 시뮬레이션 · 비밀 값 검사
docs/        설계 문서 01~15
.github/     배포 workflow
```

## 로컬에서 해 보기
```bash
npm ci
npm run build:gas          # shared → backend/GameCore.gs
npm run dev:server         # 가짜 GAS (backend 실제 코드) → http://localhost:8787
npm run dev                # 다른 창 → http://localhost:5173
# 시간 3시간 건너뛰기(오프라인 보상 확인): curl -X POST "http://localhost:8787/__time?add=10800"
npm run check              # 타입·테스트·GAS 묶기·빌드·비밀 값 검사
npm run e2e                # 브라우저 테스트 (Playwright, 처음엔 npx playwright install chromium)
npm run sim                # 밸런스 시뮬레이션 표
```

## 처음 설정 (사람이 할 일 — Claude 는 계정에 접근할 수 없음)
> ⚠ 기존 잠만보 시트·스크립트·저장소는 열지도 고치지도 않습니다. 아래는 전부 **새로 만드는 것**.
> 운영 격리가 중요하면 1~3번을 **새 Google 계정**으로 (docs/02).

1. **스테이징 시트**: 구글 드라이브 → 새 스프레드시트 `몬스터키우기_staging`
2. **GAS**: 그 시트 → 확장 프로그램 → Apps Script → `backend/` 의 `.gs` 7개를 같은 이름으로 만들어 붙여넣기, 프로젝트 설정에서 `appsscript.json` 표시 후 내용 교체
   (또는 clasp: `npx @google/clasp create --type sheets --rootDir backend` — `.clasp.json` 은 커밋하지 않음)
3. 편집기에서 `setupStaging` 실행(권한 허용) → `setAdminKey("24자 이상 아무 문자열")` 실행 후 그 줄의 키는 지우기 → `installTriggers` 실행
4. 배포 → 새 배포 → 웹 앱 · 실행: 나 · 액세스: 모든 사용자 → `…/exec` 주소 복사
5. **GitHub**: 저장소 `dlwjdskfcl/monster-grow` (이 폴더가 저장소). 배포 설정은 반드시 `.github\workflows\deploy.yml` 위치 (그냥 `workflows\` 면 Actions 가 안 돌아요)
6. 저장소 Settings → Pages → Source **GitHub Actions** / Settings → Secrets and variables → Actions → **Variables**: `API_URL_STAGING` = 4번 주소, `API_URL_PROD` = (운영 전까지는 같은 주소)
7. main 에 push → Actions 가 검사·배포 → `https://<계정>.github.io/monster-grow/staging/comm-test.html` 에서 **통신 실험** (docs/05)
8. 통과하면 `…/monster-grow/staging/` 에서 플레이 확인
9. 운영: 1~4를 `몬스터키우기_prod` + `setupProd` 로 반복 → `API_URL_PROD` 교체 → push

## 평소 순서
- 규칙(shared/) 수정 → `npm run check` → `npm run build:gas` → GameCore.gs 를 **스테이징 GAS** 에 붙여넣고 배포 관리에서 새 버전 → 확인 → 운영 GAS 도 같게
- 서버 먼저, 화면 나중 (docs/13). 스키마 바뀌면 마이그레이션 절차

## 문서
01 기존 시스템 실사 · 02 독립 운영 경계 · 03 아키텍처 · 04 게임 시스템(밸런스 표) · 05 API 계약·통신 실험 · 11 시트 스키마 · 12 보안·테스트 · 13 운영·백업·복구·마이그레이션 · 14 자산·권리 · 15 제한·다음 작업
