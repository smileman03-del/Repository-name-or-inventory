/**
 * 병원 재고관리 - Google Apps Script 백엔드
 *
 * 설치: 구글시트 > 확장 프로그램 > Apps Script > 이 코드 붙여넣기
 *       > setupSheets() 1회 실행 (권한 허용) > (선택) loadSampleData() 실행
 *       > 배포 > 새 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자)
 *       > 발급된 URL을 index.html 의 SCRIPT_URL 에 붙여넣기
 */

var SHEET_ITEMS = '품목';
var SHEET_AUDITS = '실사기록';
var SHEET_REQUESTS = '청구기록';

var ITEM_HEADERS = ['id', 'dept', 'cat', 'name', 'spec', 'par', 'stock', 'memo'];
var AUDIT_HEADERS = ['dept', 'date', 'changed'];
var REQUEST_HEADERS = ['id', 'date', 'dept', 'itemsJson'];

// ---------- 최초 설정 ----------
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[SHEET_ITEMS, ITEM_HEADERS], [SHEET_AUDITS, AUDIT_HEADERS], [SHEET_REQUESTS, REQUEST_HEADERS]]
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
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ITEMS);
  if (sh.getLastRow() > 1) throw new Error('이미 데이터가 있습니다. 시트를 비운 뒤 실행하세요.');
  var rows = [
    ['수술실', '소모품', '멸균장갑 7.0', 'Box(50쌍)', 10, 4, ''],
    ['수술실', '소모품', '수술용 드레이프', 'EA', 30, 12, ''],
    ['수술실', '의약품', '생리식염수 1L', 'EA', 40, 25, ''],
    ['처치실', '소모품', '일회용 주사기 5cc', 'Box(100개)', 8, 2, ''],
    ['처치실', '소모품', '알코올 솜', 'Pack', 20, 15, ''],
    ['병동', '소모품', '거즈 4x4', 'Pack', 25, 6, ''],
    ['병동', '보조기', '무릎 보조기 M', 'EA', 5, 3, ''],
    ['물리치료실', '소모품', '일회용 베드시트', 'Roll', 12, 5, ''],
    ['물리치료실', '문구', '차트 용지', 'Pack', 10, 7, '']
  ];
  rows.forEach(function (r) { sh.appendRow([newId_()].concat(r)); });
}

// ---------- 웹앱 진입점 ----------
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'getAll') return json_({ success: true, data: getAll_() });
    return json_({ success: false, error: '알 수 없는 action: ' + action });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse(e.postData.contents);
    var data;
    switch (p.action) {
      case 'itemAdd': data = itemAdd_(p); break;
      case 'itemUpdate': data = itemUpdate_(p); break;
      case 'itemDelete': data = itemDelete_(p); break;
      case 'auditSubmit': data = auditSubmit_(p); break;
      case 'requestCreate': data = requestCreate_(p); break;
      default: return json_({ success: false, error: '알 수 없는 action: ' + p.action });
    }
    return json_({ success: true, data: data });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---------- 조회 ----------
function getAll_() {
  var items = readRows_(SHEET_ITEMS, ITEM_HEADERS);

  // 부서별 가장 최근 실사일
  var audits = {};
  readRows_(SHEET_AUDITS, AUDIT_HEADERS).forEach(function (a) {
    var d = dateStr_(a.date);
    if (!audits[a.dept] || d > audits[a.dept]) audits[a.dept] = d;
  });

  var requests = readRows_(SHEET_REQUESTS, REQUEST_HEADERS).map(function (r) {
    var list = [];
    try { list = JSON.parse(r.itemsJson || '[]'); } catch (x) {}
    return { id: r.id, date: dateStr_(r.date), dept: r.dept, items: list };
  });

  return { items: items, audits: audits, requests: requests };
}

// ---------- 품목 ----------
function itemAdd_(p) {
  requireText_(p.dept, '부서');
  requireText_(p.name, '품목명');
  var id = newId_();
  sheet_(SHEET_ITEMS).appendRow([
    id, p.dept, p.cat || '', p.name, p.spec || '',
    num_(p.par), num_(p.stock), p.memo || ''
  ]);
  return { id: id };
}

function itemUpdate_(p) {
  var sh = sheet_(SHEET_ITEMS);
  var row = findRow_(sh, p.id);
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + p.id);
  ['dept', 'cat', 'name', 'spec', 'par', 'stock', 'memo'].forEach(function (k) {
    if (p[k] === undefined) return;
    var col = ITEM_HEADERS.indexOf(k) + 1;
    var v = (k === 'par' || k === 'stock') ? num_(p[k]) : p[k];
    sh.getRange(row, col).setValue(v);
  });
  return { id: p.id };
}

function itemDelete_(p) {
  var sh = sheet_(SHEET_ITEMS);
  var row = findRow_(sh, p.id);
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + p.id);
  sh.deleteRow(row);
  return { id: p.id };
}

// ---------- 실사 ----------
function auditSubmit_(p) {
  requireText_(p.dept, '부서');
  var sh = sheet_(SHEET_ITEMS);
  var changed = 0;
  (p.updates || []).forEach(function (u) {
    var row = findRow_(sh, u.id);
    if (!row) return;
    sh.getRange(row, ITEM_HEADERS.indexOf('stock') + 1).setValue(num_(u.stock));
    changed++;
  });
  var date = today_();
  sheet_(SHEET_AUDITS).appendRow([p.dept, date, changed]);
  return { date: date, changed: changed };
}

// ---------- 청구 ----------
function requestCreate_(p) {
  requireText_(p.dept, '부서');
  if (!p.items || !p.items.length) throw new Error('청구 품목이 없습니다.');
  var id = newId_();
  var date = today_();
  sheet_(SHEET_REQUESTS).appendRow([id, date, p.dept, JSON.stringify(p.items)]);
  return { id: id, date: date };
}

// ---------- 유틸 ----------
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('"' + name + '" 시트가 없습니다. setupSheets()를 먼저 실행하세요.');
  return sh;
}

function readRows_(name, headers) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, headers.length).getValues()
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

function newId_() { return Utilities.getUuid().slice(0, 8); }
function num_(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, n); }
function requireText_(v, label) { if (!v || !String(v).trim()) throw new Error(label + '이(가) 비어 있습니다.'); }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Seoul'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
