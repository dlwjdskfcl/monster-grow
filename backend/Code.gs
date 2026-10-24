/**
 * 몬스터 키우기 — Apps Script 웹 앱 입구 (신규 프로젝트 전용, 기존 jammanbo 와 무관)
 *
 * 배포: 웹 앱 · 실행 = 나(배포한 계정) · 액세스 = 모든 사용자
 *   ⚠ '나로 실행'은 시트에 쓰기 위한 실행 주체일 뿐, 게임 사용자 권한과 다름. 사용자는 세션 토큰으로 확인(Auth.gs)
 *
 * 요청: POST, 본문 = JSON 문자열 (Content-Type: text/plain → 브라우저 사전 요청(CORS preflight) 없음)
 * 응답: { ok, code, requestId, serverTime, revision, data, error }  — 내부 오류·시트 원본은 내보내지 않음
 * 파일: Code(입구) · Auth(인증) · PlayerRepository(저장) · CommandService(명령) · Admin(운영) · Setup(설치) · GameCore(게임 규칙, 자동 생성)
 */

var MAX_BODY = 16 * 1024;

function doGet(e) {
  // 상태 확인용 (모니터링·스모크 테스트). 게임 데이터는 주지 않음
  return json_({ ok: true, code: 'OK', service: 'monster-grow', env: env_(), serverTime: Date.now() });
}

function doPost(e) {
  var t0 = Date.now();
  var body = e && e.postData ? String(e.postData.contents || '') : '';
  var out = handle_(body, t0);
  metric_(out.code, Date.now() - t0);
  return json_(out);
}

function handle_(body, t0) {
  var rid = '';
  try {
    if (body.length > MAX_BODY) return fail_('', 'INVALID_REQUEST', 'BODY_TOO_LARGE');
    var raw;
    try { raw = JSON.parse(body); } catch (err) { return fail_('', 'INVALID_REQUEST', 'BAD_JSON'); }
    if (raw && raw.admin) return adminApi_(raw);                      // 운영 API 는 따로 (Admin.gs)
    var req = GameCore.validateShape(raw);
    rid = req.requestId;
    var cfg = config_();
    if (req.action === 'hello') return ok_(rid, 0, hello_(cfg));
    if (cfg.minClientVersion && GameCore.versionLess(req.clientVersion, cfg.minClientVersion)) return fail_(rid, 'INVALID_REQUEST', 'CLIENT_TOO_OLD');
    if (cfg.maintenance) return fail_(rid, 'MAINTENANCE', cfg.maintenanceMessage || 'MAINTENANCE');
    if (req.action === 'register') return register_(req, cfg);
    if (req.action === 'restore') return restore_(req, cfg);

    var pid = verifyToken_(req.token);
    if (!pid) return fail_(rid, 'AUTH_REQUIRED', 'TOKEN_INVALID');
    if (!rateOk_('p:' + pid, cfg.rateLimitPerMin || 60, 60)) return fail_(rid, 'RATE_LIMITED', 'TOO_MANY_REQUESTS');
    if (cfg.readOnly && req.action !== 'sync') return fail_(rid, 'MAINTENANCE', 'READ_ONLY');
    return runCommand_(pid, req, cfg);
  } catch (err) {
    if (err && err.code && err.reason) return fail_(rid, err.code, err.reason);   // GameError (규칙 위반)
    console.error('handle_', err && err.stack || err);
    return fail_(rid, 'SERVER_ERROR', 'INTERNAL');
  }
}

/* ---------- 응답 ---------- */
function ok_(rid, revision, data) {
  return { ok: true, code: 'OK', requestId: rid, serverTime: Date.now(), revision: revision, data: data, error: null };
}
function okCode_(rid, code, revision, data) {
  var o = ok_(rid, revision, data); o.code = code; return o;
}
function fail_(rid, code, reason) {
  return { ok: false, code: code, requestId: rid, serverTime: Date.now(), revision: -1, data: null, error: { reason: String(reason).slice(0, 80) } };
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function hello_(cfg) {
  return { env: env_(), config: publicConfig_(cfg), announcements: announcements_(), maintenance: !!cfg.maintenance, maintenanceMessage: cfg.maintenanceMessage || '' };
}

function env_() { return PropertiesService.getScriptProperties().getProperty('ENV') || 'dev'; }

/* ---------- 설정 (GameConfig 시트, 60초 캐시) ---------- */
function config_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cfg');
  if (hit) return JSON.parse(hit);
  var cfg = JSON.parse(JSON.stringify(GameCore.DEFAULT_CONFIG));
  cfg.rateLimitPerMin = 60; cfg.maintenance = false; cfg.readOnly = false; cfg.minClientVersion = ''; cfg.maintenanceMessage = '';
  var sh = sheet_('GameConfig');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  rows.forEach(function (r) {
    var key = String(r[1] || ''), val = r[2], enabled = r[3] === true || String(r[3]).toUpperCase() === 'Y' || String(r[3]).toUpperCase() === 'TRUE';
    if (!key || !enabled || !(key in cfg)) return;
    if (r[0]) cfg.configVersion = Math.max(cfg.configVersion, Number(r[0]) || 0);
    if (typeof cfg[key] === 'number') { var n = Number(val); if (isFinite(n)) cfg[key] = n; }
    else if (typeof cfg[key] === 'boolean') cfg[key] = val === true || String(val).toUpperCase() === 'Y' || String(val).toUpperCase() === 'TRUE';
    else cfg[key] = String(val);
  });
  // 안전 범위
  cfg.offlineCapHours = clamp_(cfg.offlineCapHours, 1, 48); cfg.prodMult = clamp_(cfg.prodMult, 0.1, 10);
  cfg.maxTeam = clamp_(Math.round(cfg.maxTeam), 3, 5); cfg.minTeamForBoss = clamp_(Math.round(cfg.minTeamForBoss), 1, cfg.maxTeam);
  cache.put('cfg', JSON.stringify(cfg), 60);
  return cfg;
}
function publicConfig_(cfg) {
  var o = {};
  Object.keys(GameCore.DEFAULT_CONFIG).forEach(function (k) { o[k] = cfg[k]; });
  return o;
}
function clamp_(x, a, b) { return Math.max(a, Math.min(b, Number(x))); }

function announcements_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('ann');
  if (hit) return JSON.parse(hit);
  var sh = sheet_('Announcements'), now = Date.now(), out = [];
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues() : [];
  rows.forEach(function (r) {
    var on = r[5] === true || String(r[5]).toUpperCase() === 'Y';
    var s = r[3] ? new Date(r[3]).getTime() : 0, en = r[4] ? new Date(r[4]).getTime() : Infinity;
    if (on && now >= s && now <= en) out.push({ id: String(r[0]), title: String(r[1]).slice(0, 80), body: String(r[2]).slice(0, 1000) });
  });
  cache.put('ann', JSON.stringify(out.slice(0, 10)), 120);
  return out.slice(0, 10);
}

/* ---------- 요청 빈도 제한 (캐시 카운터 — 근사치, 최종 판정 근거 아님) ---------- */
function rateOk_(key, limit, windowSec) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + key + ':' + Math.floor(Date.now() / 1000 / windowSec);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), windowSec + 5);
  return n <= limit;
}

/* ---------- 지표 (캐시에 시간 단위로 모았다가 flushMetrics 가 Metrics 시트에 기록) ---------- */
function metric_(code, ms) {
  try {
    var cache = CacheService.getScriptCache();
    var h = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH');
    var k = 'm:' + h;
    var m = JSON.parse(cache.get(k) || '{}');
    m.n = (m.n || 0) + 1; m.ms = (m.ms || 0) + ms; m.max = Math.max(m.max || 0, ms);
    m[code] = (m[code] || 0) + 1;
    cache.put(k, JSON.stringify(m), 7200);
  } catch (e) { /* 지표 실패는 무시 */ }
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('시트 없음: ' + name + ' — Setup.gs 의 setup() 을 먼저 실행하세요');
  return sh;
}
