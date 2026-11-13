/**
 * 병원 소모품 재고관리 (프로) - Apps Script (구글 시트 메뉴 + 웹앱 API)
 *
 * 시트 탭 3개 (setupSheets 가 자동으로 만들어 줍니다):
 *   품목 마스터 / 실사 기록 / 물품 청구서 / 입고 기록
 *
 * 설치: 새 구글 시트 > 확장 프로그램 > Apps Script > 이 코드 붙여넣기 > 저장
 *       > setupSheets (빈 상태로 시작) 또는 loadSampleData (예제로 체험) 실행 > 권한 승인
 *       > 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자)
 *       > 주소창에 URL?action=getAll 을 열어 연결 테스트
 */

var TAB_MASTER = '품목 마스터';
var TAB_AUDIT = '실사 기록';
var TAB_REQUEST = '물품 청구서';
var TAB_RECEIPT = '입고 기록';

// 품목 마스터: A~G 는 사람이 입력, H(품목번호)는 자동, I(상태)는 I1 의 자동 수식
var HEAD_MASTER = ['대분류(부서)', '소분류', '품목명', '규격/단위', '적정재고', '현재재고', '메모', '품목번호(자동)'];
var HEAD_AUDIT = ['실사일', '대분류(부서)', '변경건수', '변경내역'];
var HEAD_REQUEST = ['청구번호', '청구일', '청구 대상', '대분류(부서)', '소분류', '품목번호', '품목명', '규격/단위', '현재재고', '적정재고', '청구수량'];
// 입고 기록: 한 번의 입고(입고번호)에 품목별로 한 줄씩. 청구번호는 청구서를 보고 입고했을 때만 채워진다.
var HEAD_RECEIPT = ['입고번호', '입고일', '청구번호', '대분류(부서)', '소분류', '품목번호', '품목명', '규격/단위', '입고수량', '입고 전 재고', '입고 후 재고', '메모'];

// 상태 열: 머리글 칸(I1) 하나로 모든 행의 상태를 자동 계산한다.
// (2행에 두면 첫 품목을 삭제할 때 수식이 같이 사라지므로 머리글 칸에 둔다)
var MASTER_STATUS_FORMULA = '=ARRAYFORMULA({"상태(자동)"; IF(F2:F="","",IF(F2:F<E2:E,"❌ 재고부족","✅ 안정"))})';

// 가상의 예제 데이터 (실제 병원 데이터 아님): [대분류, 소분류, 품목명, 규격, 적정재고, 현재재고, 메모]
var SAMPLE_ITEMS = [
  ['수술실', '소모품', '멸균 수술장갑 7.0', 'Box(50쌍)', 10, 4, ''],
  ['수술실', '소모품', '멸균 수술장갑 7.5', 'Box(50쌍)', 10, 9, ''],
  ['수술실', '소모품', '일회용 수술가운', 'EA', 40, 26, ''],
  ['수술실', '소모품', '봉합사 Vicryl 2-0', 'Box(36개)', 6, 2, '유효기간 확인'],
  ['수술실', '의약품', '생리식염수 1L', 'EA', 40, 52, ''],
  ['처치실', '소모품', '일회용 주사기 5cc', 'Box(100개)', 8, 3, ''],
  ['처치실', '소모품', '주사바늘 23G', 'Box(100개)', 6, 6, ''],
  ['처치실', '소모품', '알코올 솜', 'Pack(100매)', 20, 20, ''],
  ['처치실', '의약품', '포비돈 용액 500ml', '병', 10, 4, '냉암소 보관'],
  ['병동', '소모품', '탄력붕대 4인치', 'Roll', 30, 11, ''],
  ['병동', '보조기', '무릎 보조기 M', 'EA', 5, 5, ''],
  ['병동', '문구', '차트 용지 A4', 'Pack', 10, 12, ''],
  ['물리치료실', '소모품', '일회용 베드시트', 'Roll', 12, 7, ''],
  ['물리치료실', '소모품', '초음파 젤', '병(250ml)', 6, 2, ''],
  ['물리치료실', '소모품', '전극 패드', 'Pack', 10, 12, '']
];

// =====================================================================
// 구글 시트 메뉴 (PC에서 시트를 열면 상단에 표시)
// =====================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏥 재고관리')
    .addItem('📊 현황 대시보드', 'showDashboard')
    .addItem('📋 물품 청구서 생성 (부족 품목 전체)', 'createRequestFromMenu')
    .addItem('📅 실사 완료 기록 (PC에서 직접 수정했을 때)', 'recordAuditFromMenu')
    .addSeparator()
    .addItem('🔢 품목번호 채우기', 'fillIdsFromMenu')
    .addItem('🧹 예제 데이터 지우기', 'clearSampleDataFromMenu')
    .addToUi();
}

function showDashboard() {
  var items = masterItems_(masterIndex_());
  var lack = items.filter(function (i) { return i.stock < i.par; });
  var by = {};
  items.forEach(function (i) {
    by[i.dept] = by[i.dept] || { n: 0, low: 0 };
    by[i.dept].n++;
    if (i.stock < i.par) by[i.dept].low++;
  });
  var lines = Object.keys(by).map(function (d) { return '· ' + d + ': ' + by[d].n + '개 중 부족 ' + by[d].low + '개'; });
  SpreadsheetApp.getUi().alert('재고 현황\n\n전체 품목: ' + items.length + '개\n재고부족: ' + lack.length + '개\n정상: ' + (items.length - lack.length) + '개' +
    (lines.length ? '\n\n' + lines.join('\n') : ''));
}

function createRequestFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var res;
  try {
    var idx = masterIndexFixed_();
    var lacking = masterItems_(idx).filter(function (i) { return i.stock < i.par; });
    res = lacking.length ? writeRequest_('전체', lacking.map(function (i) {
      return { id: i.id, name: i.name, spec: i.spec, dept: i.dept, cat: i.cat, stock: i.stock, par: i.par, qty: Math.max(1, i.par - i.stock) };
    })) : null;
  } finally { lock.releaseLock(); }
  if (!res) ui.alert('재고부족 품목이 없습니다.');
  else ui.alert('청구서 ' + res.id + ' 를 만들었습니다. (' + res.count + '개 품목)');
}

function recordAuditFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var ds = depts_(masterIndex_());
  var r = ui.prompt('실사 완료 기록', '실사를 마친 대분류(부서)를 입력하세요.\n' + (ds.length ? '(' + ds.join(', ') + ')' : ''), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var dept = r.getResponseText().trim();
  if (ds.indexOf(dept) < 0) { ui.alert('없는 대분류입니다: ' + dept); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { appendAudit_(dept, 0, '시트에서 직접 수정 (PC)'); } finally { lock.releaseLock(); }
  ui.alert(dept + ' 실사 완료를 기록했습니다. (' + today_() + ')');
}

function fillIdsFromMenu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var n;
  try { var idx = masterIndex_(); n = idx.missing.length; ensureIds_(idx); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert(n ? n + '개 품목에 번호를 채웠습니다.' : '모든 품목에 번호가 이미 있습니다.');
}

function clearSampleDataFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('예제 데이터 지우기',
    '예제 품목과, 체험하며 만든 실사 기록·물품 청구서·입고 기록을 모두 지웁니다.\n(예제가 아닌 품목이 있으면 아무것도 지우지 않습니다.)\n\n계속할까요?',
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
    if (action === 'getAll') return json_({ success: true, data: getAll_() });
    return json_({ success: false, error: '알 수 없는 action: ' + action });
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
    if (p.action === 'itemAdd') data = itemAdd_(p);
    else if (p.action === 'itemUpdate') data = itemUpdate_(p);
    else if (p.action === 'itemDelete') data = itemDelete_(p);
    else if (p.action === 'auditSubmit') data = auditSubmit_(p);
    else if (p.action === 'requestCreate') data = requestCreate_(p);
    else if (p.action === 'receiveSubmit') data = receiveSubmit_(p);
    else return json_({ success: false, error: '알 수 없는 action: ' + p.action });
    return json_({ success: true, data: data });
  } catch (err) {
    return json_({ success: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---------- 조회 ----------
function getAll_() {
  var idx = masterIndex_();
  if (idx.missing.length) {   // 새로 붙여넣은 줄에 품목번호를 채운다 (쓰기가 필요하므로 잠금)
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try { idx = masterIndexFixed_(); } finally { lock.releaseLock(); }
  }
  var rc = receiptData_();
  return { items: masterItems_(idx), audits: auditDates_(), requests: requestList_(rc.received), receipts: rc.list };
}

function auditDates_() {
  var sh = tab_(TAB_AUDIT);
  var last = lastRowByCol_(sh, 2);
  var out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
    var dept = String(r[1]).trim();
    if (!dept) return;
    var d = dateStr_(r[0]);
    if (!out[dept] || d > out[dept]) out[dept] = d;
  });
  return out;
}

// 입고 기록을 한 번 읽어 (1) 입고 내역 목록, (2) 청구서·품목별 누적 입고수량 표를 만든다
function receiptData_() {
  var sh = tab_(TAB_RECEIPT);
  var last = lastRowByCol_(sh, 1);
  var out = { list: [], received: {} };
  if (last < 2) return out;
  var byId = {};
  sh.getRange(2, 1, last - 1, 12).getValues().forEach(function (r) {
    var id = String(r[0]);
    if (!id) return;
    if (!byId[id]) { byId[id] = { id: id, date: dateStr_(r[1]), requestId: String(r[2]), memo: String(r[11]), items: [] }; out.list.push(byId[id]); }
    byId[id].items.push({ id: Number(r[5]) || 0, dept: String(r[3]), cat: String(r[4]), name: String(r[6]), spec: String(r[7]), qty: num_(r[8]), before: num_(r[9]), after: num_(r[10]) });
    var rid = String(r[2]);
    if (rid) { var k = rid + '|' + (Number(r[5]) || 0); out.received[k] = (out.received[k] || 0) + num_(r[8]); }
  });
  return out;
}

function requestList_(received) {
  received = received || {};
  var sh = tab_(TAB_REQUEST);
  var last = lastRowByCol_(sh, 1);
  if (last < 2) return [];
  var byId = {}, order = [];
  sh.getRange(2, 1, last - 1, 11).getValues().forEach(function (r) {
    var id = String(r[0]);
    if (!id) return;
    if (!byId[id]) { byId[id] = { id: id, date: dateStr_(r[1]), dept: String(r[2]), items: [] }; order.push(id); }
    var itemId = Number(r[5]) || 0;
    byId[id].items.push({ id: itemId, dept: String(r[3]), cat: String(r[4]), name: String(r[6]), spec: String(r[7]), stock: num_(r[8]), par: num_(r[9]), qty: num_(r[10]), received: received[id + '|' + itemId] || 0 });
  });
  // 입고 상태: none(입고 전) / partial(일부 입고) / done(전부 입고)
  return order.map(function (id) {
    var q = byId[id];
    var all = q.items.length > 0 && q.items.every(function (i) { return i.received >= i.qty; });
    var any = q.items.some(function (i) { return i.received > 0; });
    q.status = all ? 'done' : (any ? 'partial' : 'none');
    return q;
  });
}

// ---------- 변경 ----------
function itemAdd_(p) {
  var name = String(p.name || '').trim();
  var dept = String(p.dept || '').trim();
  if (!name) throw new Error('품목명이 비어 있습니다.');
  if (!dept) throw new Error('대분류(부서)가 비어 있습니다.');
  var idx = masterIndexFixed_();
  var id = idx.maxId + 1;
  var row = Math.max(idx.last, 1) + 1;
  idx.sh.getRange(row, 1, 1, 8).setValues([[dept, String(p.cat || '').trim() || '기타', name, String(p.spec || '').trim(), num_(p.par), num_(p.stock), String(p.memo || '').trim(), id]]);
  return { id: id };
}

function itemUpdate_(p) {
  var idx = masterIndexFixed_();
  var row = idx.rowById[Number(p.id)];
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + p.id + ' (앱을 새로고침해 주세요)');
  var cols = { dept: 1, cat: 2, name: 3, spec: 4, par: 5, stock: 6, memo: 7 };
  if (p.name !== undefined && !String(p.name).trim()) throw new Error('품목명이 비어 있습니다.');
  if (p.dept !== undefined && !String(p.dept).trim()) throw new Error('대분류(부서)가 비어 있습니다.');
  Object.keys(cols).forEach(function (k) {
    if (p[k] === undefined) return;
    var v = (k === 'par' || k === 'stock') ? num_(p[k]) : String(p[k]).trim();
    idx.sh.getRange(row, cols[k]).setValue(v);
  });
  return { id: Number(p.id) };
}

function itemDelete_(p) {
  var idx = masterIndexFixed_();
  var row = idx.rowById[Number(p.id)];
  if (!row) throw new Error('품목을 찾을 수 없습니다: ' + p.id + ' (앱을 새로고침해 주세요)');
  idx.sh.deleteRow(row);
  return { id: Number(p.id) };
}

// 실사 저장: 수량을 갱신하고 실사 기록을 남긴다. 변경이 없어도 "실사를 했다"는 기록은 남긴다.
function auditSubmit_(p) {
  var dept = String(p.dept || '').trim();
  if (!dept) throw new Error('대분류(부서)가 비어 있습니다.');
  var updates = Array.isArray(p.updates) ? p.updates : [];
  var idx = masterIndexFixed_();
  var changes = [], skipped = [], notes = [];
  updates.forEach(function (u) {
    var row = idx.rowById[Number(u.id)];
    if (!row) { skipped.push(String(u.name || u.id)); return; }
    var qty = num_(u.stock);
    var v = idx.data[row - 2];
    var prev = num_(v[5]);
    if (qty !== prev) { changes.push({ row: row, qty: qty }); notes.push(String(v[2]) + ' ' + prev + '→' + qty); }
  });
  if (updates.length && !changes.length && skipped.length === updates.length) {
    throw new Error('시트에서 찾을 수 없는 품목입니다: ' + skipped.slice(0, 3).join(', ') + ' (앱을 새로고침해 주세요)');
  }
  if (changes.length) writeStock_(idx, changes);
  var date = appendAudit_(dept, changes.length, notes.join('; '));
  return { date: date, changed: changes.length, skipped: skipped };
}

function requestCreate_(p) {
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw new Error('청구할 품목이 없습니다.');
  return writeRequest_(String(p.dept || '전체').trim() || '전체', items.map(function (i) {
    return { id: Number(i.id) || 0, name: i.name, spec: i.spec, dept: i.dept, cat: i.cat, stock: num_(i.stock), par: num_(i.par), qty: Math.max(1, num_(i.qty)) };
  }));
}

// 입고: 현재재고를 "더하고" 입고 기록을 남긴다. (실사는 수량을 "덮어쓰고", 입고는 "더한다")
// 청구서를 보고 입고하면 requestId 를 함께 보내 청구서별 입고 현황(입고 전/일부/완료)이 계산된다.
function receiveSubmit_(p) {
  var items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw new Error('입고할 품목이 없습니다.');
  var requestId = String(p.requestId || '').trim();
  if (requestId && !requestExists_(requestId)) throw new Error('청구서를 찾을 수 없습니다: ' + requestId + ' (앱을 새로고침해 주세요)');
  var memo = String(p.memo || '').trim().slice(0, 200);

  var want = {}, order = [], anyQty = false;   // 같은 품목이 여러 줄이면 수량을 합친다
  items.forEach(function (u) {
    var qty = num_(u.qty);
    if (qty < 1) return;
    anyQty = true;
    var id = Number(u.id);
    if (!want[id]) { want[id] = { qty: 0, name: String(u.name || u.id) }; order.push(id); }
    want[id].qty += qty;
  });
  if (!anyQty) throw new Error('입고 수량이 없습니다. 수량을 1 이상 입력해 주세요.');

  var idx = masterIndexFixed_();
  var changes = [], rows = [], skipped = [], stocks = {};
  var rid = 'IN' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 3);
  var date = today_();
  order.forEach(function (id) {
    var row = idx.rowById[id];
    if (!row) { skipped.push(want[id].name); return; }
    var v = idx.data[row - 2];
    var before = num_(v[5]), after = before + want[id].qty;
    changes.push({ row: row, qty: after });
    stocks[id] = after;
    rows.push([rid, date, requestId, String(v[0]).trim(), String(v[1]).trim(), id, String(v[2]).trim(), String(v[3]).trim(), want[id].qty, before, after, memo]);
  });
  if (!changes.length) throw new Error('시트에서 찾을 수 없는 품목입니다: ' + skipped.slice(0, 3).join(', ') + ' (앱을 새로고침해 주세요)');

  writeStock_(idx, changes);
  var sh = tab_(TAB_RECEIPT);
  sh.getRange(Math.max(lastRowByCol_(sh, 1), 1) + 1, 1, rows.length, 12).setValues(rows);
  return { id: rid, date: date, count: rows.length, skipped: skipped, stocks: stocks };
}

function requestExists_(requestId) {
  var sh = tab_(TAB_REQUEST);
  var last = lastRowByCol_(sh, 1);
  if (last < 2) return false;
  return sh.getRange(2, 1, last - 1, 1).getValues().some(function (r) { return String(r[0]) === requestId; });
}

// ---------- 시트 도우미 ----------
// 현재재고(F열) 갱신: 값만 들어 있으면 한 번에 쓰고, 수식이 섞여 있으면 수식을 지키기 위해 한 칸씩 쓴다
function writeStock_(idx, changes) {
  var sh = idx.sh, last = idx.last;
  var block = sh.getRange(2, 6, last - 1, 1);
  var hasFormula = block.getFormulas().some(function (r) { return String(r[0]).charAt(0) === '='; });
  if (hasFormula) {
    changes.forEach(function (c) { sh.getRange(c.row, 6).setValue(c.qty); });
    return;
  }
  var vals = block.getValues();
  changes.forEach(function (c) { vals[c.row - 2][0] = c.qty; });
  block.setValues(vals);
}

function appendAudit_(dept, changed, notes) {
  var sh = tab_(TAB_AUDIT);
  var date = today_();
  var row = Math.max(lastRowByCol_(sh, 2), 1) + 1;
  sh.getRange(row, 1, 1, 4).setValues([[date, dept, changed, String(notes || '').slice(0, 1500)]]);
  return date;
}

function writeRequest_(dept, list) {
  var sh = tab_(TAB_REQUEST);
  var date = today_();
  // 같은 초에 두 번 만들어도 번호가 겹치지 않도록 무작위 3글자를 붙인다
  var id = 'R' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 3);
  var start = Math.max(lastRowByCol_(sh, 1), 1) + 1;
  sh.getRange(start, 1, list.length, 11).setValues(list.map(function (i) {
    return [id, date, dept, String(i.dept || ''), String(i.cat || ''), i.id || '', String(i.name || ''), String(i.spec || ''), num_(i.stock), num_(i.par), i.qty];
  }));
  return { id: id, date: date };
}

// ---------- 최초 설정 / 예제 ----------
// 탭 3개와 머리글, 상태 자동 수식을 만든다. 이미 있으면 건드리지 않는다. 비어 있는 기본 시트는 정리한다.
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = [[TAB_MASTER, HEAD_MASTER], [TAB_AUDIT, HEAD_AUDIT], [TAB_REQUEST, HEAD_REQUEST], [TAB_RECEIPT, HEAD_RECEIPT]];
  var ours = defs.map(function (d) { return d[0]; });
  defs.forEach(function (p) {
    var sh = ss.getSheetByName(p[0]) || ss.insertSheet(p[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]).setFontWeight('bold');
      if (p[0] === TAB_MASTER) sh.getRange(1, 9).setFormula(MASTER_STATUS_FORMULA).setFontWeight('bold');
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
  if (lastRowByCol_(sh, 3) > 1) throw new Error('이미 품목이 있습니다. 비운 뒤 실행하세요.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sh.getRange(2, 1, SAMPLE_ITEMS.length, 7).setValues(SAMPLE_ITEMS);
    masterIndexFixed_();
  } finally { lock.releaseLock(); }
}

// 예제 데이터만 들어 있을 때 한 번에 지운다. 예제가 아닌 품목이 하나라도 있으면 아무것도 지우지 않는다.
function clearSampleData_() {
  var idx = masterIndex_();
  var sampleNames = {};
  SAMPLE_ITEMS.forEach(function (r) { sampleNames[r[2]] = true; });
  var names = idx.data.map(function (r) { return String(r[2]).trim(); }).filter(Boolean);
  var others = names.filter(function (n) { return !sampleNames[n]; });
  if (others.length) {
    throw new Error('예제가 아닌 품목이 있습니다 (' + others.slice(0, 3).join(', ') + (others.length > 3 ? ' 외 ' + (others.length - 3) + '개' : '') + '). 직접 지워 주세요.');
  }
  [[TAB_MASTER, 8, 3], [TAB_AUDIT, 4, 2], [TAB_REQUEST, 11, 1], [TAB_RECEIPT, 12, 1]].forEach(function (t) {
    var sh = tab_(t[0]);
    var last = lastRowByCol_(sh, t[2]);
    if (last > 1) sh.getRange(2, 1, last - 1, t[1]).clearContent();
  });
  return { items: names.length };
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

function validId_(v) {
  var n = Number(v);
  return (v !== '' && isFinite(n) && n > 0 && Math.floor(n) === n) ? n : 0;
}

// 품목 마스터를 한 번만 읽어 번호→행 표를 만든다. 번호가 없거나 겹치거나 깨진 줄은 missing 에 모은다.
function masterIndex_() {
  var sh = tab_(TAB_MASTER);
  var res = { sh: sh, last: lastRowByCol_(sh, 3), data: [], rowById: {}, missing: [], maxId: 0 };
  if (res.last < 2) return res;
  res.data = sh.getRange(2, 1, res.last - 1, 8).getValues();
  res.data.forEach(function (r) { var id = validId_(r[7]); if (id > res.maxId) res.maxId = id; });
  var seen = {};
  res.data.forEach(function (r, i) {
    if (String(r[2]).trim() === '') return;           // 품목명이 없는 줄은 품목이 아니다
    var id = validId_(r[7]);
    if (!id || seen[id]) res.missing.push(i); else { seen[id] = true; res.rowById[id] = i + 2; }
  });
  return res;
}

// 번호가 필요한 줄에 새 번호를 채운다. (쓰기를 하므로 호출하는 쪽이 잠금을 잡고 있어야 한다)
function ensureIds_(idx) {
  if (!idx.missing.length) return idx;
  var next = idx.maxId;
  idx.missing.forEach(function (i) {
    next++;
    idx.data[i][7] = next;
    idx.rowById[next] = i + 2;
  });
  idx.maxId = next;
  idx.sh.getRange(2, 8, idx.last - 1, 1).setValues(idx.data.map(function (r) { return [r[7]]; }));
  idx.missing = [];
  return idx;
}

function masterIndexFixed_() { return ensureIds_(masterIndex_()); }

function masterItems_(idx) {
  var out = [];
  idx.data.forEach(function (r) {
    if (String(r[2]).trim() === '') return;
    out.push({ id: validId_(r[7]), dept: String(r[0]).trim(), cat: String(r[1]).trim(), name: String(r[2]).trim(), spec: String(r[3]).trim(), par: num_(r[4]), stock: num_(r[5]), memo: String(r[6]) });
  });
  return out;
}

function depts_(idx) {
  var out = [];
  masterItems_(idx).forEach(function (i) { if (i.dept && out.indexOf(i.dept) < 0) out.push(i.dept); });
  return out;
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
