const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {chromium}=require('playwright');
const PKG='/home/user/Repository-name-or-inventory/product/inventory-excel-package';
const SPD=process.argv[2];
// ---- Code.gs 모의 환경 ----
class Range{constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
 setValues(v){for(let i=0;i<v.length;i++)for(let j=0;j<v[0].length;j++){(this.sh.d[this.r-1+i]=this.sh.d[this.r-1+i]||[])[this.c-1+j]=v[i][j]}return this}
 setValue(v){return this.setValues([[v]])} setFormula(f){return this.setValues([[f]])} setFontWeight(){return this}
 clearContent(){for(let i=0;i<this.nr;i++)for(let j=0;j<this.nc;j++){const row=this.sh.d[this.r-1+i];if(row)row[this.c-1+j]=''}return this}
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(((this.sh.d[this.r-1+i]||[])[this.c-1+j])??'');o.push(row)}return o}}
class Sheet{constructor(){this.d=[]}
 getLastRow(){for(let i=this.d.length;i>0;i--){if((this.d[i-1]||[]).some(x=>x!==''&&x!==undefined))return i}return 0}
 getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc)} appendRow(a){this.d[this.getLastRow()]=a} deleteRow(r){this.d.splice(r-1,1)} setFrozenRows(){}}
const sheets={},pad=(n,l=2)=>String(n).padStart(l,'0');
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet()}),getUi:()=>({})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>require('crypto').randomUUID(),formatDate:(d,tz,f)=>f==='yyyy-MM-dd'?d.toISOString().slice(0,10):pad(d.getUTCFullYear()%100)+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())},
 Session:{getScriptTimeZone:()=>'Asia/Seoul'},ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:'json'}},JSON,Date,Math,String,parseInt,isNaN};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(PKG+'/Code.gs','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
const gget=a=>JSON.parse(run(`doGet({parameter:{action:'${a}'}})`).s).data;
run('setupSheets()');
JSON.parse(fs.readFileSync(SPD+'/build/sample.json','utf8')).forEach(d=>run(`addItem_(${JSON.stringify(d)})`));
// ---- 브라우저 ----
const html=fs.readFileSync(PKG+'/index.html','utf8');
const online=html.replace('"SCRIPT_URL_HERE"','"https://mock.local/exec"');
let n=0;const ok=m=>console.log(++n+' '+m+' OK');
(async()=>{
 const b=await chromium.launch();const errs=[];
 async function open(h){const p=await b.newPage({viewport:{width:390,height:820}});p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  await p.route('https://mock.local/**',async r=>{const q=r.request();let body;
   if(q.method()==='POST')body=run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
   else body=run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
   r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body})});
  await p.setContent(h,{waitUntil:'load'});await p.waitForTimeout(400);return p}
 const txt=p=>p.innerText('body');

 // A. 오프라인(URL 미설정)
 let p=await open(html);
 assert.strictEqual(await p.innerText('#pillText'),'오프라인'); assert.strictEqual(await p.locator('#list .card').count(),12); ok('URL 미설정: 오프라인 표시 + 샘플 12개 표시');
 p.once('dialog',d=>d.accept()); await p.click('[data-act=del]'); await p.waitForTimeout(200);
 assert(/오프라인 상태/.test(await p.innerText('#toast'))); assert.strictEqual(await p.locator('#list .card').count(),12); ok('오프라인에서 삭제 시도: 안내만 하고 데이터 유지');
 await p.close();

 // B. 연결됨
 p=await open(online);
 assert.strictEqual(await p.innerText('#pillText'),'실시간 연결됨'); assert.strictEqual(await p.locator('#list .card').count(),12); ok('연결됨 표시 + 시트에서 12개 로드');
 const stats=await p.locator('.stat b').allInnerTexts(); assert.deepStrictEqual(stats,['6','6','12']); ok('통계 부족6/정상6/전체12');
 await p.screenshot({path:SPD+'/pkg_status.png'});
 await p.click('[data-zone=병동]'); assert.strictEqual(await p.locator('#list .card').count(),3); ok('구역 필터(병동 3개)');
 await p.click('[data-zone=전체]');
 // 한글 조합 시뮬레이션
 await p.evaluate(()=>{const i=document.getElementById('q');i.dispatchEvent(new CompositionEvent('compositionstart'));i.value='주사';i.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.strictEqual(await p.locator('#list .card').count(),12); ok('한글 조합 중에는 목록을 다시 그리지 않음');
 await p.evaluate(()=>{const i=document.getElementById('q');i.dispatchEvent(new CompositionEvent('compositionend'))});
 assert.strictEqual(await p.locator('#list .card').count(),1); assert(/주사기/.test(await p.innerText('#list'))); ok('조합 종료 후 검색 반영(주사기 1개)');
 await p.fill('#q',''); 
 // 청구
 await p.click('[data-tab=request]'); assert.strictEqual(await p.locator('.card').count(),6); ok('청구 탭: 부족 품목 6개 자동 표시');
 const first=await p.locator('.card .nm').first().innerText(); const q0=+await p.locator('.card input[type=number]').first().inputValue();
 await p.locator('[data-act=plus]').first().click(); assert.strictEqual(+await p.locator('.card input[type=number]').first().inputValue(),q0+1); ok('수량 + 버튼');
 await p.locator('.card .cb').nth(1).uncheck(); assert(/\(5개\)/.test(await p.innerText('[data-act=submitReq]'))); ok('체크 해제 시 제출 개수 5개');
 await p.screenshot({path:SPD+'/pkg_request.png'});
 await p.click('[data-act=submitReq]'); await p.waitForTimeout(300);
 const reqs=gget('getRequests'); assert.strictEqual(reqs.length,1); assert.strictEqual(reqs[0].items.length,5); assert(reqs[0].items.find(i=>i.name===first).qty===q0+1); ok('청구서 제출 → 시트 물품 청구서에 5개 품목, 조정한 수량 반영');
 // 주간실사
 await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); assert.strictEqual(await p.locator('input[data-act=draftin]').count(),12); ok('주간실사: 전체 12개 품목 불러오기');
 await p.locator('input[data-name="거즈 4x4"]').fill('30');
 await p.screenshot({path:SPD+'/pkg_weekly.png'});
 await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
 assert.strictEqual(gget('getMaster').find(i=>i.name==='거즈 4x4').stock,30); assert.strictEqual(gget('getWeekly').length,12); ok('실사 저장 → 품목 마스터 재고 갱신 + 주간 기록 12건');
 await p.click('[data-tab=status]'); assert.deepStrictEqual(await p.locator('.stat b').allInnerTexts(),['5','7','12']); ok('저장 후 현황 즉시 반영(부족 5/정상 7)');
 // 삭제
 p.once('dialog',d=>d.accept()); await p.locator('.card',{hasText:'반창고'}).locator('[data-act=del]').click(); await p.waitForTimeout(300);
 assert(!gget('getMaster').some(i=>i.name==='반창고')); assert.strictEqual(await p.locator('#list .card').count(),11); ok('삭제 → 시트에서도 삭제, 화면 11개');
 // 삭제 취소
 p.once('dialog',d=>d.dismiss()); await p.locator('.card',{hasText:'알코올 솜'}).locator('[data-act=del]').click(); await p.waitForTimeout(200);
 assert(gget('getMaster').some(i=>i.name==='알코올 솜')); ok('삭제 확인창에서 취소하면 유지');
 // 재접속 시 상태 유지
 await p.close(); p=await open(online); assert.strictEqual(await p.locator('#list .card').count(),11); ok('앱을 다시 열어도 시트 상태 유지(11개)');
 // 연결 실패 처리
 const bad=html.replace('"SCRIPT_URL_HERE"','"https://down.local/exec"'); const p2=await b.newPage(); await p2.route('https://down.local/**',r=>r.abort());
 await p2.setContent(bad,{waitUntil:'load'}); await p2.waitForTimeout(500);
 assert.strictEqual(await p2.innerText('#pillText'),'오프라인'); assert.strictEqual(await p2.locator('#list .card').count(),12); ok('서버 응답 없음: 오프라인 + 내장 샘플로 화면 유지');
 assert.deepStrictEqual(errs.filter(e=>!/ERR_FAILED|down\.local|Failed to load resource/.test(e)),[]); ok('예상 밖의 콘솔/페이지 오류 없음');
 await b.close(); console.log('\n전체 '+n+'개 통과');
})().catch(e=>{console.error('실패:',e.message);process.exit(1)});
