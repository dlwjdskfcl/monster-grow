# 05. API 계약 · 통신 실험

TypeScript 타입: `shared/protocol.ts` (ApiRequest · ApiResponse), `shared/commands.ts` (Action · ErrorCode)

## 전송
- `POST <GAS 웹 앱 /exec>`, 본문 = JSON 문자열, `Content-Type: text/plain;charset=utf-8` (CORS 사전 요청이 생기지 않는 '단순 요청')
- GAS 는 302 로 결과 주소(googleusercontent)로 보내고 fetch 가 따라가 본문을 읽음. `mode: 'no-cors'` 는 **쓰지 않음**(응답을 읽을 수 없음), JSONP 도 쓰지 않음
- 본문 최대 16KB, 시간 초과 20초, 재시도는 클라이언트(같은 requestId)

## 요청
```json
{
  "requestId": "uuid v4",
  "action": "hello|register|restore|sync|claimOffline|upgrade|setTeam|challengeBoss|rebuildEcology|setAlias",
  "expectedRevision": 12,
  "clientVersion": "0.1.0",
  "schemaVersion": 1,
  "token": "세션 토큰 (hello·register·restore 제외)",
  "payload": {}
}
```
| action | payload | 저장 | 비고 |
|---|---|---|---|
| hello | – | – | 설정·공지·점검 여부 (토큰 불필요) |
| register | – | O | 새 게스트 계정 → playerId·recoveryCode(한 번만)·token |
| restore | `{playerId, code}` | – | 10분에 5번까지 |
| sync | – | **X** | 지금 시각까지 정산한 상태 '보기'만, revision 그대로 |
| claimOffline | – | O | 정산 확정 (자동 저장도 이것) |
| upgrade | `{kind:'level'\|'skill', id, times≤100}` · `{kind:'resonance', id}` · `{kind:'trait', id, trait}` · `{kind:'research', key, times}` · `{kind:'contract', id}` | O | |
| setTeam | `{team: [id…] (1~5)}` | O | 앞 2칸 = 앞줄 |
| challengeBoss | – | O | 결과 `battle` 기록 + `reward` |
| rebuildEcology | `{confirm: true}` | O | |
| setAlias | `{id, alias≤12}` | O | |

## 응답
```json
{ "ok": true, "code": "OK", "requestId": "uuid", "serverTime": 0, "revision": 13,
  "data": { "state": { /* PlayerState, 큰 수는 "1.5e30" 문자열 */ }, "result": { "action": "...", "settle": {}, "data": {} }, "config": {} },
  "error": null }
```
`ok:false` 이면 `data:null`, `error:{reason}` (짧은 코드, 내부 오류·시트 내용 없음)

| code | 뜻 | 클라이언트 동작 |
|---|---|---|
| OK | 처리됨 | 상태 교체 |
| DUPLICATE_REQUEST | 이미 처리한 requestId (ok:true) | 상태 교체, 다시 적용하지 않음 |
| AUTH_REQUIRED | 토큰 없음·위조·만료(30일), 복구 실패 | 복구 코드 안내 |
| INVALID_REQUEST | 모양·규칙 위반 (reason: NOT_ENOUGH_ENERGY, GATE_NOT_REACHED, CLIENT_TOO_OLD …) | 안내, 큐에서 삭제 |
| VERSION_CONFLICT | expectedRevision 불일치 | sync 후 안내 |
| RATE_LIMITED | 분당 60회 초과 등 | 재시도 |
| MAINTENANCE | 점검·읽기 전용 | 점검 화면 |
| SERVER_ERROR | 잠금 실패(BUSY)·내부 오류 | 재시도 |

## 운영 API (일반 API 와 분리)
`{ "admin": { "key": "...", "op": "status|setConfig|announce|backup|metrics", "args": {}, "requestId": "..." } }` — 모든 호출 AdminAudit 기록, 10분 20회

## 통신 실험 (구현 전에 할 일 — **미실시**)
이 작업 환경에서는 script.google.com 에 접속할 수 없어 실제 GAS 로 실험하지 못함 → **추가 확인 필요**.
1. 스테이징 GAS 를 배포한 뒤 `https://<계정>.github.io/monster-grow/comm-test.html` 열기 (빌드에 포함됨)
2. 웹 앱 주소 넣고 '실험 시작' → 5개 요청 모두 '본문 읽힘 = 예'인지
3. PC Chrome, 안드로이드 Chrome, iPhone Safari, 카카오톡 인앱 브라우저에서 각각 실행, 결과를 아래 표에 기록
4. 하나라도 실패하면 게임 배포 중단

| 브라우저 | hello ms | 본문 읽힘 | 오류 응답 읽힘 | 비고 |
|---|---|---|---|---|
| (기록) | | | | |
