// 전체 흐름 시험: 엑셀(구글 시트로 가져온 상태) → 재고 파악 → 청구서 → 시트 기록 확인
const fs=require('fs'),vm=require('vm'),assert=require('assert');const {chromium}=require('playwright');
const PKG=process.argv[2], DUMP=process.argv[3], OUT=process.argv[4];
class Range{constructor(sh,r,c,nr,nc){Object.assign(this,{sh,r,c,nr,nc})}
 setValues(v){for(let i=0;i<v.length;i++)for(let j=0;j<v[0].length;j++){(this.sh.d[this.r-1+i]=this.sh.d[this.r-1+i]||[])[this.c-1+j]=v[i][j]}return this}
 setValue(v){return this.setValues([[v]])} setFormula(f){return this.setValues([[f]])} setFontWeight(){return this}
 clearContent(){for(let i=0;i<this.nr;i++)for(let j=0;j<this.nc;j++){const row=this.sh.d[this.r-1+i];if(row)row[this.c-1+j]=''}return this}
 getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++)row.push(((this.sh.d[this.r-1+i]||[])[this.c-1+j])??'');o.push(row)}return o}}
class Sheet{constructor(){this.d=[]}
 getLastRow(){for(let i=this.d.length;i>0;i--){if((this.d[i-1]||[]).some(x=>x!==''&&x!==undefined))return i}return 0}
 getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc)} appendRow(a){this.d[this.getLastRow()]=a} deleteRow(r){this.d.splice(r-1,1)} setFrozenRows(){}}
const sheets={},pad=(n,l=2)=>String(n).padStart(l,'0'),alerts=[];
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet()}),getUi:()=>({alert:m=>alerts.push(m)})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>require('crypto').randomUUID(),formatDate:(d,tz,f)=>f==='yyyy-MM-dd'?d.toISOString().slice(0,10):pad(d.getUTCFullYear()%100)+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())},
 Session:{getScriptTimeZone:()=>'Asia/Seoul'},ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:'json'}},JSON,Date,Math,String,parseInt,isNaN};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(PKG+'/Code.gs','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),J=x=>JSON.parse(JSON.stringify(x));
const gget=a=>JSON.parse(run(`doGet({parameter:{action:'${a}'}})`).s).data;
const gpost=p=>JSON.parse(run(`doPost({postData:{contents:${JSON.stringify(JSON.stringify(p))}}})`).s);
let n=0;const ok=m=>console.log(String(++n).padStart(2)+' '+m+' OK');
const today=new Date().toISOString().slice(0,10);

// ===== 1. 엑셀 → 구글 시트 가져오기 재현 + 구조 계약 확인 =====
const dump=JSON.parse(fs.readFileSync(DUMP,'utf8'));
const tabs=J(run('[TAB_MASTER,TAB_WEEKLY,TAB_REALTIME,TAB_REQUEST]')), heads=J(run('[HEAD_MASTER,HEAD_WEEKLY,HEAD_REALTIME,HEAD_REQUEST]'));
tabs.forEach((t,i)=>{assert(dump[t],`엑셀에 "${t}" 탭이 없음`);assert.deepStrictEqual(dump[t][0],heads[i],`${t} 머리글 불일치`)});
ok('엑셀 탭 4개 이름·머리글이 Code.gs 기대값과 정확히 일치');
tabs.forEach(t=>{const s=sheets[t]=new Sheet();s.d=J(dump[t])});
const master=gget('getMaster'); assert.strictEqual(master.length,15);
assert.strictEqual(new Set(master.map(i=>i.name)).size,15); assert(master.every(i=>i.name&&i.loc&&i.spec&&Number.isInteger(i.par)&&Number.isInteger(i.stock)&&i.par>0&&i.stock>=0)); ok('엑셀 품목 15개를 API가 정상 해석(중복·빈 값·비숫자 없음)');
const expShort=m=>m.filter(i=>i.stock<i.par).map(i=>i.name).sort();
const names0=expShort(master); assert.strictEqual(names0.length,9);
assert.deepStrictEqual(gget('getRealtime').map(i=>i.name).sort(),names0); assert(!gget('getRealtime').some(i=>['알코올 솜','주사바늘 23G','무릎 보조기 M'].includes(i.name))); ok('실시간 재고 대장 = 부족 9개 (적정=현재인 3개는 제외)');

(async()=>{
 const b=await chromium.launch(),errs=[];
 const p=await b.newPage({viewport:{width:390,height:820}});p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await p.route('https://mock.local/**',async r=>{const q=r.request();let body;
  if(q.method()==='POST')body=run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s;
  else body=run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body})});
 const html=fs.readFileSync(PKG+'/index.html','utf8').replace('"SCRIPT_URL_HERE"','"https://mock.local/exec"');
 await p.setContent(html,{waitUntil:'load'});await p.waitForTimeout(400);
 const stats=async()=>p.locator('.stat b').allInnerTexts();

 // ===== 2. 앱 구동 =====
 assert.strictEqual(await p.innerText('#pillText'),'실시간 연결됨'); assert.deepStrictEqual(await stats(),['9','6','15']); ok('앱 구동: 실시간 연결됨, 부족9/정상6/전체15');
 for(const z of ['수술실','처치실','병동','물리치료실']) {await p.click(`[data-zone=${z}]`); assert.strictEqual(await p.locator('#list .card').count(),master.filter(i=>i.loc===z).length)} await p.click('[data-zone=전체]'); ok('구역 4개 필터가 시트 데이터와 일치');
 await p.fill('#q','장갑'); assert.strictEqual(await p.locator('#list .card').count(),2); await p.fill('#q',''); ok('검색 "장갑" → 2개');

 // ===== 3. 재고 파악(주간실사) =====
 await p.click('[data-tab=weekly]'); await p.click('[data-act=loadDraft]'); assert.strictEqual(await p.locator('input[data-act=draftin]').count(),15);
 for(const i of master) assert.strictEqual(+await p.locator(`input[data-name="${i.name}"]`).inputValue(),i.stock); ok('재고 파악: 15개 품목이 현재재고 값으로 채워져 불러와짐');
 const count={'멸균 수술장갑 7.0':12,'일회용 수술가운':18,'주사바늘 23G':2,'일회용 베드시트':14,'탄력붕대 4인치':30}; // 입고·사용 반영
 for(const [k,v] of Object.entries(count)) await p.locator(`input[data-name="${k}"]`).fill(String(v));
 await p.screenshot({path:OUT+'/full_weekly.png'});
 await p.click('[data-act=saveWeekly]'); await p.waitForTimeout(300);
 const m2=gget('getMaster'); for(const [k,v] of Object.entries(count)) assert.strictEqual(m2.find(i=>i.name===k).stock,v);
 assert.strictEqual(m2.find(i=>i.name==='알코올 솜').stock,20); ok('실사 저장 → 품목 마스터 현재재고 5건 갱신, 나머지 유지');
 const wk=gget('getWeekly'); assert.strictEqual(wk.length,15); assert(wk.every(r=>r.date===today)); assert.strictEqual(wk.find(r=>r.name==='주사바늘 23G').qty,2); ok('주간 재고 파악 탭에 15건 기록(오늘 날짜)');
 const exp1=expShort(m2); assert.deepStrictEqual(gget('getRealtime').map(i=>i.name).sort(),exp1);
 assert(exp1.includes('주사바늘 23G')&&!exp1.includes('멸균 수술장갑 7.0')&&!exp1.includes('일회용 베드시트')&&!exp1.includes('탄력붕대 4인치')); ok(`실시간 재고 대장 자동 갱신: 보충된 3개 제외, 새로 부족해진 주사바늘 포함 → 총 ${exp1.length}개`);
 await p.click('[data-tab=status]'); assert.deepStrictEqual(await stats(),[String(exp1.length),String(15-exp1.length),'15']); ok(`앱 현황 즉시 반영 (부족 ${exp1.length}/정상 ${15-exp1.length})`);

 // ===== 4. 청구서 생성 =====
 await p.click('[data-tab=request]'); const shown=await p.locator('.card .nm').allInnerTexts(); assert.deepStrictEqual(shown.sort(),exp1); ok(`청구 탭 후보 = 부족 ${exp1.length}개와 정확히 일치`);
 const def=n=>{const i=m2.find(x=>x.name===n);return i.par-i.stock};
 assert.strictEqual(+await p.locator('input[data-act=qtyin][data-name="봉합사 Vicryl 2-0"]').inputValue(),def('봉합사 Vicryl 2-0')); ok('기본 청구수량 = 적정재고 − 현재재고');
 await p.locator('[data-act=plus][data-name="봉합사 Vicryl 2-0"]').click(); await p.locator('[data-act=minus][data-name="초음파 젤"]').click();
 await p.locator('.cb[data-name="포비돈 용액 500ml"]').uncheck();
 await p.screenshot({path:OUT+'/full_request.png'});
 await p.click('[data-act=submitReq]'); await p.waitForTimeout(300);
 const rq=gget('getRequests'); assert.strictEqual(rq.length,1); const r1=rq[0]; assert.strictEqual(r1.date,today); assert.strictEqual(r1.items.length,exp1.length-1);
 assert(!r1.items.some(i=>i.name==='포비돈 용액 500ml')); const q=n=>r1.items.find(i=>i.name===n).qty;
 assert.strictEqual(q('봉합사 Vicryl 2-0'),def('봉합사 Vicryl 2-0')+1); assert.strictEqual(q('초음파 젤'),def('초음파 젤')-1); assert.strictEqual(q('일회용 주사기 5cc'),def('일회용 주사기 5cc'));
 assert(r1.items.every(i=>i.loc&&i.spec&&i.qty>=1)); ok(`청구서 제출 → 물품 청구서 탭 ${r1.items.length}행(체크 해제한 1개 제외), 조정 수량(+1/−1)·기본 수량 정확, 보관위치·규격 포함`);
 assert(!r1.items.some(i=>['알코올 솜','무릎 보조기 M'].includes(i.name))); ok('적정재고와 같은 품목은 청구서에 들어가지 않음');

 await p.click('[data-tab=status]'); assert.deepStrictEqual(await stats(),[String(exp1.length),String(15-exp1.length),'15']); ok('청구 후에도 재고 수치는 변하지 않음(청구는 입고가 아님)');

 // ===== 5. 구글 시트 PC 메뉴 흐름 =====
 run('createRequestFromMenu()'); const rq2=gget('getRequests'); assert.strictEqual(rq2.length,2); assert.notStrictEqual(rq2[0].id,rq2[1].id);
 assert.strictEqual(rq2[1].items.length,exp1.length); assert(rq2[1].items.every(i=>i.qty===def(i.name))); ok(`시트 메뉴 "물품 청구서 생성": ${exp1.length}개 전체 자동 청구, 청구번호 중복 없음`);
 run('weeklyInputFromMenu()'); assert.strictEqual(gget('getWeekly').length,30); assert(/15개 품목/.test(alerts.at(-1))); ok('시트 메뉴 "주간실사 자동입력": 15건 추가 입력(누적 30건)');
 // 신규 품목 추가 후 흐름
 assert(gpost({action:'addItem',name:'정형외과 석고붕대 4인치',loc:'처치실',spec:'Roll',par:20,stock:5}).success); assert(gget('getRealtime').some(i=>i.name==='정형외과 석고붕대 4인치'&&i.lack===15)); ok('신규 품목 추가 → 실시간 대장에 부족수량 15로 자동 등록');
 // 새로고침 후 상태
 await p.reload(); await p.waitForTimeout(100); await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(400);
 const mm=gget('getMaster'); assert.strictEqual(await p.locator('#list .card').count(),16); ok('앱 재접속: 시트의 최신 상태(16개) 그대로 표시');
 assert.deepStrictEqual(errs,[]); ok('브라우저 콘솔/페이지 오류 없음');
 await b.close();
 // 최종 시트 상태 저장 → 엑셀로 만들어 수식 검증
 fs.writeFileSync(OUT+'/final_state.json',JSON.stringify(Object.fromEntries(tabs.map(t=>[t,sheets[t].d.filter(r=>r&&r.some(x=>x!==''&&x!==undefined))])),null,0));
 console.log('\n전체 '+n+'개 통과');
})().catch(e=>{console.error('\n실패:',e.message);process.exit(1)});
