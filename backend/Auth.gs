/**
 * 인증 — 게스트 계정 + 복구 코드
 *  - register: 새 playerId + 복구 코드(한 번만 보여 줌) + 세션 토큰
 *  - restore : playerId + 복구 코드 → 새 세션 토큰 (다른 기기에서 이어 하기)
 *  - 토큰 = base64url(playerId.만료시각) + '.' + HMAC-SHA256(서명키)  — 서명키는 스크립트 속성 SESSION_SECRET (Setup.gs 가 생성)
 *  - 복구 코드는 시트에 해시(SHA-256 + RECOVERY_PEPPER)로만 저장
 * ⚠ 게스트 계정은 복구 코드를 잃으면 되찾을 수 없음 (화면에서 안내)
 */

var TOKEN_DAYS = 30;

function prop_(k) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('스크립트 속성 없음: ' + k + ' — setup() 실행 필요');
  return v;
}

function b64u_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, '');
}
function hmac_(text) {
  return b64u_(Utilities.computeHmacSha256Signature(text, prop_('SESSION_SECRET')));
}
function sha_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function sameStr_(a, b) {            // 길이가 같으면 끝까지 비교 (시간 차이로 정보가 새지 않게)
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function makeToken_(pid) {
  var body = b64u_(pid + '.' + (Date.now() + TOKEN_DAYS * 86400000));
  return body + '.' + hmac_(body);
}

/** 토큰이 맞으면 playerId, 아니면 '' */
function verifyToken_(token) {
  if (typeof token !== 'string' || token.length > 400) return '';
  var i = token.lastIndexOf('.');
  if (i < 1) return '';
  var body = token.slice(0, i), sig = token.slice(i + 1);
  if (!sameStr_(sig, hmac_(body))) return '';
  var txt;
  try { txt = Utilities.newBlob(Utilities.base64DecodeWebSafe(body + '==='.slice((body.length + 3) % 4))).getDataAsString(); } catch (e) { return ''; }
  var j = txt.lastIndexOf('.');
  var pid = txt.slice(0, j), exp = Number(txt.slice(j + 1));
  if (!/^[0-9a-f-]{36}$/.test(pid) || !(exp > Date.now())) return '';
  return pid;
}

function newRecoveryCode_() {
  var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toUpperCase();
  return 'MK-' + hex.slice(0, 5) + '-' + hex.slice(5, 10) + '-' + hex.slice(10, 15) + '-' + hex.slice(15, 20);
}
function recoveryHash_(code) { return sha_(prop_('RECOVERY_PEPPER') + ':' + String(code).toUpperCase().trim()); }

function register_(req, cfg) {
  if (!rateOk_('register', 30, 600)) return fail_(req.requestId, 'RATE_LIMITED', 'REGISTER_BUSY');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return fail_(req.requestId, 'SERVER_ERROR', 'BUSY');
  try {
    // 같은 requestId 로 다시 온 가입(응답 유실 후 재시도)은 새 계정을 만들지 않음
    var c = CacheService.getScriptCache().get('reg:' + req.requestId);
    if (c) return okCode_(req.requestId, 'DUPLICATE_REQUEST', 0, JSON.parse(c));
    var pid = Utilities.getUuid().toLowerCase();
    var code = newRecoveryCode_();
    var now = Date.now();
    var state = GameCore.newState(now);
    createPlayer_(pid, recoveryHash_(code), state, now);
    var data = { playerId: pid, recoveryCode: code, token: makeToken_(pid), state: JSON.parse(GameCore.serialize(state)), config: publicConfig_(cfg) };
    // 재시도 대비: 10분 동안 같은 응답 (복구 코드 포함 — 캐시는 이 스크립트만 읽음)
    CacheService.getScriptCache().put('reg:' + req.requestId, JSON.stringify(data), 600);
    journal_(req.requestId, pid, 'register', 'OK', '');
    return ok_(req.requestId, 0, data);
  } finally { lock.releaseLock(); }
}

function restore_(req, cfg) {
  var p = req.payload || {};
  var pid = String(p.playerId || '').toLowerCase(), code = String(p.code || '');
  if (!/^[0-9a-f-]{36}$/.test(pid) || code.length < 10 || code.length > 40) return fail_(req.requestId, 'INVALID_REQUEST', 'BAD_RESTORE');
  if (!rateOk_('restore:' + pid, 5, 600) || !rateOk_('restore', 60, 600)) return fail_(req.requestId, 'RATE_LIMITED', 'RESTORE_LOCKED');
  var row = findRow_(pid);
  if (!row) return fail_(req.requestId, 'AUTH_REQUIRED', 'RESTORE_FAILED');
  var hash = String(sheet_('Players').getRange(row, 6).getValue());
  if (!sameStr_(hash, recoveryHash_(code))) return fail_(req.requestId, 'AUTH_REQUIRED', 'RESTORE_FAILED');
  var st = readState_(pid, row);
  return ok_(req.requestId, st.revision, { playerId: pid, token: makeToken_(pid), state: JSON.parse(GameCore.serialize(st)), config: publicConfig_(cfg) });
}
