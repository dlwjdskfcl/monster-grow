/**
 * 처음 한 번: 새 구글 시트(몬스터키우기_<환경>) → 확장 프로그램 → Apps Script → 파일 붙여넣기 → setup() 실행
 *   setupDev() / setupStaging() / setupProd() 중 환경에 맞는 것을 실행 (ENV 속성만 다름)
 * 하는 일: 탭·제목 만들기(이미 있으면 그대로), 비밀 값 생성(SESSION_SECRET·RECOVERY_PEPPER·SEED_SECRET — 이미 있으면 유지)
 * 운영 API 키는 setAdminKey('원하는 긴 문자열') 로 따로 (해시만 저장)
 * ⚠ 기존 jammanbo 시트·스크립트에서 실행하지 마세요. 반드시 이 게임 전용 새 시트에서.
 */

var SHEETS = {
  Players: ['playerId', 'createdAt', 'updatedAt', 'schemaVersion', 'lastSeenAt', 'recoveryHash', 'status'],
  PlayerState: ['playerId', 'stateJson', 'stateHash', 'revision', 'updatedAt'],
  Inventory: ['playerId', 'itemId', 'amount', 'revision', 'updatedAt'],
  Collection: ['playerId', 'creatureId', 'level', 'resonance', 'traitsJson', 'updatedAt'],
  CommandJournal: ['requestId', 'playerId', 'action', 'status', 'resultHash', 'createdAt'],
  GameConfig: ['configVersion', 'key', 'value', 'enabled', 'updatedAt'],
  Announcements: ['id', 'title', 'body', 'startAt', 'endAt', 'enabled'],
  AdminAudit: ['requestId', 'adminId', 'action', 'result', 'createdAt'],
  Migrations: ['schemaVersion', 'migrationName', 'status', 'executedAt'],
  Metrics: ['hour', 'requests', 'avgMs', 'maxMs', 'ok', 'duplicate', 'conflict', 'rateLimited', 'serverError', 'lockFail', 'invalid', 'authRequired']
};

function setupDev() { setup('dev'); }
function setupStaging() { setup('staging'); }
function setupProd() { setup('prod'); }

function setup(envName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (/jammanbo|잠만보/i.test(ss.getName())) throw new Error('잠만보 시트에서는 실행할 수 없어요. 몬스터 키우기 전용 새 시트를 만드세요.');
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // 큰 수·JSON·ID 가 숫자/날짜로 바뀌지 않게 텍스트 서식
  ss.getSheetByName('PlayerState').getRange('A:C').setNumberFormat('@');
  ss.getSheetByName('Players').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('Players').getRange('F:F').setNumberFormat('@');
  ss.getSheetByName('CommandJournal').getRange('A:B').setNumberFormat('@');
  ss.getSheetByName('Inventory').getRange('A:C').setNumberFormat('@');
  ss.getSheetByName('GameConfig').getRange('C:C').setNumberFormat('@');
  var first = ss.getSheets()[0];
  if (/^(Sheet1|시트1)$/.test(first.getName()) && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);

  var p = PropertiesService.getScriptProperties();
  ['SESSION_SECRET', 'RECOVERY_PEPPER', 'SEED_SECRET'].forEach(function (k) {
    if (!p.getProperty(k)) p.setProperty(k, Utilities.getUuid() + Utilities.getUuid());
  });
  if (envName) p.setProperty('ENV', envName);
  // 기본 설정 한 줄씩 (켜짐 Y). 이미 있으면 건드리지 않음
  var cfg = ss.getSheetByName('GameConfig');
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, 4, 5).setValues([
      [1, 'offlineCapHours', '8', 'Y', new Date()],
      [1, 'prodMult', '1', 'Y', new Date()],
      [1, 'maintenance', 'N', 'Y', new Date()],
      [1, 'minClientVersion', '0.1.0', 'Y', new Date()]
    ]);
  }
  CacheService.getScriptCache().removeAll(['cfg', 'ann']);
  return 'OK ' + (envName || p.getProperty('ENV') || 'dev');
}

/** 운영 API 키 설정 — 실행 후 편집기의 이 줄에서 키 문자열은 지워 두세요 */
function setAdminKey(key) {
  if (!key || String(key).length < 24) throw new Error('24자 이상으로 정하세요');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY_HASH', sha_(String(key)));
  return 'OK';
}
