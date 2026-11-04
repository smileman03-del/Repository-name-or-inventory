// Code.gs 백엔드 시험 (엑셀 없이: setupSheets → loadSampleData 기준)
const fs = require('fs'), assert = require('assert'), path = require('path');
const createEnv = require('./gs_mock');
const CODE = process.argv[2];
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample.json'), 'utf8'));
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const fresh = (o) => createEnv(CODE, o);
const names = e => e.get('getMaster').data.map(i => i.name);
const shortage = items => items.filter(i => i.stock < i.par).map(i => i.name).sort();

// ---- 메뉴 / 최초 설정 ----
let e = fresh();
e.run('onOpen()'); assert.strictEqual(e.ui.menu.title, '🏥 재고관리'); assert.strictEqual(e.ui.menu.items, 7); ok('시트 메뉴 7개 항목(예제 데이터 지우기 포함)');
assert.strictEqual(e.get('getMaster').success, false); assert(/setupSheets/.test(e.get('getMaster').error)); ok('탭이 없으면 "setupSheets 를 먼저 실행" 안내 오류');

e.run('setupSheets()');
assert.deepStrictEqual(e.sheets.map(s => s.name), ['품목 마스터', '주간 재고 파악', '실시간 재고 대장', '물품 청구서']); ok('setupSheets: 탭 4개가 정확한 이름·순서로 생기고, 비어 있던 기본 시트("시트1")는 정리됨');
assert.strictEqual(e.sheet('품목 마스터').d[0][5], e.run('MASTER_STATUS_FORMULA')); assert(/^=ARRAYFORMULA\(\{"상태"; IF\(E2:E=""/.test(e.sheet('품목 마스터').d[0][5])); ok('품목 마스터 F1 에 상태 자동 수식(ARRAYFORMULA) 입력');
assert.deepStrictEqual(e.sheet('주간 재고 파악').d[0], e.J(e.run('HEAD_WEEKLY'))); ok('다른 탭 머리글도 정확');
const before = JSON.stringify(e.sheets.map(s => s.d)); e.run('setupSheets()'); assert.strictEqual(JSON.stringify(e.sheets.map(s => s.d)), before); ok('setupSheets 를 두 번 실행해도 안전(아무것도 바뀌지 않음)');
{ const x = fresh(); x.paste('시트1', 1, [['내 메모']]); x.run('setupSheets()'); assert(x.ss.getSheetByName('시트1')); assert.strictEqual(x.sheets.length, 5); ok('내용이 있는 기존 시트는 지우지 않고 보존'); }

// ---- 예제 ----
e.run('loadSampleData()');
let m = e.get('getMaster').data; assert.strictEqual(m.length, 15); assert(m.every(i => Number.isInteger(i.par) && Number.isInteger(i.stock))); ok('loadSampleData: 예제 15개 입력');
assert.deepStrictEqual(e.J(e.run('SAMPLE_ITEMS')), SAMPLE.map(x => [x.name, x.loc, x.spec, x.par, x.stock])); ok('Code.gs 예제 = 개발용 sample.json (앱 내장 예제와 같은 원본)');
assert.throws(() => e.run('loadSampleData()'), /이미 품목이 있습니다/); ok('품목이 있으면 예제 입력 거부(실수로 덮어쓰기 방지)');
assert.deepStrictEqual(e.get('getRealtime').data.map(i => i.name).sort(), shortage(m)); assert.strictEqual(shortage(m).length, 9); ok('실시간 재고 대장 = 재고부족 9개, 적정과 같은 3개는 제외');
assert(e.get('getRealtime').data.every(i => i.lack === i.par - i.stock)); ok('부족수량 = 적정재고 − 현재재고');

// ---- 마지막 행 / 품목 추가·삭제 (ARRAYFORMULA 로 getLastRow 가 맨 아래를 돌려주는 최악의 경우) ----
assert.strictEqual(e.sheet('품목 마스터').getLastRow(), 1000); ok('(모의 환경) 자동 수식 때문에 getLastRow()가 1000행으로 보고되는 최악의 상황을 재현');
assert(e.post({ action: 'addItem', name: '신규품목', loc: '병동', spec: 'EA', par: 10, stock: 1 }).success);
assert.strictEqual(e.sheet('품목 마스터').d[16][0], '신규품목'); assert.strictEqual(e.sheet('품목 마스터').d[999], undefined); ok('품목 추가는 마지막 품목 바로 아래(17행)에 들어감 — 맨 아래(1000행)로 가지 않음');
assert.strictEqual(e.get('getRealtime').data.length, 10); ok('품목 추가 → 실시간 재고 대장 자동 갱신');
assert(e.post({ action: 'addItem', name: '신규품목', loc: 'x' }).success === false); assert(e.post({ action: 'addItem', name: '  ', loc: 'x' }).success === false); ok('중복·빈 품목명 추가 거부');
assert(e.post({ action: 'deleteItem', name: '멸균 수술장갑 7.0' }).success);   // 첫 번째 데이터 행(2행) 삭제
assert.strictEqual(e.sheet('품목 마스터').d[0][5], e.run('MASTER_STATUS_FORMULA')); assert(!names(e).includes('멸균 수술장갑 7.0')); ok('첫 번째 품목(2행)을 삭제해도 상태 자동 수식(F1)은 그대로 유지');
assert(e.post({ action: 'deleteItem', name: '신규품목' }).success); assert(e.post({ action: 'deleteItem', name: '신규품목' }).success === false); ok('삭제 + 이미 지운 품목 재삭제 거부');

// ---- 주간실사 (일괄 처리) ----
e = fresh(); e.run('loadSampleData()');
let r = e.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '멸균 수술장갑 7.0', qty: 12 }, { name: '주사바늘 23G', qty: 2 }, { name: '없는품목', qty: 1 }] });
assert(r.success && r.data.saved === 2 && JSON.stringify(r.data.skipped) === JSON.stringify(['없는품목'])); m = e.get('getMaster').data;
assert.strictEqual(m.find(i => i.name === '멸균 수술장갑 7.0').stock, 12); assert.strictEqual(m.find(i => i.name === '알코올 솜').stock, 20); ok('실사 저장: 2건 갱신, 없는 품목 무시, 나머지 재고 유지');
const wk = e.get('getWeekly').data; assert.strictEqual(wk.length, 2); assert.strictEqual(wk[0].date, '2026-11-03'); ok('주간 재고 파악 탭에 기록');
assert.strictEqual(e.sheet('주간 재고 파악').d[1][5], '=IF(E2="","",IF(E2<D2,"❌ 재고부족","✅ 안정"))'); assert(e.sheet('주간 재고 파악').d[2][5].includes('E3')); ok('주간 기록의 상태 수식이 행 번호에 맞게 입력됨');
assert.deepStrictEqual(e.get('getRealtime').data.map(i => i.name).sort(), shortage(m)); ok('실사 후 실시간 재고 대장 자동 갱신');
assert(e.post({ action: 'saveWeekly', rows: [] }).success === false); ok('빈 실사 거부');
r = e.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '없는A', qty: 1 }, { name: '없는B', qty: 2 }] }); assert(r.success === false && /없는A/.test(r.error) && /새로고침/.test(r.error)); assert.strictEqual(e.get('getWeekly').data.length, 2); ok('전부 못 찾으면 "성공"이 아니라 오류로 알리고(이름 표시 + 새로고침 안내), 아무것도 저장하지 않음');
ok('일부만 못 찾으면 나머지는 저장하고 건너뛴 이름을 알려줌(skipped)');
{ const x = fresh(); x.run('loadSampleData()'); x.sheet('품목 마스터').d[2][4] = '=B3';   // E3 에 수식이 들어 있는 경우
  x.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '멸균 수술장갑 7.0', qty: 99 }, { name: '일회용 수술가운', qty: 7 }] });
  assert.strictEqual(x.sheet('품목 마스터').d[2][4], '=B3'); assert.strictEqual(x.get('getMaster').data.find(i => i.name === '멸균 수술장갑 7.0').stock, 99); ok('현재재고 칸에 수식이 있으면 지우지 않고 보존(그 칸 외에는 정상 저장)'); }

// ---- 품목명 중복 감지 ----
e = fresh(); e.run('setupSheets()');
e.paste('품목 마스터', 2, [['거즈', '병동', 'Pack', 20, 5], ['거즈', '병동', 'Pack', 20, 8], ['장갑', '수술실', 'Box', 10, 2], ['  멸균  ', '수술실', 'Box', 4, 1]]);
assert.strictEqual(e.get('getMaster').data.length, 4);
r = e.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '거즈', qty: 50 }, { name: '장갑', qty: 9 }] });
assert(r.success === false && /거즈/.test(r.error) && /중복/.test(r.error)); assert.strictEqual(e.sheet('품목 마스터').d[1][4], 5); assert.strictEqual(e.sheet('품목 마스터').d[3][4], 2); assert.strictEqual(e.get('getWeekly').data.length, 0); ok('중복 이름 실사 저장: 틀린 값을 쓰지 않고 멈춤 + 어떤 이름인지 알려줌 (아무것도 저장 안 됨)');
r = e.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '장갑', qty: 9 }, { name: '멸균', qty: 3 }] }); assert(r.success && r.data.saved === 2); ok('중복이 아닌 품목은 그대로 정상 저장(앞뒤 공백 있는 이름 포함)');
assert(e.post({ action: 'deleteItem', name: '거즈' }).success === false); assert(/여러 개/.test(e.post({ action: 'deleteItem', name: '거즈' }).error)); assert.strictEqual(e.get('getMaster').data.length, 4); ok('중복 이름 삭제 거부');
assert(e.post({ action: 'addItem', name: '거즈', loc: '병동' }).success === false); ok('중복 이름 추가 거부');
e.run('showDashboard()'); assert(/중복/.test(e.alerts.at(-1)) && /거즈/.test(e.alerts.at(-1))); ok('현황 대시보드가 중복 품목을 경고');

// ---- 예제 데이터 지우기 ----
e = fresh(); e.run('loadSampleData()'); e.post({ action: 'saveWeekly', date: '2026-11-03', rows: [{ name: '주사바늘 23G', qty: 2 }] }); e.post({ action: 'submitRequest', items: [{ name: '초음파 젤', loc: '물리치료실', spec: '병', qty: 3 }] });
e.paste('품목 마스터', 17, [['우리병원 품목', '병동', 'EA', 5, 1]]);
assert.throws(() => e.run('clearSampleData_()'), /예제가 아닌 품목/); assert.strictEqual(e.get('getMaster').data.length, 16); assert.strictEqual(e.get('getRequests').data.length, 1); ok('예제가 아닌 품목이 섞여 있으면 아무것도 지우지 않고 이유를 알려줌');
e.sheet('품목 마스터').d.splice(16, 1);
e.ui.answer = 'NO'; e.run('clearSampleDataFromMenu()'); assert.strictEqual(e.get('getMaster').data.length, 15); ok('확인 창에서 "아니오"를 누르면 지우지 않음');
e.ui.answer = 'YES'; e.run('clearSampleDataFromMenu()');
assert.strictEqual(e.get('getMaster').data.length, 0); assert.strictEqual(e.get('getWeekly').data.length, 0); assert.strictEqual(e.get('getRequests').data.length, 0); assert.strictEqual(e.get('getRealtime').data.length, 0); ok('예제 품목 + 체험 기록(주간 재고 파악·청구서·실시간 대장)을 한 번에 삭제');
assert.strictEqual(e.sheet('품목 마스터').d[0][5], e.run('MASTER_STATUS_FORMULA')); assert.strictEqual(e.sheet('품목 마스터').d[0][0], '품목명'); assert.strictEqual(e.sheet('물품 청구서').d[0][0], '청구번호'); ok('머리글과 상태 자동 수식은 그대로 남음');
e.post({ action: 'addItem', name: '내 첫 품목', loc: '병동', spec: 'EA', par: 5, stock: 1 }); assert.strictEqual(e.sheet('품목 마스터').d[1][0], '내 첫 품목'); ok('지운 뒤 첫 품목은 2행부터 들어감');

// ---- 청구서 ----
e = fresh(); e.run('loadSampleData()');
r = e.post({ action: 'submitRequest', items: [{ name: '봉합사', loc: '수술실', spec: 'Box', qty: 6 }, { name: '초음파 젤', loc: '물리치료실', spec: '병', qty: 0 }] });
assert(r.success && r.data.count === 2 && /^R\d{12}-[0-9a-f]{3}$/.test(r.data.id)); let rq = e.get('getRequests').data; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items[1].qty, 1); ok('청구 제출: 한 청구번호로 묶임, 수량 0은 1로 보정');
e.post({ action: 'submitRequest', items: [{ name: 'a', qty: 1 }] }); e.post({ action: 'submitRequest', items: [{ name: 'b', qty: 1 }] }); const ids = e.get('getRequests').data.map(x => x.id); assert.strictEqual(new Set(ids).size, ids.length); ok('같은 초에 여러 번 청구해도 번호 중복 없음');
assert(e.post({ action: 'submitRequest', items: [] }).success === false); ok('빈 청구 거부');
const cnt = e.get('getRequests').data.length; e.run('createRequestFromMenu()'); rq = e.get('getRequests').data; assert.strictEqual(rq.length, cnt + 1); assert.strictEqual(rq.at(-1).items.length, 9); assert(rq.at(-1).items.every(i => i.qty > 0)); ok('시트 메뉴 "물품 청구서 생성": 부족 9개 자동 청구');
e.run('weeklyInputFromMenu()'); assert.strictEqual(e.get('getWeekly').data.length, 15); ok('시트 메뉴 "주간실사 자동입력": 15개 입력');
e.run('showDashboard()'); assert(/전체 품목: 15개/.test(e.alerts.at(-1)) && /재고부족: 9개/.test(e.alerts.at(-1))); ok('현황 대시보드 숫자 정확');
e.ui.promptText = '테스트품목, 병동, EA, 10, 3'; e.run('addItemFromMenu()'); assert(e.get('getMaster').data.some(i => i.name === '테스트품목' && i.stock === 3)); ok('시트 메뉴 "품목 추가" 입력 해석');

// ---- 시간대 / 기타 ----
e = fresh({ sheetTz: 'Asia/Seoul' }); e.run('loadSampleData()'); e.seen.tz.length = 0; e.post({ action: 'submitRequest', items: [{ name: 'a', qty: 1 }] });
assert(e.seen.tz.length > 0 && e.seen.tz.every(t => t === 'Asia/Seoul')); ok('날짜는 스프레드시트 시간대(Asia/Seoul)를 따름 — 스크립트 기본 시간대(LA)가 아님');
assert(e.post({ action: 'bogus' }).success === false && e.get('bogus').success === false); ok('잘못된 action 거부');

// ---- 성능: 품목이 많아도 호출 횟수가 늘지 않는지 (일괄 처리) ----
e = fresh(); e.run('setupSheets()'); const big = []; for (let i = 1; i <= 300; i++) big.push(['품목' + i, '병동', 'EA', 10, 3]); e.paste('품목 마스터', 2, big);
Object.keys(e.calls).forEach(k => e.calls[k] = 0);
r = e.post({ action: 'saveWeekly', date: '2026-11-03', rows: big.map(x => ({ name: x[0], qty: 8 })) });
assert(r.success && r.data.saved === 300); assert.strictEqual(e.calls.setValue, 0); assert(e.calls.getRange < 40, 'getRange 호출 ' + e.calls.getRange);
assert.strictEqual(e.get('getMaster').data.filter(i => i.stock === 8).length, 300); ok(`품목 300개 실사 저장도 일괄 처리 (한 칸씩 쓰기 0회, 시트 호출 ${e.calls.getRange}회)`);

console.log('\n전체 ' + n + '개 통과');
