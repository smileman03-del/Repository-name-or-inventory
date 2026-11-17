// 거친 입력 시험: 잘못된 요청·특수문자·긴 이름·좁은 화면(320~768px)·HTML 주입
const fs=require('fs'),assert=require('assert');const {chromium}=require('playwright');
const createEnv=require('./gs_mock'); const PK=process.argv[2];
let n=0;const ok=m=>console.log(String(++n).padStart(2)+' '+m+' OK');
(async()=>{
// --- 잘못된 요청에도 서버가 죽지 않고 JSON 오류로 답하는지 ---
const e=createEnv(PK+'/Code.gs'); e.run('loadSampleData()');
const call=js=>{try{return JSON.parse(e.run(js).s)}catch(x){return {THREW:String(x.message||x)}}};
for(const [name,js] of [['doGet 인자 없음','doGet()'],['doGet 빈 객체','doGet({})'],['doPost 인자 없음','doPost()'],['doPost 본문 없음','doPost({})'],['doPost 깨진 JSON','doPost({postData:{contents:"{not json"}})'],
  ['doPost null','doPost({postData:{contents:"null"}})'],['saveWeekly rows가 문자열','doPost({postData:{contents:JSON.stringify({action:"saveWeekly",rows:"abc"})}})'],
  ['saveWeekly 품목명 없음','doPost({postData:{contents:JSON.stringify({action:"saveWeekly",rows:[{qty:3}]})}})'],['deleteItem 이름 없음','doPost({postData:{contents:JSON.stringify({action:"deleteItem"})}})'],
  ['submitRequest items 숫자','doPost({postData:{contents:JSON.stringify({action:"submitRequest",items:5})}})']]){
  const r=call(js); assert(!r.THREW,name+' → 예외로 죽음: '+r.THREW); assert.strictEqual(r.success,false,name+' → '+JSON.stringify(r)); }
ok('잘못된 요청 10종(인자 없음·깨진 JSON·엉뚱한 타입)에도 서버가 죽지 않고 "실패" JSON 으로 응답');
assert.strictEqual(e.get('getMaster').data.length,15); ok('잘못된 요청 후에도 데이터는 그대로');
// 특수문자 품목명
const odd=['A,B(쉼표)','"따옴표" 품목',"작은'따옴표",'<b>태그</b>','줄\n바꿈'];
odd.forEach((nm,i)=>assert(e.post({action:'addItem',name:nm,loc:'병동',spec:'EA',par:5,stock:1}).success));
const got=e.get('getMaster').data.map(i=>i.name); odd.forEach(nm=>assert(got.includes(nm.trim()),nm)); ok('쉼표·따옴표·HTML 태그·줄바꿈이 든 품목명도 저장·조회 가능');
// --- 앱: 긴 이름·특수문자·좁은 화면 ---
const e2=createEnv(PK+'/Code.gs'); e2.run('setupSheets()');
e2.paste('품목 마스터',2,[['<img src=x onerror=alert(1)> 위험한 이름','<script>1</script>구역','"규격"',10,1],['초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명초장문품목명','아주아주긴보관위치이름아주아주긴보관위치이름','Box(100개입 특대형 규격 설명이 매우 긴 경우)',9999999,3],['보통 품목','병동','EA',5,9]]);
const html=fs.readFileSync(PK+'/index.html','utf8').replace('"SCRIPT_URL_HERE"','"https://mock.local/exec"');
const b=await chromium.launch(); const errs=[]; const dialogs=[];
for(const w of [320,360,430,768]){
  const p=await b.newPage({viewport:{width:w,height:700}}); p.on('pageerror',x=>errs.push(x.message)); p.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
  await p.route('https://mock.local/**',async r=>{const q=r.request();let body=q.method()==='POST'?e2.run(`doPost({postData:{contents:${JSON.stringify(q.postData())}}})`).s:e2.run(`doGet({parameter:{action:'${new URL(q.url()).searchParams.get('action')}'}})`).s;r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body})});
  await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(300);
  for(const tab of ['status','request','weekly']){ await p.click(`[data-tab=${tab}]`); if(tab==='weekly') await p.click('[data-act=loadDraft]'); await p.waitForTimeout(100);
    const sw=await p.evaluate(()=>document.documentElement.scrollWidth), iw=await p.evaluate(()=>window.innerWidth);
    assert(sw<=iw+1,`${w}px 폭 ${tab} 탭에서 가로로 넘침 (scrollWidth ${sw} > ${iw})`); }
  if(w===320){ await p.click('[data-tab=status]'); await p.screenshot({path:(process.argv[3]||'/tmp')+'/narrow320.png'}); }
  await p.close();}
ok('화면 폭 320·360·430·768px × 탭 3개: 가로 넘침 없음(긴 품목명·긴 규격 포함)');
const p=await b.newPage({viewport:{width:390,height:800}}); await p.route('https://mock.local/**',async r=>{r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:e2.run(`doGet({parameter:{action:'getMaster'}})`).s})});
await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(300);
const injected=await p.evaluate(()=>document.querySelectorAll('#list img, #list script, main img').length); assert.strictEqual(injected,0); assert.strictEqual(dialogs.length,0);
assert(/<img src=x onerror=alert\(1\)>/.test(await p.innerText('#list'))); ok('품목명에 HTML/스크립트가 들어 있어도 실행되지 않고 글자 그대로 표시(주입 공격 차단)');
assert.deepStrictEqual(errs,[]); ok('전 과정 브라우저 오류 없음');
await b.close(); console.log('\n전체 '+n+'개 통과');
})().catch(e=>{console.error('\n실패:',e.message);process.exit(1)});
