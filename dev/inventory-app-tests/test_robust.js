// 거친 입력 시험: HTML 주입 시도, 특수문자·아주 긴 이름·큰 숫자가 4개 화면과 모달을 깨뜨리지 않는지, 좁은 화면(320~768px)
const fs = require('fs'), assert = require('assert'); const { chromium } = require('playwright');
const createEnv = require('./gs_mock'); const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const env = createEnv(PKG + '/Code.gs'); env.run('setupSheets()');
const EVIL = '<img src=x onerror="window.__pwned=1"> 위험한 이름', EVILDEPT = '"따옴표" <script>window.__pwned=1</script> 부서';
env.paste('품목 마스터', 2, [
  [EVILDEPT, '<b>굵게</b>소분류', EVIL, '"규격" & \'값\'', 10, 1, '<svg onload="window.__pwned=1">메모'],
  ['아주아주긴대분류이름아주아주긴대분류이름아주아주긴대분류이름', '아주아주긴소분류이름아주아주긴소분류이름', '초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명', 'Box(100개입 특대형 규격 설명이 매우 긴 경우의 규격 문자열)', 9999999, 3, '메모 '.repeat(60)],
  ['병동', '소모품', '보통 품목', 'EA', 5, 9, ''], ['병동', '소모품', "작은'따옴표 품목", 'EA', 5, 1, '']]);
const html = fs.readFileSync(PKG + '/index.html', 'utf8').replace('"SCRIPT_URL_HERE"', '"https://mock.local/exec"');
(async () => {
  const b = await chromium.launch(); const pageErrs = [];
  async function page(w) {
    const ctx = await b.newContext({ viewport: { width: w, height: 760 }, timezoneId: 'Asia/Seoul' });
    await ctx.route('https://mock.local/**', async r => { const q = r.request(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: q.method() === 'POST' ? env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s : env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s }); });
    const p = await ctx.newPage(); p.dialogs = []; p.on('dialog', d => { p.dialogs.push(d.message()); d.accept(); }); p.on('pageerror', e => pageErrs.push(e.message));
    await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(350); return p;
  }
  const overflow = async (p, label, w) => { const sw = await p.evaluate(() => document.documentElement.scrollWidth); assert(sw <= w + 1, `${w}px ${label}: 가로 넘침 (scrollWidth ${sw})`); };
  const go = async (p, s) => { await p.click(`.nav-btn[data-screen=${s}]`); await p.waitForTimeout(80); };
  for (const w of [320, 360, 430, 768]) {
    const p = await page(w);
    await overflow(p, '재고현황', w);
    await go(p, 'audit'); await overflow(p, '재고파악(부서 선택)', w);
    await p.locator('[data-d]').nth(1).click(); await p.waitForTimeout(80); await overflow(p, '재고파악(입력: 아주 긴 이름의 대분류)', w);
    await go(p, 'request'); await overflow(p, '물품청구', w); await p.click('#genRequest'); await p.waitForTimeout(300); await overflow(p, '청구서 모달', w);
    if (w === 320) await p.screenshot({ path: OUT + '/pro_narrow_modal.png' }); await p.click('#closeModal');
    await go(p, 'manage'); await overflow(p, '품목관리', w); await p.click('#addItemBtn'); await p.waitForTimeout(80); await overflow(p, '품목 추가 모달', w); await p.click('#cancelItem');
    await p.click('#bulkCatBtn'); await p.waitForTimeout(80); await overflow(p, '일괄 변경 모달', w); await p.click('#cancelBulk');
    if (w === 320) { await go(p, 'manage'); await p.screenshot({ path: OUT + '/pro_narrow320.png' }); }
    await p.context().close();
  }
  ok('화면 폭 320·360·430·768px × 4개 화면 + 모달 3종(청구서·품목 추가·일괄 변경): 가로 넘침 없음 (긴 이름·큰 숫자·긴 메모 포함)');
  const p = await page(390);
  assert.strictEqual(await p.evaluate(() => window.__pwned || 0), 0); assert.strictEqual(p.dialogs.length, 0);
  for (const scr of ['dashboard', 'audit', 'request', 'manage']) {
    await go(p, scr);
    if (scr === 'audit') for (let i = 0; i < 3; i++) { await go(p, 'audit'); const bt = p.locator('[data-d]'); if (await bt.count() > i) { await bt.nth(i).click(); await p.waitForTimeout(60); } }
    // 주입한 태그가 실제 요소로 만들어졌다면 이런 요소가 존재한다
    assert.strictEqual(await p.locator('#main img[src="x"], #main svg[onload], #main script').count(), 0, scr + ': 주입된 태그가 실제 요소로 만들어짐');
  }
  assert.strictEqual(await p.evaluate(() => window.__pwned || 0), 0); ok('품목명·대분류·소분류·규격·메모에 <img onerror>·<script>·<svg onload>가 있어도 4개 화면에서 실행되지 않음(글자 그대로 표시)');
  await go(p, 'dashboard'); assert(/<img src=x onerror=/.test(await p.innerText('#itemListCard'))); ok('주입 시도 문자열은 화면에 글자 그대로 보임(태그로 해석되지 않음)');
  await p.click(`.dept-chip[data-dept="${EVILDEPT.replace(/"/g, '\\"')}"]`); await p.waitForTimeout(80); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 1); ok('따옴표·태그가 든 대분류 칩도 눌러서 정상 필터링');
  await p.click('.dept-chip[data-dept=전체]'); await go(p, 'manage');
  const row = p.locator('.manage-item', { hasText: '작은\'따옴표 품목' }); await row.locator('.editBtn').click(); await p.waitForTimeout(80); assert.strictEqual(await p.inputValue('#fName'), "작은'따옴표 품목"); await p.fill('#fName', '따옴표 "수정" \'완료\''); await p.click('#saveItem'); await p.waitForTimeout(350);
  assert(env.get('getAll').data.items.some(i => i.name === '따옴표 "수정" \'완료\'')); ok('따옴표가 든 품목명을 수정 모달에서 그대로 읽고 저장');
  await go(p, 'manage'); await p.locator('.manage-item', { hasText: '아주아주긴' }).first().locator('.parInput').fill('0'); await p.locator('.manage-item', { hasText: '초장문' }).first().locator('.parInput').dispatchEvent('change'); await p.waitForTimeout(350);
  assert(env.get('getAll').data.items.find(i => i.name.startsWith('초장문')).par === 0); ok('아주 긴 품목명 행의 적정재고도 정상 수정(큰 숫자 9999999 포함)');
  assert.deepStrictEqual(pageErrs, []); ok('전 과정 스크립트 오류 없음');
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
