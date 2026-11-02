/**
 * 병원 소모품 재고관리 - Apps Script (구글 시트 메뉴 + 웹앱 API)
 *
 * 시트 탭 4개(이름은 띄어쓰기까지 정확히):
 *   품목 마스터 / 주간 재고 파악 / 실시간 재고 대장 / 물품 청구서
 *
 * 설치: 구글 시트 > 확장 프로그램 > Apps Script > 이 코드 붙여넣기 > 저장
 *       > onOpen 실행(권한 승인) > 배포 > 새 배포 > 웹 앱(실행: 나 / 액세스: 모든 사용자)
 *       > URL?action=getMaster 로 연결 테스트
 */

var TAB_MASTER = '품목 마스터';
var TAB_WEEKLY = '주간 재고 파악';
var TAB_REALTIME = '실시간 재고 대장';
var TAB_REQUEST = '물품 청구서';

var HEAD_MASTER = ['품목명', '보관위치', '규격/단위', '적정재고', '현재재고', '상태'];
var HEAD_WEEKLY = ['실사일', '품목명', '보관위치', '적정재고', '실사수량', '상태'];
var HEAD_REALTIME = ['품목명', '보관위치', '규격/단위', '적정재고', '현재재고', '부족수량'];
var HEAD_REQUEST = ['청구번호', '청구일', '품목명', '보관위치', '규격/단위', '청구수량'];

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
    .addToUi();
}

function showDashboard() {
  var items = getMaster_();
  var lack = items.filter(function (i) { return i.stock < i.par; }).length;
  SpreadsheetApp.getUi().alert(
    '재고 현황\n\n전체 품목: ' + items.length + '개\n재고부족: ' + lack + '개\n정상: ' + (items.length - lack) + '개');
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
function getMaster_() {
  var sh = tab_(TAB_MASTER);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return { name: String(r[0]), loc: String(r[1]), spec: String(r[2]), par: num_(r[3]), stock: num_(r[4]) };
    });
}

function getWeekly_() {
  var sh = tab_(TAB_WEEKLY);
  var last = sh.getLastRow();
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
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      return { name: String(r[0]), loc: String(r[1]), spec: String(r[2]), par: num_(r[3]), stock: num_(r[4]), lack: num_(r[5]) };
    });
}

function getRequests_() {
  var sh = tab_(TAB_REQUEST);
  var last = sh.getLastRow();
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
  if (findMasterRow_(name)) throw new Error('이미 있는 품목입니다: ' + name);
  var sh = tab_(TAB_MASTER);
  var row = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(row, 1, 1, 5).setValues([[name, String(p.loc || '').trim(), String(p.spec || '').trim(), num_(p.par), num_(p.stock)]]);
  sh.getRange(row, 6).setFormula('=IF(E' + row + '="","",IF(E' + row + '<D' + row + ',"❌ 재고부족","✅ 안정"))');
  refreshRealtime();
  return { name: name };
}

function deleteItem_(name) {
  var row = findMasterRow_(String(name || '').trim());
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + name);
  tab_(TAB_MASTER).deleteRow(row);
  refreshRealtime();
  return { name: name };
}

// 주간실사 저장: 실사 기록을 쌓고 품목 마스터의 현재재고를 갱신한다
function saveWeekly_(p) {
  var rows = p.rows || [];
  if (!rows.length) throw new Error('저장할 실사 내용이 없습니다.');
  var date = p.date ? String(p.date).slice(0, 10) : today_();
  var master = tab_(TAB_MASTER);
  var weekly = tab_(TAB_WEEKLY);
  var saved = 0;
  rows.forEach(function (r) {
    var row = findMasterRow_(String(r.name).trim());
    if (!row) return;
    var qty = num_(r.qty);
    var v = master.getRange(row, 1, 1, 4).getValues()[0];
    master.getRange(row, 5).setValue(qty);
    var wr = Math.max(weekly.getLastRow(), 1) + 1;
    weekly.getRange(wr, 1, 1, 5).setValues([[date, v[0], v[1], num_(v[3]), qty]]);
    weekly.getRange(wr, 6).setFormula('=IF(E' + wr + '="","",IF(E' + wr + '<D' + wr + ',"❌ 재고부족","✅ 안정"))');
    saved++;
  });
  refreshRealtime();
  return { saved: saved, date: date };
}

function submitRequest_(p) {
  var items = p.items || [];
  if (!items.length) throw new Error('청구할 품목이 없습니다.');
  return writeRequest_(items.map(function (i) {
    return { name: i.name, loc: i.loc, spec: i.spec, qty: Math.max(1, num_(i.qty)) };
  }));
}

// ---------- 시트 도우미 ----------
// 주간 재고 파악: 모든 품목의 현재재고를 실사수량 초안으로 입력 (PC에서 확인·수정)
function weeklyInput_(date) {
  var items = getMaster_();
  var weekly = tab_(TAB_WEEKLY);
  items.forEach(function (i) {
    var wr = Math.max(weekly.getLastRow(), 1) + 1;
    weekly.getRange(wr, 1, 1, 5).setValues([[date, i.name, i.loc, i.par, i.stock]]);
    weekly.getRange(wr, 6).setFormula('=IF(E' + wr + '="","",IF(E' + wr + '<D' + wr + ',"❌ 재고부족","✅ 안정"))');
  });
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
  list.forEach(function (i) {
    sh.appendRow([id, date, i.name, i.loc, i.spec, i.qty]);
  });
  return { id: id, date: date, count: list.length };
}

// 실시간 재고 대장: 재고부족 품목만 새로 채운다
function refreshRealtime() {
  var sh = tab_(TAB_REALTIME);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  var lacking = getMaster_().filter(function (i) { return i.stock < i.par; });
  if (lacking.length) {
    sh.getRange(2, 1, lacking.length, 6).setValues(lacking.map(function (i) {
      return [i.name, i.loc, i.spec, i.par, i.stock, i.par - i.stock];
    }));
  }
}

// ---------- 최초 설정 / 샘플 ----------
// 엑셀을 업로드하지 않고 시작할 때: 탭과 머리글을 만든다
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[TAB_MASTER, HEAD_MASTER], [TAB_WEEKLY, HEAD_WEEKLY], [TAB_REALTIME, HEAD_REALTIME], [TAB_REQUEST, HEAD_REQUEST]]
    .forEach(function (p) {
      var sh = ss.getSheetByName(p[0]) || ss.insertSheet(p[0]);
      if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
    });
}

// 가상의 샘플 데이터 (실제 병원 데이터 아님)
function loadSampleData() {
  setupSheets();
  if (tab_(TAB_MASTER).getLastRow() > 1) throw new Error('이미 데이터가 있습니다. 비운 뒤 실행하세요.');
  [['멸균 수술장갑 7.0', '수술실', 'Box(50쌍)', 10, 4],
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
   ['전극 패드', '물리치료실', 'Pack', 10, 12]]
    .forEach(function (r) { addItem_({ name: r[0], loc: r[1], spec: r[2], par: r[3], stock: r[4] }); });
}

// ---------- 유틸 ----------
function tab_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('"' + name + '" 탭이 없습니다. 탭 이름(띄어쓰기 포함)을 확인하세요.');
  return sh;
}
function findMasterRow_(name) {
  if (!name) return 0;
  var sh = tab_(TAB_MASTER);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var names = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === name) return i + 2;
  }
  return 0;
}
function num_(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, n); }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Seoul'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function dateStr_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v).slice(0, 10); }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
