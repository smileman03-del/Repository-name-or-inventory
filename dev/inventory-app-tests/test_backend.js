// Code.gs(프로) 백엔드 시험: 실제 앱의 API 규약(getAll / itemAdd / itemUpdate / itemDelete / auditSubmit / requestCreate)
const fs = require('fs'), assert = require('assert'), path = require('path');
const createEnv = require('./gs_mock');
const CODE = process.argv[2];
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample.json'), 'utf8'));
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const fresh = o => createEnv(CODE, o);
const all = e => e.get('getAll').data;
const sample = () => { const e = fresh(); e.run('loadSampleData()'); return e; };
const byName = (e, nm) => all(e).items.find(i => i.name === nm);
const M = 'sheet-master';

// ---- 메뉴 / 최초 설정 ----
let e = fresh();
e.run('onOpen()'); assert.strictEqual(e.ui.menu.title, '🏥 재고관리'); assert.strictEqual(e.ui.menu.items, 5); ok('시트 메뉴 5개 항목');
assert.strictEqual(e.get('getAll').success, false); assert(/setupSheets/.test(e.get('getAll').error)); ok('탭이 없으면 "setupSheets 를 먼저 실행" 안내 오류');
e.run('setupSheets()');
assert.deepStrictEqual(e.sheets.map(s => s.name), ['품목 마스터', '실사 기록', '물품 청구서']); ok('setupSheets: 탭 3개가 정확한 이름·순서로 생기고, 비어 있던 기본 시트("시트1")는 정리됨');
assert.strictEqual(e.sheet('품목 마스터').d[0][8], e.run('MASTER_STATUS_FORMULA')); assert(/^=ARRAYFORMULA\(\{"상태\(자동\)"; IF\(F2:F=""/.test(e.sheet('품목 마스터').d[0][8])); ok('품목 마스터 I1 에 상태 자동 수식(ARRAYFORMULA) 입력');
assert.deepStrictEqual(e.sheet('품목 마스터').d[0].slice(0, 8), e.J(e.run('HEAD_MASTER'))); assert.deepStrictEqual(e.sheet('물품 청구서').d[0], e.J(e.run('HEAD_REQUEST'))); ok('머리글 정확');
const before = JSON.stringify(e.sheets.map(s => s.d)); e.run('setupSheets()'); assert.strictEqual(JSON.stringify(e.sheets.map(s => s.d)), before); ok('setupSheets 를 두 번 실행해도 안전(아무것도 바뀌지 않음)');
{ const x = fresh(); x.paste('시트1', 1, [['내 메모']]); x.run('setupSheets()'); assert(x.ss.getSheetByName('시트1')); assert.strictEqual(x.sheets.length, 4); ok('내용이 있는 기존 시트는 지우지 않고 보존'); }
let r = all(e); assert.deepStrictEqual(r, { items: [], audits: {}, requests: [] }); ok('빈 상태의 getAll 응답: items/audits/requests 모두 빈 값');

// ---- 예제 ----
e = sample(); r = all(e);
assert.strictEqual(r.items.length, 15); assert.deepStrictEqual(r.items.map(i => i.id), Array.from({ length: 15 }, (_, i) => i + 1)); assert(r.items.every(i => typeof i.id === 'number')); ok('loadSampleData: 예제 15개, 품목번호 1~15가 숫자로 자동 부여됨(앱이 숫자 번호를 요구)');
assert.deepStrictEqual(e.J(e.run('SAMPLE_ITEMS')), SAMPLE.map(x => [x.dept, x.cat, x.name, x.spec, x.par, x.stock, x.memo])); ok('Code.gs 예제 = 개발용 sample.json');
assert.throws(() => e.run('loadSampleData()'), /이미 품목이 있습니다/); ok('품목이 있으면 예제 입력 거부(덮어쓰기 방지)');
assert.deepStrictEqual(Object.keys(r.items[0]).sort(), ['cat', 'dept', 'id', 'memo', 'name', 'par', 'spec', 'stock']); ok('품목 필드가 앱이 기대하는 형태(id,dept,cat,name,spec,par,stock,memo)');
assert.strictEqual(r.items.filter(i => i.stock < i.par).length, 9); assert.deepStrictEqual([...new Set(r.items.map(i => i.dept))], ['수술실', '처치실', '병동', '물리치료실']); assert.strictEqual(byName(e, '봉합사 Vicryl 2-0').memo, '유효기간 확인'); ok('부족 9개 / 대분류 4개(처음 나온 순서) / 메모 보존');

// ---- 품목 추가 (ARRAYFORMULA 로 getLastRow 가 맨 아래를 돌려주는 최악의 경우) ----
assert.strictEqual(e.sheet('품목 마스터').getLastRow(), 1000); ok('(모의 환경) 자동 수식 때문에 getLastRow()가 1000행으로 보고되는 최악의 상황 재현');
r = e.post({ action: 'itemAdd', dept: '병동', cat: '소모품', name: '신규품목', spec: 'EA', par: 10, stock: 1, memo: '테스트' });
assert(r.success && r.data.id === 16); assert.strictEqual(e.sheet('품목 마스터').d[16][2], '신규품목'); assert.strictEqual(e.sheet('품목 마스터').d[16][7], 16); assert.strictEqual(e.sheet('품목 마스터').d[999], undefined); ok('품목 추가: 번호 16 부여, 마지막 품목 바로 아래(17행)에 기록 — 맨 아래(1000행)로 가지 않음');
assert.deepStrictEqual(byName(e, '신규품목'), { id: 16, dept: '병동', cat: '소모품', name: '신규품목', spec: 'EA', par: 10, stock: 1, memo: '테스트' }); ok('추가한 품목이 getAll 에서 그대로 조회됨');
assert(e.post({ action: 'itemAdd', dept: '병동', cat: '', name: '분류없음', par: 1, stock: 0 }).success); assert.strictEqual(byName(e, '분류없음').cat, '기타'); ok('소분류를 비워도 "기타"로 저장');
assert(e.post({ action: 'itemAdd', dept: '병동', name: '' }).success === false && e.post({ action: 'itemAdd', dept: '', name: 'x' }).success === false); ok('품목명·대분류가 비면 추가 거부');
assert(e.post({ action: 'itemAdd', dept: '병동', cat: '소모품', name: '신규품목', par: 1, stock: 1 }).success); assert.strictEqual(all(e).items.filter(i => i.name === '신규품목').length, 2); ok('같은 이름도 번호로 구분되어 추가 가능(막지 않음)');
{ const x = e.post({ action: 'itemAdd', dept: '새대분류', cat: '새소분류', name: '새품목', par: 3, stock: 0 }); assert(x.success); assert(all(e).items.some(i => i.dept === '새대분류' && i.cat === '새소분류')); ok('새 대분류·소분류도 자유롭게 입력 가능'); }

// ---- 품목 수정 / 삭제 ----
e = sample();
assert(e.post({ action: 'itemUpdate', id: 1, par: 20 }).success); let it = byName(e, '멸균 수술장갑 7.0'); assert.strictEqual(it.par, 20); assert.strictEqual(it.stock, 4); assert.strictEqual(it.name, '멸균 수술장갑 7.0'); ok('itemUpdate: 보낸 필드(적정재고)만 바뀌고 나머지는 유지');
assert(e.post({ action: 'itemUpdate', id: '2', stock: 50 }).success); assert.strictEqual(byName(e, '멸균 수술장갑 7.5').stock, 50); ok('번호가 문자열("2")로 와도 정상 처리');
assert(e.post({ action: 'itemUpdate', id: 3, dept: '병동', cat: '보조기', name: '이름 바꿈', spec: 'XL', par: 7, memo: '수정' }).success); assert.deepStrictEqual(byName(e, '이름 바꿈'), { id: 3, dept: '병동', cat: '보조기', name: '이름 바꿈', spec: 'XL', par: 7, stock: 26, memo: '수정' }); ok('전체 필드 수정(대분류·소분류·이름·규격·메모)');
assert(e.post({ action: 'itemUpdate', id: 4, name: '  ' }).success === false && e.post({ action: 'itemUpdate', id: 4, dept: '' }).success === false); assert.strictEqual(byName(e, '봉합사 Vicryl 2-0').name, '봉합사 Vicryl 2-0'); ok('이름·대분류를 비우는 수정은 거부(아무것도 바뀌지 않음)');
assert(/새로고침/.test(e.post({ action: 'itemUpdate', id: 999, par: 1 }).error)); ok('없는 번호 수정 → "앱을 새로고침해 주세요" 안내');
assert.strictEqual(e.post({ action: 'itemUpdate', id: 5, stock: -3 }).success, true); assert.strictEqual(byName(e, '생리식염수 1L').stock, 0); ok('음수 수량은 0으로 보정');
assert(e.post({ action: 'itemDelete', id: 1 }).success);   // 첫 번째 데이터 행(2행) 삭제
assert.strictEqual(e.sheet('품목 마스터').d[0][8], e.run('MASTER_STATUS_FORMULA')); assert(!all(e).items.some(i => i.id === 1)); assert.strictEqual(all(e).items.length, 14); ok('첫 번째 품목(2행)을 삭제해도 상태 자동 수식(I1) 유지');
assert.deepStrictEqual(all(e).items.map(i => i.id), Array.from({ length: 14 }, (_, i) => i + 2)); ok('삭제 후에도 나머지 품목의 번호는 그대로');
assert(e.post({ action: 'itemDelete', id: 1 }).success === false && /새로고침/.test(e.post({ action: 'itemDelete', id: 1 }).error)); ok('이미 지운 품목 재삭제 → 새로고침 안내');

// ---- 붙여넣기 / 품목번호 자동 부여 ----
e = fresh(); e.run('setupSheets()');
e.paste('품목 마스터', 2, [['병동', '소모품', '붙여넣은 A', 'EA', 10, 3, ''], ['병동', '소모품', '붙여넣은 B', 'EA', 5, 9, '메모']]);   // 구매자가 A~G 만 붙여넣음
r = all(e).items; assert.deepStrictEqual(r.map(i => i.id), [1, 2]); assert.strictEqual(e.sheet('품목 마스터').d[1][7], 1); ok('A~G 만 붙여넣어도 품목번호가 자동으로 채워져 시트(H열)에 기록됨');
assert.deepStrictEqual(all(e).items.map(i => i.id), [1, 2]); ok('다시 조회해도 번호는 그대로(안정적)');
e.paste('품목 마스터', 4, [['병동', '소모품', '복사한 줄', 'EA', 1, 1, '', 2], ['병동', '소모품', '깨진 번호', 'EA', 1, 1, '', 'abc'], ['병동', '소모품', '소수 번호', 'EA', 1, 1, '', 1.5], ['병동', '소모품', '', 'EA', 1, 1, '', ''], ['병동', '소모품', '음수 번호', 'EA', 1, 1, '', -4]]);
r = all(e).items; assert.strictEqual(r.length, 6); assert.strictEqual(new Set(r.map(i => i.id)).size, 6); assert(r.every(i => Number.isInteger(i.id) && i.id > 0)); assert.deepStrictEqual(r.slice(0, 2).map(i => i.id), [1, 2]); ok('번호가 겹치거나(복사한 줄)·깨졌거나·소수·음수여도 새 번호를 받아 모두 고유해짐, 기존 번호는 유지');
assert(!r.some(i => i.name === '')); ok('품목명이 빈 줄은 품목으로 취급하지 않음');
e.ui.alerts = 0; e.run('fillIdsFromMenu()'); assert(/이미 있습니다/.test(e.alerts.at(-1))); ok('메뉴 "품목번호 채우기": 이미 다 있으면 그렇게 안내');
e.paste('품목 마스터', 9, [['병동', '소모품', '또 붙여넣음', 'EA', 1, 1, '']]); e.run('fillIdsFromMenu()'); assert(/1개 품목에 번호를 채웠습니다/.test(e.alerts.at(-1))); ok('메뉴 "품목번호 채우기": 새로 붙여넣은 1개를 채우고 개수를 알려줌');

// ---- 실사 ----
e = sample();
r = e.post({ action: 'auditSubmit', dept: '처치실', updates: [{ id: 6, name: '일회용 주사기 5cc', stock: 9 }, { id: 7, name: '주사바늘 23G', stock: 6 }, { id: 9, name: '포비돈', stock: 2 }] });
assert(r.success && r.data.changed === 2 && /^\d{4}-\d{2}-\d{2}$/.test(r.data.date) && r.data.skipped.length === 0); ok('실사 저장: 실제로 바뀐 2건만 변경으로 집계(같은 값은 제외)');
assert.strictEqual(byName(e, '일회용 주사기 5cc').stock, 9); assert.strictEqual(byName(e, '주사바늘 23G').stock, 6); assert.strictEqual(byName(e, '포비돈 용액 500ml').stock, 2); ok('현재재고가 시트에 반영됨');
assert.strictEqual(all(e).audits['처치실'], r.data.date); const log = e.sheet('실사 기록').d[1]; assert.deepStrictEqual([log[1], log[2]], ['처치실', 2]); assert(/주사기 5cc 3→9/.test(log[3]) && /포비돈 용액 500ml 4→2/.test(log[3])); ok('실사 기록 탭에 날짜·대분류·변경 건수·변경 내역(이전→이후)이 남음');
r = e.post({ action: 'auditSubmit', dept: '병동', updates: [] }); assert(r.success && r.data.changed === 0 && all(e).audits['병동']); assert.strictEqual(e.sheet('실사 기록').d[2][2], 0); ok('변경이 하나도 없어도 "실사 완료"가 기록됨 → 다음 실사일 계산 가능');
e.paste('실사 기록', 4, [[new Date('2026-01-05T00:00:00Z'), '수술실', 0, ''], ['2026-03-02', '수술실', 0, '']]);
assert.strictEqual(all(e).audits['수술실'], '2026-03-02'); ok('같은 대분류의 실사가 여러 번이면 가장 최근 날짜를 사용(날짜 형식이 Date 든 문자열이든)');
r = e.post({ action: 'auditSubmit', dept: '물리치료실', updates: [{ id: 13, name: '베드시트', stock: 20 }, { id: 888, name: '없는품목', stock: 1 }] });
assert(r.success && r.data.changed === 1 && JSON.stringify(r.data.skipped) === JSON.stringify(['없는품목'])); ok('일부만 못 찾으면 나머지는 저장하고 건너뛴 이름을 알려줌(skipped)');
const rows0 = e.sheet('실사 기록').d.length;
r = e.post({ action: 'auditSubmit', dept: '병동', updates: [{ id: 777, name: '없는A', stock: 1 }, { id: 778, name: '없는B', stock: 2 }] }); assert(r.success === false && /없는A/.test(r.error) && /새로고침/.test(r.error)); assert.strictEqual(e.sheet('실사 기록').d.length, rows0); ok('전부 못 찾으면 "성공"이 아니라 오류로 알리고, 실사 기록도 남기지 않음');
assert(e.post({ action: 'auditSubmit', dept: '', updates: [] }).success === false); ok('대분류가 비면 거부');
{ const x = sample(); x.sheet('품목 마스터').d[2][5] = '=E3';   // F3(현재재고)에 수식이 있는 경우
  x.post({ action: 'auditSubmit', dept: '수술실', updates: [{ id: 1, name: 'a', stock: 99 }, { id: 3, name: 'b', stock: 7 }] });
  assert.strictEqual(x.sheet('품목 마스터').d[2][5], '=E3'); assert.strictEqual(byName(x, '멸균 수술장갑 7.0').stock, 99); ok('현재재고 칸에 수식이 있으면 지우지 않고 보존(그 칸 외에는 정상 저장)'); }

// ---- 청구서 ----
e = sample();
const reqItems = [{ id: 1, name: '멸균 수술장갑 7.0', spec: 'Box(50쌍)', dept: '수술실', cat: '소모품', stock: 4, par: 10, qty: 6 }, { id: 14, name: '초음파 젤', spec: '병(250ml)', dept: '물리치료실', cat: '소모품', stock: 2, par: 6, qty: 0 }];
r = e.post({ action: 'requestCreate', dept: '전체', items: reqItems }); assert(r.success && /^R\d{12}-[0-9a-f]{3}$/.test(r.data.id) && /^\d{4}-\d{2}-\d{2}$/.test(r.data.date)); ok('청구서 생성: 청구번호(R+시각+무작위)와 날짜 반환');
let rq = all(e).requests; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].dept, '전체'); assert.strictEqual(rq[0].items.length, 2); assert.deepStrictEqual(rq[0].items[0], { id: 1, dept: '수술실', cat: '소모품', name: '멸균 수술장갑 7.0', spec: 'Box(50쌍)', stock: 4, par: 10, qty: 6 }); assert.strictEqual(rq[0].items[1].qty, 1); ok('청구 내역이 앱이 기대하는 형태로 복원됨(수량 0은 1로 보정)');
e.post({ action: 'requestCreate', dept: '병동', items: [reqItems[0]] }); e.post({ action: 'requestCreate', dept: '병동', items: [reqItems[0]] }); const ids = all(e).requests.map(x => x.id); assert.strictEqual(ids.length, 3); assert.strictEqual(new Set(ids).size, 3); ok('같은 초에 여러 번 청구해도 번호 중복 없음(청구가 합쳐지지 않음)');
assert(e.post({ action: 'requestCreate', dept: '병동', items: [] }).success === false && e.post({ action: 'requestCreate', dept: '병동', items: 5 }).success === false); ok('빈 청구·잘못된 형식 거부');
e.post({ action: 'requestCreate', items: [reqItems[0]] }); assert.strictEqual(all(e).requests.at(-1).dept, '전체'); ok('청구 대상을 안 보내면 "전체"로 기록');

// ---- 시트 메뉴 ----
e = sample();
e.run('showDashboard()'); assert(/전체 품목: 15개/.test(e.alerts.at(-1)) && /재고부족: 9개/.test(e.alerts.at(-1)) && /수술실: 5개 중 부족 4개/.test(e.alerts.at(-1))); ok('현황 대시보드: 전체·부족 숫자와 대분류별 현황');
e.run('createRequestFromMenu()'); rq = all(e).requests; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items.length, 9); assert(rq[0].items.every(i => i.qty === i.par - i.stock && i.id > 0)); ok('메뉴 "물품 청구서 생성": 부족 9개를 적정−현재 수량으로 자동 청구');
e.ui.promptText = '병동'; e.run('recordAuditFromMenu()'); assert(/병동 실사 완료/.test(e.alerts.at(-1))); assert(all(e).audits['병동']); ok('메뉴 "실사 완료 기록": PC에서 직접 수정한 대분류의 실사 완료를 기록');
const nA = e.sheet('실사 기록').d.length; e.ui.promptText = '없는부서'; e.run('recordAuditFromMenu()'); assert(/없는 대분류/.test(e.alerts.at(-1))); assert.strictEqual(e.sheet('실사 기록').d.length, nA); ok('없는 대분류는 기록하지 않고 안내');
{ const x = sample(); x.run('createRequestFromMenu()'); x.run('clearSampleDataFromMenu()'); assert.strictEqual(all(x).items.length, 0); }
// ---- 예제 데이터 지우기 ----
e = sample(); e.post({ action: 'auditSubmit', dept: '처치실', updates: [{ id: 6, name: 'a', stock: 9 }] }); e.post({ action: 'requestCreate', dept: '병동', items: [reqItems[0]] });
e.paste('품목 마스터', 17, [['병동', '소모품', '우리병원 품목', 'EA', 5, 1, '']]);
assert.throws(() => e.run('clearSampleData_()'), /예제가 아닌 품목/); assert.strictEqual(all(e).items.length, 16); assert.strictEqual(all(e).requests.length, 1); ok('예제가 아닌 품목이 섞여 있으면 아무것도 지우지 않고 이유를 알려줌');
e.sheet('품목 마스터').d.splice(16, 1);
e.ui.answer = 'NO'; e.run('clearSampleDataFromMenu()'); assert.strictEqual(all(e).items.length, 15); ok('확인 창에서 "아니오"를 누르면 지우지 않음');
e.ui.answer = 'YES'; e.run('clearSampleDataFromMenu()'); r = all(e); assert.deepStrictEqual([r.items.length, Object.keys(r.audits).length, r.requests.length], [0, 0, 0]); ok('예제 품목 + 체험 기록(실사 기록·청구서)을 한 번에 삭제');
assert.strictEqual(e.sheet('품목 마스터').d[0][8], e.run('MASTER_STATUS_FORMULA')); assert.strictEqual(e.sheet('품목 마스터').d[0][2], '품목명'); assert.strictEqual(e.sheet('물품 청구서').d[0][0], '청구번호'); ok('머리글과 상태 자동 수식은 그대로 남음');
e.post({ action: 'itemAdd', dept: '병동', cat: '소모품', name: '내 첫 품목', par: 5, stock: 1 }); assert.strictEqual(e.sheet('품목 마스터').d[1][2], '내 첫 품목'); assert.strictEqual(all(e).items[0].id, 1); ok('지운 뒤 첫 품목은 2행·번호 1부터 시작');

// ---- 시간대 / 거친 입력 / 성능 ----
e = fresh({ sheetTz: 'Asia/Seoul' }); e.run('loadSampleData()'); e.seen.tz.length = 0; e.post({ action: 'requestCreate', dept: '병동', items: [reqItems[0]] });
assert(e.seen.tz.length > 0 && e.seen.tz.every(t => t === 'Asia/Seoul')); ok('날짜는 스프레드시트 시간대(Asia/Seoul)를 따름 — 스크립트 기본 시간대(LA)가 아님');
e = sample(); const call = js => { try { return JSON.parse(e.run(js).s); } catch (x) { return { THREW: String(x.message || x) }; } };
for (const [name, js] of [['doGet 인자 없음', 'doGet()'], ['doGet 빈 객체', 'doGet({})'], ['doPost 인자 없음', 'doPost()'], ['doPost 본문 없음', 'doPost({})'], ['doPost 깨진 JSON', 'doPost({postData:{contents:"{not json"}})'], ['doPost null', 'doPost({postData:{contents:"null"}})'],
  ['auditSubmit updates 문자열', 'doPost({postData:{contents:JSON.stringify({action:"auditSubmit",dept:"병동",updates:"abc"})}})'], ['itemUpdate id 없음', 'doPost({postData:{contents:JSON.stringify({action:"itemUpdate"})}})'], ['itemDelete id 없음', 'doPost({postData:{contents:JSON.stringify({action:"itemDelete"})}})']]) {
  const x = call(js); assert(!x.THREW, name + ' → 예외로 죽음: ' + x.THREW); if (name.startsWith('auditSubmit')) assert.strictEqual(x.success, true); else assert.strictEqual(x.success, false, name + ' → ' + JSON.stringify(x)); }
assert.strictEqual(all(e).items.length, 15); ok('잘못된 요청 9종에도 서버가 죽지 않고 JSON 으로 응답, 데이터는 그대로');
assert(e.post({ action: 'bogus' }).success === false && e.get('bogus').success === false); ok('잘못된 action 거부');
e = fresh(); e.run('setupSheets()'); const big = []; for (let i = 1; i <= 300; i++) big.push(['병동', '소모품', '품목' + i, 'EA', 10, 3, '']); e.paste('품목 마스터', 2, big);
r = all(e).items; assert.strictEqual(r.length, 300); assert.strictEqual(new Set(r.map(i => i.id)).size, 300);
Object.keys(e.calls).forEach(k => e.calls[k] = 0);
r = e.post({ action: 'auditSubmit', dept: '병동', updates: r.map(i => ({ id: i.id, name: i.name, stock: 8 })) });
assert(r.success && r.data.changed === 300); assert.strictEqual(e.calls.setValue, 0); assert(e.calls.getRange < 20, 'getRange 호출 ' + e.calls.getRange);
assert.strictEqual(all(e).items.filter(i => i.stock === 8).length, 300); ok(`품목 300개 실사 저장도 일괄 처리 (한 칸씩 쓰기 0회, 시트 호출 ${e.calls.getRange}회) — 붙여넣은 300줄에 번호도 한 번에 부여`);

console.log('\n전체 ' + n + '개 통과');
