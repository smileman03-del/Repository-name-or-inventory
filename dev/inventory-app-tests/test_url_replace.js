// 구매자가 SCRIPT_URL_HERE 를 URL 로 바꾸는 여러 방식(메모장 '모두 바꾸기' 포함)에서 모두 연결되는지 확인
const fs = require('fs'), assert = require('assert'), { chromium } = require('playwright');
const src = fs.readFileSync(process.argv[2], 'utf8'); const U = 'https://script.google.com/macros/s/FAKE_TEST_ID_1234567890/exec';
const data = { items: [{ id: 1, dept: '병동', cat: '소모품', name: '테스트', spec: 'EA', par: 5, stock: 1, memo: '' }], audits: {}, requests: [] };
const variants = { '모두 바꾸기(Replace All)': src.split('SCRIPT_URL_HERE').join(U), '첫 번째만 바꾸기': src.replace('SCRIPT_URL_HERE', U), '따옴표 안 값만 바꾸기': src.replace('"SCRIPT_URL_HERE"', '"' + U + '"') };
(async () => {
  const b = await chromium.launch(); let n = 0;
  { const p = await b.newPage(); let reqs = 0; await p.route('**/*', r => { if (/^https?:/.test(r.request().url())) reqs++; r.continue(); }); await p.setContent(src, { waitUntil: 'load' }); await p.waitForTimeout(300);
    assert.strictEqual(await p.innerText('#syncText'), '연결 안 됨'); assert.strictEqual(reqs, 0); assert(/SCRIPT_URL/.test(await p.innerText('#main'))); console.log(++n + ' URL 미설정(원본): "연결 안 됨" + 설정 안내 + 서버 요청 없음 OK'); await p.close(); }
  for (const [name, html] of Object.entries(variants)) {
    const p = await b.newPage(); let reqs = 0;
    await p.route('https://script.google.com/**', r => { reqs++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ success: true, data }) }); });
    await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(400);
    assert.strictEqual(await p.innerText('#syncText'), '연결됨', name); assert.strictEqual(reqs, 1, name); assert.strictEqual(await p.locator('#itemListCard .item-row').count(), 1, name);
    console.log(++n + ' ' + name + ': 연결됨 + 시트 데이터 표시 OK'); await p.close(); }
  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
