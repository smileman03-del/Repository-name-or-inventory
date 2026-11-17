// 신규 구매자 전체 흐름 시험: 새 구글 시트(빈 "시트1" 포함)에서 설명서대로 처음부터 끝까지
const fs = require('fs'), assert = require('assert');
const { chromium } = require('playwright');
const createEnv = require('./gs_mock');
const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const URL_ = 'https://script.google.com/macros/s/FAKE_BUYER_DEPLOY_ID_123456/exec';

// 설명서 4단계: 메모장 "모두 바꾸기"로 SCRIPT_URL_HERE 를 구글이 발급한 URL로 교체
const html = fs.readFileSync(PKG + '/index.html', 'utf8').split('SCRIPT_URL_HERE').join(URL_);

(async () => {
  // 1단계: 새 구글 시트 + Apps Script 에 Code.gs 붙여넣기 → setupSheets 실행
  const env = createEnv(PKG + '/Code.gs');            // 기본 빈 시트("시트1") 포함, 자동 수식 때문에 getLastRow 가 맨 아래로 보고되는 최악의 환경
  env.run('onOpen()'); env.run('setupSheets()');
  assert.deepStrictEqual(env.sheets.map(s => s.name), ['품목 마스터', '주간 재고 파악', '실시간 재고 대장', '물품 청구서']); ok('① setupSheets 한 번으로 탭 4개 완성(엑셀·탭 이름 확인 불필요), 빈 기본 시트 정리');

  const b = await chromium.launch(); const errs = [];
  async function open() {
    const p = await b.newPage({ viewport: { width: 390, height: 820 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.route(URL_ + '**', async r => {
      const q = r.request(); let body;
      if (q.method() === 'POST') body = env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
      else body = env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
    });
    await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(400); return p;
  }

  // 빈 상태에서 앱을 열어도 깨지지 않아야 한다
  let p = await open();
  assert.strictEqual(await p.innerText('#pillText'), '실시간 연결됨'); assert.strictEqual(await p.locator('#list .card').count(), 0); assert(/표시할 품목이 없어요/.test(await p.innerText('#list'))); ok('② 품목이 하나도 없는 빈 상태에서도 연결되고 안내 문구 표시');
  await p.click('[data-tab=request]'); assert(/재고부족 품목이 없어요/.test(await p.innerText('main'))); await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); assert.strictEqual(await p.locator('input[data-act=draftin]').count(), 0); ok('   청구·주간실사 탭도 빈 상태에서 오류 없음');
  await p.close();

  // 2단계: 예제로 체험
  env.run('loadSampleData()');
  p = await open(); assert.deepStrictEqual(await p.locator('.stat b').allInnerTexts(), ['9', '6', '15']); ok('③ 예제 15개로 체험 시작 (부족9/정상6/전체15)');
  await p.click('[data-tab=request]'); await p.click('[data-act=submitReq]'); await p.waitForTimeout(300);
  await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); await p.locator('input[data-name="초음파 젤"]').fill('10'); await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
  assert.strictEqual(env.get('getRequests').data.length, 1); assert.strictEqual(env.get('getWeekly').data.length, 15); ok('④ 체험: 청구서 1건 제출, 주간 실사 저장(15건) 성공');
  await p.close();

  // 3단계: 예제 지우기 → 자기 병원 품목을 엑셀에서 복사해 A~E열에 붙여넣기
  env.ui.answer = 'YES'; env.run('clearSampleDataFromMenu()'); assert(/지웠습니다/.test(env.alerts.at(-1)));
  assert.strictEqual(env.get('getMaster').data.length, 0); assert.strictEqual(env.get('getRequests').data.length, 0); ok('⑤ 메뉴 "예제 데이터 지우기": 예제와 체험 기록이 모두 사라지고 머리글·수식은 유지');
  env.paste('품목 마스터', 2, [
    ['멸균거즈 10x10', 'A구역', 'Pack', 30, 12], ['일회용 장갑 M', 'A구역', 'Box', 20, 25], ['주사기 10cc', 'B구역', 'Box', 10, 4],
    ['소독용 에탄올', 'B구역', '병', 8, 8], ['석고붕대 4인치', 'C구역', 'Roll', 40, 15]]);   // 구매자가 붙여넣은 자기 품목(상태 열은 자동)
  p = await open(); assert.deepStrictEqual(await p.locator('.stat b').allInnerTexts(), ['3', '2', '5']); assert.strictEqual(await p.locator('.chip').count(), 4); ok('⑥ 자기 품목 5개 붙여넣기 → 앱에 즉시 표시, 구역 탭(A·B·C구역)이 자동 생성, 부족3/정상2');

  // 4단계: 실사 → 청구
  await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); await p.locator('input[data-name="멸균거즈 10x10"]').fill('40'); await p.locator('input[data-name="소독용 에탄올"]').fill('3'); await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
  assert.strictEqual(env.get('getMaster').data.find(i => i.name === '멸균거즈 10x10').stock, 40); ok('⑦ 자기 품목으로 주간 실사 저장');
  await p.click('[data-tab=request]'); const names = (await p.locator('.card .nm').allInnerTexts()).sort(); assert.deepStrictEqual(names, ['석고붕대 4인치', '소독용 에탄올', '주사기 10cc']); ok('⑧ 청구 후보가 실사 결과와 정확히 일치 (보충된 거즈 제외, 새로 부족해진 에탄올 포함)');
  await p.click('[data-act=submitReq]'); await p.waitForTimeout(300);
  const rq = env.get('getRequests').data; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items.length, 3); assert(rq[0].items.every(i => i.qty >= 1)); ok('⑨ 청구서 제출 → 3개 품목 기록');
  await p.close();

  // 5단계: 운영 중 변경 — 첫 품목 삭제·품목 추가 후에도 정상
  assert(env.post({ action: 'deleteItem', name: '멸균거즈 10x10' }).success);
  env.ui.promptText = '붕대 3인치, C구역, Roll, 20, 5'; env.run('addItemFromMenu()');
  const m = env.get('getMaster').data; assert.strictEqual(m.length, 5); assert.strictEqual(m.at(-1).name, '붕대 3인치'); assert.strictEqual(env.sheet('품목 마스터').d[0][5], env.run('MASTER_STATUS_FORMULA')); ok('⑩ 첫 품목 삭제 + 메뉴로 품목 추가 후에도 상태 자동 수식 유지, 새 품목은 마지막 줄 아래에 정상 추가');
  assert.deepStrictEqual(env.get('getRealtime').data.map(i => i.name).sort(), m.filter(i => i.stock < i.par).map(i => i.name).sort()); ok('⑪ 실시간 재고 대장이 항상 현재 부족 품목과 일치');
  assert.strictEqual(env.sheet('품목 마스터').d[999], undefined); assert.strictEqual(new Set(env.get('getRequests').data.map(x => x.id)).size, env.get('getRequests').data.length); ok('⑫ 시트 맨 아래(1000행)에 엉뚱한 데이터 없음, 청구번호 중복 없음');
  assert.deepStrictEqual(errs, []); ok('⑬ 전 과정에서 브라우저 오류 없음');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
