// 신규 구매자 전체 흐름 시험: 새 구글 시트(빈 "시트1" 포함)에서 설명서대로 처음부터 끝까지
const fs = require('fs'), assert = require('assert');
const { chromium } = require('playwright');
const createEnv = require('./gs_mock');
const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const URL_ = 'https://script.google.com/macros/s/FAKE_BUYER_DEPLOY_ID_123456/exec';
// 설명서 4단계: 메모장 "모두 바꾸기"로 SCRIPT_URL_HERE 를 구글이 발급한 URL로 교체
const html = fs.readFileSync(PKG + '/index.html', 'utf8').split('SCRIPT_URL_HERE').join(URL_);
const ymdKR = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const today = ymdKR(new Date());

(async () => {
  // 1단계: 새 구글 시트 + Apps Script 에 Code.gs 붙여넣기 → setupSheets 실행
  const env = createEnv(PKG + '/Code.gs');   // 빈 기본 시트("시트1") 포함, ARRAYFORMULA 때문에 getLastRow 가 맨 아래로 보고되는 최악의 환경
  const all = () => env.get('getAll').data;
  env.run('onOpen()'); env.run('setupSheets()');
  assert.deepStrictEqual(env.sheets.map(s => s.name), ['품목 마스터', '실사 기록', '물품 청구서', '입고 기록']); ok('① setupSheets 한 번으로 탭 4개 완성(탭 이름 확인 불필요), 빈 기본 시트 정리');

  const b = await chromium.launch(); const pageErrs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await ctx.route(URL_ + '**', async r => {
    const q = r.request(); let body;
    if (q.method() === 'POST') body = env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
    else body = env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
  });
  async function open() { const p = await ctx.newPage(); p.dialogs = []; p.on('dialog', d => { p.dialogs.push(d.message()); d.accept(); }); p.on('pageerror', e => pageErrs.push(e.message)); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(350); return p; }
  const go = async (p, s) => { await p.click(`.nav-btn[data-screen=${s}]`); await p.waitForTimeout(60); };
  const wait = p => p.waitForTimeout(350);

  // 빈 상태에서 앱을 열어도 깨지지 않아야 한다
  let p = await open();
  assert.strictEqual(await p.innerText('#syncText'), '연결됨'); assert(/등록된 품목이 없어요/.test(await p.innerText('#itemListCard')));
  for (const s of ['audit', 'request', 'manage']) { await go(p, s); assert((await p.innerText('#main')).length > 0); } ok('② 품목이 하나도 없는 빈 상태에서도 연결되고 4개 화면 모두 안내 문구 표시');
  // 빈 상태에서 앱으로 첫 품목 추가 (품목관리 → 새 품목 추가, 대분류를 직접 입력)
  await p.click('#addItemBtn'); await p.waitForTimeout(60); await p.fill('#fDept', 'A구역'); await p.fill('#fCat', '재료'); await p.fill('#fName', '첫 품목'); await p.fill('#fPar', '10'); await p.fill('#fStock', '3'); await p.click('#saveItem'); await wait(p);
  assert.deepStrictEqual(all().items.map(i => [i.id, i.dept, i.name]), [[1, 'A구역', '첫 품목']]); assert.strictEqual(env.sheet('품목 마스터').d[1][7], 1); ok('③ 빈 시트에서 앱으로 첫 품목 추가 → 번호 1, 시트 2행에 기록(대분류를 직접 입력해 새로 만듦)');
  await p.close();
  assert.throws(() => env.run('clearSampleData_()'), /예제가 아닌 품목/); ok('   예제가 아닌 내 품목이 있으면 "예제 지우기"는 아무것도 지우지 않음');
  env.sheet('품목 마스터').d.splice(1, 1);   // 시험 계속을 위해 직접 지움

  // 2단계: 예제로 체험
  env.run('loadSampleData()');
  p = await open(); assert.deepStrictEqual(await p.locator('.ring-stat-line .v').allInnerTexts(), ['15', '6', '9']); ok('④ 예제 15개로 체험 시작 (전체15/정상6/부족9)');
  await go(p, 'audit'); await p.click('[data-d=병동]'); await p.waitForTimeout(60); await p.click('#saveAudit'); await wait(p);   // 변경 없이 실사 완료
  await go(p, 'request'); await p.click('#genRequest'); await wait(p); await p.click('#closeModal');
  assert.strictEqual(all().requests.length, 1); assert.strictEqual(all().audits['병동'], today); ok('⑤ 체험: 실사 완료 1건 + 청구서 1건 생성 성공');
  await p.close();

  // 3단계: 예제 지우기 → 자기 병원 품목을 엑셀에서 복사해 A~G열에 붙여넣기
  env.ui.answer = 'YES'; env.run('clearSampleDataFromMenu()'); assert(/지웠습니다/.test(env.alerts.at(-1)));
  let r = all(); assert.deepStrictEqual([r.items.length, Object.keys(r.audits).length, r.requests.length], [0, 0, 0]); ok('⑥ 메뉴 "예제 데이터 지우기": 예제와 체험 기록이 모두 사라지고 머리글·수식은 유지');
  env.paste('품목 마스터', 2, [
    ['A구역', '재료', '멸균거즈 10x10', 'Pack', 30, 12, ''], ['A구역', '재료', '일회용 장갑 M', 'Box', 20, 25, ''], ['B구역', '약품', '주사기 10cc', 'Box', 10, 4, '냉장 아님'],
    ['B구역', '약품', '소독용 에탄올', '병', 8, 8, ''], ['C구역', '재료', '석고붕대 4인치', 'Roll', 40, 15, '']]);   // 구매자가 붙여넣은 자기 품목
  p = await open(); assert.deepStrictEqual(await p.locator('.ring-stat-line .v').allInnerTexts(), ['5', '2', '3']);
  assert.deepStrictEqual(await p.locator('#deptScroll .dept-chip').allInnerTexts(), ['전체', 'A구역', 'B구역', 'C구역']); assert.deepStrictEqual((await p.locator('#catFilter .cat-chip').allInnerTexts()).sort(), ['약품', '재료', '전체']);
  assert.deepStrictEqual(all().items.map(i => i.id), [1, 2, 3, 4, 5]); assert.deepStrictEqual(env.sheet('품목 마스터').d.slice(1, 6).map(r => r[7]), [1, 2, 3, 4, 5]); ok('⑦ 자기 품목 5개 붙여넣기 → 앱에 즉시 표시, 대분류(A·B·C구역)·소분류(재료·약품) 칩이 자동 생성, 품목번호 자동 부여');

  // 4단계: 실사 → 청구
  await go(p, 'audit'); await p.click('[data-d=A구역]'); await p.waitForTimeout(60);
  const idOf = nm => all().items.find(i => i.name === nm).id;
  await p.locator(`.audit-input[data-id="${idOf('멸균거즈 10x10')}"]`).fill('40'); await p.click('#saveAudit'); await wait(p);
  assert.strictEqual(all().items.find(i => i.name === '멸균거즈 10x10').stock, 40); assert(/A구역 실사 완료 · 1건 변경/.test(await p.innerText('#toast'))); ok('⑧ 자기 품목으로 실사 저장(1건 변경)');
  await p.click('#changeDept'); await p.click('[data-d=B구역]'); await p.waitForTimeout(60);
  await p.locator(`.audit-input[data-id="${idOf('소독용 에탄올')}"]`).fill('3'); await p.click('#saveAudit'); await wait(p);
  await go(p, 'request'); const names = (await p.locator('.req-item .name').allInnerTexts()).sort(); assert.deepStrictEqual(names, ['석고붕대 4인치', '소독용 에탄올', '주사기 10cc']); ok('⑨ 청구 후보가 실사 결과와 정확히 일치 (보충된 거즈 제외, 새로 부족해진 에탄올 포함)');
  await p.click('#genRequest'); await wait(p); await p.click('#printReq'); assert.strictEqual(await p.evaluate(() => window.__printed), 1); await p.click('#closeModal');
  const rq = all().requests; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items.length, 3); assert(rq[0].items.every(i => i.qty >= 1 && i.id > 0 && i.dept && i.cat)); ok('⑩ 청구서 생성 → 3개 품목 기록, 인쇄 호출');

  // 5단계: 운영 중 변경
  await go(p, 'manage'); await p.click('#addItemBtn'); await p.waitForTimeout(60); await p.fill('#fDept', 'C구역'); await p.fill('#fName', '붕대 3인치'); await p.fill('#fPar', '20'); await p.fill('#fStock', '5'); await p.click('#saveItem'); await wait(p);
  assert(env.post({ action: 'itemDelete', id: 1 }).success);   // 첫 품목 삭제
  env.paste('품목 마스터', 8, [['C구역', '재료', '또 붙여넣음', 'EA', 1, 1, '', 2]]);   // 번호가 겹치는 줄(복사)
  const items = all().items; assert.strictEqual(items.length, 6); assert.strictEqual(new Set(items.map(i => i.id)).size, 6); assert.strictEqual(env.sheet('품목 마스터').d[0][8], env.run('MASTER_STATUS_FORMULA')); ok('⑪ 앱에서 품목 추가 + 첫 품목 삭제 + 번호가 겹치는 줄 붙여넣기 후에도 번호 고유, 상태 자동 수식 유지');
  assert.strictEqual(env.sheet('품목 마스터').d[999], undefined); assert.strictEqual(new Set(all().requests.map(x => x.id)).size, all().requests.length); ok('⑫ 시트 맨 아래(1000행)에 엉뚱한 데이터 없음, 청구번호 중복 없음');
  await p.close(); p = await open(); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 6); ok('⑬ 앱을 다시 열어도 시트의 최신 상태(6개) 그대로');
  assert.deepStrictEqual(pageErrs, []); ok('⑭ 전 과정에서 스크립트 오류 없음');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
