// 앱(index.html) 화면 + 백엔드 연동 시험 (실제 브라우저, 모바일 크기)
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const createEnv = require('./gs_mock');
const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample.json'), 'utf8'));
const html = fs.readFileSync(PKG + '/index.html', 'utf8');
const online = html.replace('"SCRIPT_URL_HERE"', '"https://mock.local/exec"');
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');

const env = createEnv(PKG + '/Code.gs'); env.run('loadSampleData()');
const master = () => env.get('getMaster').data;

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open(h, route = true) {
    const p = await b.newPage({ viewport: { width: 390, height: 820 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    if (route) await p.route('https://mock.local/**', async r => {
      const q = r.request(); let body;
      if (q.method() === 'POST') body = env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
      else body = env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
    });
    await p.setContent(h, { waitUntil: 'load' }); await p.waitForTimeout(400); return p;
  }
  const stats = p => p.locator('.stat b').allInnerTexts();
  const toast = p => p.innerText('#toast');

  // 내장 예제 = sample.json
  const embedded = JSON.parse(html.match(/<script id="jdata" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(embedded, SAMPLE); ok('앱에 내장된 예제 15개 = 개발용 sample.json = Code.gs 예제');

  // A. 오프라인(URL 미설정)
  let p = await open(html, false);
  assert.strictEqual(await p.innerText('#pillText'), '오프라인'); assert.strictEqual(await p.locator('#list .card').count(), 15); ok('URL 미설정: 오프라인 표시 + 예제 15개 표시');
  p.once('dialog', d => d.accept()); await p.click('[data-act=del]'); await p.waitForTimeout(200);
  assert(/오프라인 상태/.test(await toast(p))); assert.strictEqual(await p.locator('#list .card').count(), 15); ok('오프라인에서 삭제 시도: 안내만 하고 데이터 유지');
  await p.close();

  // B. 연결됨
  p = await open(online);
  assert.strictEqual(await p.innerText('#pillText'), '실시간 연결됨'); assert.deepStrictEqual(await stats(p), ['9', '6', '15']); ok('연결됨 + 시트에서 15개 로드, 부족9/정상6/전체15');
  assert.strictEqual(await p.locator('.warn').count(), 0); ok('중복이 없으면 경고 배너 없음');
  await p.screenshot({ path: OUT + '/app_status.png' });
  for (const z of ['수술실', '처치실', '병동', '물리치료실']) { await p.click(`[data-zone=${z}]`); assert.strictEqual(await p.locator('#list .card').count(), master().filter(i => i.loc === z).length); }
  await p.click('[data-zone=전체]'); ok('구역 4개 필터가 시트 데이터와 일치');
  await p.evaluate(() => { const i = document.getElementById('q'); i.dispatchEvent(new CompositionEvent('compositionstart')); i.value = '주사'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.strictEqual(await p.locator('#list .card').count(), 15); ok('한글 조합 중에는 목록을 다시 그리지 않음');
  await p.evaluate(() => document.getElementById('q').dispatchEvent(new CompositionEvent('compositionend')));
  assert.strictEqual(await p.locator('#list .card').count(), 2); ok('조합 종료 후 검색 반영("주사" → 주사기·주사바늘)');
  await p.fill('#q', '');

  // 청구
  await p.click('[data-tab=request]'); assert.strictEqual(await p.locator('.card').count(), 9); ok('청구 탭: 부족 품목 9개 자동 표시');
  const q0 = +await p.locator('input[data-act=qtyin][data-name="봉합사 Vicryl 2-0"]').inputValue(); assert.strictEqual(q0, 4); ok('기본 청구수량 = 적정 − 현재 (봉합사 6−2=4)');
  await p.locator('[data-act=plus][data-name="봉합사 Vicryl 2-0"]').click(); await p.locator('.cb[data-name="포비돈 용액 500ml"]').uncheck();
  assert(/\(8개\)/.test(await p.innerText('[data-act=submitReq]'))); ok('수량 +1, 체크 해제 → 제출 8개');
  await p.screenshot({ path: OUT + '/app_request.png' });
  await p.click('[data-act=submitReq]'); await p.waitForTimeout(300);
  const rq = env.get('getRequests').data; assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].items.length, 8);
  assert.strictEqual(rq[0].items.find(i => i.name === '봉합사 Vicryl 2-0').qty, 5); assert(!rq[0].items.some(i => i.name === '포비돈 용액 500ml')); ok('청구서 제출 → 물품 청구서 탭에 8행, 조정한 수량(5) 반영, 해제한 품목 제외');

  // 주간실사
  await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); assert.strictEqual(await p.locator('input[data-act=draftin]').count(), 15); ok('주간실사: 전체 15개 품목 불러오기');
  await p.locator('input[data-name="탄력붕대 4인치"]').fill('45'); await p.locator('input[data-name="주사바늘 23G"]').fill('2');
  await p.screenshot({ path: OUT + '/app_weekly.png' });
  await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
  assert.strictEqual(master().find(i => i.name === '탄력붕대 4인치').stock, 45); assert.strictEqual(env.get('getWeekly').data.length, 15); ok('실사 저장 → 품목 마스터 갱신 + 주간 기록 15건');
  await p.click('[data-tab=status]'); assert.deepStrictEqual(await stats(p), ['9', '6', '15']); ok('저장 후 현황 즉시 반영 (탄력붕대 보충 −1, 주사바늘 부족 +1 → 부족 9)');

  // 삭제
  p.once('dialog', d => d.accept()); await p.locator('.card', { hasText: '부직포 반창고' }).locator('[data-act=del]').click(); await p.waitForTimeout(300);
  assert(!master().some(i => i.name === '부직포 반창고')); assert.strictEqual(await p.locator('#list .card').count(), 14); ok('삭제 → 시트에서도 삭제, 화면 14개');
  p.once('dialog', d => d.dismiss()); await p.locator('.card', { hasText: '알코올 솜' }).locator('[data-act=del]').click(); await p.waitForTimeout(200);
  assert(master().some(i => i.name === '알코올 솜')); ok('삭제 확인창에서 취소하면 유지');
  await p.close(); p = await open(online); assert.strictEqual(await p.locator('#list .card').count(), 14); ok('앱을 다시 열어도 시트 상태 유지(14개)');

  // 중복 품목명 경고
  env.paste('품목 마스터', 16, [['알코올 솜', '처치실', 'Pack', 20, 3]]);   // 같은 이름 추가(구매자가 붙여넣다 생기는 실수)
  const stockBefore = JSON.stringify(master()); const weeklyBefore = env.get('getWeekly').data.length;
  await p.close(); p = await open(online);
  assert.strictEqual(await p.locator('.warn').count(), 1); assert(/알코올 솜/.test(await p.innerText('.warn'))); ok('품목명이 중복되면 현황 화면 위에 경고 배너(어떤 이름인지 표시)');
  await p.screenshot({ path: OUT + '/app_dup.png' });
  await p.click('[data-tab=weekly]'); assert.strictEqual(await p.locator('.warn').count(), 1); ok('주간실사 화면에도 경고 배너');
  await p.click('[data-act=loadDraft]'); await p.locator('input[data-name="멸균 수술장갑 7.5"]').first().fill('1'); await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
  assert(/중복/.test(await toast(p))); assert.strictEqual(JSON.stringify(master()), stockBefore); assert.strictEqual(env.get('getWeekly').data.length, weeklyBefore); ok('중복 상태에서 실사 저장 → 저장하지 않고 "중복" 이유를 화면에 알려줌, 시트는 그대로');
  await p.close();

  // 서버 응답 없음
  const bad = html.replace('"SCRIPT_URL_HERE"', '"https://down.local/exec"'); const p2 = await b.newPage(); await p2.route('https://down.local/**', r => r.abort());
  p2.on('console', () => {}); await p2.setContent(bad, { waitUntil: 'load' }); await p2.waitForTimeout(500);
  assert.strictEqual(await p2.innerText('#pillText'), '오프라인'); assert.strictEqual(await p2.locator('#list .card').count(), 15); ok('서버 응답 없음: 오프라인 + 내장 예제로 화면 유지');
  assert.deepStrictEqual(errs.filter(e => !/ERR_FAILED|down\.local|Failed to load resource/.test(e)), []); ok('예상 밖의 콘솔/페이지 오류 없음');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
