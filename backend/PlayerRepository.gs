/**
 * 저장소 — Players / PlayerState 시트 (같은 playerId 는 두 시트에서 같은 행 번호)
 *  - 행 찾기: 캐시(행 번호) → 그 행의 playerId 가 맞는지 확인 → 틀리면 TextFinder 로 A열에서 정확히 일치 검색 (전체 스캔 아님)
 *  - 상태는 PlayerState 한 행(stateJson·stateHash·revision·updatedAt)을 setValues 한 번으로 씀 → 이 쓰기가 '확정 지점'
 *  - stateJson 셀은 텍스트 서식('@')이라 시트가 큰 수를 숫자로 바꾸지 않음. 큰 수는 JSON 안에서 문자열("1.5e30")
 *  - Inventory / Collection 시트는 운영 조회용 사본 (정본 아님). refreshMirrors() 가 한꺼번에 다시 만듦
 */

var STATE_LIMIT = 45000;   // 셀 최대 50,000자 — 여유를 둠

function findRow_(pid) {
  var cache = CacheService.getScriptCache();
  var sh = sheet_('PlayerState');
  var c = Number(cache.get('row:' + pid) || 0);
  if (c > 1 && c <= sh.getLastRow() && String(sh.getRange(c, 1).getValue()) === pid) return c;
  if (sh.getLastRow() < 2) return 0;
  var hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(pid).matchEntireCell(true).findNext();
  if (!hit) return 0;
  var row = hit.getRow();
  cache.put('row:' + pid, String(row), 21600);
  return row;
}

function readState_(pid, row) {
  var v = sheet_('PlayerState').getRange(row, 1, 1, 5).getValues()[0];
  if (String(v[0]) !== pid) throw new Error('ROW_MISMATCH');
  var text = String(v[1]);
  if (sha_(text).slice(0, 16) !== String(v[2])) console.warn('stateHash 불일치 (시트를 손으로 고쳤거나 손상)', pid);
  var st = GameCore.deserialize(text);
  if (st.revision !== Number(v[3])) console.warn('revision 열과 상태가 다름', pid);
  return st;
}

function writeState_(pid, row, state, now) {
  var text = GameCore.serialize(state);
  if (text.length > STATE_LIMIT) throw new Error('STATE_TOO_LARGE');
  sheet_('PlayerState').getRange(row, 1, 1, 5).setValues([[pid, text, sha_(text).slice(0, 16), state.revision, new Date(now)]]);
  sheet_('Players').getRange(row, 3, 1, 3).setValues([[new Date(now), GameCore.SCHEMA_VERSION, new Date(now)]]);
}

function createPlayer_(pid, recoveryHash, state, now) {
  var ps = sheet_('Players'), st = sheet_('PlayerState');
  var row = Math.max(ps.getLastRow(), st.getLastRow()) + 1;
  ps.getRange(row, 1, 1, 7).setValues([[pid, new Date(now), new Date(now), GameCore.SCHEMA_VERSION, new Date(now), recoveryHash, 'active']]);
  var text = GameCore.serialize(state);
  st.getRange(row, 1, 1, 5).setValues([[pid, text, sha_(text).slice(0, 16), state.revision, new Date(now)]]);
  CacheService.getScriptCache().put('row:' + pid, String(row), 21600);
  return row;
}

function journal_(requestId, pid, action, status, resultHash) {
  try { sheet_('CommandJournal').appendRow([requestId, pid, action, status, resultHash, new Date()]); }
  catch (e) { console.warn('journal 실패 (상태는 이미 저장됨 — reconcile() 로 보충)', e); }
}

/** 운영 조회용 Inventory / Collection 다시 만들기 (시간 트리거 권장: 1시간마다) */
function refreshMirrors() {
  var st = sheet_('PlayerState');
  if (st.getLastRow() < 2) return;
  var rows = st.getRange(2, 1, st.getLastRow() - 1, 5).getValues();
  var inv = [], col = [], now = new Date();
  rows.forEach(function (r) {
    if (!r[0]) return;
    var s;
    try { s = GameCore.deserialize(String(r[1])); } catch (e) { return; }
    ['shards', 'energy', 'materials', 'seeds'].forEach(function (k) { inv.push([r[0], k, GameCore.BN.str(s.cur[k]), s.revision, now]); });
    Object.keys(s.creatures).forEach(function (id) {
      var c = s.creatures[id];
      col.push([r[0], id, c.level, c.resonance, JSON.stringify({ skill: c.skill, trait: c.trait, alias: c.alias }), now]);
    });
  });
  replaceBody_(sheet_('Inventory'), inv, 5);
  replaceBody_(sheet_('Collection'), col, 6);
}

function replaceBody_(sh, rows, width) {
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
  if (rows.length) { sh.getRange(2, 1, rows.length, width).setNumberFormat('@').setValues(rows); }
}
