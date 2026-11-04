// 디자인 품질 시험: 글자 대비(WCAG), 터치 영역, 모션 줄이기, 좁은 화면, 다크 모드, 인쇄
const fs = require('fs'), assert = require('assert'), cp = require('child_process'); const { chromium } = require('playwright');
const createEnv = require('./gs_mock'); const PKG = process.argv[2], OUT = process.argv[3] || '/tmp';
const html = fs.readFileSync(PKG + '/index.html', 'utf8').replace('"SCRIPT_URL_HERE"', '"https://mock.local/exec"');
let n = 0; const ok = m => console.log(String(++n).padStart(2) + ' ' + m + ' OK');
const ymdKR = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const add = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const today = ymdKR(new Date());
function makeEnv() {
  const env = createEnv(PKG + '/Code.gs'); env.run('loadSampleData()');
  env.sheet('실사 기록').d = [env.sheet('실사 기록').d[0], [add(today, -20), '수술실', 0, ''], [add(today, -12), '처치실', 0, ''], [today, '병동', 0, '']];
  const it = nm => env.get('getAll').data.items.find(i => i.name === nm);
  const mk = (dept, names) => env.post({ action: 'requestCreate', dept, items: names.map(nm => { const i = it(nm); return { id: i.id, name: i.name, spec: i.spec, dept: i.dept, cat: i.cat, stock: i.stock, par: i.par, qty: i.par - i.stock }; }) }).data.id;
  const r1 = mk('전체', ['멸균 수술장갑 7.0', '일회용 주사기 5cc', '봉합사 Vicryl 2-0']); env.post({ action: 'receiveSubmit', requestId: r1, items: [{ id: it('멸균 수술장갑 7.0').id, qty: 4 }], memo: '납품' }); mk('병동', ['탄력붕대 4인치']);
  return env;
}
const env = makeEnv();
async function ctxFor(b, opts) {
  const c = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: 2 }, opts));
  await c.addInitScript(() => { window.print = () => {}; });
  await c.route('https://mock.local/**', async r => { const q = r.request(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: q.method() === 'POST' ? env.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s : env.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s }); });
  return c;
}
async function openPage(c) { const p = await c.newPage(); p.on('dialog', d => d.accept()); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(400); return p; }
const go = async (p, s) => { await p.click(`.nav-btn[data-screen=${s}]`); await p.waitForTimeout(700); };   // 등장 애니메이션이 끝난 뒤 측정

// 화면에서 (글자색, 실제 배경색, 글자 크기·굵기)를 읽어 WCAG 대비율을 계산한다
const MEASURE = sels => sels.map(([sel, bgOverride]) => {
  const el = document.querySelector(sel); if (!el) return { sel, missing: true };
  const rgba = c => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat([a]); };
  let bg = [255, 255, 255, 1];
  if (bgOverride) { bg = rgba(bgOverride); }
  else { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(rgba(getComputedStyle(e).backgroundColor)); bg = chain.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255, 1]); }
  const cs = getComputedStyle(el); const fg = over(rgba(cs.color), bg);
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
  const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const large = px >= 24 || (px >= 18.66 && bold);
  return { sel, ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, px, text: (el.textContent || '').trim().slice(0, 14) };
}).filter(Boolean);

(async () => {
  const b = await chromium.launch();
  const SCREENS = {
    dashboard: [['.brand-sub'], ['.brand-date'], ['.sync-pill'], ['.dept-chip:not(.active)'], ['.dept-chip.active'], ['.toggle'], ['.cat-chip:not(.active)'], ['.cat-chip.active'], ['.item-name'], ['.tag'], ['.item-sub span:not(.tag)'], ['.memo'], ['.item-row.low .n'], ['.item-row.ok .n'], ['.item-stock .n .par'], ['.badge.low'], ['.badge.ok'], ['.nav-btn:not(.active)'], ['.nav-btn.active'], ['.hero-cta'], ['.eyebrow', '#14665F'], ['.ring-stat-line .k', '#14665F'], ['.ring-stat-line .v', '#14665F'], ['.ring-stat-line.low .v', '#14665F'], ['.hero-chip', '#14665F'], ['.ring-center .lbl', '#14665F']],
    request: [['.section-title'], ['.req-item .name'], ['.req-item .spec'], ['.shortage'], ['.history-item .row1'], ['.history-item .row2'], ['.history-item .badge'], ['.btn-primary'], ['.stepper input']],
    receive: [['.seg-btn:not(.on)'], ['.seg-btn.on'], ['.pc-title'], ['.pc-meta'], ['.badge.st-partial'], ['.badge.st-none'], ['.history-item .row2']],
    audit: [['.dept-card .dc-name'], ['.dept-card .dc-meta'], ['.dc-badge.over'], ['.dc-badge.soon'], ['.dc-badge.fine'], ['.dc-badge:not(.over):not(.soon):not(.fine)']],
    manage: [['.manage-item .name'], ['.manage-item .spec'], ['.par-field'], ['.icon-btn.danger'], ['.btn-secondary']],
  };
  for (const scheme of ['light', 'dark']) {
    const c = await ctxFor(b, { colorScheme: scheme }); const p = await openPage(c); const bad = []; let count = 0;
    for (const [scr, sels] of Object.entries(SCREENS)) {
      await go(p, scr);
      if (scr === 'audit') { await p.click('[data-d=처치실]'); await p.waitForTimeout(500); await p.locator('.stp-plus').first().click(); sels.push(['.audit-banner .t1'], ['.audit-banner .t2'], ['.audit-row .name'], ['.audit-row .spec'], ['.audit-row .old'], ['.delta.up'], ['.fab-note'], ['.pill-count']); await p.click('#changeDept'); await p.waitForTimeout(500); }
      const res = await p.evaluate(MEASURE, sels); for (const r of res) { if (r.missing) continue; count++; if (r.ratio < r.need) bad.push(`${scr} ${r.sel} "${r.text}" ${r.px}px → ${r.ratio}:1 (필요 ${r.need})`); }
    }
    await p.click('.nav-btn[data-screen=request]'); await p.waitForTimeout(600); await p.click('.history-item'); await p.waitForTimeout(500);
    const mres = await p.evaluate(MEASURE, [['.modal-title'], ['.doc-id'], ['.muted.doc-meta'], ['.modal-sheet .item-name'], ['.modal-sheet .item-sub .tag'], ['.modal-sheet .item-stock .n'], ['.modal-sheet .item-stock .p'], ['.btn-secondary'], ['.rcv-chip']]); for (const r of mres) { if (r.missing) continue; count++; if (r.ratio < r.need) bad.push(`모달 ${r.sel} "${r.text}" ${r.px}px → ${r.ratio}:1 (필요 ${r.need})`); }
    if (bad.length) console.log('  [' + scheme + '] 대비 부족:\n   - ' + bad.join('\n   - '));
    assert.strictEqual(bad.length, 0, `${scheme}: 글자 대비 기준 미달 ${bad.length}건`); ok(`${scheme === 'light' ? '라이트' : '다크'} 모드: 주요 글자 ${count}곳이 WCAG AA 대비(일반 4.5:1, 큰 글자 3:1)를 모두 만족`);
    await c.close();
  }

  // 터치 영역
  { const c = await ctxFor(b, {}); const p = await openPage(c); const small = [];
    const check = async (label, sel, min) => { const r = await p.evaluate((s) => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null).map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }), sel); r.forEach(([w, h]) => { if (Math.min(w, h) < min) small.push(`${label} ${w}×${h}`); }); return r.length; };
    let total = 0;
    total += await check('부서칩', '.dept-chip', 36); total += await check('소분류칩', '.cat-chip', 32); total += await check('부족만', '.toggle', 40); total += await check('메뉴', '.nav-btn', 48); total += await check('청구 CTA', '.hero-cta', 44);
    await go(p, 'request'); total += await check('체크박스', '.reqChk', 24); total += await check('스테퍼 버튼', '.stepper button', 36); total += await check('수량 입력', '.stepper input', 36); total += await check('큰 버튼', '.btn', 44);
    await go(p, 'manage'); total += await check('아이콘 버튼', '.icon-btn', 40); total += await check('품목관리 입력', '.par-field input', 40);
    await go(p, 'receive'); total += await check('분할 탭', '.seg-btn', 40); total += await check('청구서 카드', '.pending-card', 56);
    await go(p, 'audit'); total += await check('부서 카드', '.dept-card', 80);
    if (small.length) console.log('  작은 터치 영역:', small.join(', ')); assert.strictEqual(small.length, 0); ok(`터치 영역: 측정한 ${total}개 조작 요소가 모두 기준 이상(메뉴 48·버튼 44·스테퍼/입력 36~40px 이상)`); await c.close(); }

  // 모션 줄이기
  { const c = await ctxFor(b, { reducedMotion: 'reduce' }); const p = await openPage(c); const names = await p.evaluate(() => [...document.querySelectorAll('.item-row, .hero')].map(e => getComputedStyle(e).animationName)); assert(names.length && names.every(a => a === 'none')); ok('"동작 줄이기" 설정이면 모든 등장 애니메이션이 꺼짐'); await c.close(); }
  { const c = await ctxFor(b, {}); const p = await openPage(c); const names = await p.evaluate(() => [...document.querySelectorAll('.item-row')].map(e => getComputedStyle(e).animationName)); assert(names.every(a => a !== 'none')); ok('기본 설정에서는 목록이 부드럽게 나타남(애니메이션 동작)'); await c.close(); }

  // 좁은 화면: 5개 화면 + 하단 메뉴 라벨
  for (const w of [320, 360, 430, 768]) {
    const c = await ctxFor(b, { viewport: { width: w, height: 800 } }); const p = await openPage(c);
    for (const scr of ['dashboard', 'request', 'receive', 'audit', 'manage']) {
      await go(p, scr); if (scr === 'audit') { await p.click('[data-d=처치실]'); await p.waitForTimeout(400); }
      if (scr === 'receive') { await p.click('.pending-card'); await p.waitForTimeout(400); }
      const sw = await p.evaluate(() => document.documentElement.scrollWidth); assert(sw <= w + 1, `${w}px ${scr}: 가로 넘침 ${sw}`);
      const clipped = await p.evaluate(() => [...document.querySelectorAll('.nav-btn span')].filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.textContent)); assert.deepStrictEqual(clipped, [], `${w}px 메뉴 라벨 잘림`);
    }
    await c.close();
  }
  ok('화면 폭 320·360·430·768px × 5개 화면: 가로 넘침 없음, 하단 메뉴 5개 라벨이 잘리지 않음');

  // 다크 모드: 실제로 어두운 배경·밝은 글자
  { const c = await ctxFor(b, { colorScheme: 'dark' }); const p = await openPage(c); const r = await p.evaluate(() => { const l = e => { const m = getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; }; return { body: l(document.body), card: l(document.querySelector('.item-row')), text: getComputedStyle(document.querySelector('.item-name')).color }; }); assert(r.body < 40 && r.card < 60); ok('다크 모드: 배경이 어둡고(평균 밝기 ' + Math.round(r.body) + ') 글자는 밝은색'); await c.close(); }

  // 인쇄: 청구서만 결재 문서 형태로
  { const orgHtml = html.replace('const ORG_NAME = "";', 'const ORG_NAME = "테스트병원";'); const c = await ctxFor(b, {}); const p = await c.newPage(); p.on('dialog', d => d.accept()); await p.setContent(orgHtml, { waitUntil: 'load' }); await p.waitForTimeout(400);
    await go(p, 'request'); await p.click('.history-item'); await p.waitForTimeout(500); await p.emulateMedia({ media: 'print' });
    const vis = await p.evaluate(() => { const d = s => { const e = document.querySelector(s); return e ? (e.getClientRects().length === 0 ? 'none' : getComputedStyle(e).display) : 'missing'; }; return { header: d('header.app-header'), nav: d('nav.bottom-nav'), main: d('main'), head: d('.print-head'), sign: d('.print-sign'), title: d('.modal-title'), btn: d('#printReq'), toast: d('#toast') }; });   // 부모가 숨겨져 실제로 그려지지 않으면 none
    assert.strictEqual(vis.header, 'none'); assert.strictEqual(vis.nav, 'none'); assert.strictEqual(vis.main, 'none'); assert.strictEqual(vis.btn, 'none'); assert.notStrictEqual(vis.head, 'none'); assert.strictEqual(vis.sign, 'grid'); ok('인쇄 모드: 상단 바·하단 메뉴·본문·버튼은 숨기고, 청구서 제목·결재란만 표시');
    const pdf = OUT + '/print_check.pdf'; await p.pdf({ path: pdf, format: 'A4', printBackground: true });
    const txt = cp.execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }); const pages = (cp.execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/) || [])[1];
    assert(/물품\s*청\s*구\s*서/.test(txt) && /테스트병원/.test(txt) && /병동/.test(txt) && /탄력붕대/.test(txt) && /담당/.test(txt) && /팀장/.test(txt) && /승인/.test(txt), txt.slice(0, 400)); assert(!/재고현황|품목관리|입고 저장/.test(txt)); assert.strictEqual(pages, '1'); ok('실제 PDF 출력(A4): 1쪽에 "물품 청구서 · 병원명 · 품목 · 담당/팀장/승인 결재란"이 들어 있고 앱 메뉴 글자는 섞이지 않음');
    await p.screenshot({ path: OUT + '/print_screen_check.png' }); await c.close(); }

  await b.close(); console.log('\n전체 ' + n + '개 통과');
})().catch(e => { console.error('\n실패:', e.message); process.exit(1); });
