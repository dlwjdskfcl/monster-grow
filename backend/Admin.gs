/**
 * 운영 — 일반 게임 API 와 분리
 *  A) 편집기에서 직접 실행하는 함수 (가장 안전): setMaintenance · setReadOnly · backupSnapshot · refreshMirrors · flushMetrics · reconcile · runMigrations · installTriggers
 *  B) 운영 API: 본문 { admin: { key, op, args, requestId } }  — key 는 스크립트 속성 ADMIN_KEY_HASH(SHA-256)와 비교
 *     op: status · setConfig · announce · backup · metrics       모든 호출은 AdminAudit 시트에 기록
 */

function adminApi_(raw) {
  var a = raw.admin || {};
  var rid = String(a.requestId || '').slice(0, 40);
  if (!rateOk_('admin', 20, 600)) return fail_(rid, 'RATE_LIMITED', 'ADMIN_LOCKED');
  var want = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY_HASH');
  if (!want || typeof a.key !== 'string' || !sameStr_(sha_(a.key), want)) {
    audit_(rid, '(실패)', String(a.op || ''), 'DENIED');
    return fail_(rid, 'AUTH_REQUIRED', 'ADMIN_DENIED');
  }
  var adminId = 'admin:' + sha_(a.key).slice(0, 8);
  var args = a.args || {};
  var res;
  switch (a.op) {
    case 'status': res = { env: env_(), config: config_(), players: Math.max(0, sheet_('Players').getLastRow() - 1) }; break;
    case 'setConfig': res = setConfig_(String(args.key || ''), args.value); break;
    case 'announce': res = announce_(args); break;
    case 'backup': res = { name: backupSnapshot() }; break;
    case 'metrics': res = { rows: lastMetrics_(48) }; break;
    default: audit_(rid, adminId, String(a.op), 'UNKNOWN'); return fail_(rid, 'INVALID_REQUEST', 'UNKNOWN_OP');
  }
  audit_(rid, adminId, a.op + ' ' + JSON.stringify(args).slice(0, 200), 'OK');
  return ok_(rid, 0, res);
}

function audit_(rid, adminId, action, result) {
  try { sheet_('AdminAudit').appendRow([rid, adminId, action, result, new Date()]); } catch (e) {}
}

var CONFIG_KEYS = ['offlineCapHours', 'prodMult', 'maxTeam', 'minTeamForBoss', 'rebuildMinDepth', 'maintenance', 'maintenanceMessage', 'readOnly', 'minClientVersion', 'rateLimitPerMin'];

function setConfig_(key, value) {
  if (CONFIG_KEYS.indexOf(key) < 0) throw { code: 'INVALID_REQUEST', reason: 'UNKNOWN_CONFIG' };
  var sh = sheet_('GameConfig');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  var ver = rows.reduce(function (m, r) { return Math.max(m, Number(r[0]) || 0); }, 1) + 1;
  var idx = -1;
  rows.forEach(function (r, i) { if (r[1] === key) idx = i; });
  var line = [ver, key, value, 'Y', new Date()];
  if (idx >= 0) sh.getRange(idx + 2, 1, 1, 5).setValues([line]); else sh.appendRow(line);
  CacheService.getScriptCache().remove('cfg');
  return { key: key, value: value, configVersion: ver };
}

function announce_(a) {
  var id = 'n' + Date.now();
  sheet_('Announcements').appendRow([id, String(a.title || '').slice(0, 80), String(a.body || '').slice(0, 1000), a.startAt ? new Date(a.startAt) : new Date(), a.endAt ? new Date(a.endAt) : '', 'Y']);
  CacheService.getScriptCache().remove('ann');
  return { id: id };
}

/* ---------- 편집기에서 실행 ---------- */
function setMaintenance(on, message) {
  setConfig_('maintenance', on === false ? 'N' : 'Y');
  if (message) setConfig_('maintenanceMessage', message);
  audit_('editor', 'editor', 'setMaintenance ' + on, 'OK');
}
function maintenanceOn() { setMaintenance(true, '점검 중이에요. 잠시 후 다시 접속해 주세요.'); }
function maintenanceOff() { setMaintenance(false); }
function setReadOnly(on) { setConfig_('readOnly', on === false ? 'N' : 'Y'); audit_('editor', 'editor', 'setReadOnly ' + on, 'OK'); }

/** 백업: 새 스프레드시트를 만들고 모든 탭을 복사. 이름 = 몬스터키우기_백업_<env>_<시각> */
function backupSnapshot() {
  var src = SpreadsheetApp.getActiveSpreadsheet();
  var name = '몬스터키우기_백업_' + env_() + '_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmm');
  var dst = SpreadsheetApp.create(name);
  src.getSheets().forEach(function (sh) { sh.copyTo(dst).setName(sh.getName()); });
  var first = dst.getSheets()[0];
  if (first.getName().indexOf('Sheet') === 0 || first.getName().indexOf('시트') === 0) dst.deleteSheet(first);
  audit_('editor', 'system', 'backup ' + dst.getId().slice(0, 6) + '…', 'OK');
  return name;
}

/** 캐시에 모인 시간별 지표를 Metrics 시트에 기록 (1시간 트리거) */
function flushMetrics() {
  var cache = CacheService.getScriptCache(), sh = sheet_('Metrics');
  for (var back = 1; back <= 2; back++) {
    var h = Utilities.formatDate(new Date(Date.now() - back * 3600000), 'Asia/Seoul', 'yyyy-MM-dd HH');
    var m = cache.get('m:' + h);
    if (!m) continue;
    var o = JSON.parse(m);
    sh.appendRow([h, o.n || 0, o.n ? Math.round(o.ms / o.n) : 0, o.max || 0, o.OK || 0, o.DUPLICATE_REQUEST || 0, o.VERSION_CONFLICT || 0, o.RATE_LIMITED || 0, o.SERVER_ERROR || 0, o.LOCK_FAIL || 0, o.INVALID_REQUEST || 0, o.AUTH_REQUIRED || 0]);
    cache.remove('m:' + h);
  }
}
function lastMetrics_(n) {
  var sh = sheet_('Metrics'), last = sh.getLastRow();
  if (last < 2) return [];
  var from = Math.max(2, last - n + 1);
  return sh.getRange(from, 1, last - from + 1, 12).getValues();
}

/** 상태는 저장됐는데 CommandJournal 이 빠진 요청을 보충 (상태의 recent 기준) */
function reconcile() {
  var j = sheet_('CommandJournal');
  var have = {};
  if (j.getLastRow() > 1) j.getRange(2, 1, j.getLastRow() - 1, 1).getValues().forEach(function (r) { have[r[0]] = 1; });
  var st = sheet_('PlayerState');
  if (st.getLastRow() < 2) return 0;
  var add = [];
  st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (!r[0]) return;
    try { GameCore.deserialize(String(r[1])).recent.forEach(function (x) { if (!have[x.id]) add.push([x.id, r[0], x.a, 'RECOVERED', 'rev' + x.r, new Date()]); }); } catch (e) {}
  });
  if (add.length) j.getRange(j.getLastRow() + 1, 1, add.length, 6).setValues(add);
  return add.length;
}

/** 스키마 변경 뒤: 모든 상태를 지금 스키마로 다시 저장. 먼저 backupSnapshot() 권장 */
function runMigrations() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var st = sheet_('PlayerState'), mig = sheet_('Migrations');
    var name = 'state-to-v' + GameCore.SCHEMA_VERSION;
    mig.appendRow([GameCore.SCHEMA_VERSION, name, 'RUNNING', new Date()]);
    var n = 0, bad = 0;
    if (st.getLastRow() > 1) {
      var rng = st.getRange(2, 1, st.getLastRow() - 1, 5), rows = rng.getValues();
      rows.forEach(function (r) {
        if (!r[0]) return;
        try { var s = GameCore.deserialize(String(r[1])); var t = GameCore.serialize(s); r[1] = t; r[2] = sha_(t).slice(0, 16); n++; } catch (e) { bad++; }
      });
      rng.setValues(rows);
    }
    mig.appendRow([GameCore.SCHEMA_VERSION, name, 'DONE ' + n + ' / 실패 ' + bad, new Date()]);
    return { migrated: n, failed: bad };
  } finally { lock.releaseLock(); }
}

/** 시간 트리거 설치: 지표 1시간 · 운영 사본 1시간 · 백업 매일 새벽 4시 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['flushMetrics', 'refreshMirrors', 'backupSnapshot'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('flushMetrics').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('refreshMirrors').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('backupSnapshot').timeBased().atHour(4).everyDays(1).inTimezone('Asia/Seoul').create();
}
