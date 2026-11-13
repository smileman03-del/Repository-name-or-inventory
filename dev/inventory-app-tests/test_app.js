// 프로 앱(index.html) 4개 화면 + 백엔드 연동 시험 (실제 브라우저, 한국 시간대, 모바일 크기)
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const createEnv = require('./gs_mock');
const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
const html = fs.readFileSync(PKG + '/index.html', 'utf8');
const URL_ = 'https://mock.local/exec';
const online = html.replace('"SCRIPT_URL_HERE"', '"' + URL_ + '"');
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');

// 한국 날짜 계산 (앱과 같은 기준)
const ymdKR = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const addDaysStr = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const today = ymdKR(new Date());
const dot = s => s.replace(/-/g, '.');

let env, down = false;
function newEnv() { env = createEnv(PKG + '/Code.gs'); env.run('loadSampleData()'); down = false; }
const all = () => env.get('getAll').data;
const item = nm => all().items.find(i => i.name === nm);

(async () => {
  const b = await chromium.launch(); const pageErrs = [], consoleErrs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await ctx.route('https://mock.local/**', async r => {
    if (down) return r.abort();
    const q = r.request(); let body;
    if (q.method() === 'POST') body = env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
    else body = env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
  });
  async function open(h = online) {
    const p = await ctx.newPage(); p.dialogs = []; p.answer = true;
    p.on('dialog', d => { p.dialogs.push(d.message()); p.answer ? d.accept() : d.dismiss(); });
    p.on('pageerror', e => pageErrs.push(e.message)); p.on('console', m => m.type() === 'error' && consoleErrs.push(m.text()));
    await p.setContent(h, { waitUntil: 'load' }); await p.waitForTimeout(350); return p;
  }
  const go = async (p, screen) => { await p.click(`.nav-btn[data-screen=${screen}]`); await p.waitForTimeout(60); };
  const toast = p => p.innerText('#toast');
  const texts = (p, sel) => p.locator(sel).allInnerTexts();
  const wait = p => p.waitForTimeout(350);

  newEnv();
  // ===== 연결 / 대시보드 =====
  let p = await open(html);
  assert.strictEqual(await p.innerText('#syncText'), '연결 안 됨'); assert(/SCRIPT_URL/.test(await p.innerText('#main'))); assert.strictEqual(await p.locator('#retryConn').count(), 1); ok('URL 미설정: "연결 안 됨" + SCRIPT_URL 설정 안내 + 다시 연결 버튼');
  await p.close();
  p = await open();
  assert.strictEqual(await p.innerText('#syncText'), '연결됨'); assert.deepStrictEqual((await texts(p, '#deptScroll .dept-chip')), ['전체', '수술실', '처치실', '병동', '물리치료실']); ok('연결됨 + 대분류 칩이 시트 품목에서 자동 생성(전체·수술실·처치실·병동·물리치료실)');
  assert.strictEqual(await p.innerText('.ring-center .num'), '40%'); assert.deepStrictEqual(await texts(p, '.ring-stat-line .v'), ['15', '6', '9']); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 15); assert.strictEqual(await p.locator('#itemListCard .badge.low').count(), 9); ok('대시보드: 정상 비율 40%, 전체15/정상6/부족9, 품목 15줄(부족 배지 9)');
  await p.screenshot({ path: OUT + '/pro_dashboard.png' });
  await p.click('.dept-chip[data-dept=병동]'); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 3); assert.strictEqual(await p.innerText('.ring-center .num'), '67%'); ok('대분류 필터(병동): 3개, 정상 비율 67%로 갱신');
  await p.click('.dept-chip[data-dept=전체]');
  assert.deepStrictEqual((await texts(p, '#catFilter .cat-chip')).sort(), ['문구', '보조기', '소모품', '의약품', '전체']); await p.click('.cat-chip[data-cat=보조기]'); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 1); assert(/무릎 보조기 M/.test(await p.innerText('#itemListCard'))); ok('소분류 필터(보조기): 1개 — 소분류 칩도 시트 데이터에서 생성');
  await p.click('.cat-chip[data-cat=전체]');
  await p.fill('#searchInput', 'vicryl'); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 1); ok('검색은 대소문자 구분 없음("vicryl" → 봉합사 Vicryl 2-0)');
  await p.fill('#searchInput', '');
  await p.evaluate(() => { const i = document.getElementById('searchInput'); i.dispatchEvent(new CompositionEvent('compositionstart')); i.value = '장갑'; i.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })); });
  assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 15); ok('한글 조합 중에는 목록을 다시 그리지 않음');
  await p.evaluate(() => document.getElementById('searchInput').dispatchEvent(new CompositionEvent('compositionend')));
  assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 2); ok('조합 종료 후 검색 반영("장갑" → 2개)');
  await p.close();

  // ===== 재고파악(실사) =====
  p = await open(); await go(p, 'audit');
  assert.strictEqual(await p.locator('[data-d]').count(), 4); ok('재고파악: 실사할 대분류 선택 화면(4개)');
  await p.click('[data-d=처치실]'); await p.waitForTimeout(60);
  assert(/기록 없음/.test(await p.innerText('.audit-banner'))); assert(/실사 후 안내/.test(await p.innerText('.audit-banner'))); assert.strictEqual(await p.locator('.audit-input').count(), 4); ok('실사 기록이 없는 대분류: "기록 없음", 처치실 품목 4개 입력칸');
  const inputOf = nm => p.locator(`.audit-input[data-id="${item(nm).id}"]`);
  assert.strictEqual(+await inputOf('일회용 주사기 5cc').inputValue(), 3); await inputOf('일회용 주사기 5cc').fill('9'); await inputOf('포비돈 용액 500ml').fill('2');
  await p.screenshot({ path: OUT + '/pro_audit.png' });
  await p.click('#saveAudit'); await wait(p);
  const next = dot(addDaysStr(today, 14));
  assert(new RegExp(`처치실 실사 완료 · 2건 변경 · 다음 실사 ${next.replace(/\./g, '\\.')}`).test(await toast(p)), await toast(p)); ok(`실사 저장 → "2건 변경 · 다음 실사 ${next}" (오늘 ${today} + 14일, 한국 시간대에서도 정확)`);
  assert.strictEqual(item('일회용 주사기 5cc').stock, 9); assert.strictEqual(all().audits['처치실'], today); assert(/주사기 5cc 3→9/.test(env.sheet('실사 기록').d[1][3])); ok('시트에 수량·실사일·변경 내역이 기록됨');
  const banner = await p.innerText('.audit-banner'); assert(banner.includes(dot(today)) && banner.includes(next) && !banner.includes('지남')); assert(!(await p.locator('.audit-banner.overdue').count())); ok('저장 직후 배너: 최근 실사일 오늘, 다음 실사 +14일, 지연 아님');
  await p.close();

  // 실사 주기 경계: 딱 14일째는 "지남"이 아니고, 15일째부터 "지남"
  for (const [ago, overdue] of [[13, false], [14, false], [15, true], [40, true]]) {
    env.sheet('실사 기록').d = [env.sheet('실사 기록').d[0], [addDaysStr(today, -ago), '병동', 0, '']];
    p = await open(); await go(p, 'audit'); await p.click('[data-d=병동]'); await p.waitForTimeout(60);
    const cls = await p.locator('.audit-banner.overdue').count(), t = await p.innerText('.audit-banner');
    assert.strictEqual(!!cls, overdue, `${ago}일 전 실사: 지연 판정 오류`); assert.strictEqual(t.includes('(지남)'), overdue);
    assert(t.includes(dot(addDaysStr(today, -ago + 14))), `${ago}일 전 실사: 다음 실사일 표시 오류`); await p.close();
  }
  ok('실사 주기 경계: 13·14일 전은 정상(14일째 당일은 지남 아님), 15·40일 전은 빨간 "(지남)" — 다음 실사일 계산도 정확');

  // 변경 없는 실사도 기록
  newEnv(); p = await open(); await go(p, 'audit'); await p.click('[data-d=병동]'); await p.waitForTimeout(60);
  p.answer = false; await p.click('#saveAudit'); await p.waitForTimeout(150);
  assert(p.dialogs.at(-1).includes('변경 없이') && p.dialogs.at(-1).includes('병동')); assert.deepStrictEqual(all().audits, {}); ok('수량이 그대로면 "변경 없이 실사 완료로 기록할까요?" 확인 → 취소하면 기록 안 함');
  p.answer = true; await p.click('#saveAudit'); await wait(p);
  assert(/병동 실사 완료 · 0건 변경/.test(await toast(p))); assert.strictEqual(all().audits['병동'], today); assert.strictEqual(env.sheet('실사 기록').d[1][2], 0); ok('확인하면 "0건 변경"으로 실사 완료가 기록되어 다음 실사일이 계산됨');
  await p.close();

  // 서버 오류 메시지가 그대로 보이는지
  newEnv(); p = await open(); await go(p, 'audit'); await p.click('[data-d=물리치료실]'); await p.waitForTimeout(60);
  const id13 = item('일회용 베드시트').id, id14 = item('초음파 젤').id;
  env.post({ action: 'itemDelete', id: id13 });
  await p.locator(`.audit-input[data-id="${id13}"]`).fill('99'); await p.locator(`.audit-input[data-id="${id14}"]`).fill('8'); await p.click('#saveAudit'); await wait(p);
  assert(/못 찾은 1개는 저장되지 않았어요/.test(await toast(p))); assert.strictEqual(item('초음파 젤').stock, 8); ok('앱을 켜 둔 사이 시트에서 품목이 지워지면: 나머지는 저장 + "못 찾은 1개는 저장되지 않았어요" 알림');
  env.post({ action: 'itemDelete', id: id14 });
  await p.locator(`.audit-input[data-id="${id14}"]`).fill('3'); await p.click('#saveAudit'); await wait(p);
  assert(/시트에서 찾을 수 없는 품목입니다/.test(await toast(p)), await toast(p)); assert(!/연결을 확인/.test(await toast(p))); ok('전부 못 찾으면 서버의 구체적인 이유("시트에서 찾을 수 없는 품목입니다")를 그대로 표시 — "연결을 확인하세요"라고 오해하게 하지 않음');
  await p.close();

  // ===== 물품청구 =====
  newEnv(); p = await open(); await go(p, 'request');
  assert.deepStrictEqual(await texts(p, '#reqDeptScroll [data-d]'), ['전체', '수술실', '처치실', '병동', '물리치료실']); assert.strictEqual(await p.locator('.req-item').count(), 9); ok('물품청구: 청구 대상 칩 + 부족 품목 9개 자동 표시');
  const gid = nm => item(nm).id;
  assert.strictEqual(+await p.locator(`.reqQty[data-id="${gid('봉합사 Vicryl 2-0')}"]`).inputValue(), 4); ok('기본 청구수량 = 적정 − 현재 (봉합사 6−2=4)');
  await p.locator(`.reqPlus[data-id="${gid('봉합사 Vicryl 2-0')}"]`).click(); await p.locator(`.reqMinus[data-id="${gid('초음파 젤')}"]`).click(); await p.locator(`.reqMinus[data-id="${gid('초음파 젤')}"]`).click();
  assert.strictEqual(+await p.locator(`.reqQty[data-id="${gid('봉합사 Vicryl 2-0')}"]`).inputValue(), 5); assert.strictEqual(+await p.locator(`.reqQty[data-id="${gid('초음파 젤')}"]`).inputValue(), 2); ok('수량 +1 / −2');
  await p.locator(`.reqMinus[data-id="${gid('초음파 젤')}"]`).click(); await p.locator(`.reqMinus[data-id="${gid('초음파 젤')}"]`).click(); await p.locator(`.reqMinus[data-id="${gid('초음파 젤')}"]`).click(); assert.strictEqual(+await p.locator(`.reqQty[data-id="${gid('초음파 젤')}"]`).inputValue(), 1); ok('수량은 1 아래로 내려가지 않음');
  await p.locator(`.reqChk[data-id="${gid('포비돈 용액 500ml')}"]`).uncheck();
  await p.click('#genRequest'); await wait(p);
  assert.strictEqual(await p.locator('.modal-sheet').count(), 1); assert(/전체 물품청구서/.test(await p.innerText('.modal-title'))); assert.strictEqual(await p.locator('.modal-sheet .item-row').count(), 8); assert(!/·/.test((await p.innerText('.modal-sheet .muted')).replace(/\d{4}\.\d{2}\.\d{2}/, '').trim() ? '' : ''));
  await p.screenshot({ path: OUT + '/pro_request_modal.png' });
  let rq = all().requests; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items.length, 8); assert.strictEqual(rq[0].items.find(i => i.name === '봉합사 Vicryl 2-0').qty, 5); assert(!rq[0].items.some(i => i.name === '포비돈 용액 500ml')); ok('청구서 생성 → 모달에 8개 품목, 시트 "물품 청구서"에 조정 수량(5) 반영·해제한 품목 제외');
  await p.click('#printReq'); assert.strictEqual(await p.evaluate(() => window.__printed), 1); ok('"인쇄 / PDF 저장" 버튼이 인쇄(window.print)를 호출');
  await p.click('#closeModal'); assert.strictEqual(await p.locator('.modal-sheet').count(), 0);
  assert.strictEqual(await p.locator('.history-item').count(), 1); assert(/전체 청구서/.test(await p.innerText('.history-item'))); assert(/8개 품목/.test(await p.innerText('.history-item'))); ok('지난 청구 내역에 방금 청구서가 표시됨');
  await p.close(); p = await open(); await go(p, 'request'); assert.strictEqual(await p.locator('.history-item').count(), 1); await p.click('.history-item'); await p.waitForTimeout(80);
  assert.strictEqual(await p.locator('.modal-sheet .item-row').count(), 8); ok('앱을 다시 열어도 청구 내역이 남아 있고, 눌러서 다시 볼 수 있음');
  await p.click('#closeModal'); await p.click('#reqDeptScroll [data-d=병동]'); await p.waitForTimeout(60);
  assert.strictEqual(await p.locator('.req-item').count(), 1); await p.click('#genRequest'); await wait(p); assert.strictEqual(all().requests.at(-1).dept, '병동'); assert.strictEqual(all().requests.at(-1).items.length, 1); ok('대분류별 청구(병동): 병동 부족 품목만 청구되고 청구 대상 "병동"으로 기록');
  await p.close();
  newEnv(); { const x = env; x.run('clearSampleData_()'); }
  // 빈 시트에서도 깨지지 않는지
  p = await open(); assert.strictEqual(await p.innerText('#syncText'), '연결됨'); assert(/등록된 품목이 없어요/.test(await p.innerText('#itemListCard')));
  await go(p, 'audit'); assert(/등록된 품목이 없어요/.test(await p.innerText('#main'))); await go(p, 'request'); assert(/재고 부족 품목이 없어요/.test(await p.innerText('#main'))); await go(p, 'manage'); assert(/등록된 품목이 없어요/.test(await p.innerText('#main'))); ok('품목이 하나도 없는 빈 시트에서도 4개 화면 모두 안내 문구가 나오고 오류 없음');
  await p.close();

  // ===== 품목관리 =====
  newEnv(); p = await open(); await go(p, 'manage');
  assert.strictEqual(await p.locator('.manage-item').count(), 15); await p.screenshot({ path: OUT + '/pro_manage.png' });
  await p.click('#addItemBtn'); await p.waitForTimeout(60);
  await p.fill('#fName', ''); await p.click('#saveItem'); assert(/품목명을 입력해주세요/.test(await toast(p))); assert.strictEqual(await p.locator('.modal-sheet').count(), 1);
  await p.fill('#fName', 'UI추가품목'); await p.fill('#fDept', ''); await p.click('#saveItem'); assert(/대분류\(부서\)를 입력해주세요/.test(await toast(p))); assert.strictEqual(all().items.length, 15); ok('품목 추가 모달: 품목명·대분류가 비면 저장하지 않고 안내(모달 유지)');
  assert.deepStrictEqual((await p.locator('#deptList option').evaluateAll(o => o.map(x => x.value))), ['수술실', '처치실', '병동', '물리치료실']); assert((await p.locator('#catList option').evaluateAll(o => o.map(x => x.value))).includes('의약품')); ok('대분류·소분류 입력칸에 기존 값이 자동완성 목록으로 제공됨');
  await p.fill('#fDept', '신규부서'); await p.fill('#fCat', '새분류'); await p.fill('#fSpec', 'EA'); await p.fill('#fPar', '10'); await p.fill('#fStock', '2'); await p.fill('#fMemo', '메모내용'); await p.click('#saveItem'); await wait(p);
  assert(/품목이 추가됐어요/.test(await toast(p))); assert.deepStrictEqual(item('UI추가품목'), { id: 16, dept: '신규부서', cat: '새분류', name: 'UI추가품목', spec: 'EA', par: 10, stock: 2, memo: '메모내용' }); ok('새 대분류·소분류를 직접 입력해 품목 추가 → 시트에 번호 16으로 기록');
  assert((await texts(p, '#deptScroll .dept-chip')).includes('신규부서')); ok('새 대분류가 상단 칩에 즉시 나타남');
  await p.click('.dept-chip[data-dept=신규부서]'); assert.strictEqual(await p.locator('.manage-item').count(), 1);
  await p.click('.manage-item .editBtn'); await p.waitForTimeout(60); assert.strictEqual(await p.inputValue('#fName'), 'UI추가품목'); assert.strictEqual(await p.inputValue('#fMemo'), '메모내용'); assert.strictEqual(await p.locator('#fStock').count(), 0);
  await p.fill('#fName', 'UI수정품목'); await p.fill('#fPar', '7'); await p.click('#saveItem'); await wait(p); assert(/품목이 수정됐어요/.test(await toast(p))); assert.strictEqual(item('UI수정품목').par, 7); assert.strictEqual(item('UI수정품목').stock, 2); ok('품목 수정: 기존 값이 채워져 열리고(초기재고 칸 없음), 수정이 시트에 반영(재고는 유지)');
  await p.fill('.parInput', '12'); await p.locator('.parInput').dispatchEvent('change'); await wait(p); assert.strictEqual(item('UI수정품목').par, 12); assert(/UI수정품목 적정재고 12로 변경/.test(await toast(p)));
  await p.fill('.stockInput', '30'); await p.locator('.stockInput').dispatchEvent('change'); await wait(p); assert.strictEqual(item('UI수정품목').stock, 30); ok('목록에서 적정재고·현재고를 바로 고치면 시트에 반영(안내 표시)');
  p.answer = false; await p.click('.manage-item .delBtn'); await p.waitForTimeout(80); assert(p.dialogs.at(-1).includes('UI수정품목') && p.dialogs.at(-1).includes('삭제')); assert(item('UI수정품목')); ok('삭제 확인창에서 취소하면 유지');
  p.answer = true; await p.click('.manage-item .delBtn'); await wait(p); assert(!item('UI수정품목')); assert(!(await texts(p, '#deptScroll .dept-chip')).includes('신규부서')); ok('삭제 확인 → 시트에서도 삭제, 비어 버린 대분류 칩도 사라짐');
  await p.click('.dept-chip[data-dept=전체]'); await p.click('#bulkCatBtn'); await p.waitForTimeout(60);
  await p.selectOption('#bDept', '수술실'); await p.fill('#bCat', '의약품'); await p.fill('#bNames', '멸균 수술장갑\n없는이름'); await p.click('#applyBulk'); await wait(p);
  assert(/2개 변경, 1개는 못 찾았어요: 없는이름/.test(await toast(p)), await toast(p)); assert.strictEqual(item('멸균 수술장갑 7.0').cat, '의약품'); assert.strictEqual(item('멸균 수술장갑 7.5').cat, '의약품'); assert.strictEqual(item('일회용 수술가운').cat, '소모품'); ok('소분류 일괄 변경: 앞부분이 같은 2개만 바뀌고, 못 찾은 이름은 알려줌');
  await p.close();

  // ===== 연결 끊김 / 복구 =====
  newEnv(); p = await open(); down = true; await p.click('.nav-btn[data-screen=manage]'); await p.click('#addItemBtn'); await p.waitForTimeout(60);
  await p.fill('#fName', '끊김중'); await p.fill('#fDept', '병동'); await p.click('#saveItem'); await wait(p); assert(/구글시트 연결을 확인해주세요/.test(await toast(p))); assert.strictEqual(all().items.length, 15); ok('연결이 끊긴 상태에서 저장하면 "연결을 확인해주세요"(네트워크 오류는 일반 안내) + 시트는 그대로');
  await p.close(); p = await open(); assert.strictEqual(await p.innerText('#syncText'), '연결 실패'); assert(/구글시트에 연결할 수 없어요/.test(await p.innerText('#main'))); ok('앱을 열 때 서버가 안 되면 "연결 실패" + 원인 안내 화면');
  down = false; await p.click('#retryConn'); await wait(p); assert.strictEqual(await p.innerText('#syncText'), '연결됨'); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 15); ok('"다시 연결 시도"를 누르면 복구되어 정상 화면으로');
  await p.close();

  // ===== 설정값(병원 이름·실사 주기) =====
  newEnv(); p = await open(online.replace('const ORG_NAME = "";', 'const ORG_NAME = "테스트병원";').replace('const AUDIT_INTERVAL_DAYS = 14;', 'const AUDIT_INTERVAL_DAYS = 7;'));
  assert.strictEqual(await p.title(), '테스트병원 재고관리'); assert.strictEqual(await p.innerText('#brandName'), '테스트병원 재고관리'); ok('ORG_NAME 설정 → 화면 제목·머리글에 병원 이름 표시');
  await go(p, 'audit'); await p.click('[data-d=병동]'); await p.waitForTimeout(60); assert(/7일 후로 설정돼요/.test(await p.innerText('main'))); await p.click('#saveAudit'); await wait(p);
  assert(new RegExp(dot(addDaysStr(today, 7)).replace(/\./g, '\\.')).test(await toast(p))); ok('AUDIT_INTERVAL_DAYS=7 → 다음 실사일이 7일 후로 계산되고 안내 문구도 바뀜');
  await go(p, 'request'); await p.click('#genRequest'); await wait(p); assert(/· 테스트병원/.test(await p.innerText('.modal-sheet .muted'))); ok('청구서(인쇄용)에 설정한 병원 이름이 표시됨');
  await p.close();
  const orgDefault = await open(); await go(orgDefault, 'request'); await orgDefault.click('#genRequest'); await wait(orgDefault); assert(!(await orgDefault.innerText('.modal-sheet .muted')).includes('·')); ok('ORG_NAME을 비워 두면 청구서에 병원 이름 줄이 나오지 않음(기본값)'); await orgDefault.close();

  assert.deepStrictEqual(pageErrs, []);   // 스크립트 오류(예외)는 단 하나도 없어야 한다
  // 콘솔 기록은 이 시험이 일부러 일으킨 실패(서버 거부·연결 끊김)에 대한 것만 허용한다
  const expected = /시트에서 찾을 수 없는 품목입니다|Failed to fetch|load error|Failed to load resource|net::ERR/;
  assert.deepStrictEqual(consoleErrs.filter(e => !expected.test(e)), []); ok('스크립트 오류 0건, 콘솔 기록은 시험이 일부러 일으킨 실패(서버 거부·연결 끊김)뿐');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
