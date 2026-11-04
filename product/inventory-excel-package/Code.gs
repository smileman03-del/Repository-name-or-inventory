/**
 * 병원 소모품 재고관리 - Apps Script (구글 시트 메뉴 + 웹앱 API)
 *
 * 시트 탭 4개 (setupSheets 가 자동으로 만들어 줍니다):
 *   품목 마스터 / 주간 재고 파악 / 실시간 재고 대장 / 물품 청구서
 *
 * 설치: 새 구글 시트 > 확장 프로그램 > Apps Script > 이 코드 붙여넣기 > 저장
 *       > setupSheets (빈 상태로 시작) 또는 loadSampleData (예제로 체험) 실행 > 권한 승인
 *       > 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자)
 *       > 주소창에 URL?action=getMaster 를 열어 연결 테스트
 */

var TAB_MASTER = '품목 마스터';
var TAB_WEEKLY = '주간 재고 파악';
var TAB_REALTIME = '실시간 재고 대장';
var TAB_REQUEST = '물품 청구서';

var HEAD_MASTER = ['품목명', '보관위치', '규격/단위', '적정재고', '현재재고'];   // F열(상태)은 F1 의 자동 수식이 채운다
var HEAD_WEEKLY = ['실사일', '품목명', '보관위치', '적정재고', '실사수량', '상태'];
var HEAD_REALTIME = ['품목명', '보관위치', '규격/단위', '적정재고', '현재재고', '부족수량'];
var HEAD_REQUEST = ['청구번호', '청구일', '품목명', '보관위치', '규격/단위', '청구수량'];

// 품목 마스터 F열: 머리글 칸(F1) 하나로 모든 행의 상태를 자동 계산한다.
// (2행에 두면 첫 품목을 삭제할 때 수식이 같이 사라지므로 머리글 칸에 둔다)
var MASTER_STATUS_FORMULA = '=ARRAYFORMULA({"상태"; IF(E2:E="","",IF(E2:E<D2:D,"❌ 재고부족","✅ 안정"))})';

// 가상의 예제 데이터 (실제 병원 데이터 아님)
var SAMPLE_ITEMS = [
  ['멸균 수술장갑 7.0', '수술실', 'Box(50쌍)', 10, 4],
  ['멸균 수술장갑 7.5', '수술실', 'Box(50쌍)', 10, 9],
  ['일회용 수술가운', '수술실', 'EA', 40, 26],
  ['봉합사 Vicryl 2-0', '수술실', 'Box(36개)', 6, 2],
  ['생리식염수 1L', '수술실', 'EA', 40, 52],
  ['일회용 주사기 5cc', '처치실', 'Box(100개)', 8, 3],
  ['주사바늘 23G', '처치실', 'Box(100개)', 6, 6],
  ['알코올 솜', '처치실', 'Pack(100매)', 20, 20],
  ['포비돈 용액 500ml', '처치실', '병', 10, 4],
  ['탄력붕대 4인치', '병동', 'Roll', 30, 11],
  ['부직포 반창고', '병동', 'Box', 8, 10],
  ['무릎 보조기 M', '병동', 'EA', 5, 5],
  ['일회용 베드시트', '물리치료실', 'Roll', 12, 7],
  ['초음파 젤', '물리치료실', '병(250ml)', 6, 2],
  ['전극 패드', '물리치료실', 'Pack', 10, 12]
];

// =====================================================================
// 구글 시트 메뉴 (PC에서 시트를 열면 상단에 표시)
// =====================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏥 재고관리')
    .addItem('📊 현황 대시보드', 'showDashboard')
    .addItem('📅 주간실사 자동입력', 'weeklyInputFromMenu')
    .addItem('📋 물품 청구서 생성', 'createRequestFromMenu')
    .addSeparator()
    .addItem('➕ 품목 추가', 'addItemFromMenu')
    .addItem('🗑 품목 삭제', 'deleteItemFromMenu')
    .addItem('🔄 실시간 재고 대장 새로고침', 'refreshRealtime')
    .addSeparator()
    .addItem('🧹 예제 데이터 지우기', 'clearSampleDataFromMenu')
    .addToUi();
}

function showDashboard() {
  var idx = masterIndex_();
  var items = masterItems_(idx);
  var lack = items.filter(function (i) { return i.stock < i.par; }).length;
  var dups = Object.keys(idx.dups);
  SpreadsheetApp.getUi().alert(
    '재고 현황\n\n전체 품목: ' + items.length + '개\n재고부족: ' + lack + '개\n정상: ' + (items.length - lack) + '개' +
    (dups.length ? '\n\n⚠️ 품목명이 중복된 항목이 있습니다: ' + dups.join(', ') + '\n품목 마스터에서 이름을 서로 다르게 고쳐 주세요.' : ''));
}

function weeklyInputFromMenu() {
  var n = weeklyInput_(today_());
  SpreadsheetApp.getUi().alert('주간 재고 파악에 ' + n + '개 품목을 입력했습니다.\n실사수량을 확인·수정하세요.');
}

function createRequestFromMenu() {
  var res = createRequestFromShortage_();
  var ui = SpreadsheetApp.getUi();
  if (!res) ui.alert('재고부족 품목이 없습니다.');
  else ui.alert('청구서 ' + res.id + ' 를 만들었습니다. (' + res.count + '개 품목)');
}

function addItemFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('품목 추가', '형식: 품목명, 보관위치, 규격, 적정재고, 현재재고\n예) 멸균장갑, 수술실, Box, 10, 4', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var p = r.getResponseText().split(',').map(function (s) { return s.trim(); });
  try {
    addItem_({ name: p[0], loc: p[1], spec: p[2], par: p[3], stock: p[4] });
    ui.alert('추가했습니다: ' + p[0]);
  } catch (e) { ui.alert('실패: ' + e.message); }
}

function deleteItemFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('품목 삭제', '삭제할 품목명을 정확히 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  try {
    deleteItem_(r.getResponseText().trim());
    ui.alert('삭제했습니다.');
  } catch (e) { ui.alert('실패: ' + e.message); }
}

function clearSampleDataFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('예제 데이터 지우기',
    '예제 품목과, 체험하며 만든 주간 재고 파악·물품 청구서 기록을 모두 지웁니다.\n(예제가 아닌 품목이 있으면 아무것도 지우지 않습니다.)\n\n계속할까요?',
    ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  try {
    var r = clearSampleData_();
    ui.alert('지웠습니다. (예제 품목 ' + r.items + '개)\n이제 우리 병원 품목을 입력하세요.');
  } catch (e) { ui.alert('지우지 않았습니다: ' + e.message); }
}

// =====================================================================
// 웹앱 API (스마트폰 앱이 호출)
// =====================================================================
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    var data;
    if (action === 'getMaster') data = getMaster_();
    else if (action === 'getWeekly') data = getWeekly_();
    else if (action === 'getRealtime') data = getRealtime_();
    else if (action === 'getRequests') data = getRequests_();
    else return json_({ success: false, error: '알 수 없는 action: ' + action });
    return json_({ success: true, data: data });
  } catch (err) {
    return json_({ success: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse(e.postData.contents);
    var data;
    if (p.action === 'addItem') data = addItem_(p);
    else if (p.action === 'deleteItem') data = deleteItem_(p.name);
    else if (p.action === 'saveWeekly') data = saveWeekly_(p);
    else if (p.action === 'submitRequest') data = submitRequest_(p);
    else return json_({ success: false, error: '알 수 없는 action: ' + p.action });
    return json_({ success: true, data: data });
  } catch (err) {
    return json_({ success: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---------- 조회 ----------
function getMaster_() { return masterItems_(masterIndex_()); }

function getWeekly_() {
  var sh = tab_(TAB_WEEKLY);
  var last = lastRowByCol_(sh, 2);
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (r) { return String(r[1]).trim() !== ''; })
    .map(function (r) {
      return { date: dateStr_(r[0]), name: String(r[1]), loc: String(r[2]), par: num_(r[3]), qty: num_(r[4]) };
    });
}

function getRealtime_() {
  refreshRealtime();
  var sh = tab_(TAB_REALTIME);
  var last = lastRowByCol_(sh, 1);
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return { name: String(r[0]), loc: String(r[1]), spec: String(r[2]), par: num_(r[3]), stock: num_(r[4]), lack: num_(r[5]) };
    });
}

function getRequests_() {
  var sh = tab_(TAB_REQUEST);
  var last = lastRowByCol_(sh, 1);
  if (last < 2) return [];
  var byId = {}, order = [];
  sh.getRange(2, 1, last - 1, 6).getValues().forEach(function (r) {
    var id = String(r[0]);
    if (!id) return;
    if (!byId[id]) { byId[id] = { id: id, date: dateStr_(r[1]), items: [] }; order.push(id); }
    byId[id].items.push({ name: String(r[2]), loc: String(r[3]), spec: String(r[4]), qty: num_(r[5]) });
  });
  return order.map(function (id) { return byId[id]; });
}

// ---------- 변경 ----------
function addItem_(p) {
  var name = String(p.name || '').trim();
  if (!name) throw new Error('품목명이 비어 있습니다.');
  var idx = masterIndex_();
  if (idx.rows[name]) throw new Error('이미 있는 품목입니다: ' + name);
  var row = Math.max(idx.last, 1) + 1;
  idx.sh.getRange(row, 1, 1, 5).setValues([[name, String(p.loc || '').trim(), String(p.spec || '').trim(), num_(p.par), num_(p.stock)]]);
  refreshRealtime();
  return { name: name };
}

function deleteItem_(name) {
  name = String(name || '').trim();
  var idx = masterIndex_();
  if (idx.dups[name]) throw new Error('같은 이름의 품목이 여러 개라 삭제하지 않았습니다: ' + name + ' (품목 마스터에서 이름을 서로 다르게 고쳐 주세요)');
  var row = idx.rows[name];
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + name);
  idx.sh.deleteRow(row);
  refreshRealtime();
  return { name: name };
}

// 주간실사 저장: 실사 기록을 쌓고 품목 마스터의 현재재고를 갱신한다 (한 번에 일괄 처리)
function saveWeekly_(p) {
  var rows = p.rows || [];
  if (!rows.length) throw new Error('저장할 실사 내용이 없습니다.');
  var date = p.date ? String(p.date).slice(0, 10) : today_();
  var idx = masterIndex_();

  // 같은 이름이 둘 이상이면 어느 행에 저장할지 알 수 없으므로, 틀린 값을 쓰는 대신 멈추고 알려준다
  var dupHit = [];
  rows.forEach(function (r) {
    var n = String(r.name).trim();
    if (idx.dups[n] && dupHit.indexOf(n) < 0) dupHit.push(n);
  });
  if (dupHit.length) throw new Error('품목명이 중복되어 저장하지 않았습니다: ' + dupHit.join(', ') + ' (품목 마스터에서 이름을 서로 다르게 고쳐 주세요)');

  var changes = [];   // {row, qty}
  var logs = [];
  rows.forEach(function (r) {
    var row = idx.rows[String(r.name).trim()];
    if (!row) return;
    var qty = num_(r.qty);
    var v = idx.data[row - 2];
    changes.push({ row: row, qty: qty });
    logs.push([date, v[0], v[1], num_(v[3]), qty]);
  });
  if (!changes.length) return { saved: 0, date: date };

  writeStock_(idx, changes);
  appendWeekly_(logs);
  refreshRealtime();
  return { saved: changes.length, date: date };
}

function submitRequest_(p) {
  var items = p.items || [];
  if (!items.length) throw new Error('청구할 품목이 없습니다.');
  return writeRequest_(items.map(function (i) {
    return { name: i.name, loc: i.loc, spec: i.spec, qty: Math.max(1, num_(i.qty)) };
  }));
}

// ---------- 시트 도우미 ----------
// 현재재고(E열) 갱신: 값만 들어 있으면 한 번에 쓰고, 수식이 섞여 있으면 수식을 지키기 위해 한 칸씩 쓴다
function writeStock_(idx, changes) {
  var sh = idx.sh, last = idx.last;
  var block = sh.getRange(2, 5, last - 1, 1);
  var hasFormula = block.getFormulas().some(function (r) { return String(r[0]).charAt(0) === '='; });
  if (hasFormula) {
    changes.forEach(function (c) { sh.getRange(c.row, 5).setValue(c.qty); });
    return;
  }
  var vals = block.getValues();
  changes.forEach(function (c) { vals[c.row - 2][0] = c.qty; });
  block.setValues(vals);
}

function statusFormula_(r) {
  return '=IF(E' + r + '="","",IF(E' + r + '<D' + r + ',"❌ 재고부족","✅ 안정"))';
}

function appendWeekly_(list) {
  if (!list.length) return;
  var sh = tab_(TAB_WEEKLY);
  var start = Math.max(lastRowByCol_(sh, 2), 1) + 1;
  sh.getRange(start, 1, list.length, 5).setValues(list);
  sh.getRange(start, 6, list.length, 1).setFormulas(list.map(function (x, i) { return [statusFormula_(start + i)]; }));
}

// 주간 재고 파악: 모든 품목의 현재재고를 실사수량 초안으로 입력 (PC에서 확인·수정)
function weeklyInput_(date) {
  var items = getMaster_();
  appendWeekly_(items.map(function (i) { return [date, i.name, i.loc, i.par, i.stock]; }));
  return items.length;
}

function createRequestFromShortage_() {
  var lacking = getMaster_().filter(function (i) { return i.stock < i.par; });
  if (!lacking.length) return null;
  return writeRequest_(lacking.map(function (i) {
    return { name: i.name, loc: i.loc, spec: i.spec, qty: i.par - i.stock };
  }));
}

function writeRequest_(list) {
  var sh = tab_(TAB_REQUEST);
  var date = today_();
  // 같은 초에 두 번 만들어도 번호가 겹치지 않도록 무작위 3글자를 붙인다
  var id = 'R' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 3);
  var start = Math.max(lastRowByCol_(sh, 1), 1) + 1;
  sh.getRange(start, 1, list.length, 6).setValues(list.map(function (i) {
    return [id, date, i.name, i.loc, i.spec, i.qty];
  }));
  return { id: id, date: date, count: list.length };
}

// 실시간 재고 대장: 재고부족 품목만 새로 채운다
function refreshRealtime() {
  var sh = tab_(TAB_REALTIME);
  var last = lastRowByCol_(sh, 1);
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  var lacking = getMaster_().filter(function (i) { return i.stock < i.par; });
  if (lacking.length) {
    sh.getRange(2, 1, lacking.length, 6).setValues(lacking.map(function (i) {
      return [i.name, i.loc, i.spec, i.par, i.stock, i.par - i.stock];
    }));
  }
}

// ---------- 최초 설정 / 예제 ----------
// 탭 4개와 머리글, 상태 자동 수식을 만든다. 이미 있으면 건드리지 않는다. 비어 있는 기본 시트는 정리한다.
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = [[TAB_MASTER, HEAD_MASTER], [TAB_WEEKLY, HEAD_WEEKLY], [TAB_REALTIME, HEAD_REALTIME], [TAB_REQUEST, HEAD_REQUEST]];
  var ours = defs.map(function (d) { return d[0]; });
  defs.forEach(function (p) {
    var sh = ss.getSheetByName(p[0]) || ss.insertSheet(p[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]).setFontWeight('bold');
      if (p[0] === TAB_MASTER) sh.getRange(1, 6).setFormula(MASTER_STATUS_FORMULA).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  // 새 구글 시트에 기본으로 있는 빈 시트("시트1" 등)만 지운다. 내용이 조금이라도 있으면 그대로 둔다.
  ss.getSheets().forEach(function (s) {
    if (ours.indexOf(s.getName()) < 0 && ss.getSheets().length > 1 && s.getLastRow() === 0 && s.getLastColumn() === 0) {
      ss.deleteSheet(s);
    }
  });
}

// 예제 15개를 넣어 앱을 체험해 볼 때 사용
function loadSampleData() {
  setupSheets();
  var sh = tab_(TAB_MASTER);
  if (lastRowByCol_(sh, 1) > 1) throw new Error('이미 품목이 있습니다. 비운 뒤 실행하세요.');
  sh.getRange(2, 1, SAMPLE_ITEMS.length, 5).setValues(SAMPLE_ITEMS);
  refreshRealtime();
}

// 예제 데이터만 들어 있을 때 한 번에 지운다. 예제가 아닌 품목이 하나라도 있으면 아무것도 지우지 않는다.
function clearSampleData_() {
  var idx = masterIndex_();
  var sampleNames = {};
  SAMPLE_ITEMS.forEach(function (r) { sampleNames[r[0]] = true; });
  var others = Object.keys(idx.rows).filter(function (n) { return !sampleNames[n]; });
  if (others.length) {
    throw new Error('예제가 아닌 품목이 있습니다 (' + others.slice(0, 3).join(', ') + (others.length > 3 ? ' 외 ' + (others.length - 3) + '개' : '') + '). 직접 지워 주세요.');
  }
  var n = Object.keys(idx.rows).length;
  [[TAB_MASTER, 5], [TAB_WEEKLY, 6], [TAB_REALTIME, 6], [TAB_REQUEST, 6]].forEach(function (t) {
    var sh = tab_(t[0]);
    var last = lastRowByCol_(sh, t[0] === TAB_WEEKLY ? 2 : 1);
    if (last > 1) sh.getRange(2, 1, last - 1, t[1]).clearContent();
  });
  return { items: n };
}

// ---------- 유틸 ----------
function tab_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('"' + name + '" 탭이 없습니다. setupSheets 를 먼저 실행하거나 탭 이름(띄어쓰기 포함)을 확인하세요.');
  return sh;
}

// 지정한 열에서 값이 있는 마지막 행. 자동 수식이 아래 빈 칸까지 채워져 있어도 정확하다.
function lastRowByCol_(sh, col) {
  var vals = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]).trim() !== '') return i + 1;
  }
  return 0;
}

// 품목 마스터를 한 번만 읽어 이름→행 번호 표와 중복 이름 표를 만든다
function masterIndex_() {
  var sh = tab_(TAB_MASTER);
  var res = { sh: sh, last: lastRowByCol_(sh, 1), data: [], rows: {}, dups: {} };
  if (res.last < 2) return res;
  res.data = sh.getRange(2, 1, res.last - 1, 5).getValues();
  res.data.forEach(function (r, i) {
    var n = String(r[0]).trim();
    if (!n) return;
    if (res.rows[n]) res.dups[n] = true; else res.rows[n] = i + 2;
  });
  return res;
}

function masterItems_(idx) {
  return idx.data
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return { name: String(r[0]), loc: String(r[1]), spec: String(r[2]), par: num_(r[3]), stock: num_(r[4]) };
    });
}

function num_(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, n); }
// 날짜는 스프레드시트의 시간대를 따른다 (파일 > 설정 > 시간대)
function tz_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return (ss.getSpreadsheetTimeZone && ss.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || 'Asia/Seoul';
}
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function dateStr_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v).slice(0, 10); }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
