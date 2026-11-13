// 입고 화면 + 새 디자인 기능 시험 (실제 브라우저, 한국 시간대)
const fs = require('fs'), assert = require('assert'); const { chromium } = require('playwright');
const createEnv = require('./gs_mock'); const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
const html = fs.readFileSync(PKG + '/index.html', 'utf8').replace('"SCRIPT_URL_HERE"', '"https://mock.local/exec"');
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const ymdKR = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const addDaysStr = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const today = ymdKR(new Date());
let env; const fresh = () => { env = createEnv(PKG + '/Code.gs'); env.run('loadSampleData()'); };
const all = () => env.get('getAll').data; const item = nm => all().items.find(i => i.name === nm);

(async () => {
  const b = await chromium.launch(); const pageErrs = [], consoleErrs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await ctx.route('https://mock.local/**', async r => { const q = r.request(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: q.method() === 'POST' ? env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s : env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s }); });
  async function open() { const p = await ctx.newPage(); p.dialogs = []; p.answer = true; p.on('dialog', d => { p.dialogs.push(d.message()); p.answer ? d.accept() : d.dismiss(); }); p.on('pageerror', e => pageErrs.push(e.message)); p.on('console', m => m.type() === 'error' && consoleErrs.push(m.text())); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(350); return p; }
  const go = async (p, s) => { await p.click(`.nav-btn[data-screen=${s}]`); await p.waitForTimeout(90); };
  const wait = p => p.waitForTimeout(400);
  const toast = p => p.innerText('#toast');
  const idOf = nm => item(nm).id;
  const mkReq = (dept, names) => env.post({ action: 'requestCreate', dept, items: names.map(nm => { const i = item(nm); return { id: i.id, name: i.name, spec: i.spec, dept: i.dept, cat: i.cat, stock: i.stock, par: i.par, qty: i.par - i.stock }; }) }).data.id;

  // ===== 메뉴 구성 / 빈 입고 화면 =====
  fresh(); let p = await open();
  assert.deepStrictEqual(await p.locator('.nav-btn span').allInnerTexts(), ['재고현황', '물품청구', '입고', '재고파악', '품목관리']); ok('하단 메뉴 5개(재고현황·물품청구·입고·재고파악·품목관리)');
  assert.strictEqual(await p.locator('.nav-btn[data-screen=receive][data-badge]').count(), 0); await go(p, 'receive');
  assert(/입고를 기다리는 청구서가 없어요/.test(await p.innerText('#main'))); assert.strictEqual(await p.locator('.seg-btn.on').innerText(), '청구서 기준'); assert(/기록된 입고가 없어요/.test(await p.innerText('#main'))); ok('입고 화면: 기본은 "청구서 기준", 대기 청구서·입고 내역이 없을 때 안내 문구');
  await p.close();

  // ===== 청구서 기준 입고 =====
  fresh(); const rid = mkReq('전체', ['멸균 수술장갑 7.0', '일회용 주사기 5cc', '봉합사 Vicryl 2-0', '초음파 젤']);
  p = await open();
  assert.strictEqual(await p.locator('.nav-btn[data-screen=receive]').getAttribute('data-badge'), '1'); ok('입고 대기 청구서가 있으면 메뉴의 "입고"에 개수 배지(1)가 뜸');
  await go(p, 'receive'); assert.strictEqual(await p.locator('.pending-card').count(), 1); const card = await p.innerText('.pending-card'); assert(/전체 청구서/.test(card) && /4개 품목 · 입고 0\/4/.test(card) && /입고 전/.test(card)); ok('대기 청구서 카드: "전체 청구서 · 4개 품목 · 입고 0/4 · 입고 전"');
  await p.screenshot({ path: OUT + '/after_5_receive_list.png' });
  await p.click('.pending-card'); await p.waitForTimeout(100);
  assert.strictEqual(await p.locator('.rcv-row').count(), 4); assert.strictEqual(+await p.locator(`.rcvQty[data-id="${idOf('멸균 수술장갑 7.0')}"]`).inputValue(), 6); assert.strictEqual(+await p.locator(`.rcvQty[data-id="${idOf('봉합사 Vicryl 2-0')}"]`).inputValue(), 4);
  assert(/남음 6/.test(await p.locator('.rcv-row').first().innerText())); assert(/4개 품목/.test(await p.innerText('#saveReceive'))); ok('청구서를 열면 품목별 입고 수량이 "남은 수량"으로 미리 채워져 있음(6·4…), 저장 버튼에 "4개 품목"');
  await p.screenshot({ path: OUT + '/after_6_receive_detail.png' });
  await p.locator(`.rcvQty[data-id="${idOf('멸균 수술장갑 7.0')}"]`).fill('4'); await p.locator(`.rcvQty[data-id="${idOf('일회용 주사기 5cc')}"]`).fill('0'); await p.locator(`.stp-minus[data-for="${idOf('봉합사 Vicryl 2-0')}"]`).click();
  assert(/3개 품목/.test(await p.innerText('#saveReceive'))); ok('수량을 고치거나 0으로 두면 저장 버튼의 품목 수가 바로 바뀜(4→3), 스테퍼 −로 4→3');
  await p.fill('#rcvMemo', '○○상사 11/4 납품'); await p.click('#saveReceive'); await wait(p);
  assert(/입고 완료 · 3개 품목 · 재고에 반영했어요/.test(await toast(p)), await toast(p));
  assert.strictEqual(item('멸균 수술장갑 7.0').stock, 8); assert.strictEqual(item('봉합사 Vicryl 2-0').stock, 5); assert.strictEqual(item('일회용 주사기 5cc').stock, 3); assert.strictEqual(item('초음파 젤').stock, 6); ok('입고 저장 → 재고가 더해짐(4+4=8, 2+3=5), 수량 0인 품목은 그대로');
  assert.strictEqual(all().requests[0].status, 'partial'); assert.strictEqual(all().receipts[0].memo, '○○상사 11/4 납품'); assert.strictEqual(all().receipts[0].requestId, rid); ok('청구서가 "일부 입고"가 되고 입고 기록에 메모·청구번호가 남음');
  assert.strictEqual(await p.locator('.rcv-row').count(), 4); const first = await p.locator('.rcv-row').first().innerText(); assert(/청구 6 · 입고됨 4 · 남음 2/.test(first), first); ok('같은 청구서를 계속 열어 둔 채로 "청구 6 · 입고됨 4 · 남음 2"로 갱신됨(나눠 입고 가능)');
  await p.click('#rcvAllBtn'); assert.strictEqual(+await p.locator(`.rcvQty[data-id="${idOf('멸균 수술장갑 7.0')}"]`).inputValue(), 2); assert.strictEqual(+await p.locator(`.rcvQty[data-id="${idOf('일회용 주사기 5cc')}"]`).inputValue(), 5); ok('"남은 수량 전부 입고로 채우기"로 남은 수량을 한 번에 입력');
  await p.click('#saveReceive'); await wait(p);
  assert.strictEqual(all().requests[0].status, 'done'); assert.strictEqual(await p.locator('.pending-card').count(), 0); assert(/입고를 기다리는 청구서가 없어요/.test(await p.innerText('#main'))); assert.strictEqual(await p.locator('.nav-btn[data-screen=receive][data-badge]').count(), 0); ok('남은 것을 모두 입고하면 "입고 완료"가 되어 대기 목록으로 돌아가고 메뉴 배지도 사라짐');
  assert.strictEqual(await p.locator('.history-item[data-rcid]').count(), 2); await p.locator('.history-item[data-rcid]').first().click(); await p.waitForTimeout(100); const rcText = await p.innerText('.modal-sheet'); assert(/재고 \d+ → \d+/.test(rcText) && /입고수량/.test(rcText)); await p.screenshot({ path: OUT + '/after_7_receipt_modal.png' }); ok('지난 입고 내역 2건, 눌러 보면 "재고 3 → 8"처럼 입고 전·후 재고를 확인');
  await p.click('#closeModal'); await p.close();

  // ===== 청구서 화면에서 바로 입고 =====
  fresh(); const rid2 = mkReq('병동', ['탄력붕대 4인치']); p = await open(); await go(p, 'request');
  assert(/입고 전/.test(await p.innerText('.history-item'))); await p.click('.history-item'); await p.waitForTimeout(120);
  assert.strictEqual(await p.locator('#goReceive').count(), 1); await p.click('#goReceive'); await p.waitForTimeout(150);
  assert.strictEqual(await p.locator('.nav-btn.active').getAttribute('data-screen'), 'receive'); assert.strictEqual(+await p.locator(`.rcvQty[data-id="${idOf('탄력붕대 4인치')}"]`).inputValue(), 19); ok('청구서 상세의 "입고하기" → 입고 화면의 그 청구서로 바로 이동, 수량 미리 채워짐');
  await p.click('#saveReceive'); await wait(p); await go(p, 'request'); assert(/입고 완료/.test(await p.innerText('.history-item'))); await p.click('.history-item'); await p.waitForTimeout(120);
  assert.strictEqual(await p.locator('#goReceive').count(), 0); assert(/입고 19\/19/.test(await p.innerText('.modal-sheet'))); ok('입고 완료 후 청구 내역에 "입고 완료" 표시, 청구서 상세에는 품목별 "입고 19/19"이고 입고하기 버튼은 없어짐');
  await p.close();

  // ===== 직접 입고 =====
  fresh(); p = await open(); await go(p, 'receive'); await p.click('.seg-btn[data-mode=direct]'); await p.waitForTimeout(100);
  assert.strictEqual(await p.locator('.rcv-row').count(), 15); assert(await p.locator('#saveReceive').isDisabled()); ok('직접 입고: 전체 품목이 나열되고 수량이 없으면 저장 버튼이 비활성');
  await p.click('.dept-chip[data-dept=병동]'); await p.waitForTimeout(100); assert.strictEqual(await p.locator('.rcv-row').count(), 3); ok('상단 부서 칩(병동)으로 직접 입고 목록을 좁힘');
  await p.fill('#searchInput', '붕대'); assert.strictEqual(await p.locator('.rcv-row').count(), 1); ok('직접 입고에서도 검색 가능(붕대 → 1개)');
  const sid = idOf('탄력붕대 4인치'); await p.locator(`.stp-plus[data-for="${sid}"]`).click(); await p.locator(`.stp-plus[data-for="${sid}"]`).click(); await p.locator(`.stp-plus[data-for="${sid}"]`).click(); await p.fill('#rcvMemo', '긴급 구매');
  assert.strictEqual(+await p.locator(`.rcvQty[data-id="${sid}"]`).inputValue(), 3); assert(/1개 품목/.test(await p.innerText('#saveReceive'))); await p.click('#saveReceive'); await wait(p);
  assert.strictEqual(item('탄력붕대 4인치').stock, 14); assert.strictEqual(all().receipts[0].requestId, ''); assert.strictEqual(all().receipts[0].memo, '긴급 구매'); assert(/입고 완료 · 1개 품목/.test(await toast(p))); ok('스테퍼 +3 → 직접 입고 저장: 재고 11→14, 청구서 연결 없이 메모만 기록');
  assert.strictEqual(await p.locator('.rcv-row .rcv-meta b').first().innerText(), '14'); ok('저장 후 목록의 "현재 14"가 즉시 갱신됨');
  await p.close();

  // ===== 서버 이유 그대로 표시 =====
  fresh(); const rid3 = mkReq('전체', ['초음파 젤']); p = await open(); await go(p, 'receive'); await p.click('.pending-card'); await p.waitForTimeout(100);
  env.post({ action: 'itemDelete', id: idOf('초음파 젤') }); await p.click('#saveReceive'); await wait(p);
  assert(/시트에서 찾을 수 없는 품목입니다/.test(await toast(p)), await toast(p)); ok('입고하려는 품목이 시트에서 지워졌으면 서버의 구체적 이유를 그대로 알림(재고·기록 변화 없음)');
  assert.strictEqual(all().receipts.length, 0); await p.close();

  // ===== 대시보드 새 기능 =====
  fresh(); p = await open();
  assert.strictEqual(await p.locator('.hero-cta').count(), 1); assert(/부족 9개 청구하러 가기/.test(await p.innerText('.hero-cta'))); await p.click('.hero-cta'); await p.waitForTimeout(100); assert.strictEqual(await p.locator('.nav-btn.active').getAttribute('data-screen'), 'request'); ok('대시보드 "부족 9개 청구하러 가기" 버튼 → 물품청구 화면으로 이동');
  mkReq('전체', ['초음파 젤']); await p.close(); p = await open(); assert(/입고 대기 1건/.test(await p.innerText('.hero-chip'))); await p.click('.hero-chip'); await p.waitForTimeout(100); assert.strictEqual(await p.locator('.nav-btn.active').getAttribute('data-screen'), 'receive'); ok('"입고 대기 1건" 칩 → 입고 화면으로 이동');
  await go(p, 'dashboard');
  assert.strictEqual(await p.locator('.dept-chip[data-dept=수술실]').getAttribute('data-low'), '4'); assert.strictEqual(await p.locator('.dept-chip[data-dept=전체]').getAttribute('data-low'), '9'); const bubble = await p.locator('.dept-chip[data-dept=수술실]').evaluate(e => getComputedStyle(e, '::after').content); assert.strictEqual(bubble, '"4"'); assert.strictEqual((await p.locator('.dept-chip[data-dept=수술실]').innerText()).trim(), '수술실'); ok('부서 칩에 부족 개수 배지(수술실 4, 전체 9)가 표시되고, 칩의 글자 자체는 그대로');
  await p.click('#lowOnlyBtn'); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 9); assert.strictEqual(await p.locator('#itemListCard .badge.ok').count(), 0); assert.strictEqual(await p.locator('#lowOnlyBtn').getAttribute('aria-pressed'), 'true'); ok('"부족만" 토글: 부족 9개만 표시');
  await p.click('.dept-chip[data-dept=병동]'); await p.click('.cat-chip[data-cat=문구]'); assert(/조건에 맞는 품목이 없어요|부족한 품목이 없어요/.test(await p.innerText('#itemListCard'))); await p.click('#lowOnlyBtn'); await p.click('.cat-chip[data-cat=전체]'); await p.click('.dept-chip[data-dept=전체]'); ok('부족만 + 필터 조합에서 결과가 없으면 안내 문구');
  const gauges = await p.locator('#itemListCard .item-row').evaluateAll(rs => rs.map(r => ({ low: r.classList.contains('low'), w: parseFloat(r.querySelector('.gauge i').style.width) })));
  assert(gauges.every(g => g.w >= 3 && g.w <= 100) && gauges.filter(g => g.low).every(g => g.w < 100)); const full = gauges.find(g => !g.low); assert(full); ok('품목별 재고 게이지: 부족한 품목은 100% 미만, 정상은 채워진 막대(최소 3%·최대 100% 범위)');
  await p.locator('.item-row', { hasText: '봉합사' }).scrollIntoViewIfNeeded(); assert(/유효기간 확인/.test(await p.locator('.item-row', { hasText: '봉합사' }).innerText())); ok('품목 메모(예: "유효기간 확인")가 현황 목록에 표시됨');
  await p.close();

  // ===== 재고파악 개선 =====
  fresh(); env.sheet('실사 기록').d = [env.sheet('실사 기록').d[0], [addDaysStr(today, -20), '수술실', 0, ''], [addDaysStr(today, -12), '처치실', 0, ''], [today, '병동', 0, '']];
  p = await open(); await go(p, 'audit'); const cards = await p.locator('.dept-card').allInnerTexts();
  assert(/6일 지남/.test(cards[0]) && /오늘 이후|D-2/.test(cards[1]) && /D-14/.test(cards[2]) && /미실시/.test(cards[3]), cards.join(' | ')); await p.screenshot({ path: OUT + '/after_8_audit_select.png' }); ok('재고파악 부서 카드: 수술실 "6일 지남"(빨강) / 처치실 "D-2"(곧) / 병동 "D-14" / 물리치료실 "미실시"');
  await p.click('[data-d=처치실]'); await p.waitForTimeout(100);
  const aid = idOf('일회용 주사기 5cc'); assert.strictEqual(await p.locator('.audit-row.changed').count(), 0); assert(/변경 없음/.test(await p.innerText('#saveAudit')));
  await p.locator(`.stp-plus[data-for="${aid}"]`).click(); await p.locator(`.stp-plus[data-for="${aid}"]`).click(); await p.locator(`.audit-input[data-id="${idOf('포비돈 용액 500ml')}"]`).fill('1');
  assert.strictEqual(await p.locator('.audit-row.changed').count(), 2); const deltas = await p.locator('.audit-row .delta').allInnerTexts(); assert(deltas.includes('+2') && deltas.includes('−3'), deltas.join(',')); assert(/2건 변경/.test(await p.innerText('#saveAudit'))); await p.screenshot({ path: OUT + '/after_2_audit.png' }); ok('수량을 바꾸면 바뀐 줄이 강조되고 증감(+2 / −3)이 보이며, 저장 버튼에 "2건 변경"이 실시간 표시됨');
  await p.locator(`.stp-minus[data-for="${aid}"]`).click(); await p.locator(`.stp-minus[data-for="${aid}"]`).click(); await p.locator(`.audit-input[data-id="${idOf('포비돈 용액 500ml')}"]`).fill('4'); assert.strictEqual(await p.locator('.audit-row.changed').count(), 0); assert(/변경 없음/.test(await p.innerText('#saveAudit'))); ok('원래 값으로 되돌리면 강조와 변경 건수가 사라짐');
  await p.close();

  assert.deepStrictEqual(pageErrs, []);
  assert.deepStrictEqual(consoleErrs.filter(e => !/시트에서 찾을 수 없는 품목입니다|Failed to fetch|Failed to load resource|net::ERR/.test(e)), []); ok('스크립트 오류 0건 (콘솔 기록은 시험이 일부러 일으킨 서버 거부뿐)');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
