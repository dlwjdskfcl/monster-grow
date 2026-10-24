/**
 * 명령 처리 순서 (게임 규칙은 GameCore.processRequest)
 *  1~4. (Code.gs) 본문 파싱 → 크기·모양 검사 → 토큰 확인 → 빈도 제한
 *  5. 잠금 (sync 는 쓰지 않으므로 잠금 없이 읽기만)
 *  6. 잠금 안에서 최신 상태 다시 읽기
 *  7~8. 중복 requestId · expectedRevision · 비용/소유/해금 검사 + 규칙 적용 (GameCore)
 *  9~10. 상태 한 행 쓰기 (revision+1 포함) → 명령 기록(CommandJournal) 추가
 *  11~12. 결과 반환 · 잠금 해제
 *
 * ⚠ LockService 는 '충돌 완화'이지 데이터베이스 트랜잭션이 아님
 *   - 상태 쓰기 성공 후 기록 쓰기 실패 → 상태 안의 recent(최근 요청 40개)가 중복을 막고, reconcile() 이 기록을 보충
 *   - 상태 쓰기 전에 실행이 끊김 → 아무것도 안 바뀜. 클라이언트가 같은 requestId 로 다시 보내면 정상 처리
 *   - 잠금 대기 초과 → SERVER_ERROR(BUSY). 클라이언트가 지수 백오프로 재시도
 */

var LOCK_WAIT_MS = 8000;

function runCommand_(pid, req, cfg) {
  if (req.action === 'sync') {
    var row0 = findRow_(pid);
    if (!row0) return fail_(req.requestId, 'AUTH_REQUIRED', 'NO_PLAYER');
    var st0 = readState_(pid, row0);
    var v = GameCore.processRequest(st0, req, ctx_(pid, st0, req, cfg));
    return ok_(req.requestId, st0.revision, payload_(v.state, v.data, cfg));
  }
  var lock = LockService.getScriptLock();
  var w0 = Date.now();
  if (!lock.tryLock(LOCK_WAIT_MS)) { metric_('LOCK_FAIL', Date.now() - w0); return fail_(req.requestId, 'SERVER_ERROR', 'BUSY'); }
  try {
    var row = findRow_(pid);
    if (!row) return fail_(req.requestId, 'AUTH_REQUIRED', 'NO_PLAYER');
    var st = readState_(pid, row);                      // 잠금 안에서 최신 상태
    var out = GameCore.processRequest(st, req, ctx_(pid, st, req, cfg));
    if (out.code === 'DUPLICATE_REQUEST') {
      metric_('DUP', 0);
      return okCode_(req.requestId, 'DUPLICATE_REQUEST', st.revision, payload_(st, out.data, cfg));
    }
    var now = Date.now();
    writeState_(pid, row, out.state, now);              // 확정 지점
    journal_(req.requestId, pid, req.action, 'OK', sha_(GameCore.serialize(out.state)).slice(0, 12));
    return ok_(req.requestId, out.state.revision, payload_(out.state, out.data, cfg));
  } finally {
    lock.releaseLock();
  }
}

function ctx_(pid, st, req, cfg) {
  // 보스전 seed: 서버 비밀값 + playerId + revision → 클라이언트가 미리 계산해 고를 수 없음, 같은 revision 이면 같은 결과
  var seed = GameCore.hashSeed(prop_('SEED_SECRET') + ':' + pid + ':' + st.revision);
  return { now: Date.now(), cfg: cfg, seed: seed };
}

function payload_(state, result, cfg) {
  return { state: JSON.parse(GameCore.serialize(state)), result: result, config: publicConfig_(cfg) };
}
